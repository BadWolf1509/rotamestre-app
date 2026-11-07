// O envio à Expo de UM aparelho (envioExpo.ts) não lança: rede fora, prazo
// estourado e corpo que não é JSON viram `{ ok: false, motivo }`, para o laço
// de aparelhos seguir para o próximo. Antes, um `fetch` que lançava ou
// pendurava parava o envio no 1º aparelho e os demais não recebiam nada.
import { readFileSync } from 'fs';
import { join } from 'path';

import { enviarAoExpo, PRAZO_ENVIO_EXPO_MS } from '../envioExpo';

const URL_EXPO = 'https://exemplo.test/push';
const mensagem = { to: 'ExponentPushToken[abc]', title: 't', body: 'b' };

function resposta(corpo: string, status = 200): Response {
  return new Response(corpo, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('enviarAoExpo', () => {
  it('prazo padrão de 10 s', () => {
    expect(PRAZO_ENVIO_EXPO_MS).toBe(10_000);
  });

  it('devolve o corpo e o HTTP quando a Expo responde JSON', async () => {
    const fazerFetch = jest
      .fn()
      .mockResolvedValue(resposta('{"data":{"status":"ok","id":"t1"}}'));
    const r = await enviarAoExpo(fazerFetch, URL_EXPO, mensagem);
    expect(r).toEqual({
      ok: true,
      http: 200,
      corpo: { data: { status: 'ok', id: 't1' } },
    });
    const [url, init] = fazerFetch.mock.calls[0];
    expect(url).toBe(URL_EXPO);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(mensagem);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('rede fora (fetch lança) vira motivo rede, sem lançar', async () => {
    const fazerFetch = jest
      .fn()
      .mockRejectedValue(new TypeError('error sending request'));
    await expect(enviarAoExpo(fazerFetch, URL_EXPO, mensagem)).resolves.toEqual(
      { ok: false, motivo: 'rede' },
    );
  });

  it('fetch pendurado estoura o prazo e vira motivo prazo', async () => {
    const fazerFetch = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(init.signal.reason),
          );
        }),
    );
    await expect(
      enviarAoExpo(fazerFetch, URL_EXPO, mensagem, 20),
    ).resolves.toEqual({ ok: false, motivo: 'prazo' });
  });

  it('corpo que não é JSON vira motivo resposta_invalida, com o HTTP', async () => {
    const fazerFetch = jest
      .fn()
      .mockResolvedValue(resposta('<html>502</html>', 502));
    await expect(enviarAoExpo(fazerFetch, URL_EXPO, mensagem)).resolves.toEqual(
      { ok: false, motivo: 'resposta_invalida', http: 502 },
    );
  });
});

describe('send-push-notification: um aparelho que falha não para os outros', () => {
  const fonte = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');

  it('envia pela função testada, não por fetch direto', () => {
    expect(fonte).toMatch(
      /import\s*\{[^}]*enviarAoExpo[^}]*\}\s*from\s*'\.\/envioExpo\.ts'/,
    );
    expect(fonte).toMatch(
      /await enviarAoExpo\(\s*fetch,\s*EXPO_PUSH_URL,\s*pushMessage,?\s*\)/,
    );
    expect(fonte).not.toMatch(/await fetch\(EXPO_PUSH_URL/);
  });

  it('falha do envio registra no log de push e segue para o próximo aparelho', () => {
    const i = fonte.indexOf('if (!envio.ok)');
    expect(i).toBeGreaterThan(-1);
    const trecho = fonte.slice(i, i + 700);
    expect(trecho).toMatch(/await logPushAttempt\(supabase, \{/);
    expect(trecho).toMatch(/status: 'failed'/);
    expect(trecho).toMatch(/push_token: token/);
    expect(trecho).toMatch(/continue;/);
  });
});
