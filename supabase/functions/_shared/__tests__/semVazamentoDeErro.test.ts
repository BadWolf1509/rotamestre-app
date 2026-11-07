// Guarda estática: Edge Function não devolve ao cliente a mensagem crua do
// Auth, do Postgres ou de uma exceção. Esses textos expõem nome de tabela,
// constraint, coluna e detalhe interno — e o workflow público do cron
// (`expire-routes.yml`) imprime o corpo da resposta no log do Actions, que
// qualquer um lê num repositório público. O detalhe vai para o `console.error`
// (log da função, só no painel); para fora, mensagem genérica ou de negócio.
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// Toda função do diretório, não uma lista fixa: função nova entra na guarda sozinha.
const pastaFuncoes = join(__dirname, '..', '..');
const funcoes = readdirSync(pastaFuncoes).filter(
  (nome) =>
    !nome.startsWith('_') &&
    !nome.startsWith('.') &&
    statSync(join(pastaFuncoes, nome)).isDirectory() &&
    existsSync(join(pastaFuncoes, nome, 'index.ts')),
);

// Corpo de resposta (JSON.stringify({...})) que interpola `.message`/`.details`
// de um erro. `[^}]*` atravessa linhas e para no fim do objeto literal.
const VAZA_MENSAGEM =
  /JSON\.stringify\(\{[^}]*(?:\b\w*(?:[Ee]rror|err)\.(?:message|details|stack)\b|String\(\s*\w*(?:[Ee]rror|err)\w*\s*\))/;

it('acha as funções (senão a guarda passaria vazia)', () => {
  expect(funcoes.length).toBeGreaterThanOrEqual(7);
});

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

  it('pega String(error) e .stack no corpo da resposta', () => {
    expect(
      "JSON.stringify({\n error: 'x',\n details: String(error),\n }),",
    ).toMatch(VAZA_MENSAGEM);
    expect('JSON.stringify({ error: err.stack }),').toMatch(VAZA_MENSAGEM);
  });

  it('não acusa mensagem fixa', () => {
    expect("JSON.stringify({ error: 'Erro interno' })").not.toMatch(
      VAZA_MENSAGEM,
    );
  });
});
