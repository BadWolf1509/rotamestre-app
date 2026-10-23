/**
 * Guarda estática da migration que faz um token de push pertencer a UMA
 * conta. O banco é único (produção) e não há pgTAP: a semântica é provada pela
 * sonda transacional comentada no próprio arquivo; aqui fica o que nunca pode
 * regredir no texto.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const ARQUIVO = '20261023010000_push_token_de_uma_conta_so.sql';
const canonica = join(RAIZ, 'database', 'migrations', ARQUIVO);
const copia = join(RAIZ, 'supabase', 'migrations', ARQUIVO);

const sql = existsSync(canonica) ? readFileSync(canonica, 'utf8') : '';
const semRollback = sql.split('-- ROLLBACK:')[0] ?? '';
const funcao =
  semRollback.match(
    /CREATE OR REPLACE FUNCTION public\.registrar_push_token[\s\S]*?\$\$;/,
  )?.[0] ?? '';
const trava =
  semRollback.match(
    /CREATE OR REPLACE FUNCTION public\.trava_motorista_outra_loja[\s\S]*?\$function\$;/,
  )?.[0] ?? '';

describe('migration registrar_push_token', () => {
  it('existe nas duas pastas, idêntica', () => {
    expect(existsSync(canonica)).toBe(true);
    expect(existsSync(copia)).toBe(true);
    expect(readFileSync(copia, 'utf8')).toBe(sql);
  });

  it('é SECURITY DEFINER com search_path vazio', () => {
    expect(funcao).toMatch(/SECURITY DEFINER/);
    expect(funcao).toMatch(/SET search_path = ''/);
  });

  it('exige usuário autenticado e token no formato Expo', () => {
    expect(funcao).toMatch(/auth\.uid\(\)/);
    expect(funcao).toMatch(/IS NULL THEN\s+RAISE EXCEPTION/);
    expect(funcao).toMatch(/PushToken/);
  });

  it('tira o token de qualquer OUTRA conta e grava na de quem chama', () => {
    expect(funcao).toMatch(
      /SET push_token = NULL\s+WHERE push_token = p_token\s+AND id <> v_uid/,
    );
    expect(funcao).toMatch(/SET push_token = p_token\s+WHERE id = v_uid/);
  });

  it('só authenticated executa', () => {
    expect(semRollback).toMatch(
      /REVOKE ALL ON FUNCTION public\.registrar_push_token\(text\) FROM PUBLIC, anon;/,
    );
    expect(semRollback).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.registrar_push_token\(text\) TO authenticated;/,
    );
  });

  it('a trava de motorista de outra loja deixa passar SÓ zerar o push_token', () => {
    // Sem isso, B limpando o token que ficou na linha de A (motorista de outra
    // loja) cairia na exceção "só dá para mudar nome e telefone".
    expect(trava).toMatch(/NEW\.push_token IS NULL/);
    expect(trava).toMatch(/to_jsonb\(NEW\) - 'push_token'/);
    expect(trava).toMatch(/to_jsonb\(OLD\) - 'push_token'/);
    // E o resto da trava continua lá.
    expect(trava).toMatch(/só dá para mudar nome e telefone/);
  });

  it('tem rollback, sonda e entrada pendente no MIGRATIONS.md', () => {
    expect(sql).toMatch(/-- ROLLBACK:/);
    expect(sql).toMatch(/RAISE EXCEPTION 'SONDA/);
    const doc = readFileSync(join(RAIZ, 'database', 'MIGRATIONS.md'), 'utf8');
    expect(doc).toMatch(
      new RegExp(`### ⏳ [^\\n]*\\n+\\*\\*Arquivo:\\*\\* \`${ARQUIVO}\``),
    );
  });
});
