// Guarda estática da Migration 89 (pendências 26 e 30(h)):
// `desempenho_motorista_na_loja(uuid, uuid)` devolve as métricas da
// `vw_performance_motoristas` contando só as rotas de uma loja, e só para
// gestor com vínculo ativo de gestor nela. O comportamento se prova com a
// sonda.
import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
} from './_helpers/migration';

const ARQUIVO = '20261108124000_desempenho_motorista_por_loja.sql';
const ASSINATURA = 'public.desempenho_motorista_na_loja(uuid, uuid)';

const m = carregarMigration(ARQUIVO);
const { executavel, rollback } = m;
const sonda = lerSonda('20261108124000_sonda_migration89.sql');

const INICIO =
  'CREATE OR REPLACE FUNCTION public.desempenho_motorista_na_loja(';
const corpo = (() => {
  const i = executavel.indexOf(INICIO);
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
})();

// As métricas que a tela do perfil lê da view (MotoristaPerformance).
const METRICAS = [
  'total_rotas',
  'rotas_concluidas',
  'rotas_em_andamento',
  'rotas_nao_executadas',
  'rotas_canceladas',
  'taxa_execucao',
  'distancia_total_km',
  'tempo_medio_minutos',
];

describe('Migration 89: desempenho_motorista_na_loja', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('assinatura: (p_motorista_id uuid, p_unidade_id uuid) RETURNS jsonb, STABLE, DEFINER, search_path vazio', () => {
    expect(corpo).not.toBe('');
    expect(corpo).toMatch(
      /\(\s*p_motorista_id uuid,\s*p_unidade_id uuid\s*\)\s*RETURNS jsonb/,
    );
    expect(corpo).toMatch(/\bSTABLE\b/);
    expect(corpo).toMatch(/SECURITY DEFINER/);
    expect(corpo).toMatch(/SET search_path = ''/);
  });

  it('recusa SEM_PERMISSAO sem sessão ou sem vínculo ativo de gestor na loja, antes de ler rotas', () => {
    const guarda =
      corpo.match(
        /IF auth\.uid\(\) IS NULL OR NOT EXISTS \([\s\S]*?END IF;/,
      )?.[0] ?? '';
    expect(guarda).toMatch(/uu\.usuario_id = auth\.uid\(\)/);
    expect(guarda).toMatch(/uu\.unidade_id = p_unidade_id/);
    expect(guarda).toMatch(/uu\.papel::text = 'gestor'/);
    expect(guarda).toMatch(/uu\.ativo = true/);
    expect(guarda).toMatch(
      /'success', false, 'code', 'SEM_PERMISSAO',\s+'error', '[^']+'/,
    );
    expect(corpo.indexOf(guarda)).toBeLessThan(
      corpo.indexOf('FROM public.rotas r'),
    );
    expect(corpo).not.toMatch(/RAISE EXCEPTION/);
  });

  it('conta só as rotas do motorista nesta loja', () => {
    expect(corpo).toMatch(
      /FROM public\.rotas r\s+WHERE r\.motorista_id = p_motorista_id\s+AND r\.unidade_id = p_unidade_id;/,
    );
  });

  it('devolve success e as mesmas métricas da view', () => {
    expect(corpo).toContain("'success', true,");
    for (const metrica of METRICAS) {
      expect(corpo).toContain(`'${metrica}',`);
    }
  });

  it('fórmulas da view da Migration 80 (taxa, distância só das concluídas, tempo real até 24 h)', () => {
    expect(corpo).toMatch(
      /round\(\s+count\(r\.id\) FILTER \(WHERE r\.status::text = 'concluida'\)::numeric \* 100::numeric\s+\/ count\(r\.id\) FILTER \(WHERE r\.status::text IN \('concluida', 'nao_executada'\)\)::numeric,\s+1\s+\)\s+ELSE 100\.0/,
    );
    expect(corpo).toMatch(
      /'distancia_total_km', sum\(r\.distancia_total\) FILTER \(WHERE r\.status::text = 'concluida'\)/,
    );
    expect(corpo).toMatch(
      /avg\(extract\(epoch FROM r\.concluida_em - r\.iniciada_em\) \/ 60\) FILTER \([\s\S]*?r\.concluida_em > r\.iniciada_em\s+AND r\.concluida_em - r\.iniciada_em < interval '24 hours'/,
    );
  });

  it('ACL: dono postgres, sem PUBLIC/anon, EXECUTE de authenticated e service_role', () => {
    expect(executavel).toContain(
      `ALTER FUNCTION ${ASSINATURA} OWNER TO postgres;`,
    );
    expect(executavel).toContain(
      `REVOKE ALL ON FUNCTION ${ASSINATURA} FROM PUBLIC, anon;`,
    );
    expect(executavel).toContain(
      `GRANT EXECUTE ON FUNCTION ${ASSINATURA} TO authenticated, service_role;`,
    );
  });

  it('COMMENT da Migration 89 com o code de recusa', () => {
    const comment =
      executavel.match(
        /COMMENT ON FUNCTION public\.desempenho_motorista_na_loja\(uuid, uuid\) IS\s+'(Migration 89:[^']*)'/,
      )?.[1] ?? '';
    expect(comment).not.toBe('');
    expect(comment).toContain('SEM_PERMISSAO');
  });

  it('rollback colável: apaga a função', () => {
    expect(rollback).toContain(`DROP FUNCTION IF EXISTS ${ASSINATURA};`);
  });

  it('sonda transacional desfeita pelo RAISE, com duas lojas e a recusa', () => {
    expect(sonda).toMatch(/^DO \$\$/m);
    expect(sonda).toMatch(
      /RAISE EXCEPTION 'SONDA M89 \(desfeita\): % OK \| % FALHOU/,
    );
    for (const termo of [
      'public.desempenho_motorista_na_loja(',
      "'SEM_PERMISSAO'",
      'public.vw_performance_motoristas',
      'SET LOCAL ROLE authenticated;',
      '@example.invalid',
    ]) {
      expect(sonda).toContain(termo);
    }
    expect(sonda).not.toMatch(/^\s*COMMIT;/m);
  });

  it('MIGRATIONS.md registra a 89', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### (⏳|✅) Migration 89:/);
    expect(doc).toContain(ARQUIVO);
  });
});
