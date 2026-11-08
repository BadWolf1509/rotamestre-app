// Guarda estática da Migration 84 (teto diário por usuário no Google Places):
// `uso_places_diario` fechada à API (RLS sem policy, sem privilégio de anon e
// authenticated) e `consumir_cota_places(p_servico)`, SECURITY DEFINER com
// search_path fixo, que conta a chamada do `auth.uid()` no dia de Brasília
// num upsert atômico com teto (autocomplete 1000, details 300).
// O comportamento se prova com a sonda (desfeita pelo RAISE). Esta guarda
// impede que o teto, o fuso, a atomicidade, a ACL ou o fechamento da tabela
// mudem sem a sonda e a documentação acompanharem.
import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
} from './_helpers/migration';

const ARQUIVO = '20261108090000_teto_diario_places.sql';

const m = carregarMigration(ARQUIVO);
const { executavel, rollback } = m;
const sonda = lerSonda('20261108090000_sonda_migration84.sql');

const corpoDe = (inicio: string): string => {
  const i = executavel.indexOf(inicio);
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
};

const funcao = corpoDe(
  'CREATE OR REPLACE FUNCTION public.consumir_cota_places(',
);

describe('Migration 84: teto diário do Google Places', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });
});

describe('uso_places_diario: fechada à API', () => {
  it('colunas, check do serviço, FK com cascade e chave primária', () => {
    expect(executavel).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.uso_places_diario \(\s*usuario_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE,\s*dia date NOT NULL,\s*servico text NOT NULL CHECK \(servico IN \('autocomplete', 'details'\)\),\s*chamadas integer NOT NULL DEFAULT 0,\s*PRIMARY KEY \(usuario_id, dia, servico\)\s*\);/,
    );
  });

  it('RLS ligada e nenhuma policy', () => {
    expect(executavel).toMatch(
      /ALTER TABLE public\.uso_places_diario ENABLE ROW LEVEL SECURITY;/,
    );
    expect(executavel).not.toMatch(/CREATE POLICY/i);
  });

  it('sem privilégio de anon e authenticated na tabela', () => {
    expect(executavel).toMatch(
      /REVOKE ALL ON TABLE public\.uso_places_diario FROM PUBLIC, anon, authenticated;/,
    );
    expect(executavel).not.toMatch(
      /GRANT [^;]* ON TABLE public\.uso_places_diario/i,
    );
  });
});

describe('consumir_cota_places', () => {
  it('assinatura, DEFINER e search_path fixo', () => {
    expect(funcao).toMatch(
      /consumir_cota_places\(p_servico text\)\s+RETURNS boolean\s+LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = ''\s+AS \$\$/,
    );
  });

  it('usuário do JWT, sem sessão devolve false', () => {
    expect(funcao).toMatch(/v_uid uuid := auth\.uid\(\);/);
    expect(funcao).toMatch(/IF v_uid IS NULL THEN\s+RETURN false;/);
  });

  it('dia de hoje no fuso de Brasília', () => {
    expect(funcao).toMatch(
      /v_hoje date := \(now\(\) AT TIME ZONE 'America\/Sao_Paulo'\)::date;/,
    );
  });

  it('limites fixos: autocomplete 1000, details 300; outro serviço é 22023', () => {
    expect(funcao).toMatch(/WHEN 'autocomplete' THEN 1000\b/);
    expect(funcao).toMatch(/WHEN 'details' THEN 300\b/);
    expect(funcao).toMatch(
      /IF v_limite IS NULL THEN\s+RAISE EXCEPTION[^;]*USING ERRCODE = '22023';/,
    );
  });

  it('incremento atômico com teto no próprio upsert', () => {
    expect(funcao).toMatch(
      /INSERT INTO public\.uso_places_diario AS u \(usuario_id, dia, servico, chamadas\)\s+VALUES \(v_uid, v_hoje, p_servico, 1\)\s+ON CONFLICT \(usuario_id, dia, servico\) DO UPDATE\s+SET chamadas = u\.chamadas \+ 1\s+WHERE u\.chamadas < v_limite\s+RETURNING u\.chamadas INTO v_chamadas;/,
    );
    expect(funcao).toMatch(/RETURN v_chamadas IS NOT NULL;/);
    // Sem leitura-e-escrita separadas (corrida entre chamadas simultâneas).
    expect(funcao).not.toMatch(/SELECT[^;]*FROM public\.uso_places_diario/);
  });

  it('limpa só as linhas antigas do próprio usuário', () => {
    expect(funcao).toMatch(
      /DELETE FROM public\.uso_places_diario\s+WHERE usuario_id = v_uid\s+AND dia < v_hoje - 7;/,
    );
  });

  it('ACL: dono postgres, sem PUBLIC/anon, EXECUTE de authenticated', () => {
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

  it('COMMENT da Migration 84 na tabela e na função', () => {
    expect(executavel).toMatch(
      /COMMENT ON TABLE public\.uso_places_diario IS\s+'Migration 84/,
    );
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.consumir_cota_places\(text\) IS\s+'Migration 84/,
    );
  });
});

describe('Migration 84: rollback, sonda e documentação', () => {
  it('rollback colável: DROP da função e da tabela', () => {
    expect(rollback).toMatch(
      /DROP FUNCTION IF EXISTS public\.consumir_cota_places\(text\);/,
    );
    expect(rollback).toMatch(/DROP TABLE IF EXISTS public\.uso_places_diario;/);
  });

  it('sonda transacional desfeita pelo RAISE, com o resumo N OK | N FALHOU', () => {
    expect(sonda).toMatch(/^DO \$\$/m);
    expect(sonda).toMatch(
      /RAISE EXCEPTION 'SONDA M84 \(desfeita\): % OK \| % FALHOU/,
    );
    for (const termo of [
      "consumir_cota_places('autocomplete')",
      "consumir_cota_places('details')",
      "consumir_cota_places('geocode')",
      'SET LOCAL ROLE authenticated;',
      'SET LOCAL ROLE anon;',
      'FOR v_i IN 1..1002 LOOP',
      'FOR v_i IN 1..301 LOOP',
    ]) {
      expect(sonda).toContain(termo);
    }
    expect(sonda).not.toMatch(/^\s*COMMIT;/m);
  });

  it('MIGRATIONS.md registra a 84', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### (⏳|✅) Migration 84:/);
    expect(doc).toContain(ARQUIVO);
  });
});
