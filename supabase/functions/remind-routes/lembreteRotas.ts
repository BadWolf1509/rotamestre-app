// Decisão da remind-routes sem Deno/rede, testável no Jest. Quem recebe o
// lembrete e quando é decidido na função SQL `remind_pending_routes`; aqui
// ficam só a leitura da urgência pedida e dos números devolvidos pela RPC.

export type Urgencia = 'normal' | 'final';

export interface EstatisticasDoLembrete {
  routes_found: number;
  reminders_sent: number;
}

// `corpo` é o JSON já lido (ou indefinido se a leitura falhou). Só o texto
// exato "final" escala; qualquer outra coisa, inclusive corpo que não é
// objeto, fica em "normal".
export function urgenciaDoCorpo(corpo: unknown): Urgencia {
  if (typeof corpo !== 'object' || corpo === null) return 'normal';
  return (corpo as { urgency?: unknown }).urgency === 'final'
    ? 'final'
    : 'normal';
}

// A RPC devolve uma linha com os totais; sem linha, nada foi lembrado.
export function estatisticasDoLembrete(
  linhas: EstatisticasDoLembrete[] | null | undefined,
): EstatisticasDoLembrete {
  return linhas?.[0] || { routes_found: 0, reminders_sent: 0 };
}
