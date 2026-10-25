/**
 * Posição do motorista no mapa do gestor: qual vale e há quanto tempo.
 *
 * Desde a 1.14.6 toda posição vai ao banco com o `timestamp` do GPS, e a fila
 * offline (`filaPosicoes.ts`) reenvia posições guardadas quando a rede volta.
 * Elas chegam pelo realtime DEPOIS das atuais: o marcador que aceitasse a
 * última que chegou voltaria para onde o motorista esteve meia hora antes. A
 * carga inicial também pode chegar depois de um INSERT mais novo. Vale a de
 * `timestamp` maior, não a que chegou por último.
 */

interface ComTimestamp {
  timestamp: string;
}

function instante(timestamp: string | null | undefined): number {
  if (!timestamp) return Number.NaN;
  return Date.parse(timestamp);
}

/**
 * Teto de relógio: posição atual com `timestamp` mais de 2 min à frente de
 * agora veio de um aparelho com relógio adiantado. Se o relógio for corrigido
 * no meio da rota (NTP), as posições seguintes têm `timestamp` menor e seriam
 * recusadas até o horário adiantado passar, congelando o marcador. Uma atual
 * "do futuro" não bloqueia a próxima posição válida.
 */
const TOLERANCIA_RELOGIO_MS = 2 * 60_000;

/**
 * A posição que o marcador deve mostrar entre a atual e uma que chegou.
 * Devolve a própria `atual` quando ela continua valendo (sem render à toa).
 */
export function posicaoMaisRecente<T extends ComTimestamp>(
  atual: T | null,
  nova: T,
  agoraMs: number = Date.now(),
): T {
  if (!atual) return nova;
  const deAtual = instante(atual.timestamp);
  const daNova = instante(nova.timestamp);
  if (Number.isNaN(daNova)) return Number.isNaN(deAtual) ? nova : atual;
  if (Number.isNaN(deAtual)) return nova;
  if (deAtual > agoraMs + TOLERANCIA_RELOGIO_MS) return nova;
  return daNova > deAtual ? nova : atual;
}

/** "agora", "há 12 min", "há 3 h" — idade da posição em relação a `agoraMs`. */
export function formatarIdadeDaPosicao(
  timestamp: string,
  agoraMs: number,
): string {
  const momento = instante(timestamp);
  if (Number.isNaN(momento)) return '';
  const minutos = Math.floor((agoraMs - momento) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  return `há ${Math.floor(minutos / 60)} h`;
}

/** Intervalo do relógio que atualiza a idade: a menor unidade mostrada é o minuto. */
export const INTERVALO_IDADE_DA_POSICAO_MS = 30_000;
