// Guarda estática da Migration 76 (gatilho `trg_rota_status_pelo_gestor`:
// quem não é gestor ativo da loja da rota só leva o status de `pendente` a
// `em_andamento` (iniciar) e de `em_andamento` a `concluida` (a
// `finalizar_rota` e o app até a 1.14.2, que finaliza por UPDATE direto)).
// A troca de loja da rota NÃO é tratada aqui: `authenticated` não tem UPDATE
// na coluna `rotas.unidade_id` (privilégio por coluna), e a sonda prova que a
// API recebe 42501 antes e depois da migration. O comportamento se prova com
// a sonda (`database/sondas/`), desfeita pelo RAISE. Esta guarda impede que a
// função perca o SECURITY DEFINER (ela lê `usuario_unidades`), que a sessão
// sem usuário (cron, chave secreta, CLI) deixe de passar, que as duas
// transições do motorista saiam da lista, que a regra volte a olhar a loja e
// que as cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261027100000_rota_status_pelo_gestor.sql';
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
const FUNCAO = 'public.rota_status_pelo_gestor()';
const corpoFuncao = (() => {
  const i = executavel.indexOf(`CREATE OR REPLACE FUNCTION ${FUNCAO}`);
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
})();

describe('Migration 76: status da rota pelo gestor', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('o nome antigo (com loja) não existe mais em nenhuma pasta', () => {
    const antigo = '20261027100000_rota_loja_e_status_pelo_gestor.sql';
    expect(existsSync(join(raiz, 'database', 'migrations', antigo))).toBe(
      false,
    );
    expect(existsSync(join(raiz, 'supabase', 'migrations', antigo))).toBe(
      false,
    );
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
      /COMMENT ON FUNCTION public\.rota_status_pelo_gestor\(\) IS\s+'[^']*Migration 76/,
    );
  });

  it('sessão sem usuário passa antes de qualquer regra', () => {
    const semUsuario = corpoFuncao.search(
      /IF v_uid IS NULL THEN\s+RETURN NEW;\s+END IF;/,
    );
    expect(semUsuario).toBeGreaterThan(-1);
    expect(corpoFuncao.indexOf('RAISE EXCEPTION')).toBeGreaterThan(semUsuario);
  });

  it('gestor ativo da loja da rota passa', () => {
    expect(corpoFuncao).toMatch(/uu\.unidade_id = OLD\.unidade_id/);
    expect(corpoFuncao).toMatch(/uu\.papel::text = 'gestor'/);
    expect(corpoFuncao).toMatch(/uu\.ativo = true/);
  });

  it('quem não é gestor só inicia e conclui', () => {
    expect(corpoFuncao).toMatch(
      /\(OLD\.status = 'pendente' AND NEW\.status = 'em_andamento'\)/,
    );
    expect(corpoFuncao).toMatch(
      /\(OLD\.status = 'em_andamento' AND NEW\.status = 'concluida'\)/,
    );
    expect(corpoFuncao).toMatch(
      /RAISE EXCEPTION 'ROTA_TRANSICAO_RECUSADA'\s+USING ERRCODE = 'P0001'/,
    );
    expect(corpoFuncao.match(/RAISE EXCEPTION/g)).toHaveLength(1);
  });

  it('não trata troca de loja (a permissão de coluna já a barra)', () => {
    expect(corpoFuncao).not.toMatch(/NEW\.unidade_id/);
    expect(executavel).not.toMatch(/OF unidade_id/);
    expect(executavel).not.toMatch(/só muda de loja/);
  });

  it('gatilho BEFORE UPDATE OF status, por linha, com WHEN de status mudado', () => {
    expect(executavel).toContain(
      'DROP TRIGGER IF EXISTS trg_rota_status_pelo_gestor ON public.rotas;',
    );
    expect(executavel).toMatch(
      /CREATE TRIGGER trg_rota_status_pelo_gestor\s+BEFORE UPDATE OF status ON public\.rotas\s+FOR EACH ROW\s+WHEN \(OLD\.status IS DISTINCT FROM NEW\.status\)\s+EXECUTE FUNCTION public\.rota_status_pelo_gestor\(\);/,
    );
  });

  it('função do gatilho sem EXECUTE para PUBLIC, anon e authenticated', () => {
    expect(executavel).toContain(
      `REVOKE ALL ON FUNCTION ${FUNCAO} FROM PUBLIC, anon, authenticated;`,
    );
    expect(executavel).not.toMatch(
      /GRANT[^;]*rota_status_pelo_gestor[^;]*\b(anon|PUBLIC|authenticated)\b/,
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
      'DROP TRIGGER IF EXISTS trg_rota_status_pelo_gestor ON public.rotas;',
    );
    const func = rollback.indexOf(`DROP FUNCTION IF EXISTS ${FUNCAO};`);
    expect(trig).toBeGreaterThan(-1);
    expect(func).toBeGreaterThan(trig);
  });

  it('a sonda cobre os 9 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M76 \(desfeita\)/);
    for (let caso = 1; caso <= 9; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    expect(sonda).not.toContain("' | 10 OK: ");
    // Caso 1: a API não muda unidade_id (privilégio de coluna), antes e depois.
    expect(sonda).toMatch(/permission denied for table rotas/);
    expect(sonda).toMatch(
      /has_column_privilege\('authenticated', 'public\.rotas', 'unidade_id', 'UPDATE'\)/,
    );
    for (const rpc of ['cancelar_rota', 'finalizar_rota']) {
      expect(sonda).toContain(`public.${rpc}(`);
    }
    // UPDATE de início de rota do app (useRouteActions.startRoute).
    expect(sonda).toMatch(/AND status = 'pendente'\s+AND motorista_id = v_m/);
    expect(sonda).toMatch(/SET LOCAL ROLE service_role/);
    expect(sonda).toMatch(
      /to_regprocedure\('public\.rota_status_pelo_gestor\(\)'\)/,
    );
    expect(sonda).toMatch(/sonda-m76-/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M76 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 76 com o arquivo e a permissão de coluna', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 76: /);
    expect(doc).toContain(ARQUIVO);
    expect(doc).not.toContain('20261027100000_rota_loja_e_status_pelo_gestor');
    const i = doc.search(/### .*Migration 76: /);
    const fim = doc.indexOf('\n---', i);
    const entrada = doc.slice(i, fim).replace(/\s+/g, ' ');
    expect(entrada).toContain('permissão de coluna');
    expect(entrada).toContain('BKD-1');
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
