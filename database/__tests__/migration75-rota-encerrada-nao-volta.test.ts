// Guarda estática da Migration 75 (gatilho `trg_rota_encerrada_nao_volta`:
// rota `cancelada`, `concluida` ou `nao_executada` não muda de status por
// UPDATE vindo da API — papéis `authenticated` e `anon`; as RPCs SECURITY
// DEFINER, a chave secreta e o cron seguem mudando). O comportamento se prova
// com a sonda (`database/sondas/`), que reproduz os UPDATEs do app como
// `authenticated` e é desfeita pelo RAISE. Esta guarda impede que a função do
// gatilho vire SECURITY DEFINER (com DEFINER, `current_user` seria sempre o
// dono e a RPC seria recusada junto com a API), que o teste de papel passe a
// olhar `auth.uid()` (a RPC roda com a sessão de quem chama), que o gatilho
// deixe de ser BEFORE UPDATE OF status com o WHEN dos três status encerrados,
// que o erro perca o código `ROTA_ENCERRADA`, que a função ganhe EXECUTE para
// PUBLIC, anon ou authenticated e que as cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261026125000_rota_encerrada_nao_volta.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261026125000_sonda_migration75.sql',
);
const caminhoDoc = join(raiz, 'database', 'MIGRATIONS.md');

const ler = (p: string) =>
  existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '';
const sql = ler(caminhoDb);
const sonda = ler(caminhoSonda);
const semComentarios = (texto: string) =>
  texto
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
const executavel = semComentarios(sql);
const rollback = (() => {
  const i = sql.indexOf('-- ROLLBACK:');
  if (i < 0) return '';
  return sql
    .slice(i)
    .split('\n')
    .map((l) => l.replace(/^-- ?/, ''))
    .join('\n');
})();
const corpoFuncao = (() => {
  const i = executavel.indexOf(
    'CREATE OR REPLACE FUNCTION public.rota_encerrada_nao_volta()',
  );
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
})();

describe('Migration 75: rota encerrada não volta por UPDATE direto', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('função do gatilho: INVOKER, search_path vazio, dono postgres, COMMENT', () => {
    expect(executavel).toMatch(
      /CREATE OR REPLACE FUNCTION public\.rota_encerrada_nao_volta\(\)\s+RETURNS trigger/,
    );
    expect(corpoFuncao).toMatch(/LANGUAGE plpgsql/);
    expect(corpoFuncao).toMatch(/SECURITY INVOKER/);
    expect(corpoFuncao).not.toMatch(/SECURITY DEFINER/);
    expect(corpoFuncao).toMatch(/SET search_path = ''/);
    expect(executavel).toContain(
      'ALTER FUNCTION public.rota_encerrada_nao_volta() OWNER TO postgres;',
    );
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.rota_encerrada_nao_volta\(\) IS\s+'[^']*Migration 75/,
    );
  });

  it('recusa só quando o UPDATE vem dos papéis da API, pelo current_user', () => {
    expect(corpoFuncao).toMatch(
      /IF current_user IN \('authenticated', 'anon'\) THEN\s+RAISE EXCEPTION 'ROTA_ENCERRADA'/,
    );
    expect(corpoFuncao).toMatch(/USING ERRCODE = 'P0001'/);
    // A RPC roda com a sessão de quem chama: auth.uid() não separa API de RPC.
    expect(corpoFuncao).not.toMatch(/auth\.uid\(\)/);
    expect(corpoFuncao).not.toMatch(/session_user/);
    // Uma só saída de erro, e o resto segue.
    expect(corpoFuncao.match(/RAISE EXCEPTION/g)).toHaveLength(1);
    expect(corpoFuncao).toMatch(/RETURN NEW;/);
  });

  it('gatilho BEFORE UPDATE OF status com o WHEN dos três status encerrados', () => {
    expect(executavel).toContain(
      'DROP TRIGGER IF EXISTS trg_rota_encerrada_nao_volta ON public.rotas;',
    );
    expect(executavel).toMatch(
      /CREATE TRIGGER trg_rota_encerrada_nao_volta\s+BEFORE UPDATE OF status ON public\.rotas\s+FOR EACH ROW\s+WHEN \(OLD\.status IN \('cancelada', 'concluida', 'nao_executada'\) AND NEW\.status IS DISTINCT FROM OLD\.status\)\s+EXECUTE FUNCTION public\.rota_encerrada_nao_volta\(\);/,
    );
  });

  it('função do gatilho sem EXECUTE para PUBLIC, anon e authenticated', () => {
    expect(executavel).toContain(
      'REVOKE ALL ON FUNCTION public.rota_encerrada_nao_volta() FROM PUBLIC, anon, authenticated;',
    );
    expect(executavel).not.toMatch(
      /GRANT[^;]*rota_encerrada_nao_volta[^;]*\b(anon|PUBLIC|authenticated)\b/,
    );
  });

  it('não mexe em policy, privilégio de tabela nem nas RPCs', () => {
    expect(executavel).not.toMatch(/\b(CREATE|ALTER|DROP) POLICY\b/);
    expect(executavel).not.toMatch(/ON (TABLE )?public\.rotas\s+(TO|FROM)/);
    for (const rpc of ['cancelar_rota', 'reativar_rota', 'finalizar_rota']) {
      expect(executavel).not.toContain(`FUNCTION public.${rpc}`);
    }
  });

  it('rollback colável: remove gatilho e depois a função', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    const trig = rollback.indexOf(
      'DROP TRIGGER IF EXISTS trg_rota_encerrada_nao_volta ON public.rotas;',
    );
    const func = rollback.indexOf(
      'DROP FUNCTION IF EXISTS public.rota_encerrada_nao_volta();',
    );
    expect(trig).toBeGreaterThan(-1);
    expect(func).toBeGreaterThan(trig);
  });

  it('a sonda cobre os 10 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M75 \(desfeita\)/);
    for (let caso = 1; caso <= 10; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    for (const rpc of ['reativar_rota', 'cancelar_rota', 'finalizar_rota']) {
      expect(sonda).toContain(`public.${rpc}(`);
    }
    // UPDATE de início de rota do app (useRouteActions.startRoute).
    expect(sonda).toMatch(/AND status = 'pendente'\s+AND motorista_id = v_m/);
    expect(sonda).toMatch(/SET LOCAL ROLE service_role/);
    expect(sonda).toMatch(
      /to_regprocedure\('public\.rota_encerrada_nao_volta\(\)'\)/,
    );
    expect(sonda).toMatch(/sonda-m75-/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M75 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 75 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 75: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const i = doc.search(/### .*Migration 75: /);
    const fim = i < 0 ? -1 : doc.indexOf('\n---', i);
    const entrada = i < 0 ? '' : doc.slice(i, fim < 0 ? undefined : fim);
    const publicos = [sql, sonda, entrada].join('\n').toLowerCase();
    for (const termo of [
      'vaza',
      'ataque',
      'atacante',
      'brecha',
      'explor',
      'vulnerab',
      'falha',
    ]) {
      expect(publicos).not.toContain(termo);
    }
  });
});
