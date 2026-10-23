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

  it('grava primeiro na própria linha e exige que ela exista', () => {
    // Conta sem linha em usuarios não pode tirar o token de terceiros.
    const propria = funcao.search(
      /SET push_token = p_token\s+WHERE id = v_uid/,
    );
    const naoAchou = funcao.search(/IF NOT FOUND THEN\s+RAISE EXCEPTION/);
    const outras = funcao.search(/SET push_token = NULL/);
    expect(propria).toBeGreaterThan(-1);
    expect(naoAchou).toBeGreaterThan(propria);
    expect(outras).toBeGreaterThan(naoAchou);
  });

  it('serializa por token e limita o tamanho', () => {
    expect(funcao).toMatch(
      /PERFORM pg_advisory_xact_lock\(hashtext\(p_token\)\)/,
    );
    expect(funcao.search(/pg_advisory_xact_lock/)).toBeLessThan(
      funcao.search(/UPDATE public\.usuarios/),
    );
    expect(funcao).toMatch(/length\(p_token\) > 200/);
  });

  it('marca o caminho da RPC antes de zerar nas outras contas', () => {
    const marca = funcao.search(
      /PERFORM set_config\('rotamestre\.push_rpc', '1', true\)/,
    );
    expect(marca).toBeGreaterThan(-1);
    expect(marca).toBeLessThan(funcao.search(/SET push_token = NULL/));
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
    // Só no caminho da RPC: UPDATE direto de gestor continua recusado.
    expect(trava).toMatch(
      /current_setting\('rotamestre\.push_rpc', true\) = '1'/,
    );
    expect(trava).toMatch(/to_jsonb\(NEW\) - 'push_token'/);
    expect(trava).toMatch(/to_jsonb\(OLD\) - 'push_token'/);
    // E o resto da trava continua lá.
    expect(trava).toMatch(/só dá para mudar nome e telefone/);
  });

  it('tem rollback, sonda e entrada pendente no MIGRATIONS.md', () => {
    expect(sql).toMatch(/-- ROLLBACK:/);
    expect(sql).toMatch(/RAISE EXCEPTION 'SONDA/);
    expect(sql).toMatch(/SET LOCAL ROLE authenticated/);
    expect(sql).toMatch(/SET LOCAL ROLE anon/);
  });

  describe('sonda', () => {
    const sonda = sql.slice(
      Math.max(0, sql.indexOf('-- SONDA')),
      sql.indexOf('-- ROLLBACK:'),
    );

    it('escolhe motorista que atende outra loja do ponto de vista de B, ou sai em SKIP claro', () => {
      // Sem isso a trava retorna cedo e os casos negativos acusam falso defeito.
      expect(sonda).toMatch(/count\(\*\) >= 2/);
      expect(sonda).toMatch(/NOT public\.motorista_atende_outra_loja\(v_a\)/);
      expect(sonda).toMatch(
        /SONDA M39 \(desfeita\): SKIP sem motorista em duas lojas/,
      );
    });

    it('prova que a exceção da trava só vale pela RPC (UPDATE direto sem a marca → P0001)', () => {
      expect(sonda).toMatch(/\(0\) UPDATE direto SEM a marca/);
      const caso0 = sonda.slice(sonda.indexOf('(0) UPDATE direto SEM a marca'));
      expect(caso0).toMatch(/set_config\('rotamestre\.push_rpc', '', true\)/);
      expect(caso0).toMatch(/SET push_token = NULL WHERE id = v_a/);
    });

    it('explica que (0)–(2) rodam como postgres com claims de B', () => {
      expect(sonda).toMatch(/como postgres com as claims de B/);
      expect(sonda).toMatch(/trava DEFINER, não a RLS/);
    });
    // Checkout no Windows vem com CRLF; o índice guarda LF.
    const doc = readFileSync(
      join(RAIZ, 'database', 'MIGRATIONS.md'),
      'utf8',
    ).replace(/\r\n/g, '\n');
    expect(doc).toMatch(
      new RegExp(
        // ⏳ a aplicar ou ✅ aplicada: a entrada existe nos dois estados.
        `### (⏳|✅) Migration 39:[^\\n]*\\n+\\*\\*Arquivo:\\*\\* \`${ARQUIVO}\``,
      ),
    );
  });
});
