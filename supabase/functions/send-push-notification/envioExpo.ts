// Envio de UMA mensagem ao serviço de push da Expo, com prazo próprio e sem
// lançar: rede fora, prazo estourado e corpo que não é JSON voltam como
// `{ ok: false, motivo }`. Quem chama (o laço de aparelhos do index.ts)
// registra a falha e segue para o próximo aparelho — antes, um `fetch` que
// lançava ou ficava pendurado parava o envio no 1º aparelho da conta.
// O `fetch` vem injetado para a decisão rodar no Jest.

/** Prazo de cada envio (conexão + corpo da resposta). */
export const PRAZO_ENVIO_EXPO_MS = 10_000;

export type MotivoFalhaEnvio = 'prazo' | 'rede' | 'resposta_invalida';

export type ResultadoEnvioExpo =
  | { ok: true; http: number; corpo: unknown }
  | { ok: false; motivo: MotivoFalhaEnvio; http?: number };

interface PedidoDeEnvio {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

type Fetch = (url: string, init: PedidoDeEnvio) => Promise<Response>;

function ehEstouroDePrazo(erro: unknown): boolean {
  const nome = (erro as { name?: unknown } | null)?.name;
  return nome === 'TimeoutError' || nome === 'AbortError';
}

export async function enviarAoExpo(
  fazerFetch: Fetch,
  url: string,
  mensagem: unknown,
  prazoMs: number = PRAZO_ENVIO_EXPO_MS,
): Promise<ResultadoEnvioExpo> {
  const signal = AbortSignal.timeout(prazoMs);

  let resposta: Response;
  try {
    resposta = await fazerFetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mensagem),
      signal,
    });
  } catch (erro) {
    return { ok: false, motivo: ehEstouroDePrazo(erro) ? 'prazo' : 'rede' };
  }

  try {
    return { ok: true, http: resposta.status, corpo: await resposta.json() };
  } catch (erro) {
    // O corpo também corre dentro do prazo (o mesmo `signal`).
    return ehEstouroDePrazo(erro)
      ? { ok: false, motivo: 'prazo', http: resposta.status }
      : { ok: false, motivo: 'resposta_invalida', http: resposta.status };
  }
}
