/**
 * `fetch` com prazo, para o cliente Supabase.
 *
 * POR QUE EXISTE. Nenhum dos DOIS `createClient` deste repo recebia
 * `global.fetch` customizado — são dois porque o Metro resolve `.web.ts`
 * sobre `.ts`: `src/lib/supabase.ts` serve nativo, `src/lib/supabase.web.ts`
 * serve web, e cada um tem seu cliente real e seu cliente placeholder
 * (usado quando faltam env vars, em E2E/CI). O `fetch` do runtime **não tem
 * timeout**. Numa rede que aceita a conexão TCP e nunca responde — uma barra
 * de sinal, em movimento, que é o dia do motorista — a promessa nunca
 * resolve nem rejeita. O efeito medido no fluxo de conclusão de parada:
 * `setIsCompleting(true)` roda, o `await completeStop(...)` fica pendurado,
 * o `finally { setIsCompleting(false) }` **nunca** executa, e o botão
 * "Concluir" gira para sempre, sem cancelamento. No web — toda a superfície
 * do gestor, e `NavigationMode.web.tsx` do motorista — o defeito persistia
 * mesmo depois deste arquivo existir, porque `supabase.web.ts` nunca foi
 * ligado a ele.
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
type OpcoesDeFetch = Parameters<typeof fetch>[1];

function urlDe(input: EntradaDeFetch): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/**
 * Extrai o método HTTP de uma chamada de `fetch`. `init.method` é o caminho
 * normal — é o que o supabase-js sempre manda, para REST, Storage e Auth.
 * O fallback via `Request` cobre quem chama `fetch(new Request(url, {...}))`
 * diretamente; na ausência dos dois, GET é o default do próprio `fetch`.
 */
function metodoDe(input: EntradaDeFetch, init?: OpcoesDeFetch): string {
  if (init?.method) return init.method;
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method;
  }
  return 'GET';
}

/**
 * Paths do Storage que devolvem metadados — um JSON pequeno — mesmo estando
 * debaixo de `/storage/v1/`, onde o padrão (bytes de arquivo) pede o prazo
 * longo. `createSignedUrlForFoto` (`lib/storage.ts`) bate em `/object/sign/`,
 * e é isso que tornava o prazo de upload (180 s) errado pra ele: é uma
 * chamada no caminho de render — `useSignedUrl` faz dedupe por path, então
 * TODOS os componentes que pedem aquela foto ficavam esperando a mesma
 * promessa de 3 minutos numa rede ruim.
 *
 * ATENÇÃO ao path `/object/sign/`: ele é usado nos DOIS sentidos.
 * `createSignedUrl` faz POST nele para GERAR o link — corpo JSON minúsculo, é
 * essa a chamada que este `fetch` de fato intercepta. Mas o link GERADO usa
 * esse MESMO path, e baixar o arquivo por ele é um GET com `?token=...` — aí
 * sim são os bytes da foto. O método é o que distingue os dois casos. Na
 * prática esse GET nem passa por este `fetch`: quem busca a imagem é o
 * `<Image>`/`<img>` do componente, pela rede nativa da plataforma, não pelo
 * cliente Supabase — mas a checagem por método fica aqui mesmo assim, para
 * não depender só dessa premissa de quem chama.
 */
function ehChamadaDeMetadadosDoStorage(url: string, metodo: string): boolean {
  if (metodo === 'POST' && url.includes('/object/sign/')) return true;
  if (metodo === 'POST' && url.includes('/object/list/')) return true;
  if (metodo === 'GET' && url.includes('/object/info/')) return true;
  return false;
}

export function prazoParaUrl(url: string, method = 'GET'): number {
  if (!url.includes('/storage/v1/')) return TIMEOUT_SUPABASE_MS;
  if (ehChamadaDeMetadadosDoStorage(url, method.toUpperCase())) {
    return TIMEOUT_SUPABASE_MS;
  }
  return TIMEOUT_STORAGE_MS;
}

export function criarFetchComTimeout(
  timeoutMs?: number,
  // Lazy de propósito: resolve o `fetch` global na hora da CHAMADA, não na
  // criação do wrapper. `criarFetchComTimeout()` roda uma vez, no boot do
  // módulo `supabase.ts` — antes de `initSentry()`. Um `fetchBase = fetch`
  // capturaria o `fetch` de ANTES do Sentry instrumentar o global (ele faz
  // isso para gerar breadcrumb), e todas as chamadas do Supabase ficariam
  // fora do breadcrumb para sempre. `(...args) => fetch(...args)` é o mesmo
  // padrão que o `resolveFetch` do próprio storage-js usa.
  fetchBase: typeof fetch = (...args) => fetch(...args),
): typeof fetch {
  return async function fetchComTimeout(input, init) {
    const prazo =
      timeoutMs ?? prazoParaUrl(urlDe(input), metodoDe(input, init));
    const controller = new AbortController();
    const sinalDoChamador = init?.signal;
    // Distingue "estourou nosso prazo" de "o chamador cancelou" (ex.:
    // `.abortSignal()` em `useGestaoRotas`). Não confia no `reason` que o
    // `fetch` real repropaga no erro rejeitado — nem todo runtime faz isso
    // fielmente (o polyfill do RN é incerto) — por isso é uma flag local,
    // não `controller.signal.reason`.
    let expirouPorPrazo = false;

    if (sinalDoChamador) {
      if (sinalDoChamador.aborted) {
        controller.abort();
      } else {
        sinalDoChamador.addEventListener('abort', () => controller.abort(), {
          once: true,
        });
      }
    }

    const timer = setTimeout(() => {
      expirouPorPrazo = true;
      // O motivo fica registrado no signal para quem inspecionar (breadcrumb,
      // etc.), mas a classificação abaixo não depende disso — ver a flag acima.
      controller.abort(new Error('timeout'));
    }, prazo);

    try {
      return await fetchBase(input, { ...init, signal: controller.signal });
    } catch (error) {
      // Só o NOSSO timeout deve virar um erro reconhecível como
      // não-retentável em `classifyError` (`queryClient.ts`) — um INSERT como
      // `createIncidente` não é idempotente, e o abort mata o cliente, não a
      // transação: se o servidor gravou e a resposta não voltou, repetir
      // duplicaria. O cancelamento do chamador precisa continuar como
      // "Requisição cancelada" (retentável), sem mudança de comportamento.
      if (expirouPorPrazo) {
        throw new Error('timeout');
      }
      throw error;
    } finally {
      // Ganhando ou perdendo a corrida, o timer não sobrevive a ela — senão
      // ele dispara depois e aborta um controller já descartado. Mesma
      // armadilha documentada em `auth/sessaoComTimeout.ts`. O `try/finally`
      // (em vez do `.finally()` de promise) cobre também o `fetchBase` que
      // lança SINCRONAMENTE, antes de existir uma Promise para encadear —
      // nesse caso um `.finally()` nunca seria alcançado e o timer vazaria.
      clearTimeout(timer);
    }
  };
}
