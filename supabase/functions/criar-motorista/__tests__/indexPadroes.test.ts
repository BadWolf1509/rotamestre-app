// Guarda estática do index.ts (roda em Deno, fora do Jest): autenticação pela
// guarda compartilhada, respostas pelo helper local e compensação conferida.
import { readFileSync } from 'fs';
import { join } from 'path';

const fonte = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');

describe('criar-motorista: padrões do index.ts', () => {
  it('recusa com 401 antes de criar cliente quando falta o Authorization (exigirUsuario)', () => {
    expect(fonte).toMatch(/exigirUsuario\(/);
    expect(fonte).not.toMatch(/get\('Authorization'\)!/);
    expect(fonte.indexOf('exigirUsuario(')).toBeLessThan(
      fonte.indexOf('chavePublica()'),
    );
  });

  it('todas as respostas passam por resposta(), sem new Response com JSON inline', () => {
    expect(fonte).not.toMatch(/new Response\(\s*JSON\.stringify\(\{/);
  });

  it('a compensação confere o erro do deleteUser (desfazerContaCriada)', () => {
    expect(fonte).not.toMatch(/deleteUser\(/);
    expect(fonte.match(/desfazerContaCriada\(/g)).toHaveLength(2);
  });
});
