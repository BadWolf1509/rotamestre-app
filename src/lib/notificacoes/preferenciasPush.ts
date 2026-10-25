/**
 * Preferências de push da conta: banco (`preferencias_notificacao`, Migration
 * 47) com cópia e pendência no aparelho.
 *
 * POR QUE EXISTE. Os interruptores das Configurações só gravavam no
 * AsyncStorage, e a Edge Function `send-push-notification` nunca soube deles:
 * o push chegava igual. Agora ela consulta o banco antes de enviar.
 *
 * DESENHO.
 * - O banco é a fonte; o aparelho guarda a última cópia (`…:<uid>`) para a
 *   tela abrir sem rede e sem esperar a rede.
 * - Sem rede, a escolha não se perde: fica na cópia, marcada como pendente,
 *   e sobe na próxima sincronização (antes da leitura, para o servidor não
 *   desfazer o que a pessoa escolheu offline). Alternativa descartada:
 *   desfazer o interruptor quando a gravação falha — o motorista sem sinal
 *   perderia a escolha e teria de lembrar de refazê-la.
 * - O valor antigo do AsyncStorage (chaves de antes da Migration 47) migra
 *   UMA vez: se a conta ainda não tem linha, ele sobe; tenha ou não, as
 *   chaves antigas são apagadas depois de lidas.
 * - Nada aqui lança: falha vira `logger.warn` e o melhor valor conhecido.
 *
 * As chaves `@rotamestre:preferencias_push…` ficam fora do "Limpar Cache"
 * (`limpezaDeCache.ts`): a pendência só existe no aparelho.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { classificarFalhaPerfil } from '@/lib/auth/falhaPerfil';
import { logger } from '@/lib/logger';
import { semRedeConfirmada } from '@/lib/semRede';
import { supabase } from '@/lib/supabase';
import type { PreferenciasNotificacao } from '@/types/notifications';

/** Aviso das telas quando a escolha ficou só no aparelho por falta de rede. */
export const AVISO_PREFERENCIA_SEM_REDE =
  'Sem conexão. A preferência ficou salva e vale assim que a conexão voltar.';

/** Aviso quando o servidor respondeu e recusou (tabela ausente, permissão). */
export const AVISO_PREFERENCIA_RECUSADA =
  'O servidor recusou a preferência. Ela ficou salva neste aparelho e será enviada de novo na próxima vez que você abrir esta tela.';

/** Por que a escolha ficou só no aparelho. */
export type MotivoNaoSincronizado = 'sem_rede' | 'recusado';

export type ResultadoDaGravacao =
  | { sincronizado: true }
  | { sincronizado: false; motivo: MotivoNaoSincronizado };

/** O toast que a tela mostra para o resultado (null = nada a dizer). */
export function avisoDaGravacao(
  resultado: ResultadoDaGravacao,
): { mensagem: string; tipo: 'info' | 'error' } | null {
  if (resultado.sincronizado) return null;
  return resultado.motivo === 'recusado'
    ? { mensagem: AVISO_PREFERENCIA_RECUSADA, tipo: 'error' }
    : { mensagem: AVISO_PREFERENCIA_SEM_REDE, tipo: 'info' };
}

export const PREFERENCIAS_PADRAO: PreferenciasNotificacao = {
  push_ativo: true,
  incidentes: true,
  rotas: true,
  resumo_diario: true,
};

const TABELA = 'preferencias_notificacao';
const COLUNAS = 'push_ativo, incidentes, rotas, resumo_diario';

export const PREFIXO_PREFERENCIAS_PUSH = '@rotamestre:preferencias_push';
const chaveCopia = (uid: string) => `${PREFIXO_PREFERENCIAS_PUSH}:${uid}`;
const chavePendente = (uid: string) =>
  `${PREFIXO_PREFERENCIAS_PUSH}_pendente:${uid}`;

/**
 * Chaves de antes da Migration 47, por coluna (a primeira presente vale).
 * Motorista: só o push geral. Gestor: as quatro.
 */
export const CHAVES_LEGADAS: Record<keyof PreferenciasNotificacao, string[]> = {
  push_ativo: [
    '@rotamestre:notifications_enabled',
    '@rotamestre:gestor:notifications_enabled',
  ],
  incidentes: ['@rotamestre:gestor:incident_alerts'],
  rotas: ['@rotamestre:gestor:route_updates'],
  resumo_diario: ['@rotamestre:gestor:daily_summary'],
};

export type OrigemDasPreferencias = 'servidor' | 'aparelho' | 'padrao';

function normalizar(bruto: unknown): PreferenciasNotificacao | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const o = bruto as Record<string, unknown>;
  // Só `false` explícito desliga, como na Edge Function.
  return {
    push_ativo: o.push_ativo !== false,
    incidentes: o.incidentes !== false,
    rotas: o.rotas !== false,
    resumo_diario: o.resumo_diario !== false,
  };
}

async function lerDisco(chave: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(chave);
  } catch (error) {
    logger.warn('[PreferenciasPush] Falha ao ler o aparelho', error);
    return null;
  }
}

async function gravarDisco(chave: string, valor: string): Promise<void> {
  try {
    await AsyncStorage.setItem(chave, valor);
  } catch (error) {
    logger.warn('[PreferenciasPush] Falha ao gravar no aparelho', error);
  }
}

async function apagarDisco(chave: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(chave);
  } catch (error) {
    logger.warn('[PreferenciasPush] Falha ao apagar do aparelho', error);
  }
}

async function lerCopia(uid: string): Promise<PreferenciasNotificacao | null> {
  const texto = await lerDisco(chaveCopia(uid));
  if (!texto) return null;
  try {
    return normalizar(JSON.parse(texto));
  } catch {
    // Cópia corrompida: ignorada; o servidor ou o padrão a substituem.
    return null;
  }
}

/** Valores antigos presentes no aparelho (null se não houver nenhum). */
async function lerLegado(): Promise<Partial<PreferenciasNotificacao> | null> {
  const parcial: Partial<PreferenciasNotificacao> = {};
  let achou = false;
  for (const coluna of Object.keys(CHAVES_LEGADAS) as Array<
    keyof PreferenciasNotificacao
  >) {
    for (const chave of CHAVES_LEGADAS[coluna]) {
      const v = await lerDisco(chave);
      if (v !== null) {
        parcial[coluna] = v !== 'false';
        achou = true;
        break;
      }
    }
  }
  return achou ? parcial : null;
}

async function apagarLegado(): Promise<void> {
  await Promise.all(
    Object.values(CHAVES_LEGADAS)
      .flat()
      .map((k) => apagarDisco(k)),
  );
}

// Rede × recusa pelo status HTTP (`classificarFalhaPerfil`: status 0, 408,
// 429, 5xx e exceção do fetch são transitórios), não pela mensagem do erro,
// que muda com a plataforma (`isNetworkError` adivinha pelo texto).
async function enviarAoServidor(
  uid: string,
  preferencias: PreferenciasNotificacao,
): Promise<ResultadoDaGravacao> {
  if (await semRedeConfirmada()) {
    return { sincronizado: false, motivo: 'sem_rede' };
  }
  try {
    const { error, status } = await supabase.from(TABELA).upsert(
      {
        usuario_id: uid,
        ...preferencias,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'usuario_id' },
    );
    if (error) {
      const transitoria = classificarFalhaPerfil(error, status).transitoria;
      logger.warn(
        transitoria
          ? '[PreferenciasPush] Sem resposta do servidor ao gravar'
          : '[PreferenciasPush] Servidor recusou a gravação',
        error,
      );
      return {
        sincronizado: false,
        motivo: transitoria ? 'sem_rede' : 'recusado',
      };
    }
    return { sincronizado: true };
  } catch (error) {
    const transitoria = classificarFalhaPerfil(error).transitoria;
    logger.warn('[PreferenciasPush] Falha ao gravar', error);
    return {
      sincronizado: false,
      motivo: transitoria ? 'sem_rede' : 'recusado',
    };
  }
}

/**
 * O que o aparelho sabe, sem rede: a cópia da conta ou, na falta dela, os
 * valores antigos sobre o padrão. null = nada no aparelho.
 */
export async function lerPreferenciasLocais(
  uid: string,
): Promise<PreferenciasNotificacao | null> {
  const copia = await lerCopia(uid);
  if (copia) return copia;
  const legado = await lerLegado();
  return legado ? { ...PREFERENCIAS_PADRAO, ...legado } : null;
}

/**
 * Grava a escolha: cópia no aparelho primeiro (nunca se perde), depois o
 * servidor. Falhou o servidor, fica pendente para a próxima sincronização.
 */
export async function salvarPreferencias(
  uid: string,
  preferencias: PreferenciasNotificacao,
): Promise<ResultadoDaGravacao> {
  await gravarDisco(chaveCopia(uid), JSON.stringify(preferencias));
  const resultado = await enviarAoServidor(uid, preferencias);
  if (resultado.sincronizado) {
    await apagarDisco(chavePendente(uid));
  } else {
    // Recusa também fica pendente: a mais provável é a tabela ainda não
    // existir (app antes da Migration 47), e ela passa sozinha.
    await gravarDisco(chavePendente(uid), '1');
  }
  return resultado;
}

/**
 * Sobe a pendência (se houver), migra o valor antigo (uma vez) e lê do
 * servidor. Sem servidor, devolve o melhor que o aparelho sabe.
 */
export async function sincronizarPreferencias(uid: string): Promise<{
  preferencias: PreferenciasNotificacao;
  origem: OrigemDasPreferencias;
}> {
  const locais = await lerPreferenciasLocais(uid);
  const doAparelho = () => ({
    preferencias: locais ?? PREFERENCIAS_PADRAO,
    origem: (locais ? 'aparelho' : 'padrao') as OrigemDasPreferencias,
  });

  if ((await lerDisco(chavePendente(uid))) && locais) {
    const { sincronizado } = await salvarPreferencias(uid, locais);
    if (!sincronizado) return doAparelho();
  }

  if (await semRedeConfirmada()) return doAparelho();

  let linha: unknown = null;
  try {
    const { data, error } = await supabase
      .from(TABELA)
      .select(COLUNAS)
      .eq('usuario_id', uid)
      .maybeSingle();
    if (error) {
      logger.warn('[PreferenciasPush] Falha ao ler do servidor', error);
      return doAparelho();
    }
    linha = data;
  } catch (error) {
    logger.warn('[PreferenciasPush] Falha de rede ao ler', error);
    return doAparelho();
  }

  const doServidor = normalizar(linha);
  const legado = await lerLegado();
  if (legado) await apagarLegado();

  if (doServidor) {
    // O servidor vence o valor antigo: pode ter sido escolhido em outro aparelho.
    await gravarDisco(chaveCopia(uid), JSON.stringify(doServidor));
    return { preferencias: doServidor, origem: 'servidor' };
  }

  // Conta sem linha: o valor antigo (ou a cópia) sobe agora; sem nenhum dos
  // dois vale o padrão, sem criar linha.
  if (!locais) return { preferencias: PREFERENCIAS_PADRAO, origem: 'padrao' };
  const { sincronizado } = await salvarPreferencias(uid, locais);
  return {
    preferencias: locais,
    origem: sincronizado ? 'servidor' : 'aparelho',
  };
}
