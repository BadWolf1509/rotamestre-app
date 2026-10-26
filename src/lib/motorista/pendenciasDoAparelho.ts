/**
 * O que a conta tem no aparelho e ainda não chegou ao banco.
 *
 * POR QUE EXISTE. O "Sair" preserva as filas de ações e de fotos (decisão
 * certa: não perder comprovante), mas elas só sobem quando a MESMA conta
 * entrar de novo NESTE aparelho; se ela não voltar (aparelho passado a um
 * colega, troca de celular, "limpar dados"), as entregas nunca chegam ao
 * gestor. A fila de posições é apagada no logout. O diálogo de saída conta
 * isto antes e avisa; o "Limpar cache" já fazia o mesmo.
 *
 * Só leitura local; falha de leitura conta zero (o aviso é ajuda, não trava).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/lib/logger';
import { getPendingPhotosCount } from '@/lib/offline';

import { lerFilaAcoesParada } from './filaAcoesParada';
import { CHAVE_FILA_POSICOES } from './filaPosicoes';

export interface PendenciasDaConta {
  acoes: number;
  fotos: number;
  posicoes: number;
}

async function contarSemFalhar(
  nome: string,
  contar: () => Promise<number>,
): Promise<number> {
  try {
    return await contar();
  } catch (erro) {
    logger.warn(`[Pendencias] Falha ao contar ${nome}`, erro);
    return 0;
  }
}

export async function contarPendenciasDaConta(
  userId: string,
): Promise<PendenciasDaConta> {
  const [acoes, fotos, posicoes] = await Promise.all([
    contarSemFalhar('ações', async () => {
      const fila = await lerFilaAcoesParada();
      return fila.filter((a) => a.motoristaId === userId).length;
    }),
    contarSemFalhar('fotos', getPendingPhotosCount),
    contarSemFalhar('posições', async () => {
      const bruto = await AsyncStorage.getItem(CHAVE_FILA_POSICOES);
      if (!bruto) return 0;
      const registro = JSON.parse(bruto) as {
        userId?: string;
        posicoes?: unknown[];
      };
      return registro.userId === userId && Array.isArray(registro.posicoes)
        ? registro.posicoes.length
        : 0;
    }),
  ]);
  return { acoes, fotos, posicoes };
}

export const MENSAGEM_SAIDA_PADRAO = 'Deseja realmente encerrar sua sessão?';

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

export function temPendencias(p: PendenciasDaConta): boolean {
  return p.acoes + p.fotos + p.posicoes > 0;
}

/** Texto do diálogo de saída. Sem pendência, a pergunta de sempre. */
export function mensagemDeSaida(p: PendenciasDaConta): string {
  if (!temPendencias(p)) return MENSAGEM_SAIDA_PADRAO;

  const partes: string[] = [];
  const guardadas: string[] = [];
  if (p.acoes > 0) {
    guardadas.push(
      plural(p.acoes, 'registro de parada', 'registros de parada'),
    );
  }
  if (p.fotos > 0) guardadas.push(plural(p.fotos, 'foto', 'fotos'));
  if (guardadas.length > 0) {
    partes.push(
      `Ainda não foram enviados: ${guardadas.join(' e ')}. Se sair, ficam guardados e só sobem quando você entrar de novo neste aparelho, com esta conta.`,
    );
  }
  if (p.posicoes > 0) {
    partes.push(
      'O trajeto registrado sem sinal ainda não foi enviado e será apagado ao sair.',
    );
  }
  partes.push('O app já está tentando enviar. Deseja sair mesmo assim?');
  return partes.join('\n\n');
}
