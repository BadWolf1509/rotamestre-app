/**
 * Rede caída OBSERVADA: o `fetch` do Supabase falhou por falta de rede.
 *
 * POR QUE EXISTE. Medido em 25/10 (pendência 27): com Wi-Fi conectado e sem
 * internet, o NetInfo responde `isConnected: true` e nenhum atalho de "sem
 * rede" disparava. A abertura encadeava sessão → perfil completo → perfil
 * simples → rota, cada uma com o retry do postgrest-js (~20 s por etapa).
 *
 * Alternativas comparadas (decisão do plano 1.14.7):
 * - observar a falha no próprio `fetch` do Supabase (ESTA) — todo atalho que
 *   já consulta `semRedeConfirmada()` passa a valer sem mudar quem chama, e
 *   vê também as quedas do meio do dia;
 * - sonda HTTP própria no boot — mais uma requisição e mais um prazo, e só
 *   enxerga o instante da abertura;
 * - `isInternetReachable` do NetInfo — vem `null` na abertura (ver
 *   `semRede.ts`), justamente quando mais importa.
 *
 * O QUE CONTA COMO QUEDA: só a rejeição do `fetch` que NÃO é abort (DNS,
 * conexão recusada, "Network request failed"). Timeout deste app e
 * cancelamento do chamador ficam de fora — uma consulta lenta com uma barra
 * de sinal não pode pôr o app inteiro em modo offline.
 *
 * SAÍDA DO ESTADO: qualquer resposta HTTP (qualquer status, até 5xx) prova
 * que a rede chega ao Supabase e limpa o sinal. Sem resposta, ele expira em
 * `JANELA_REDE_CAIDA_MS`: a abertura precisa de ~5 s; uma janela longa
 * prenderia a carga da rota depois da volta da rede.
 *
 * Vale só no cliente NATIVO (`supabase.ts`); o web fica como follow-up.
 */
import { logger } from './logger';

export const JANELA_REDE_CAIDA_MS = 20_000;

/** Instante (ms) da última falha de rede, ou `null` depois de uma resposta. */
let ultimaFalhaEm: number | null = null;

/** Ouvintes de UMA queda: cada um é chamado no máximo uma vez. */
const ouvintes = new Set<() => void>();

export function redeCaidaObservada(agora: number = Date.now()): boolean {
  return ultimaFalhaEm !== null && agora - ultimaFalhaEm < JANELA_REDE_CAIDA_MS;
}

export function registrarFalhaDeRede(agora: number = Date.now()): void {
  ultimaFalhaEm = agora;
  // Copia antes de chamar: um ouvinte pode cancelar outro no meio.
  const avisar = [...ouvintes];
  ouvintes.clear();
  for (const ouvinte of avisar) {
    try {
      ouvinte();
    } catch (error) {
      // Um ouvinte com defeito não pode impedir os outros nem o fetch.
      logger.warn('[Rede] Ouvinte de queda de rede lançou', error);
    }
  }
}

export function registrarRespostaDaRede(): void {
  ultimaFalhaEm = null;
}

export interface OpcoesAoCairRede {
  /**
   * Só quedas registradas DEPOIS desta chamada contam; a já ligada não avisa
   * na hora. Para quem tem uma resposta local a ganhar mesmo com a rede
   * caída (a leitura da sessão com token válido não usa rede).
   */
  ignorarQuedaAtual?: boolean;
}

/**
 * Avisa na próxima queda (uma vez só). Se a rede já está caída, avisa na
 * hora (salvo `ignorarQuedaAtual`). Devolve o cancelamento — quem registra
 * tem de chamá-lo quando deixar de esperar, senão o ouvinte fica preso no
 * módulo até a próxima queda.
 */
export function aoCairRede(
  ouvinte: () => void,
  opcoes?: OpcoesAoCairRede,
): () => void {
  if (!opcoes?.ignorarQuedaAtual && redeCaidaObservada()) {
    ouvinte();
    return () => {};
  }
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

type EntradaDeFetch = Parameters<typeof fetch>[0];
type OpcoesDeFetch = Parameters<typeof fetch>[1];

function ehAbort(error: unknown, init?: OpcoesDeFetch): boolean {
  if (init?.signal?.aborted) return true;
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * `fetch` que registra queda e volta da rede, sem mudar o resultado.
 *
 * Na composição de `supabase.ts` ele fica POR DENTRO do porteiro e do prazo
 * (prazo → porteiro → este → fetch): o 401 local do porteiro não chega aqui
 * (não é resposta da rede, não pode limpar uma queda), e o abort do prazo
 * chega com `init.signal.aborted === true` (não conta como queda).
 */
export function criarFetchObservandoRede(
  // Lazy de propósito, como em `fetchComTimeout.ts`: resolve o `fetch`
  // global na hora da chamada, não na criação do wrapper.
  base: typeof fetch = (...args) => fetch(...args),
): typeof fetch {
  return async function fetchObservandoRede(
    input: EntradaDeFetch,
    init?: OpcoesDeFetch,
  ) {
    let resposta: Response;
    try {
      resposta = await base(input, init);
    } catch (error) {
      if (!ehAbort(error, init)) registrarFalhaDeRede();
      throw error;
    }
    registrarRespostaDaRede();
    return resposta;
  };
}

/** @internal Só para testes: quantos ouvintes de queda ainda esperam. */
export function _ouvintesDeQuedaAtivos(): number {
  return ouvintes.size;
}

/** @internal Só para testes: volta ao estado de "nenhuma queda observada". */
export function _resetRedeObservada(): void {
  ultimaFalhaEm = null;
  ouvintes.clear();
}
