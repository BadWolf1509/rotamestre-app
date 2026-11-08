// Guarda estática da Migration 85 (Places: teto de details e limpeza global).
// `consumir_cota_places` é recriada a partir da versão viva da Migration 84
// mudando só duas coisas: o teto de details sobe para 1000 (B8-1) e a chamada
// sem `auth.uid()` devolve null, não false (B8-4: false vira 429 "limite
// atingido" para quem nem tem sessão). `limpar_uso_places_antigo(p_dias)`
// apaga as linhas antigas de todos os usuários (B8-5), chamada pela Edge
// Function `expire-routes`. O comportamento se prova com a sonda.
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
  RAIZ,
} from './_helpers/migration';

const ARQUIVO = '20261108120000_places_teto_e_limpeza.sql';

const m = carregarMigration(ARQUIVO);
const { executavel, rollback } = m;
const m84 = carregarMigration('20261108090000_teto_diario_places.sql');
const sonda = lerSonda('20261108120000_sonda_migration85.sql');

const corpoDe = (sql: string, inicio: string): string => {
  const i = sql.indexOf(inicio);
  if (i < 0) return '';
  const fim = sql.indexOf('$$;', i);
  return sql.slice(i, fim < 0 ? undefined : fim);
};

const cota = corpoDe(
  executavel,
  'CREATE OR REPLACE FUNCTION public.consumir_cota_places(',
);
const cota84 = corpoDe(
  m84.executavel,
  'CREATE OR REPLACE FUNCTION public.consumir_cota_places(',
);
const limpeza = corpoDe(
  executavel,
  'CREATE OR REPLACE FUNCTION public.limpar_uso_places_antigo(',
);

describe('Migration 85: Places, teto de details e limpeza global', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });
});

describe('consumir_cota_places (recriada a partir da Migration 84)', () => {
  it('details passa a 1000; autocomplete continua 1000', () => {
    expect(cota).toMatch(/WHEN 'autocomplete' THEN 1000\b/);
    expect(cota).toMatch(/WHEN 'details' THEN 1000\b/);
    expect(cota).not.toMatch(/THEN 300\b/);
  });

  it('sem sessão devolve null (indisponível), não false (esgotada)', () => {
    expect(cota).toMatch(/IF v_uid IS NULL THEN\s+RETURN NULL;/);
    expect(cota).not.toMatch(/RETURN false;/);
  });

  it('o resto do corpo é o da Migration 84, sem outra mudança', () => {
    expect(cota84).not.toBe('');
    const normalizar = (s: string) =>
      s
        .replace(/WHEN 'details' THEN \d+/, "WHEN 'details' THEN N")
        .replace(/IF v_uid IS NULL THEN\s+RETURN \w+;/, 'SEM_SESSAO')
        .replace(/\s+/g, ' ')
        .trim();
    expect(normalizar(cota)).toBe(normalizar(cota84));
  });

  it('ACL refeita: dono postgres, sem PUBLIC/anon, EXECUTE de authenticated', () => {
    expect(executavel).toMatch(
      /ALTER FUNCTION public\.consumir_cota_places\(text\) OWNER TO postgres;/,
    );
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.consumir_cota_places\(text\) FROM PUBLIC, anon;/,
    );
    expect(executavel).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.consumir_cota_places\(text\) TO authenticated;/,
    );
  });

  it('COMMENT da Migration 85 com os limites novos e o null', () => {
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.consumir_cota_places\(text\) IS\s+'Migration 85[^']*details 1000[^']*sem sessão, null/,
    );
  });
});

describe('limpar_uso_places_antigo', () => {
  it('assinatura, DEFINER e search_path vazio (como a Migration 84)', () => {
    expect(limpeza).toMatch(
      /limpar_uso_places_antigo\(p_dias integer DEFAULT 8\)\s+RETURNS integer\s+LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = ''\s+AS \$\$/,
    );
  });

  it('piso de 1 dia: argumento errado não zera a cota de hoje', () => {
    expect(limpeza).toMatch(
      /IF p_dias IS NULL OR p_dias < 1 THEN\s+RAISE EXCEPTION[^;]*USING ERRCODE = '22023';/,
    );
  });

  it('apaga de todos os usuários só o que é anterior ao corte, no dia de Brasília', () => {
    expect(limpeza).toMatch(
      /DELETE FROM public\.uso_places_diario\s+WHERE dia < \(now\(\) AT TIME ZONE 'America\/Sao_Paulo'\)::date - p_dias;/,
    );
    expect(limpeza).toMatch(/GET DIAGNOSTICS v_apagadas = ROW_COUNT;/);
    expect(limpeza).toMatch(/RETURN v_apagadas;/);
  });

  it('ACL: dono postgres, EXECUTE só de service_role', () => {
    expect(executavel).toMatch(
      /ALTER FUNCTION public\.limpar_uso_places_antigo\(integer\) OWNER TO postgres;/,
    );
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.limpar_uso_places_antigo\(integer\) FROM PUBLIC, anon, authenticated;/,
    );
    expect(executavel).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.limpar_uso_places_antigo\(integer\) TO service_role;/,
    );
  });

  it('COMMENT da Migration 85', () => {
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.limpar_uso_places_antigo\(integer\) IS\s+'Migration 85/,
    );
  });

  it('a expire-routes chama a limpeza depois da de notificações, sem derrubar a expiração', () => {
    const fonte = readFileSync(
      join(RAIZ, 'supabase', 'functions', 'expire-routes', 'index.ts'),
      'utf8',
    );
    const notificacoes = fonte.indexOf("'limpar_notificacoes_antigas'");
    const places = fonte.indexOf("rpc('limpar_uso_places_antigo')");
    expect(notificacoes).toBeGreaterThan(-1);
    expect(places).toBeGreaterThan(notificacoes);
    const trecho = fonte.slice(
      places,
      fonte.indexOf('return new Response', places),
    );
    expect(trecho).not.toMatch(/status:\s*500/);
    expect(fonte).toMatch(/uso_places_apagados/);
  });
});

describe('Migration 85: rollback, sonda e documentação', () => {
  it('rollback colável: volta o corpo da 84 e apaga a limpeza', () => {
    expect(rollback).toMatch(/WHEN 'details' THEN 300/);
    expect(rollback).toMatch(/IF v_uid IS NULL THEN\s+RETURN false;/);
    expect(rollback).toMatch(
      /DROP FUNCTION IF EXISTS public\.limpar_uso_places_antigo\(integer\);/,
    );
  });

  it('sonda transacional desfeita pelo RAISE, com o resumo N OK | N FALHOU', () => {
    expect(sonda).toMatch(/^DO \$\$/m);
    expect(sonda).toMatch(
      /RAISE EXCEPTION 'SONDA M85 \(desfeita\): % OK \| % FALHOU/,
    );
    for (const termo of [
      "consumir_cota_places('details')",
      'FOR v_i IN 1..1001 LOOP',
      'public.limpar_uso_places_antigo()',
      'public.limpar_uso_places_antigo(0)',
      'SET LOCAL ROLE authenticated;',
      'SET LOCAL ROLE anon;',
      'v_hoje - 9',
      'v_hoje - 8',
    ]) {
      expect(sonda).toContain(termo);
    }
    expect(sonda).not.toMatch(/^\s*COMMIT;/m);
  });

  it('MIGRATIONS.md registra a 85', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### (⏳|✅) Migration 85:/);
    expect(doc).toContain(ARQUIVO);
  });
});
