// Guarda estática da Migration 70 (RPC `cancelar_rota`: o gestor da loja
// cancela a rota e, na mesma transação, a parada `em_andamento` volta a
// `pendente`). O comportamento se prova com a sonda (`database/sondas/`), que
// monta o cenário como `authenticated` e é desfeita pelo RAISE. Esta guarda
// impede que a função perca SECURITY DEFINER / search_path vazio, que devolva
// algo fora dos quatro resultados, que a trava vire FOR UPDATE simples, que as
// pendentes passem a ser puladas (Decisão D1), que o EXECUTE volte a PUBLIC ou
// anon, que o ajuste do passado saia do id medido e que as cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261026120000_cancelar_rota_rpc.sql';
const PARADA_MEDIDA = 'af99fbdf-d040-41d9-b41c-011868640f7e';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261026120000_sonda_migration70.sql',
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

describe('Migration 70: RPC cancelar_rota', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('declara cancelar_rota(uuid) RETURNS text, SECURITY DEFINER, search_path vazio', () => {
    expect(executavel).toMatch(
      /CREATE OR REPLACE FUNCTION public\.cancelar_rota\(p_rota_id uuid\)\s+RETURNS text/,
    );
    expect(executavel).toMatch(/SECURITY DEFINER/);
    expect(executavel).toMatch(/SET search_path = ''/);
    expect(executavel).toContain(
      'ALTER FUNCTION public.cancelar_rota(uuid) OWNER TO postgres;',
    );
    expect(executavel).toMatch(/COMMENT ON FUNCTION public\.cancelar_rota\(uuid\) IS\s+'[^']*Migration 70/);
  });

  it('devolve só os quatro resultados', () => {
    const literais = new Set(executavel.match(/RETURN '([a-z_]+)'/g));
    expect([...literais].sort()).toEqual([
      "RETURN 'cancelada'",
      "RETURN 'ja_cancelada'",
      "RETURN 'sem_permissao'",
      "RETURN 'situacao_mudou'",
    ]);
    // Regra de negócio nunca vira exceção.
    expect(executavel).not.toMatch(/RAISE\s+EXCEPTION/);
  });

  it('confere gestor ativo da loja e trava com FOR NO KEY UPDATE', () => {
    expect(executavel).toMatch(/papel[^;]*'gestor'/);
    expect(executavel).toMatch(/ativo = true/);
    expect(executavel).toMatch(/auth\.uid\(\)/);
    expect(executavel).toMatch(/FOR NO KEY UPDATE/);
    expect(executavel).not.toMatch(/FOR UPDATE\b(?! OF)/);
  });

  it('fecha só em_andamento → pendente', () => {
    expect(executavel).toMatch(
      /UPDATE public\.paradas\s+SET status = 'pendente'[\s\S]*status = 'em_andamento'/,
    );
    expect(executavel).not.toMatch(/'pulada'/);
  });

  it('REVOKE de PUBLIC e anon; EXECUTE para authenticated e service_role', () => {
    expect(executavel).toContain(
      'REVOKE ALL ON FUNCTION public.cancelar_rota(uuid) FROM PUBLIC, anon;',
    );
    expect(executavel).toContain(
      'GRANT EXECUTE ON FUNCTION public.cancelar_rota(uuid) TO authenticated, service_role;',
    );
    expect(executavel).not.toMatch(/GRANT[^;]*\b(anon|PUBLIC)\b/);
  });

  it('ajuste do passado travado pelo id medido e pelo status', () => {
    const ajuste = executavel.slice(executavel.indexOf(PARADA_MEDIDA) - 400);
    expect(executavel).toContain(PARADA_MEDIDA);
    expect(ajuste).toMatch(
      new RegExp(
        `UPDATE public\\.paradas p\\s+SET status = 'pendente'[\\s\\S]*p\\.id = '${PARADA_MEDIDA}'[\\s\\S]*r\\.status = 'cancelada'[\\s\\S]*p\\.status = 'em_andamento'`,
      ),
    );
  });

  it('rollback colável: DROP da função e volta da parada medida', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    expect(rollback).toContain(
      'DROP FUNCTION IF EXISTS public.cancelar_rota(uuid);',
    );
    expect(rollback).toMatch(
      new RegExp(
        `SET status = 'em_andamento'[\\s\\S]*${PARADA_MEDIDA}[\\s\\S]*status = 'pendente'`,
      ),
    );
  });

  it('a sonda cobre os 12 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M70 \(desfeita\)/);
    for (let caso = 1; caso <= 12; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    // Catálogo lido sem abortar quando a função ainda não existe.
    expect(sonda).toMatch(/to_regprocedure\('public\.cancelar_rota\(uuid\)'\)/);
    expect(sonda).toMatch(/sonda-m70-/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M70 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 70 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 70: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const i = doc.search(/### .*Migration 70: /);
    const entrada = i < 0 ? '' : doc.slice(i);
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
