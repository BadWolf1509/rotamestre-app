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

  it('só cria motorista em loja da qual o chamador é gestor ativo', () => {
    // A função é a única porta de escrita em usuario_unidades: papel e
    // unidade_id antigos em `usuarios` não bastam (gestor removido da loja).
    expect(fonte).toMatch(
      /from\('usuario_unidades'\)\s*\.select\([^)]*\)\s*\.eq\('usuario_id', user\.id\)\s*\.eq\('unidade_id', unidadeId\)\s*\.eq\('papel', 'gestor'\)\s*\.eq\('ativo', true\)/,
    );
    expect(fonte).not.toMatch(/unidade_id: gestorData\.unidade_id/);
  });

  it('desfaz a conta criada quando o vínculo falha', () => {
    // Sem vínculo o motorista some da lista (que vem de usuario_unidades) e
    // o gestor não tem como criá-lo: a tela diria "adicionado" em vão.
    const chamadas = fonte.match(/deleteUser\(authData\.user\.id\)/g) ?? [];
    expect(chamadas).toHaveLength(2);
    expect(fonte).not.toMatch(/Não falhar - o registro principal foi criado/);
  });

  it('busca o e-mail por igualdade, sem curinga', () => {
    expect(fonte).toMatch(/\.eq\('email', emailNormalizado\)/);
    expect(fonte).not.toMatch(/ilike/);
  });

  it('o aviso de telefone não manda mais cadastrar pelo e-mail', () => {
    expect(MSG_TELEFONE_OUTRA_LOJA).not.toMatch(/e-mail/);
    expect(MSG_TELEFONE_OUTRA_LOJA).toMatch(/fale com o suporte/);
  });
});

describe('criar-motorista: entrada e permissão', () => {
  it('usa validarCorpo e decidirPermissao do módulo puro', () => {
    expect(fonte).toMatch(
      /import\s*\{[^}]*\bvalidarCorpo\b[^}]*\}\s*from\s*'\.\/entrada\.ts'/,
    );
    expect(fonte).toMatch(
      /import\s*\{[^}]*\bdecidirPermissao\b[^}]*\}\s*from\s*'\.\/entrada\.ts'/,
    );
  });

  it('guarda o erro da consulta do vínculo', () => {
    expect(fonte).not.toMatch(/const\s*\{\s*data:\s*vinculoGestor\s*\}\s*=/);
  });

  it('responde 503 quando não consegue conferir a permissão', () => {
    expect(fonte).toMatch(/status: 503/);
  });

  it('lê o corpo dentro de try', () => {
    expect(fonte).toMatch(/try\s*\{\s*corpo = await req\.json\(\)/);
  });
});
