// Guarda estática: o index.ts (Deno, não roda no Jest) tem de conferir as
// guardas ANTES de qualquer coisa irreversível. Apagar o avatar e depois ser
// recusado deixaria a conta viva com a foto perdida; e a ordem é o que um
// refactor desatento inverte sem quebrar teste nenhum.
import { readFileSync } from 'fs';
import { join } from 'path';

const fonte = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

describe('delete-account/index.ts', () => {
  it('importa e chama verificarGuardas com o cliente de serviço e o id do token', () => {
    expect(fonte).toMatch(/from '\.\/guardasExclusao\.ts'/);
    expect(fonte).toMatch(/verificarGuardas\(\s*supabaseAdmin,\s*user\.id\s*\)/);
  });

  it('confere as guardas antes de apagar o avatar e antes de apagar o usuário', () => {
    const guarda = fonte.indexOf('verificarGuardas(supabaseAdmin');
    const avatar = fonte.indexOf(".from('fotos-entrega')");
    const apagar = fonte.indexOf('auth.admin.deleteUser');
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(avatar);
    expect(guarda).toBeLessThan(apagar);
  });

  it('devolve a recusa com o status, o código e a mensagem dela', () => {
    expect(fonte).toMatch(
      /jsonResponse\(\s*\{\s*error:\s*recusa\.mensagem,\s*code:\s*recusa\.codigo\s*\},\s*recusa\.status,?\s*\)/,
    );
  });

  it('só remove o avatar da própria conta, pelo módulo avatarDaConta', () => {
    expect(fonte).toMatch(/from '\.\/avatarDaConta\.ts'/);
    expect(fonte).toMatch(
      /caminhoDoAvatarDaConta\(\s*profile\?\.foto_url,\s*user\.id\s*\)/,
    );
    expect(fonte).not.toContain('getAvatarPath');
    expect(fonte).not.toContain("'/fotos-entrega/'");
  });
});
