/**
 * `fetch` com prazo, para o cliente Supabase.
 *
 * POR QUE EXISTE. O `createClient` não recebia `global.fetch` customizado, e o
 * `fetch` do runtime **não tem timeout**. Numa rede que aceita a conexão TCP e
 * nunca responde — uma barra de sinal, em movimento, que é o dia do motorista —
 * a promessa nunca resolve nem rejeita. O efeito medido no fluxo de conclusão
 * de parada: `setIsCompleting(true)` roda, o `await completeStop(...)` fica
 * pendurado, o `finally { setIsCompleting(false) }` **nunca** executa, e o
 * botão "Concluir" gira para sempre, sem cancelamento.
 *
 * O contraste que denunciou o buraco está dentro do próprio repo: OSRM
 * (`osrm/api.ts`, 10 s), Photon (8 s), Google Places e ViaCEP — todo cliente
 * HTTP escrito à mão aqui tem `AbortController` + `setTimeout`. Só o caminho
 * que grava a entrega não tinha.
 *
 * DUAS CAUTELAS no desenho:
 *
 * 1. **Não usa `AbortSignal.timeout()` nem `AbortSignal.any()`.** São APIs
 *    recentes e o Hermes não as garante — a mesma razão pela qual este projeto
 *    evita `Intl.NumberFormat` no nativo. `AbortController` + `setTimeout` é o
 *    que já roda em produção nos outros clientes.
 * 2. **Não sobrescreve o `signal` do chamador.** O supabase-js expõe
 *    `.abortSignal()`, e o repo usa isso em `useGestaoRotas`. Trocar o signal
 *    por um nosso mataria esse cancelamento em silêncio; aqui os dois abortam
 *    o mesmo controller.
 */

/**
 * Prazo para uma chamada ao Supabase. Fica acima do OSRM (10 s) porque uma
 * escrita com retry interno pode legitimamente demorar mais que uma consulta de
 * rota, e bem abaixo do infinito que havia antes.
 */
export const TIMEOUT_SUPABASE_MS = 15000;

/**
 * Prazo para upload/download no Storage.
 *
 * O MESMO cliente serve consulta e foto. Uma foto a `quality: 0.8` tem 1-3 MB;
 * 2 MB a ~100 kbps levam ~160 s. Aplicar os 15 s da consulta aqui abortaria o
 * comprovante de entrega justamente na rede ruim em que o motorista trabalha —
 * trocaria um bug por outro pior. Três minutos é folgado; além disso, quem
 * responde é a fila offline de fotos (`lib/offline.ts`), que já tem retry.
 */
export const TIMEOUT_STORAGE_MS = 180000;

/**
 * Extrai a URL de qualquer uma das três formas que o `fetch` aceita.
 *
 * O tipo vem de `Parameters<typeof fetch>[0]`, e não do nome global
 * `RequestInfo`: o `tsc` conhece esse nome pela lib DOM, mas o `no-undef` do
 * ESLint deste projeto não — derivar do próprio `fetch` agrada aos dois.
 */
type EntradaDeFetch = Parameters<typeof fetch>[0];

function urlDe(input: EntradaDeFetch): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function prazoParaUrl(url: string): number {
  return url.includes('/storage/v1/')
    ? TIMEOUT_STORAGE_MS
    : TIMEOUT_SUPABASE_MS;
}

export function criarFetchComTimeout(
  timeoutMs?: number,
  fetchBase: typeof fetch = fetch,
): typeof fetch {
  return function fetchComTimeout(input, init) {
    const prazo = timeoutMs ?? prazoParaUrl(urlDe(input));
    const controller = new AbortController();
    const sinalDoChamador = init?.signal;

    if (sinalDoChamador) {
      if (sinalDoChamador.aborted) {
        controller.abort();
      } else {
        sinalDoChamador.addEventListener('abort', () => controller.abort(), {
          once: true,
        });
      }
    }

    const timer = setTimeout(() => controller.abort(), prazo);

    return fetchBase(input, { ...init, signal: controller.signal }).finally(
      // Ganhando ou perdendo a corrida, o timer não sobrevive a ela — senão
      // ele dispara depois e aborta um controller já descartado. Mesma
      // armadilha documentada em `auth/sessaoComTimeout.ts`.
      () => clearTimeout(timer),
    );
  };
}
