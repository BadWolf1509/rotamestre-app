// Guarda estática do index.ts: a Edge Function roda em Deno e não é
// exercitada pelo Jest, então o que ela NUNCA pode voltar a fazer é conferido
// no texto. Cada regra aqui fecha um buraco medido em 20/10/2026.
import { readFileSync } from 'fs';
import { join } from 'path';

import { MSG_TELEFONE_OUTRA_LOJA } from '../telefoneDuplicado';

const fonte = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');

describe('criar-motorista: guarda do vínculo', () => {
  it('não lista usuários do Auth (o "limpar órfão" apagava conta alheia)', () => {
    expect(fonte).not.toMatch(/listUsers/);
  });

  it('só apaga a conta que ela mesma acabou de criar', () => {
    const chamadas = fonte.match(/deleteUser\([^)]*\)/g) ?? [];
    expect(chamadas.length).toBeGreaterThan(0);
    for (const c of chamadas) {
      expect(c).toBe('deleteUser(authData.user.id)');
    }
  });

  it('não vincula conta existente nem devolve os dados dela', () => {
    expect(fonte).not.toMatch(/vinculado/);
    expect(fonte).not.toMatch(/existingUser/);
  });

  it('insere em usuario_unidades uma vez só, no caminho de criação', () => {
    const inserts = fonte.match(/from\('usuario_unidades'\)\s*\.insert/g) ?? [];
    expect(inserts).toHaveLength(1);
  });

  it('o aviso de telefone não manda mais cadastrar pelo e-mail', () => {
    expect(MSG_TELEFONE_OUTRA_LOJA).not.toMatch(/e-mail/);
    expect(MSG_TELEFONE_OUTRA_LOJA).toMatch(/fale com o suporte/);
  });
});
