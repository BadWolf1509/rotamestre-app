// Guarda estática da Migration 55 (RPC `resumo_desempenho_motorista`, os
// totais de desempenho e marcos do motorista calculados no servidor). O
// comportamento se prova com a sonda transacional (`database/sondas/`), no
// banco; esta guarda impede que uma edição perca as peças que fecham o caso:
// quem pode chamar, o recorte por loja, o fuso do período e os grants.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { RPC_RESUMO_DESEMPENHO } from '@/lib/motorista/resumoDesempenho';

const ARQUIVO = '20261024180000_resumo_desempenho_motorista.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024180000_sonda_migration55.sql',
);
const caminhoDoc = join(raiz, 'database', 'MIGRATIONS.md');

const ler = (p: string) =>
  existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '';
const sql = ler(caminhoDb);
const semComentarios = (t: string) =>
  t
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
const normaliza = (s: string) => s.replace(/\s+/g, ' ').trim();
const exec = normaliza(semComentarios(sql));
const rollback = normaliza(
  sql
    .slice(sql.indexOf('-- ROLLBACK:'))
    .split('\n')
    .map((l) => l.replace(/^-- ?/, ''))
    .join('\n'),
);
const ASSINATURA = 'public.resumo_desempenho_motorista(uuid, integer)';

describe('Migration 55: arquivos', () => {
  it('existe em database/ e a cópia em supabase/ é idêntica', () => {
    expect(sql.length).toBeGreaterThan(0);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação', () => {
    expect(exec).toMatch(/^BEGIN;/);
    expect(exec).toMatch(/COMMIT;$/);
  });

  it('o ROLLBACK remove a função (é nova: nada a restaurar)', () => {
    expect(rollback).toMatch(
      /BEGIN; DROP FUNCTION IF EXISTS public\.resumo_desempenho_motorista\(uuid, integer\); COMMIT;/,
    );
  });

  it('está no MIGRATIONS.md', () => {
    expect(ler(caminhoDoc)).toMatch(
      new RegExp(
        String.raw`### (?:⏳|✅) Migration 55[^\n]*\n[\s\S]{0,500}` + ARQUIVO,
      ),
    );
  });

  it('tem sonda que termina em RAISE EXCEPTION e compara com o COUNT direto', () => {
    const sonda = ler(caminhoSonda);
    expect(sonda).toMatch(/RAISE EXCEPTION 'SONDA M55 \(desfeita\):%', r;/);
    // Item 3 do Review Focus: o motorista de maior volume, achado por SELECT.
    expect(sonda).toMatch(/ORDER BY count\(\*\) DESC/);
  });
});

describe('Migration 55: a função', () => {
  it('o nome bate com o que o app chama', () => {
    expect(RPC_RESUMO_DESEMPENHO).toBe('resumo_desempenho_motorista');
  });

  it('é nova, DEFINER, STABLE e com search_path vazio', () => {
    expect(exec).toMatch(
      /CREATE FUNCTION public\.resumo_desempenho_motorista\( ?p_motorista_id uuid, p_dias integer DEFAULT NULL ?\) RETURNS TABLE ?\(/,
    );
    expect(exec).toMatch(
      /LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS \$\$/,
    );
    expect(exec).not.toMatch(/CREATE OR REPLACE FUNCTION/);
  });

  it('recusa quem não é o próprio motorista ativo nem gestor ativo de loja dele', () => {
    expect(exec).toMatch(/v_uid uuid := auth\.uid\(\)/);
    expect(exec).toMatch(/v_ativo boolean := public\.usuario_atual_ativo\(\)/);
    expect(exec).toMatch(/v_uid = p_motorista_id AND v_ativo/);
    expect(exec).toMatch(/g\.papel = 'gestor' AND g\.ativo/);
    expect(exec).toMatch(/ERRCODE = '42501'/);
  });

  it('só soma rotas de loja onde quem chama tem vínculo ativo (o mesmo predicado da RLS de rotas)', () => {
    expect(exec).toMatch(
      /uu\.usuario_id = v_uid AND uu\.unidade_id = r\.unidade_id AND uu\.ativo AND \(uu\.papel = 'gestor' OR \(r\.motorista_id = v_uid AND v_ativo\)\)/,
    );
  });

  it('o período é em dias corridos no fuso America/Sao_Paulo, sobre rotas.data', () => {
    expect(exec).toMatch(
      /v_desde := \(now\(\) AT TIME ZONE 'America\/Sao_Paulo'\)::date - p_dias;/,
    );
    expect(exec).toMatch(/v_desde IS NULL OR r\.data >= v_desde/);
  });

  it('partida e chegada (is_checkpoint = false) não contam como parada', () => {
    expect(exec).toMatch(/p\.is_checkpoint IS DISTINCT FROM false/);
  });

  it('EXECUTE só para authenticated', () => {
    expect(exec).toMatch(
      new RegExp(
        String.raw`REVOKE ALL ON FUNCTION ${ASSINATURA.replace(/[().]/g, '\\$&')} FROM PUBLIC, anon;`,
      ),
    );
    expect(exec).toMatch(
      new RegExp(
        String.raw`GRANT EXECUTE ON FUNCTION ${ASSINATURA.replace(/[().]/g, '\\$&')} TO authenticated;`,
      ),
    );
  });
});
