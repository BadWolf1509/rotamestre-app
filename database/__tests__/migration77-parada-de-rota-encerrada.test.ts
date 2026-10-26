// Guarda estática da Migration 77 (gatilho `trg_parada_de_rota_encerrada_nao_muda`:
// parada de rota `cancelada`, `concluida` ou `nao_executada` não muda de status
// por UPDATE vindo da API — papéis `authenticated` e `anon`; as RPCs SECURITY
// DEFINER, a chave secreta e o cron seguem mudando). Exceção única: a chegada
// (`is_checkpoint = false`) concluída depois da rota concluída, que é a ordem
// em que o app até a 1.14.2 finaliza (rota primeiro, chegada depois). O
// comportamento se prova com a sonda, desfeita pelo RAISE. Esta guarda impede
// que a função vire SECURITY DEFINER (com DEFINER, `current_user` seria sempre
// o dono e as RPCs seriam recusadas junto com a API), que o teste de papel
// passe a olhar `auth.uid()`, que a exceção da chegada se alargue e que as
// cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261027101000_parada_de_rota_encerrada_nao_muda.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261027101000_sonda_migration77.sql',
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
const FUNCAO = 'public.parada_de_rota_encerrada_nao_muda()';
const corpoFuncao = (() => {
  const i = executavel.indexOf(`CREATE OR REPLACE FUNCTION ${FUNCAO}`);
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
})();

describe('Migration 77: parada de rota encerrada não muda de status pela API', () => {
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
    expect(corpoFuncao).toMatch(/RETURNS trigger/);
    expect(corpoFuncao).toMatch(/LANGUAGE plpgsql/);
    expect(corpoFuncao).toMatch(/SECURITY INVOKER/);
    expect(corpoFuncao).not.toMatch(/SECURITY DEFINER/);
    expect(corpoFuncao).toMatch(/SET search_path = ''/);
    expect(executavel).toContain(`ALTER FUNCTION ${FUNCAO} OWNER TO postgres;`);
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.parada_de_rota_encerrada_nao_muda\(\) IS\s+'[^']*Migration 77/,
    );
  });

  it('decide pelo current_user antes de ler a rota', () => {
    const papel = corpoFuncao.search(
      /IF current_user NOT IN \('authenticated', 'anon'\) THEN\s+RETURN NEW;\s+END IF;/,
    );
    const leitura = corpoFuncao.search(/FROM public\.rotas r/);
    expect(papel).toBeGreaterThan(-1);
    expect(leitura).toBeGreaterThan(papel);
    expect(corpoFuncao).not.toMatch(/auth\.uid\(\)/);
    expect(corpoFuncao).not.toMatch(/session_user/);
  });

  it('recusa nos três status encerrados da rota, com PARADA_DE_ROTA_ENCERRADA', () => {
    expect(corpoFuncao).toMatch(/WHERE r\.id = OLD\.rota_id/);
    expect(corpoFuncao).toMatch(
      /v_status_rota NOT IN \('cancelada', 'concluida', 'nao_executada'\)/,
    );
    expect(corpoFuncao).toMatch(
      /RAISE EXCEPTION 'PARADA_DE_ROTA_ENCERRADA'\s+USING ERRCODE = 'P0001'/,
    );
    expect(corpoFuncao.match(/RAISE EXCEPTION/g)).toHaveLength(1);
  });

  it('a única exceção é a chegada ainda aberta concluída em rota concluída', () => {
    expect(corpoFuncao).toMatch(
      /IF v_status_rota = 'concluida'\s+AND OLD\.is_checkpoint = false\s+AND OLD\.status IN \('pendente', 'em_andamento'\)\s+AND NEW\.status = 'concluida' THEN\s+RETURN NEW;/,
    );
  });

  it('a sonda prova que a chegada pulada não vira concluida em rota concluída', () => {
    expect(sonda).toMatch(/' \| 11 OK: chegada pulada/);
  });

  it('gatilho BEFORE UPDATE OF status, por linha, com WHEN de status mudado', () => {
    expect(executavel).toContain(
      'DROP TRIGGER IF EXISTS trg_parada_de_rota_encerrada_nao_muda ON public.paradas;',
    );
    expect(executavel).toMatch(
      /CREATE TRIGGER trg_parada_de_rota_encerrada_nao_muda\s+BEFORE UPDATE OF status ON public\.paradas\s+FOR EACH ROW\s+WHEN \(NEW\.status IS DISTINCT FROM OLD\.status\)\s+EXECUTE FUNCTION public\.parada_de_rota_encerrada_nao_muda\(\);/,
    );
  });

  it('função do gatilho sem EXECUTE para PUBLIC, anon e authenticated', () => {
    expect(executavel).toContain(
      `REVOKE ALL ON FUNCTION ${FUNCAO} FROM PUBLIC, anon, authenticated;`,
    );
    expect(executavel).not.toMatch(
      /GRANT[^;]*parada_de_rota_encerrada_nao_muda[^;]*\b(anon|PUBLIC|authenticated)\b/,
    );
  });

  it('não mexe em policy, privilégio de tabela nem nas RPCs', () => {
    expect(executavel).not.toMatch(/\b(CREATE|ALTER|DROP) POLICY\b/);
    expect(executavel).not.toMatch(/ON (TABLE )?public\.paradas\s+(TO|FROM)/);
    for (const rpc of ['cancelar_rota', 'reativar_rota', 'finalizar_rota']) {
      expect(executavel).not.toContain(`FUNCTION public.${rpc}`);
    }
  });

  it('rollback colável: remove gatilho e depois a função', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    const trig = rollback.indexOf(
      'DROP TRIGGER IF EXISTS trg_parada_de_rota_encerrada_nao_muda ON public.paradas;',
    );
    const func = rollback.indexOf(`DROP FUNCTION IF EXISTS ${FUNCAO};`);
    expect(trig).toBeGreaterThan(-1);
    expect(func).toBeGreaterThan(trig);
  });

  it('a sonda cobre os 11 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M77 \(desfeita\)/);
    for (let caso = 1; caso <= 11; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    for (const rpc of ['reativar_rota', 'cancelar_rota', 'finalizar_rota']) {
      expect(sonda).toContain(`public.${rpc}(`);
    }
    // UPDATE da fila de ações do motorista (filaAcoesParada.atualizarSeAberta).
    expect(sonda).toMatch(/AND status IN \('pendente', 'em_andamento'\)/);
    expect(sonda).toMatch(/SET LOCAL ROLE service_role/);
    expect(sonda).toMatch(
      /to_regprocedure\('public\.parada_de_rota_encerrada_nao_muda\(\)'\)/,
    );
    expect(sonda).toMatch(/sonda-m77-/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M77 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 77 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 77: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const i = doc.search(/### .*Migration 77: /);
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
