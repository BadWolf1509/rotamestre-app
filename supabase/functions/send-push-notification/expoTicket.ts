// Decisão pura sobre a resposta do serviço de push da Expo (sem Deno/fetch),
// testável no Jest.
//
// Para UMA mensagem (corpo objeto, que é o que a função manda) a Expo devolve
// `{ data: { status, id } }` — `data` é OBJETO. Só para lista de mensagens
// `data` vira lista. A função lia `data?.[0] || resposta`: no caso real isso é
// a resposta inteira, sem `status`, e todo push era gravado como `failed`
// (1.627 falhas e nenhum envio registrado até 10/2026).

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function erro(message: string, codigo?: string): ExpoPushTicket {
  return codigo
    ? { status: 'error', message, details: { error: codigo } }
    : { status: 'error', message };
}

export function extrairTicket(resposta: unknown): ExpoPushTicket {
  if (!ehObjeto(resposta)) {
    return erro('Resposta da Expo sem forma conhecida');
  }

  const bruto = Array.isArray(resposta.data) ? resposta.data[0] : resposta.data;
  if (ehObjeto(bruto) && (bruto.status === 'ok' || bruto.status === 'error')) {
    return bruto as unknown as ExpoPushTicket;
  }

  // Erro do pedido inteiro (validação, limite): vem em `errors`, sem ticket.
  const erros = resposta.errors;
  if (Array.isArray(erros) && ehObjeto(erros[0])) {
    const primeiro = erros[0];
    return erro(
      typeof primeiro.message === 'string'
        ? primeiro.message
        : 'Erro da Expo sem mensagem',
      typeof primeiro.code === 'string' ? primeiro.code : undefined,
    );
  }

  return erro('Resposta da Expo sem ticket');
}

// `DeviceNotRegistered` = o aparelho não aceita mais esse token (app
// desinstalado, token trocado). Mandar de novo só gera outra falha. Qualquer
// outro erro (credencial, limite) é nosso ou passageiro: o token continua bom.
export function tokenDeveSerLimpo(ticket: ExpoPushTicket): boolean {
  return (
    ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
  );
}

// Token de push identifica o aparelho: no log vão só os 6 últimos caracteres.
export function mascararToken(token: string | null | undefined): string {
  if (!token) return '(sem token)';
  return token.length > 6 ? `…${token.slice(-6)}` : '…';
}

// O que pode ir para o log. A `message` da Expo fica de fora: no
// DeviceNotRegistered ela traz o token inteiro.
export function resumoDoTicket(ticket: ExpoPushTicket): {
  status: 'ok' | 'error';
  id: string | null;
  erro: string | null;
} {
  return {
    status: ticket.status,
    id: ticket.id ?? null,
    erro: ticket.details?.error ?? null,
  };
}
