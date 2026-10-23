// Guarda estática: Edge Function não devolve ao cliente a mensagem crua do
// Auth, do Postgres ou de uma exceção. Esses textos expõem nome de tabela,
// constraint, coluna e detalhe interno — e o workflow público do cron
// (`expire-routes.yml`) imprime o corpo da resposta no log do Actions, que
// qualquer um lê num repositório público. O detalhe vai para o `console.error`
// (log da função, só no painel); para fora, mensagem genérica ou de negócio.
import { readFileSync } from 'fs';
import { join } from 'path';

const funcoes = ['criar-motorista', 'expire-routes', 'remind-routes'];

// Corpo de resposta (JSON.stringify({...})) que interpola `.message`/`.details`
// de um erro. `[^}]*` atravessa linhas e para no fim do objeto literal.
const VAZA_MENSAGEM =
  /JSON\.stringify\(\{[^}]*\b\w*(?:[Ee]rror|err)\.(?:message|details)\b/;

describe.each(funcoes)('%s: sem vazamento de erro interno', (nome) => {
  const fonte = readFileSync(
    join(__dirname, '..', '..', nome, 'index.ts'),
    'utf8',
  );

  it('nenhuma resposta interpola .message/.details de erro', () => {
    expect(fonte).not.toMatch(VAZA_MENSAGEM);
  });

  it('registra o detalhe no log da função', () => {
    expect(fonte).toMatch(/console\.error\(/);
  });
});

describe('a própria guarda', () => {
  it('pega os formatos que existiam antes', () => {
    expect(
      'JSON.stringify({\n  error: `Erro ao criar usuário: ${createAuthError.message}`,',
    ).toMatch(VAZA_MENSAGEM);
    expect('JSON.stringify({ error: error.message }), {').toMatch(
      VAZA_MENSAGEM,
    );
    expect(
      'JSON.stringify({\n success: false,\n error: error.message,\n details: error.details,',
    ).toMatch(VAZA_MENSAGEM);
    expect(
      "JSON.stringify({\n error: err instanceof Error ? err.message : 'x',",
    ).toMatch(VAZA_MENSAGEM);
  });

  it('não acusa mensagem fixa', () => {
    expect("JSON.stringify({ error: 'Erro interno' })").not.toMatch(
      VAZA_MENSAGEM,
    );
  });
});
