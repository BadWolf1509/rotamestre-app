import { useCallback, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from './useAuth';
import { classificarFalhaPerfil } from '../lib/auth/falhaPerfil';
import {
  apagarPerfilConhecido,
  gravarPerfilConhecido,
  lerPerfilConhecido,
} from '../lib/auth/perfilConhecido';
import { exigirSessaoDe } from '../lib/auth/sessao';
import {
  getCache,
  setCache,
  clearCache,
  CACHE_TTL,
  CACHE_KEYS,
} from '../lib/cache';
import { logger } from '../lib/logger';
import { initializePushNotifications } from '../lib/notifications';
import { onProfileUpdate } from '../lib/profileEvents';
import { SELECT_UNIDADE_APP } from '../lib/queries/colunasUnidade';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Usuario } from '../types/usuario';

/**
 * Por que o perfil não está disponível, quando `userData` é null sem ser
 * "sem perfil": 'conexao' = falha transitória sem perfil conhecido; 'erro' =
 * falha de verdade (4xx de schema/permissão), que não usa perfil velho.
 */
export type PerfilIndisponivel = 'conexao' | 'erro' | null;

/**
 * Busca do perfil compartilhada entre as instâncias (DP-3).
 *
 * POR QUE EXISTE. Layout, cabeçalho, tela e cada hook que chama `useUser`
 * (inclusive `useUnidadeAtiva`) faziam a sua consulta — o painel do gestor
 * abria com várias idênticas. Duas formas foram comparadas:
 *
 * - **Contexto** (um `UserProvider` na raiz): um estado só, mas muda o
 *   contrato de 31 consumidores e de dezenas de testes, e o estado deste hook
 *   é delicado (perfil conhecido offline, troca de conta A→B, janela do
 *   onboarding sem perfil) — tudo testado por instância.
 * - **Busca compartilhada** (esta): cada instância mantém o seu estado, mas a
 *   ida à rede é uma só enquanto está em voo. As instâncias ficam em sincronia
 *   pelo `profileEvents`, que dispara todas juntas — e, com isto, numa
 *   consulta só.
 *
 * Escolhida a segunda: tira a consulta repetida, que era o defeito, sem mexer
 * no estado. Refresh forçado não pega carona numa busca comum já em voo: ela
 * pode ter saído antes da gravação que motivou o refresh.
 *
 * **Todo resultado fresco chega a todas as instâncias da conta** (revisão da
 * tarefa 7, C1). O `UnidadeAtivaProvider` mora na raiz e nunca desmonta: a
 * instância dele buscava o perfil uma vez — "sem linha", no cadastro — e o
 * gestor entrava no painel sem loja depois do onboarding. Comparadas duas
 * formas: (a) cada ponto que muda o perfil emite `profileEvents` — explícito,
 * mas o ponto novo que esquecer reabre o defeito; (b) a busca avisa todas as
 * instâncias da conta. A (b) corrige a classe: qualquer busca, de qualquer
 * tela, atualiza também a raiz. Os pontos conhecidos emitem o evento mesmo
 * assim (a), para não depender de outra tela buscar.
 *
 * Cada busca leva um número de sequência: a instância nunca troca um
 * resultado mais novo por um mais velho. A busca de uma conta que saiu
 * (logout, troca) é esquecida e não avisa ninguém: um login novo da mesma
 * conta não reaproveita a promessa de antes dele (que pode voltar sem sessão).
 */
export interface ResultadoDePerfil {
  seq: number;
  perfil: Usuario | null;
}
interface BuscaDePerfilEmVoo {
  promessa: Promise<ResultadoDePerfil>;
  forcada: boolean;
  esquecida: boolean;
}
type OuvinteDePerfil = (resultado: ResultadoDePerfil) => void;

const buscasDePerfilEmVoo = new Map<string, BuscaDePerfilEmVoo>();
const ouvintesDePerfil = new Map<string, Set<OuvinteDePerfil>>();
let sequenciaDeBuscas = 0;

function buscarPerfilCompartilhado(
  userId: string,
  forcada: boolean,
  buscar: () => Promise<Usuario | null>,
): Promise<ResultadoDePerfil> {
  const emVoo = buscasDePerfilEmVoo.get(userId);
  if (emVoo && (emVoo.forcada || !forcada)) return emVoo.promessa;

  const seq = ++sequenciaDeBuscas;
  const entrada: BuscaDePerfilEmVoo = {
    promessa: Promise.resolve({ seq, perfil: null }),
    forcada,
    esquecida: false,
  };
  entrada.promessa = buscar()
    .then((perfil) => {
      const resultado = { seq, perfil };
      if (!entrada.esquecida) {
        ouvintesDePerfil.get(userId)?.forEach((ouvir) => ouvir(resultado));
      }
      return resultado;
    })
    .finally(() => {
      if (buscasDePerfilEmVoo.get(userId) === entrada) {
        buscasDePerfilEmVoo.delete(userId);
      }
    });
  buscasDePerfilEmVoo.set(userId, entrada);
  return entrada.promessa;
}

/** Só para testes: volta ao estado de processo novo (sem busca em voo). */
export function reiniciarBuscasDePerfil(): void {
  buscasDePerfilEmVoo.forEach((entrada) => {
    entrada.esquecida = true;
  });
  buscasDePerfilEmVoo.clear();
}

/** A conta saiu desta tela (logout, troca): a busca dela não vale mais. */
function esquecerBuscaDePerfil(userId: string): void {
  const entrada = buscasDePerfilEmVoo.get(userId);
  if (!entrada) return;
  entrada.esquecida = true;
  buscasDePerfilEmVoo.delete(userId);
}

function ouvirPerfil(userId: string, ouvir: OuvinteDePerfil): () => void {
  const ouvintes = ouvintesDePerfil.get(userId) ?? new Set<OuvinteDePerfil>();
  ouvintes.add(ouvir);
  ouvintesDePerfil.set(userId, ouvintes);
  return () => {
    ouvintes.delete(ouvir);
    if (ouvintes.size === 0) ouvintesDePerfil.delete(userId);
  };
}

export function useUser() {
  const { user, loading: authLoading, usuarioOfflineId = null } = useAuth();
  // Offline (token vencido sem rede) não há `user`, mas há o dono do aparelho:
  // o perfil dele vem do perfil conhecido (a busca falha sem sessão).
  const userId = user?.id ?? usuarioOfflineId ?? null;
  // Muda quando a sessão volta: recarrega sozinho com a busca fresca.
  const sessaoAtiva = !!user;
  const [userData, setUserData] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [perfilIndisponivel, setPerfilIndisponivel] =
    useState<PerfilIndisponivel>(null);
  const userIdRef = useRef<string | null>(userId);
  // Geração da carga desta instância: a mais nova vence. Antes um booleano
  // (`fetchingRef`) fazia o refresh com carga em voo ser simplesmente
  // ignorado — a tela ficava com o perfil de antes da gravação.
  const geracaoRef = useRef(0);
  // Conta da carga em voo (null = nenhuma).
  const carregandoDeRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const userDataRef = useRef<Usuario | null>(null);
  // Sequência do último resultado fresco aplicado: nada mais velho o troca.
  const ultimoSeqRef = useRef(0);

  const fetchUserData = useCallback(async (): Promise<Usuario | null> => {
    if (!userId) return null;

    // For E2E/CI: Return mock user data
    if (!isSupabaseConfigured) {
      const isGestor = userId.includes('gestor');
      const mockUnidadeId = 'mock-unidade-id';

      return {
        id: userId,
        email: isGestor
          ? 'gestor.test@rotamestre.tec.br'
          : 'motorista.test@rotamestre.tec.br',
        nome: isGestor ? 'Gestor Teste' : 'Motorista Teste',
        papel: isGestor ? 'gestor' : 'motorista',
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unidade_id: mockUnidadeId,
        unidades: {
          id: mockUnidadeId,
          nome: 'Unidade Teste',
          cidade: 'São Paulo',
          ativa: true,
          sede_latitude: -23.5505,
          sede_longitude: -46.6333,
        } as any,
        usuario_unidades: [
          {
            id: 'vinculo-mock-1',
            usuario_id: userId,
            unidade_id: mockUnidadeId,
            papel: isGestor ? 'gestor' : 'motorista',
            is_principal: true,
            ativo: true,
            created_at: new Date().toISOString(),
            unidades: {
              id: mockUnidadeId,
              nome: 'Unidade Teste',
              cidade: 'São Paulo',
              ativa: true,
            },
          },
        ],
      } as Usuario;
    }

    // Sem sessão a query sai anônima e a RLS devolve 0 linhas, lidas como
    // "sem perfil" — ver `exigirSessaoDe`. Falha transitória, então.
    await exigirSessaoDe(userId);

    const { data, error } = await supabase
      .from('usuarios')
      .select(
        `
        *,
        unidades(${SELECT_UNIDADE_APP}),
        usuario_unidades(
          id,
          usuario_id,
          unidade_id,
          papel,
          is_principal,
          ativo,
          created_at,
          unidades(id, nome, cidade, ativa)
        )
      ` as const,
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Fallback para query simples (evita falhas por RLS em joins)
      logger.warn(
        '[useUser] Query completa falhou, tentando fallback simples',
        error,
      );
      const {
        data: basicData,
        error: basicError,
        status: basicStatus,
      } = await supabase
        .from('usuarios')
        .select(`*, unidades(${SELECT_UNIDADE_APP})` as const)
        .eq('id', userId)
        .maybeSingle();

      if (basicError) throw classificarFalhaPerfil(basicError, basicStatus);
      if (!basicData) {
        await exigirSessaoDe(userId); // o null só vale autenticado
        return null;
      }

      return {
        ...basicData,
        usuario_unidades: basicData?.usuario_unidades ?? [],
      } as Usuario;
    }

    // `data` nulo aqui não é falha: é a janela do onboarding, em que a conta já
    // existe no Auth mas o perfil ainda vai nascer na RPC. `.maybeSingle()`
    // devolve isso como data:null/error:null em vez do 406 + PGRST116 que o
    // `.single()` produzia — e que o catch de loadUserData registrava como erro.
    // Mas só vale autenticado: a sessão pode ter caído durante a busca.
    if (!data) await exigirSessaoDe(userId);
    return data;
  }, [userId]);

  const loadUserData = useCallback(
    async (forceRefresh = false) => {
      // Aguardar auth estar pronto antes de fazer queries (evita 406)
      if (authLoading) return;

      if (!userId) {
        // Logout: a carga em voo da conta que saiu deixa de valer — senão o
        // login seguinte da MESMA conta seria pulado como "já em voo".
        geracaoRef.current += 1;
        carregandoDeRef.current = null;
        setUserData(null);
        setPerfilIndisponivel(null);
        setLoading(false);
        return;
      }

      // Carga comum com outra em voo DA MESMA conta: a que está em voo já
      // serve. Refresh (forçado) e troca de conta sempre rodam e passam à frente.
      if (carregandoDeRef.current === userId && !forceRefresh) return;
      const minha = ++geracaoRef.current;
      const vigente = () => minha === geracaoRef.current;
      carregandoDeRef.current = userId;

      const cacheKey = CACHE_KEYS.USER_DATA(userId);
      // O que a tela já mostra, mas só se for DESTA conta: na troca A→B o
      // estado ainda guarda o perfil de A, que não pode responder por B.
      let exibido: Usuario | null =
        userDataRef.current?.id === userId ? userDataRef.current : null;

      try {
        // 1. Verificar cache primeiro (se não for refresh forçado)
        // IMPORTANTE: Não definir loading=false do cache para evitar que
        // outros componentes façam queries antes da sessão Supabase estar validada
        if (!forceRefresh) {
          const cached = await getCache<Usuario>(cacheKey);
          // Conta conferida DEPOIS do await: um logout durante a leitura do
          // cache não pode aplicar o perfil de quem saiu.
          if (
            cached !== null &&
            mountedRef.current &&
            vigente() &&
            userIdRef.current === userId
          ) {
            setUserData(cached);
            setFromCache(true);
            exibido = cached;
            // NÃO definir loading=false aqui - aguardar query Supabase validar sessão
          }
        }

        // 2. Buscar dados frescos (valida que a sessão Supabase está funcionando)
        const { seq, perfil: freshData } = await buscarPerfilCompartilhado(
          userId,
          forceRefresh,
          fetchUserData,
        );
        // A conta mudou (logout, troca) durante a busca: a resposta é de quem
        // saiu e não pode virar estado nem perfil conhecido.
        if (userIdRef.current !== userId) return;
        // Um refresh desta instância saiu depois: a resposta dele é que vale.
        if (!vigente()) return;
        // Resultado mais novo (de outra tela) já aplicado pelo ouvinte.
        if (seq < ultimoSeqRef.current) return;
        ultimoSeqRef.current = seq;

        if (freshData && mountedRef.current) {
          setUserData(freshData);
          setFromCache(false);
          setPerfilIndisponivel(null);
          await setCache(cacheKey, freshData, CACHE_TTL.USER_DATA);
          await gravarPerfilConhecido(freshData);
        } else if (!freshData && mountedRef.current) {
          // Sem linha em `usuarios` — perfil ainda não criado (onboarding) ou não
          // visível para este usuário. É estado real, não erro: reflita-o e não
          // deixe um perfil antigo em cache responder por ele.
          setUserData(null);
          setFromCache(false);
          setPerfilIndisponivel(null);
          await clearCache(cacheKey);
          await apagarPerfilConhecido(userId);
        }
      } catch (error) {
        // Falha não é "sem perfil": stale-if-error. O que já está na tela
        // (cache de 5 min, mesma conta) segue valendo. O perfil conhecido, que
        // não expira, só responde por falha TRANSITÓRIA (rede, 5xx, token):
        // 4xx de schema/permissão é defeito e não pode ficar escondido atrás
        // de um perfil velho para sempre.
        const falha = classificarFalhaPerfil(error);
        if (falha.transitoria) {
          logger.warn(
            `[useUser] Perfil indisponível (transitório; status=${falha.status}, code=${falha.code})`,
            falha.causa ?? falha,
          );
        } else {
          logger.error('Error loading user data:', error);
        }
        const conhecido =
          exibido ??
          (falha.transitoria ? await lerPerfilConhecido(userId) : null);
        if (mountedRef.current && userIdRef.current === userId && vigente()) {
          setUserData(conhecido);
          setFromCache(conhecido !== null);
          setPerfilIndisponivel(
            conhecido ? null : falha.transitoria ? 'conexao' : 'erro',
          );
        }
      } finally {
        if (vigente()) {
          carregandoDeRef.current = null;
          if (mountedRef.current) setLoading(false);
        }
      }
    },
    // `sessaoAtiva`: offline → online recarrega sem esperar o "Tentar novamente".
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authLoading, userId, sessaoAtiva, fetchUserData],
  );

  // Sincronizar ref com state para evitar stale closure
  useEffect(() => {
    userDataRef.current = userData;
  }, [userData]);

  // Conta anterior desta instância: ao trocar (logout, outra conta), a busca
  // dela em voo é esquecida (não avisa ninguém, nenhum login novo a reusa).
  const contaAnteriorRef = useRef<string | null>(userId);
  useEffect(() => {
    const anterior = contaAnteriorRef.current;
    if (anterior && anterior !== userId) esquecerBuscaDePerfil(anterior);
    contaAnteriorRef.current = userId;
    userIdRef.current = userId;
  }, [userId]);

  // Resultado fresco de QUALQUER instância da conta chega a esta (C1).
  useEffect(() => {
    if (!userId) return;
    return ouvirPerfil(userId, ({ seq, perfil }) => {
      if (!mountedRef.current || userIdRef.current !== userId) return;
      if (seq <= ultimoSeqRef.current) return;
      ultimoSeqRef.current = seq;
      setUserData(perfil);
      setFromCache(false);
      setPerfilIndisponivel(null);
      setLoading(false);
    });
  }, [userId]);

  // Carregar dados quando userId ou authLoading mudar
  useEffect(() => {
    mountedRef.current = true;
    loadUserData();

    return () => {
      mountedRef.current = false;
    };
  }, [loadUserData]);

  // Invalidar cache quando logout
  useEffect(() => {
    if (!userId && userData) {
      clearCache(CACHE_KEYS.USER_DATA(userData.id));
    }
  }, [userId, userData]);

  // Registrar push token quando usuário carregar (mobile only)
  const pushTokenRegistered = useRef(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Registrar token quando usuário estiver carregado
    if (userData?.id && !pushTokenRegistered.current) {
      pushTokenRegistered.current = true;
      initializePushNotifications(userData.id).catch((error) => {
        logger.error('[Push] Erro ao inicializar push:', error);
      });
    }

    // Remover token quando logout
    if (!userId && pushTokenRegistered.current) {
      pushTokenRegistered.current = false;
      // A remoção do token mora em authService.signOut, que roda antes de a
      // sessão sumir (aqui ela já sumiu e o UPDATE iria anônimo).
    }
  }, [userData?.id, userId]);

  // Verificar se tem múltiplas unidades
  const vinculacoes = userData?.usuario_unidades?.filter((v) => v.ativo) || [];
  const temMultiplasUnidades = vinculacoes.length > 1;

  // Refresh forçando busca na API (ignorando cache)
  const refresh = useCallback(() => loadUserData(true), [loadUserData]);

  // Escutar eventos de atualização de perfil (ex: foto alterada)
  useEffect(() => {
    const unsubscribe = onProfileUpdate(() => {
      logger.info('[useUser] Perfil atualizado, recarregando dados...');
      loadUserData(true);
    });
    return unsubscribe;
  }, [loadUserData]);

  return {
    userData,
    loading: authLoading || loading, // ✅ Inclui authLoading para evitar queries prematuras
    fromCache, // ✅ Indica se dados vieram do cache
    perfilIndisponivel,
    isGestor: userData?.papel === 'gestor',
    isMotorista: userData?.papel === 'motorista',
    unidade: userData?.unidades,
    // NOVO: Suporte a múltiplas unidades
    vinculacoes,
    temMultiplasUnidades,
    refresh,
  };
}
