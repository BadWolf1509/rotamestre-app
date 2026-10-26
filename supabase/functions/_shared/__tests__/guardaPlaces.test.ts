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
    expect(fonte).toMatch(/auth\.getUser\(\)/);
    expect(fonte).toMatch(/headers:\s*\{\s*Authorization/);
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
