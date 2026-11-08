// Guarda estática das duas Edge Functions de Places (rodam em Deno, fora do
// Jest). Até 23/10/2026 elas não autenticavam nada e rodavam sem `verify_jwt`:
// qualquer um na internet usava a chave Google do projeto (cobrada por sessão).
// Agora cada uma exige o JWT de um usuário (`auth.getUser`) ANTES de ler o
// corpo e de chamar a Google, limita o tamanho da entrada e não devolve ao
// cliente a mensagem de erro da Google nem a da exceção.
import { readFileSync } from 'fs';
import { join } from 'path';

const funcoes = ['google-places-autocomplete', 'google-place-details'];

describe.each(funcoes)('%s: autenticação e entrada', (nome) => {
  const fonte = readFileSync(
    join(__dirname, '..', '..', nome, 'index.ts'),
    'utf8',
  );

  it('importa exigirUsuario e chavePublica dos módulos compartilhados', () => {
    expect(fonte).toMatch(
      /import\s*\{[^}]*exigirUsuario[^}]*\}\s*from\s*'\.\.\/_shared\/autenticacao\.ts'/,
    );
    expect(fonte).toMatch(
      /import\s*\{[^}]*chavePublica[^}]*\}\s*from\s*'\.\.\/_shared\/chaves\.ts'/,
    );
  });

  it('valida o usuário com auth.getUser usando o Authorization recebido', () => {
    // A validação mora em _shared/autenticacao.ts (criarValidadorDeUsuario),
    // testada em autenticacao.test.ts; a função só a monta com a chave publicável.
    expect(fonte).toMatch(
      /criarValidadorDeUsuario\(\s*createClient,[\s\S]*?chavePublica,?\s*\)/,
    );
    const compartilhado = readFileSync(
      join(__dirname, '..', 'autenticacao.ts'),
      'utf8',
    );
    expect(compartilhado).toMatch(/auth\.getUser\(\)/);
    expect(compartilhado).toMatch(/headers:\s*\{\s*Authorization/);
  });

  it('a recusa da guarda é a Response devolvida (instanceof), não um truthy', () => {
    expect(fonte).toMatch(
      /const autenticacao = await exigirUsuario\(req, usuarioValido, CORS_PADRAO\);\s+if \(autenticacao instanceof Response\) \{\s+return autenticacao;/,
    );
  });

  it('exige o usuário antes de ler o corpo e antes de chamar a Google', () => {
    const guarda = fonte.indexOf('await exigirUsuario(');
    const corpo = fonte.indexOf('req.json()');
    const google = fonte.indexOf('places.googleapis.com');
    expect(guarda).toBeGreaterThan(-1);
    expect(corpo).toBeGreaterThan(guarda);
    expect(google).toBeGreaterThan(guarda);
  });

  it('limita o tamanho da entrada', () => {
    expect(fonte).toMatch(/TAMANHO_MAXIMO/);
  });

  it('não devolve ao cliente a mensagem da Google nem a da exceção', () => {
    expect(fonte).not.toMatch(/error:\s*data\.error\?\.message/);
    expect(fonte).not.toMatch(/error:\s*error\.message/);
  });
});

// Teto diário por usuário (Migration 84): antes de chamar a Google, cada
// função consome a cota do serviço dela pela RPC, com o Authorization de quem
// busca; esgotada → 429 do helper compartilhado.
describe.each([
  ['google-places-autocomplete', 'autocomplete', '{ predictions: [] }'],
  ['google-place-details', 'details', null],
])('%s: cota diária', (nome, servico, extras) => {
  const fonte = readFileSync(
    join(__dirname, '..', '..', nome, 'index.ts'),
    'utf8',
  );

  it('importa o helper da cota', () => {
    expect(fonte).toMatch(
      /import\s*\{[^}]*consumirCotaPlaces[^}]*respostaCotaEsgotada[^}]*\}\s*from\s*'\.\.\/_shared\/cotaPlaces\.ts'/,
    );
  });

  it(`consome a cota de '${servico}' com um cliente do Authorization recebido`, () => {
    expect(fonte).toMatch(
      new RegExp(
        String.raw`createClient\(\s*Deno\.env\.get\('SUPABASE_URL'\) \?\? '',\s*chavePublica\(\),\s*\{[\s\S]*?headers:\s*\{\s*Authorization:\s*req\.headers\.get\('Authorization'\)`,
      ),
    );
    expect(fonte).toMatch(
      new RegExp(
        String.raw`await consumirCotaPlaces\(\s*\(funcao, args\) => cliente\.rpc\(funcao, args\),\s*'${servico}',?\s*\)`,
      ),
    );
  });

  it('cota esgotada devolve o 429 do helper', () => {
    const esperado = extras
      ? String.raw`if \(cota === 'esgotada'\) \{\s+return respostaCotaEsgotada\(CORS_PADRAO, ${extras.replace(/[{}[\]]/g, '\\$&')}\);`
      : String.raw`if \(cota === 'esgotada'\) \{\s+return respostaCotaEsgotada\(CORS_PADRAO\);`;
    expect(fonte).toMatch(new RegExp(esperado));
  });

  it('consome depois da autenticação e da validação da entrada, antes da Google', () => {
    const guarda = fonte.indexOf('await exigirUsuario(');
    const entrada = fonte.indexOf('Entrada inválida');
    const cota = fonte.indexOf('await consumirCotaPlaces(');
    const google = fonte.indexOf('places.googleapis.com');
    expect(guarda).toBeGreaterThan(-1);
    expect(entrada).toBeGreaterThan(guarda);
    expect(cota).toBeGreaterThan(entrada);
    expect(google).toBeGreaterThan(cota);
    expect(fonte.match(/await consumirCotaPlaces\(/g)).toHaveLength(1);
  });

  if (servico === 'autocomplete') {
    it('só conta quando vai mesmo chamar a Google (input de 3+ caracteres)', () => {
      const curto = fonte.indexOf('input.length < 3');
      const cota = fonte.indexOf('await consumirCotaPlaces(');
      expect(curto).toBeGreaterThan(-1);
      expect(cota).toBeGreaterThan(curto);
    });
  }
});
