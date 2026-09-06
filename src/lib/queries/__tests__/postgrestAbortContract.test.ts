/**
 * Teste de CONTRATO entre `@supabase/postgrest-js` (biblioteca REAL,
 * instalada — não um mock) e `classifyError` / `isPostgrestAbortShape`
 * (`../queryClient.ts`).
 *
 * POR QUÊ ESTE ARQUIVO EXISTE (fix-report-3.md, PR #480, item 3).
 * `classifyError` casa a string exata `'AbortError: timeout'`, produzida
 * pelo TEMPLATE DE CONVERSÃO do postgrest-js
 * (`message: \`${fetchError.name}: ${fetchError.message}\``,
 * `node_modules/@supabase/postgrest-js/dist/index.cjs`, por volta da linha
 * 425 — documentado até no JSDoc público do pacote, `dist/index.d.cts`
 * linha ~1083, como exemplo de `PostgrestError`). Antes deste arquivo,
 * NENHUM teste do repo importava o `@supabase/postgrest-js` de verdade — a
 * forma só existia como objeto literal escrito à mão
 * (`queryClient.test.ts`, `useGestaoRotas.test.ts`). Um bump que mude esse
 * template mataria o ramo de 'timeout' com a suíte inteira verde, porque a
 * fixture escrita à mão nunca desatualiza sozinha.
 *
 * Este arquivo chama o `PostgrestClient` de verdade contra um `fetch` falso
 * que nunca resolve por conta própria — só reage ao abort, exatamente como
 * uma rede que aceita a conexão TCP e nunca responde (mesmo padrão de
 * `fetchComTimeout.test.ts` e do experimento em fix-report-2.md) — e
 * confere a mensagem que sai do outro lado, com `fetchComTimeout` real (não
 * reimplementado) no meio.
 *
 * ALTERNATIVA AVALIADA E NÃO ADOTADA: trocar a mensagem do wrapper por um
 * sentinela (ex.: 'RM_FETCH_TIMEOUT') casado por `includes`, pra sobreviver
 * a qualquer separador que a lib venha a usar. Não adotada porque (a) o
 * template atual é comportamento DOCUMENTADO do postgrest-js, não um
 * acidente de implementação; (b) mudar a mensagem exigiria reabrir
 * `fetchComTimeout.ts` e `queryClient.ts`, já endurecidos e testados em
 * duas rodadas anteriores, por um ganho marginal (só cobriria uma
 * reformatação do separador, não uma mudança de comportamento); e (c) este
 * próprio teste de contrato já fecha o risco relatado — um bump que altere
 * a conversão passa a quebrar ESTE arquivo alto e claro, em vez de
 * silenciosamente com a suíte verde. Caso a mensagem mude no futuro, o
 * sentinela continua disponível como opção.
 */
import { PostgrestClient } from '@supabase/postgrest-js';

import { criarFetchComTimeout } from '@/lib/fetchComTimeout';

import { classifyError, isPostgrestAbortShape } from '../queryClient';

/**
 * Fetch falso que representa "aceitou a conexão TCP e nunca respondeu": só
 * resolve/rejeita reagindo ao abort do próprio `fetchComTimeout` — nunca
 * por conta própria. Cobre tanto abort síncrono (signal já vinha abortado
 * quando o fetch foi chamado) quanto assíncrono (abort depois de chamado),
 * igual a uma implementação real de `fetch`.
 */
function criarFetchQueNuncaResponde(mensagemDoAbort: string): typeof fetch {
  return ((_input: unknown, init?: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) => {
      const rejeitarComAbort = () => {
        const erro = new Error(mensagemDoAbort);
        erro.name = 'AbortError';
        reject(erro);
      };
      if (init?.signal?.aborted) {
        rejeitarComAbort();
      } else {
        init?.signal?.addEventListener('abort', rejeitarComAbort, {
          once: true,
        });
      }
    })) as typeof fetch;
}

describe('contrato: postgrest-js real x fetchComTimeout real x classifyError', () => {
  it('converte o abort do NOSSO timeout na forma exata que classifyError espera', async () => {
    const fetchFalso = criarFetchQueNuncaResponde('não deveria aparecer');
    // Prazo bem curto: quem aborta é o NOSSO wrapper, não o teste.
    const client = new PostgrestClient('http://localhost/rest/v1', {
      fetch: criarFetchComTimeout(20, fetchFalso),
    });

    const { data, error } = await client.from('qualquer_tabela').select('*');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('AbortError: timeout');

    // O contrato que realmente importa: o que classifyError FAZ com a
    // forma que a biblioteca de verdade entrega.
    const classificado = classifyError(error);
    expect(classificado.type).toBe('timeout');
    expect(classificado.message).toBe(
      'A operação demorou muito e foi cancelada. Tente novamente.',
    );
    expect(isPostgrestAbortShape(error)).toBe(true);
  });

  it('converte um cancelamento do CHAMADOR na forma que isPostgrestAbortShape reconhece, mas NÃO como timeout', async () => {
    const fetchFalso = criarFetchQueNuncaResponde('The operation was aborted.');
    // Prazo bem folgado: quem aborta é o CHAMADOR (abaixo), não o timeout.
    const client = new PostgrestClient('http://localhost/rest/v1', {
      fetch: criarFetchComTimeout(10000, fetchFalso),
    });

    // Abortado ANTES da chamada — sem depender de nenhuma suposição de
    // timing sobre quando o postgrest-js liga o listener no signal.
    const controladorDoChamador = new AbortController();
    controladorDoChamador.abort();

    const { data, error } = await client
      .from('qualquer_tabela')
      .select('*')
      .abortSignal(controladorDoChamador.signal);

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toBe('AbortError: The operation was aborted.');
    expect(error?.message).not.toBe('AbortError: timeout');

    expect(isPostgrestAbortShape(error)).toBe(true);
    expect(classifyError(error).type).not.toBe('timeout');
  });
});
