// Guarda estática da Migration 76 (gatilho `trg_rotas_loja_e_status_pelo_gestor`:
// a rota só muda de loja pelo gestor ativo das duas lojas, como a parada e o
// incidente nas Migrations 58/59; e quem não é gestor ativo da loja da rota só
// leva o status de `pendente` a `em_andamento` (iniciar) e de `em_andamento` a
// `concluida` (a `finalizar_rota` e o app até a 1.14.2, que finaliza por UPDATE
// direto). O comportamento se prova com a sonda (`database/sondas/`), desfeita
// pelo RAISE. Esta guarda impede que a função perca o SECURITY DEFINER (ela lê
// `usuario_unidades`), que a sessão sem usuário (cron, chave secreta, CLI)
// deixe de passar, que as duas transições do motorista saiam da lista, que o
// gatilho deixe de olhar as duas colunas e que as cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261027100000_rota_loja_e_status_pelo_gestor.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261027100000_sonda_migration76.sql',
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
const FUNCAO = 'public.rotas_loja_e_status_pelo_gestor()';
const corpoFuncao = (() => {
  const i = executavel.indexOf(`CREATE OR REPLACE FUNCTION ${FUNCAO}`);
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
})();

describe('Migration 76: rota muda de loja e de status pelo gestor', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('função do gatilho: DEFINER, search_path vazio, dono postgres, COMMENT', () => {
    expect(corpoFuncao).toMatch(/RETURNS trigger/);
    expect(corpoFuncao).toMatch(/LANGUAGE plpgsql/);
    expect(corpoFuncao).toMatch(/SECURITY DEFINER/);
    expect(corpoFuncao).toMatch(/SET search_path = ''/);
    expect(executavel).toContain(`ALTER FUNCTION ${FUNCAO} OWNER TO postgres;`);
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.rotas_loja_e_status_pelo_gestor\(\) IS\s+'[^']*Migration 76/,
    );
  });

  it('sessão sem usuário passa antes de qualquer regra', () => {
    const semUsuario = corpoFuncao.search(
      /IF v_uid IS NULL THEN\s+RETURN NEW;\s+END IF;/,
    );
    expect(semUsuario).toBeGreaterThan(-1);
    expect(corpoFuncao.indexOf('RAISE EXCEPTION')).toBeGreaterThan(semUsuario);
  });

  it('troca de loja exige gestor ativo da loja antiga e da nova', () => {
    expect(corpoFuncao).toMatch(
      /IF NEW\.unidade_id IS DISTINCT FROM OLD\.unidade_id THEN/,
    );
    expect(corpoFuncao).toMatch(/uu\.unidade_id = OLD\.unidade_id/);
    expect(corpoFuncao).toMatch(/uu\.unidade_id = NEW\.unidade_id/);
    expect(corpoFuncao.match(/uu\.papel::text = 'gestor'/g)?.length).toBe(2);
    expect(corpoFuncao.match(/uu\.ativo = true/g)?.length).toBe(2);
    expect(corpoFuncao).toMatch(
      /RAISE EXCEPTION 'A rota só muda de loja pelo gestor das duas lojas\.'\s+USING ERRCODE = '42501'/,
    );
  });

  it('quem não é gestor só inicia e conclui', () => {
    expect(corpoFuncao).toMatch(
      /IF NEW\.status IS DISTINCT FROM OLD\.status AND NOT v_gestor_origem THEN/,
    );
    expect(corpoFuncao).toMatch(
      /\(OLD\.status = 'pendente' AND NEW\.status = 'em_andamento'\)/,
    );
    expect(corpoFuncao).toMatch(
      /\(OLD\.status = 'em_andamento' AND NEW\.status = 'concluida'\)/,
    );
    expect(corpoFuncao).toMatch(
      /RAISE EXCEPTION 'ROTA_TRANSICAO_RECUSADA'\s+USING ERRCODE = 'P0001'/,
    );
    expect(corpoFuncao.match(/RAISE EXCEPTION/g)).toHaveLength(2);
  });

  it('gatilho BEFORE UPDATE OF unidade_id, status, por linha, com WHEN', () => {
    expect(executavel).toContain(
      'DROP TRIGGER IF EXISTS trg_rotas_loja_e_status_pelo_gestor ON public.rotas;',
    );
    expect(executavel).toMatch(
      /CREATE TRIGGER trg_rotas_loja_e_status_pelo_gestor\s+BEFORE UPDATE OF unidade_id, status ON public\.rotas\s+FOR EACH ROW\s+WHEN \(OLD\.unidade_id IS DISTINCT FROM NEW\.unidade_id OR OLD\.status IS DISTINCT FROM NEW\.status\)\s+EXECUTE FUNCTION public\.rotas_loja_e_status_pelo_gestor\(\);/,
    );
  });

  it('função do gatilho sem EXECUTE para PUBLIC, anon e authenticated', () => {
    expect(executavel).toContain(
      `REVOKE ALL ON FUNCTION ${FUNCAO} FROM PUBLIC, anon, authenticated;`,
    );
    expect(executavel).not.toMatch(
      /GRANT[^;]*rotas_loja_e_status_pelo_gestor[^;]*\b(anon|PUBLIC|authenticated)\b/,
    );
  });

  it('não mexe em policy, privilégio de tabela nem nas RPCs', () => {
    expect(executavel).not.toMatch(/\b(CREATE|ALTER|DROP) POLICY\b/);
    expect(executavel).not.toMatch(/ON (TABLE )?public\.rotas\s+(TO|FROM)/);
    for (const rpc of [
      'cancelar_rota',
      'reativar_rota',
      'finalizar_rota',
      'validar_motorista_e_loja_da_rota',
    ]) {
      expect(executavel).not.toContain(`FUNCTION public.${rpc}`);
    }
  });

  it('rollback colável: remove gatilho e depois a função', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    const trig = rollback.indexOf(
      'DROP TRIGGER IF EXISTS trg_rotas_loja_e_status_pelo_gestor ON public.rotas;',
    );
    const func = rollback.indexOf(`DROP FUNCTION IF EXISTS ${FUNCAO};`);
    expect(trig).toBeGreaterThan(-1);
    expect(func).toBeGreaterThan(trig);
  });

  it('a sonda cobre os 10 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M76 \(desfeita\)/);
    for (let caso = 1; caso <= 10; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    for (const rpc of ['cancelar_rota', 'finalizar_rota']) {
      expect(sonda).toContain(`public.${rpc}(`);
    }
    // UPDATE de início de rota do app (useRouteActions.startRoute).
    expect(sonda).toMatch(/AND status = 'pendente'\s+AND motorista_id = v_m/);
    expect(sonda).toMatch(/SET LOCAL ROLE service_role/);
    expect(sonda).toMatch(
      /to_regprocedure\('public\.rotas_loja_e_status_pelo_gestor\(\)'\)/,
    );
    expect(sonda).toMatch(/sonda-m76-/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M76 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 76 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 76: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const i = doc.search(/### .*Migration 76: /);
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
