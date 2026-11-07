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

  it('o gestor vem da guarda (B-10), sem variável de fora da validação nem cast', () => {
    expect(fonte).toMatch(
      /criarValidadorDeUsuario\(\s*createClient,[\s\S]*?chavePublica,?\s*\)/,
    );
    expect(fonte).toMatch(/if \(autenticacao instanceof Response\)/);
    expect(fonte).toMatch(/const gestorId = autenticacao\.usuario\.id;/);
    expect(fonte).not.toMatch(/let user\b/);
    expect(fonte).not.toMatch(/supabaseClient!/);
    expect(fonte).not.toMatch(/\(user as /);
  });

  it('todas as respostas passam por resposta(), sem new Response com JSON inline', () => {
    expect(fonte).not.toMatch(/new Response\(\s*JSON\.stringify\(\{/);
  });

  it('a compensação confere o erro do deleteUser (desfazerContaCriada)', () => {
    expect(fonte).not.toMatch(/deleteUser\(/);
    expect(fonte.match(/desfazerContaCriada\(/g)).toHaveLength(2);
  });
});
