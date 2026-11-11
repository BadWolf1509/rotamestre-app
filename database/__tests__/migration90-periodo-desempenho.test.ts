// Guarda estática da Migration 90 (filtros por período): as duas RPCs de
// desempenho ganham `p_de`/`p_ate`, o resumo ganha `tempo_medio_minutos`, e
// entram os índices de loja + data. O comportamento — inclusive a chamada
// antiga respondendo igual — se prova com a sonda; esta guarda impede que uma
// edição perca as peças que fecham o caso.
import { RPC_RESUMO_DESEMPENHO } from '@/lib/motorista/resumoDesempenho';

import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
} from './_helpers/migration';

const ARQUIVO = '20261110120000_periodo_desempenho.sql';
const NA_LOJA = 'public.desempenho_motorista_na_loja(uuid, uuid, date, date)';
const RESUMO = 'public.resumo_desempenho_motorista(uuid, integer, date, date)';

const m = carregarMigration(ARQUIVO);
const { executavel, rollback } = m;
const sonda = lerSonda('20261110120000_sonda_migration90.sql');

const corpoDe = (inicio: string): string => {
  const i = executavel.indexOf(inicio);
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
};
const corpoNaLoja = corpoDe(
  'CREATE FUNCTION public.desempenho_motorista_na_loja(',
);
const corpoResumo = corpoDe(
  'CREATE FUNCTION public.resumo_desempenho_motorista(',
);

describe('Migration 90: arquivos e transação', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('apaga as assinaturas antigas antes de criar as novas', () => {
    const dropNaLoja = executavel.indexOf(
      'DROP FUNCTION IF EXISTS public.desempenho_motorista_na_loja(uuid, uuid);',
    );
    const dropResumo = executavel.indexOf(
      'DROP FUNCTION IF EXISTS public.resumo_desempenho_motorista(uuid, integer);',
    );
    expect(dropNaLoja).toBeGreaterThan(-1);
    expect(dropResumo).toBeGreaterThan(-1);
    expect(dropNaLoja).toBeLessThan(executavel.indexOf(corpoNaLoja));
    expect(dropResumo).toBeLessThan(executavel.indexOf(corpoResumo));
    expect(executavel).not.toMatch(/CASCADE/);
  });
});

describe('Migration 90: desempenho_motorista_na_loja', () => {
  it('assinatura com p_de/p_ate opcionais, jsonb, STABLE, DEFINER, search_path vazio', () => {
    expect(corpoNaLoja).toMatch(
      /\(\s*p_motorista_id uuid,\s*p_unidade_id uuid,\s*p_de date DEFAULT NULL,\s*p_ate date DEFAULT NULL\s*\)\s*RETURNS jsonb\s+LANGUAGE plpgsql\s+STABLE\s+SECURITY DEFINER\s+SET search_path = ''\s+AS \$\$/,
    );
  });

  it('mantém a recusa SEM_PERMISSAO antes de ler rotas', () => {
    const guarda =
      corpoNaLoja.match(
        /IF auth\.uid\(\) IS NULL OR NOT EXISTS \([\s\S]*?END IF;/,
      )?.[0] ?? '';
    expect(guarda).toMatch(/uu\.unidade_id = p_unidade_id/);
    expect(guarda).toMatch(/uu\.papel::text = 'gestor'/);
    expect(guarda).toMatch(/uu\.ativo = true/);
    expect(guarda).toContain("'code', 'SEM_PERMISSAO'");
    expect(corpoNaLoja.indexOf(guarda)).toBeLessThan(
      corpoNaLoja.indexOf('FROM public.rotas r'),
    );
  });

  it('recorta a loja e o período fechado sobre rotas.data', () => {
    expect(corpoNaLoja).toMatch(
      /FROM public\.rotas r\s+WHERE r\.motorista_id = p_motorista_id\s+AND r\.unidade_id = p_unidade_id\s+AND \(p_de IS NULL OR r\.data >= p_de\)\s+AND \(p_ate IS NULL OR r\.data <= p_ate\);/,
    );
  });

  it('as fórmulas da Migration 89 continuam (taxa, km das concluídas, tempo até 24 h)', () => {
    expect(corpoNaLoja).toMatch(/ELSE 100\.0/);
    expect(corpoNaLoja).toMatch(
      /'distancia_total_km', sum\(r\.distancia_total\) FILTER \(WHERE r\.status::text = 'concluida'\)/,
    );
    expect(corpoNaLoja).toMatch(
      /r\.concluida_em - r\.iniciada_em < interval '24 hours'/,
    );
  });

  it('ACL: dono postgres, sem PUBLIC/anon, EXECUTE de authenticated e service_role; COMMENT da 90', () => {
    expect(executavel).toContain(
      `ALTER FUNCTION ${NA_LOJA} OWNER TO postgres;`,
    );
    expect(executavel).toContain(
      `REVOKE ALL ON FUNCTION ${NA_LOJA} FROM PUBLIC, anon;`,
    );
    expect(executavel).toContain(
      `GRANT EXECUTE ON FUNCTION ${NA_LOJA} TO authenticated, service_role;`,
    );
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.desempenho_motorista_na_loja\(uuid, uuid, date, date\) IS\s+'Migration 90[^']*SEM_PERMISSAO/,
    );
  });
});

describe('Migration 90: resumo_desempenho_motorista', () => {
  it('o nome bate com o que o app chama', () => {
    expect(RPC_RESUMO_DESEMPENHO).toBe('resumo_desempenho_motorista');
  });

  it('assinatura: p_dias continua 2º argumento; p_de/p_ate opcionais; tempo_medio_minutos no fim da TABLE', () => {
    expect(corpoResumo).toMatch(
      /\(\s*p_motorista_id uuid,\s*p_dias integer DEFAULT NULL,\s*p_de date DEFAULT NULL,\s*p_ate date DEFAULT NULL\s*\)\s*RETURNS TABLE \(/,
    );
    expect(corpoResumo).toMatch(
      /entregas_em_rotas_concluidas integer,\s*tempo_medio_minutos numeric\s*\)\s*LANGUAGE plpgsql\s+STABLE\s+SECURITY DEFINER\s+SET search_path = ''\s+AS \$\$/,
    );
  });

  it('quem pode chamar não muda (42501)', () => {
    expect(corpoResumo).toMatch(/v_uid = p_motorista_id AND v_ativo/);
    expect(corpoResumo).toMatch(/g\.papel = 'gestor' AND g\.ativo/);
    expect(corpoResumo).toMatch(/ERRCODE = '42501'/);
    expect(corpoResumo).toMatch(
      /uu\.usuario_id = v_uid AND uu\.unidade_id = r\.unidade_id AND uu\.ativo AND \(uu\.papel = 'gestor' OR \(r\.motorista_id = v_uid AND v_ativo\)\)/,
    );
  });

  it('p_de/p_ate vencem p_dias; sem eles, o p_dias de sempre (fuso de São Paulo, negativo → 22023)', () => {
    expect(corpoResumo).toMatch(
      /IF p_de IS NOT NULL OR p_ate IS NOT NULL THEN\s+v_desde := p_de;\s+v_ate := p_ate;\s+ELSIF p_dias IS NOT NULL THEN\s+IF p_dias < 0 THEN[\s\S]*?ERRCODE = '22023';\s+END IF;\s+v_desde := \(now\(\) AT TIME ZONE 'America\/Sao_Paulo'\)::date - p_dias;\s+END IF;/,
    );
    expect(corpoResumo).toMatch(
      /AND \(v_desde IS NULL OR r\.data >= v_desde\)\s+AND \(v_ate IS NULL OR r\.data <= v_ate\)/,
    );
  });

  it('tempo médio = fórmula do Histórico (qualquer status, 0 < diferença < 1440 min)', () => {
    expect(corpoResumo).toMatch(
      /avg\(extract\(epoch FROM rv\.fim - rv\.ini\) \/ 60\) FILTER \(\s+WHERE rv\.ini IS NOT NULL\s+AND rv\.fim IS NOT NULL\s+AND rv\.fim > rv\.ini\s+AND rv\.fim - rv\.ini < interval '1440 minutes'\s+\)/,
    );
    // A fórmula do app que o banco replica.
    const hook = ler(
      `${__dirname}/../../src/hooks/motorista/historico/useHistoricoMetrics.ts`,
    );
    expect(hook).toContain('diffMinutos > 0 && diffMinutos < 1440');
  });

  it('partida e chegada seguem fora das paradas', () => {
    expect(corpoResumo).toMatch(/p\.is_checkpoint IS DISTINCT FROM false/);
  });

  it('ACL: dono postgres, sem PUBLIC/anon, EXECUTE de authenticated e service_role; COMMENT com a fórmula', () => {
    expect(executavel).toContain(`ALTER FUNCTION ${RESUMO} OWNER TO postgres;`);
    expect(executavel).toContain(
      `REVOKE ALL ON FUNCTION ${RESUMO} FROM PUBLIC, anon;`,
    );
    expect(executavel).toContain(
      `GRANT EXECUTE ON FUNCTION ${RESUMO} TO authenticated, service_role;`,
    );
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.resumo_desempenho_motorista\(uuid, integer, date, date\) IS\s+'Migration 90[^']*useHistoricoMetrics/,
    );
  });
});

describe('Migration 90: índices, rollback, sonda e doc', () => {
  it('cria os dois índices de loja + data', () => {
    expect(executavel).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_rotas_unidade_data_id\s+ON public\.rotas \(unidade_id, data DESC, id DESC\);/,
    );
    expect(executavel).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_incidentes_unidade_created_id\s+ON public\.incidentes \(unidade_id, created_at DESC, id DESC\);/,
    );
  });

  it('rollback colável: apaga o novo e restaura as assinaturas e ACLs antigas', () => {
    for (const trecho of [
      'DROP INDEX IF EXISTS public.idx_incidentes_unidade_created_id;',
      'DROP INDEX IF EXISTS public.idx_rotas_unidade_data_id;',
      `DROP FUNCTION IF EXISTS ${RESUMO};`,
      `DROP FUNCTION IF EXISTS ${NA_LOJA};`,
      'GRANT EXECUTE ON FUNCTION public.resumo_desempenho_motorista(uuid, integer) TO authenticated, service_role;',
      'GRANT EXECUTE ON FUNCTION public.desempenho_motorista_na_loja(uuid, uuid) TO authenticated, service_role;',
    ]) {
      expect(rollback).toContain(trecho);
    }
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
  });

  it('sonda transacional desfeita pelo RAISE, comparando com as versões anteriores', () => {
    expect(sonda).toMatch(/^DO \$\$/m);
    expect(sonda).toMatch(
      /RAISE EXCEPTION 'SONDA M90 \(desfeita\): % OK \| % FALHOU/,
    );
    for (const termo of [
      'CREATE FUNCTION pg_temp.resumo_m55(',
      'CREATE FUNCTION pg_temp.desempenho_m89(',
      'public.resumo_desempenho_motorista(v_m1, v_dias)',
      'p_motorista_id => v_m1, p_dias => v_dias',
      "DATE '2026-11-01', DATE '2026-11-30'",
      "'SEM_PERMISSAO'",
      'idx_rotas_unidade_data_id',
      'idx_incidentes_unidade_created_id',
      'SET LOCAL ROLE authenticated;',
      '@example.invalid',
    ]) {
      expect(sonda).toContain(termo);
    }
    expect(sonda).not.toMatch(/^\s*COMMIT;/m);
  });

  it('MIGRATIONS.md registra a 90', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### (⏳|✅) Migration 90:/);
    expect(doc).toContain(ARQUIVO);
  });
});
