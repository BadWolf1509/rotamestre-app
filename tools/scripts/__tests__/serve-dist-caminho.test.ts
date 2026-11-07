/**
 * Resolução de caminho do servidor estático de `dist/` (T-5).
 *
 * Três defeitos que isto fixa:
 * 1. URI malformada (`/%E0%A4%A`) lançava `URIError` e derrubava o servidor —
 *    e com ele a suíte e2e inteira;
 * 2. o prefixo da raiz era frouxo: `dist-extra/…` começa com `dist` e passava;
 * 3. asset que falta (`/_expo/static/js/web/sumiu.js`) recebia o `index.html`
 *    com status 200 — o navegador tentava executar HTML como script e o erro
 *    aparecia longe da causa.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const { resolverRequisicao } = require('../serve-dist-caminho.cjs') as {
  resolverRequisicao: (
    raiz: string,
    url: string,
  ) =>
    | { tipo: 'arquivo'; caminho: string }
    | { tipo: 'spa' }
    | { tipo: 'erro'; status: number; motivo: string };
};

let base: string;
let raiz: string;

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-dist-'));
  raiz = path.join(base, 'dist');
  fs.mkdirSync(path.join(raiz, '_expo'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'index.html'), '<html></html>');
  fs.writeFileSync(path.join(raiz, '_expo', 'app.js'), '//');
  // Irmão cujo nome começa com o da raiz: o prefixo frouxo o deixava passar.
  fs.mkdirSync(path.join(base, 'dist-extra'));
  fs.writeFileSync(path.join(base, 'dist-extra', 'segredo.txt'), 'x');
});

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

describe('resolverRequisicao', () => {
  it('serve arquivo que existe', () => {
    const r = resolverRequisicao(raiz, '/_expo/app.js?v=1');
    expect(r).toEqual({
      tipo: 'arquivo',
      caminho: path.join(raiz, '_expo', 'app.js'),
    });
  });

  it('rota sem extensão cai no fallback de SPA', () => {
    expect(resolverRequisicao(raiz, '/auth/login')).toEqual({ tipo: 'spa' });
    expect(resolverRequisicao(raiz, '/')).toEqual({ tipo: 'spa' });
  });

  it('asset com extensão que não existe é 404, não o index.html', () => {
    expect(resolverRequisicao(raiz, '/_expo/static/js/web/sumiu.js')).toEqual({
      tipo: 'erro',
      status: 404,
      motivo: expect.any(String),
    });
  });

  it('URI malformada é 400 em vez de derrubar o servidor', () => {
    expect(() => resolverRequisicao(raiz, '/%E0%A4%A')).not.toThrow();
    expect(resolverRequisicao(raiz, '/%E0%A4%A')).toMatchObject({
      tipo: 'erro',
      status: 400,
    });
  });

  it('recusa caminho que escapa da raiz', () => {
    expect(resolverRequisicao(raiz, '/..%2f..%2fetc/passwd')).toMatchObject({
      tipo: 'erro',
      status: 403,
    });
  });

  it('recusa o irmão que só compartilha o prefixo do nome da raiz', () => {
    expect(
      resolverRequisicao(raiz, '/..%2fdist-extra%2fsegredo.txt'),
    ).toMatchObject({ tipo: 'erro', status: 403 });
  });
});
