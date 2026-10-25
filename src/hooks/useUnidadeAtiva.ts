/**
 * Loja (unidade) ativa do usuário, compartilhada pelo app inteiro.
 *
 * POR QUE É UM CONTEXTO (DP-3/G13). Antes cada chamada deste hook tinha o seu
 * estado e a sua consulta das vinculações: a troca de loja num lugar não valia
 * nos outros — o seletor trocava e a tela seguia na loja velha — e o painel
 * fazia uma consulta por instância. Duas formas foram comparadas:
 *
 * - **Contexto** (esta): o `UnidadeAtivaProvider` na raiz é o único dono do
 *   estado e da carga; quem lê, lê o mesmo valor. O provider deixa explícito
 *   quem carrega, quando (troca de conta) e com que valor inicial.
 * - **Store de módulo** (`useSyncExternalStore`): dispensa o provider, mas o
 *   estado de uma conta sobrevive no processo para a próxima (logout →
 *   login de outra pessoa), a carga não tem dono (quem dispara: o primeiro
 *   inscrito?) e o estado vaza entre testes.
 *
 * A troca de loja não precisa apagar cache: toda chave por loja já leva o
 * `unidadeId` (`CACHE_KEYS`, `useRotasCache`, `useCachedData`), e quem lê a
 * loja daqui recarrega quando ela muda. O que tem a loja dentro sem estar na
 * chave é o perfil (`usuarios.unidade_id`): a troca avisa `profileEvents`, e
 * todas as instâncias de `useUser` recarregam — numa consulta só.
 *
 * Sem provider, `useUnidadeAtiva` falha alto: um estado próprio silencioso era
 * exatamente o defeito.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useUser } from './useUser';
import { logger } from '../lib/logger';
import { emitProfileUpdate } from '../lib/profileEvents';
import { SELECT_UNIDADE_APP } from '../lib/queries/colunasUnidade';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UsuarioUnidade, UnidadeComSede } from '../types/usuario';

/** Loja escolhida no aparelho (limpa no logout: `limparEstadoLocal`). */
const STORAGE_KEY = '@rotamestre:unidade_ativa';

type VinculacaoComUnidade = UsuarioUnidade & {
  unidades: UnidadeComSede | UnidadeComSede[] | null;
};

export interface UseUnidadeAtivaReturn {
  /** ID da unidade ativa atual */
  unidadeAtiva: string | null;
  /** Dados completos da unidade ativa (inclui campos de sede) */
  unidadeAtivaData: UnidadeComSede | null;
  /** Todas as vinculações do usuário com unidades */
  vinculacoes: UsuarioUnidade[];
  /** Se o usuário tem múltiplas unidades */
  temMultiplasUnidades: boolean;
  /** Papel do usuário na unidade ativa */
  papelNaUnidadeAtiva: 'gestor' | 'motorista' | null;
  /** Se está carregando */
  loading: boolean;
  /** Trocar para outra unidade */
  trocarUnidade: (unidadeId: string) => Promise<void>;
  /** Recarregar vinculações */
  refresh: () => Promise<void>;
}

/** Estado de UMA conta: `dono` é o usuário a que ele pertence. */
interface EstadoDaConta {
  dono: string | null;
  unidadeAtiva: string | null;
  vinculacoes: UsuarioUnidade[];
}

const SEM_VINCULACOES: UsuarioUnidade[] = [];

const UnidadeAtivaContext = createContext<UseUnidadeAtivaReturn | null>(null);

/** Dono do estado da loja ativa. Montado uma vez, na raiz (`app/_layout.tsx`). */
export function UnidadeAtivaProvider({ children }: { children: ReactNode }) {
  const valor = useEstadoUnidadeAtiva();
  return createElement(UnidadeAtivaContext.Provider, { value: valor }, children);
}

/** Loja ativa compartilhada. Exige o `UnidadeAtivaProvider` acima. */
export function useUnidadeAtiva(): UseUnidadeAtivaReturn {
  const valor = useContext(UnidadeAtivaContext);
  if (!valor) {
    throw new Error(
      'useUnidadeAtiva precisa do UnidadeAtivaProvider acima na árvore (app/_layout.tsx).',
    );
  }
  return valor;
}

function useEstadoUnidadeAtiva(): UseUnidadeAtivaReturn {
  const { userData } = useUser();
  const userId = userData?.id ?? null;
  const [estado, setEstado] = useState<EstadoDaConta>({
    dono: null,
    unidadeAtiva: null,
    vinculacoes: SEM_VINCULACOES,
  });
  const [carregando, setCarregando] = useState(true);
  // Só a carga mais recente escreve (troca de conta com outra em voo).
  const requisicaoRef = useRef(0);

  const loadVinculacoes = useCallback(async () => {
    const minha = ++requisicaoRef.current;
    const vigente = () => minha === requisicaoRef.current;
    const aplicar = (unidadeAtiva: string | null, vinculacoes: UsuarioUnidade[]) => {
      if (vigente()) setEstado({ dono: userId, unidadeAtiva, vinculacoes });
    };

    if (!userId) {
      aplicar(null, SEM_VINCULACOES);
      setCarregando(false);
      return;
    }

    try {
      setCarregando(true);

      // For E2E/CI: Return mock vinculações
      if (!isSupabaseConfigured) {
        const mockUnidadeId = 'mock-unidade-id';
        const isGestor = userData?.papel === 'gestor';

        const mockVinculacoes: UsuarioUnidade[] = [{
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
            endereco: 'Rua Teste, 123',
            telefone: '11999999999',
            email: 'teste@unidade.com',
            ativa: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sede_latitude: -23.5505,
            sede_longitude: -46.6333,
            sede_endereco: 'Rua Teste, 123 - São Paulo',
            uf: 'SP',
            cep: '01310-100'
          } as UnidadeComSede
        }];

        aplicar(mockUnidadeId, mockVinculacoes);
        return;
      }

      const { data, error } = await supabase
        .from('usuario_unidades')
        .select(`
          id,
          usuario_id,
          unidade_id,
          papel,
          is_principal,
          ativo,
          created_at,
          unidades(${SELECT_UNIDADE_APP})
        `)
        .eq('usuario_id', userId)
        .eq('ativo', true)
        .order('created_at', { ascending: true })
        .returns<VinculacaoComUnidade[]>();

      if (error) {
        logger.error('[UnidadeAtiva] Erro ao carregar vinculações:', error);
        // Fallback: usar unidade_id do usuário se existir
        aplicar(userData?.unidade_id ?? null, SEM_VINCULACOES);
        return;
      }

      const vinculacoesNormalizadas = (data || []).map((vinculo) => ({
        ...vinculo,
        unidades: Array.isArray(vinculo.unidades) ? vinculo.unidades[0] : vinculo.unidades,
      }));

      // Determinar unidade ativa
      if (vinculacoesNormalizadas.length > 0) {
        // Tentar recuperar do AsyncStorage
        const storedUnidadeId = await AsyncStorage.getItem(STORAGE_KEY);

        // Verificar se a unidade armazenada ainda é válida
        const unidadeValida = vinculacoesNormalizadas.find(
          (v) => v.unidade_id === storedUnidadeId
        );

        if (unidadeValida) {
          aplicar(storedUnidadeId, vinculacoesNormalizadas);
        } else {
          // Usar a primeira unidade disponível ou a que tem is_principal
          const principal = vinculacoesNormalizadas.find((v) => v.is_principal);
          const primeiraUnidade = principal || vinculacoesNormalizadas[0];
          aplicar(primeiraUnidade.unidade_id, vinculacoesNormalizadas);
          if (vigente()) {
            await AsyncStorage.setItem(STORAGE_KEY, primeiraUnidade.unidade_id);
          }
        }
      } else {
        // Fallback para unidade_id legado
        const legado = userData?.unidade_id ?? null;
        aplicar(legado, SEM_VINCULACOES);
        if (legado && vigente()) {
          await AsyncStorage.setItem(STORAGE_KEY, legado);
        }
      }
    } catch (error) {
      logger.error('[UnidadeAtiva] Erro ao carregar vinculações:', error);
      // Fallback
      aplicar(userData?.unidade_id ?? null, SEM_VINCULACOES);
    } finally {
      if (vigente()) setCarregando(false);
    }
  }, [userId, userData?.unidade_id, userData?.papel]);

  // O estado só vale para a conta a que pertence: na troca de conta, até a
  // carga da nova chegar, nada da anterior responde por ela.
  const daConta = estado.dono === userId;
  const unidadeAtiva = daConta ? estado.unidadeAtiva : null;
  const vinculacoes = daConta ? estado.vinculacoes : SEM_VINCULACOES;
  const loading = carregando || (!!userId && !daConta);

  // Trocar de unidade ativa
  const trocarUnidade = useCallback(async (unidadeId: string) => {
    if (!userId) return;

    // Verificar se o usuário tem acesso a essa unidade
    const temAcesso = vinculacoes.some(v => v.unidade_id === unidadeId);
    if (!temAcesso) {
      logger.error('[UnidadeAtiva] Usuário não tem acesso a essa unidade');
      return;
    }

    try {
      // Salvar no AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, unidadeId);

      // Atualizar o cache no banco (usuarios.unidade_id)
      const { error } = await supabase
        .from('usuarios')
        .update({ unidade_id: unidadeId })
        .eq('id', userId);

      if (error) {
        logger.error('[UnidadeAtiva] Erro ao atualizar unidade ativa no banco:', error);
      }

      // Atualizar estado compartilhado: vale em todas as telas.
      setEstado((anterior) =>
        anterior.dono === userId ? { ...anterior, unidadeAtiva: unidadeId } : anterior,
      );

      // O perfil guarda a loja (`usuarios.unidade_id`): todas as instâncias
      // de useUser recarregam, numa consulta só (busca compartilhada).
      emitProfileUpdate();
    } catch (error) {
      logger.error('[UnidadeAtiva] Erro ao trocar unidade:', error);
    }
  }, [userId, vinculacoes]);

  // Carregar vinculações quando a conta mudar
  useEffect(() => {
    loadVinculacoes();
  }, [loadVinculacoes]);

  // Derivar dados da unidade ativa
  const vinculacaoAtiva = vinculacoes.find(v => v.unidade_id === unidadeAtiva);
  const unidadeAtivaData = vinculacaoAtiva?.unidades || userData?.unidades || null;
  const papelNaUnidadeAtiva = vinculacaoAtiva?.papel || userData?.papel || null;
  const temMultiplasUnidades = vinculacoes.length > 1;

  // Valor memoizado: consumidor que usa o objeto (ou um campo) em dependência
  // de efeito não pode receber um objeto novo a cada render do provider.
  return useMemo(
    () => ({
      unidadeAtiva,
      unidadeAtivaData,
      vinculacoes,
      temMultiplasUnidades,
      papelNaUnidadeAtiva,
      loading,
      trocarUnidade,
      refresh: loadVinculacoes,
    }),
    [
      unidadeAtiva,
      unidadeAtivaData,
      vinculacoes,
      temMultiplasUnidades,
      papelNaUnidadeAtiva,
      loading,
      trocarUnidade,
      loadVinculacoes,
    ],
  );
}
