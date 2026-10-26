// Guarda estática da Migration 71 (RPC `reativar_rota`: o gestor da loja
// reabre a rota `nao_executada` com a data de hoje em São Paulo e, na mesma
// transação, devolve a `pendente` toda parada que não está `concluida`,
// gravando o log `rota_reativada`). O comportamento se prova com a sonda
// (`database/sondas/`), que monta o cenário como `authenticated` e é desfeita
// pelo RAISE. Esta guarda impede que a função perca SECURITY DEFINER /
// search_path vazio, que devolva algo fora dos três resultados, que a data
// passe a vir do aparelho ou do relógio UTC, que a trava vire FOR UPDATE
// simples, que o EXECUTE volte a PUBLIC ou anon e que as cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261026121000_reativar_rota_rpc.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261026121000_sonda_migration71.sql',
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

describe('Migration 71: RPC reativar_rota', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('declara reativar_rota(uuid) RETURNS text, SECURITY DEFINER, search_path vazio', () => {
    expect(executavel).toMatch(
      /CREATE OR REPLACE FUNCTION public\.reativar_rota\(p_rota_id uuid\)\s+RETURNS text/,
    );
    expect(executavel).toMatch(/SECURITY DEFINER/);
    expect(executavel).toMatch(/SET search_path = ''/);
    expect(executavel).toContain(
      'ALTER FUNCTION public.reativar_rota(uuid) OWNER TO postgres;',
    );
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.reativar_rota\(uuid\) IS\s+'[^']*Migration 71/,
    );
  });

  it('devolve só os três resultados', () => {
    const literais = new Set(executavel.match(/RETURN '([a-z_]+)'/g));
    expect([...literais].sort()).toEqual([
      "RETURN 'reativada'",
      "RETURN 'sem_permissao'",
      "RETURN 'situacao_mudou'",
    ]);
    // Regra de negócio nunca vira exceção.
    expect(executavel).not.toMatch(/RAISE\s+EXCEPTION/);
  });

  it('só reativa nao_executada e usa a data de São Paulo', () => {
    expect(executavel).toMatch(/'nao_executada'/);
    expect(executavel).toMatch(/now\(\) AT TIME ZONE 'America\/Sao_Paulo'/);
    // Nem relógio do servidor (UTC) nem data vinda do aparelho.
    expect(executavel).not.toMatch(/CURRENT_DATE/i);
    expect(executavel).not.toMatch(/p_data\b/);
    expect(executavel).toMatch(
      /UPDATE public\.rotas\s+SET status = 'pendente',\s*data = v_hoje,\s*iniciada_em = NULL,\s*concluida_em = NULL/,
    );
  });

  it('confere gestor ativo da loja e trava com FOR NO KEY UPDATE', () => {
    expect(executavel).toMatch(/papel[^;]*'gestor'/);
    expect(executavel).toMatch(/ativo = true/);
    expect(executavel).toMatch(/auth\.uid\(\)/);
    expect(executavel).toMatch(/FOR NO KEY UPDATE/);
    expect(executavel).not.toMatch(/FOR UPDATE\b(?! OF)/);
  });

  it('espelha o cliente nas paradas: tudo que não é concluida volta a pendente', () => {
    expect(executavel).toMatch(
      /UPDATE public\.paradas\s+SET status = 'pendente',\s*concluida_em = NULL[\s\S]*status <> 'concluida'/,
    );
    // motivo_skip e foto ficam como estão.
    expect(executavel).not.toMatch(/motivo_skip\s*=/);
    expect(executavel).not.toMatch(/foto_url\s*=/);
  });

  it("grava o log 'rota_reativada' com nova_data e reativado_por", () => {
    expect(executavel).toMatch(
      /INSERT INTO public\.logs[\s\S]*'rota_reativada'[\s\S]*'nova_data'[\s\S]*'reativado_por'/,
    );
  });

  it('REVOKE de PUBLIC e anon; EXECUTE para authenticated e service_role', () => {
    expect(executavel).toContain(
      'REVOKE ALL ON FUNCTION public.reativar_rota(uuid) FROM PUBLIC, anon;',
    );
    expect(executavel).toContain(
      'GRANT EXECUTE ON FUNCTION public.reativar_rota(uuid) TO authenticated, service_role;',
    );
    expect(executavel).not.toMatch(/GRANT[^;]*\b(anon|PUBLIC)\b/);
  });

  it('rollback colável: DROP FUNCTION IF EXISTS public.reativar_rota(uuid);', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    expect(rollback).toContain(
      'DROP FUNCTION IF EXISTS public.reativar_rota(uuid);',
    );
  });

  it('a sonda cobre os 10 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M71 \(desfeita\)/);
    for (let caso = 1; caso <= 10; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    // Catálogo lido sem abortar quando a função ainda não existe.
    expect(sonda).toMatch(/to_regprocedure\('public\.reativar_rota\(uuid\)'\)/);
    // A data esperada vem do relógio de São Paulo (Review Focus 5).
    expect(sonda).toMatch(/now\(\) AT TIME ZONE 'America\/Sao_Paulo'/);
    expect(sonda).toMatch(/sonda-m71-/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M71 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 71 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 71: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const i = doc.search(/### .*Migration 71: /);
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
