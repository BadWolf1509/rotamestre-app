// Guarda estática do index.ts (a função roda em Deno, fora do Jest). Desde
// 22/10/2026 ela roda sem `verify_jwt`: sem o segredo próprio, qualquer um
// dispararia push para qualquer usuário, de qualquer empresa.
import { readFileSync } from 'fs';
import { join } from 'path';

const fonte = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');

describe('send-push-notification: guarda do segredo', () => {
  it('importa a guarda do push', () => {
    expect(fonte).toMatch(
      /import\s*\{[^}]*requirePushSecret[^}]*\}\s*from\s*'\.\.\/_shared\/cronAuth\.ts'/,
    );
  });

  it('confere o segredo antes de ler o corpo da requisição', () => {
    const guarda = fonte.indexOf('requirePushSecret(req)');
    const corpo = fonte.indexOf('req.json()');
    expect(guarda).toBeGreaterThan(-1);
    expect(corpo).toBeGreaterThan(guarda);
  });
});
