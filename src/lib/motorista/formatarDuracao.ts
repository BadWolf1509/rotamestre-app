/**
 * Formatador único de duração do motorista (M-5).
 *
 * Eram três, com saídas diferentes para o mesmo tempo: "45min" (barra de
 * progresso da Início), "45 min" (cartões da Início) e "0h 45min" (Histórico e
 * Resumo). O formato seguiu o da barra de progresso — o mais visto, na tela
 * que o motorista abre o dia todo: sem "0h" quando passa de uma hora é que
 * aparecem as horas ("1h 5min"), e depois de 24 h as horas seguem somando
 * ("26h 30min"), sem virar dias. Alternativa descartada: o "0h 45min" do
 * Histórico, que ocupa espaço no cartão para dizer "zero horas".
 *
 * Tempo negativo (relógio do aparelho atrás do início) e valor inválido viram
 * "0min".
 */
export function formatarDuracao(ms: number): string {
  const total = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const horas = Math.floor(total / 3_600_000);
  const minutos = Math.floor((total % 3_600_000) / 60_000);
  if (horas === 0) return `${minutos}min`;
  return `${horas}h ${minutos}min`;
}
