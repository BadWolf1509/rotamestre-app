// Guarda estática da Migration 54 (desativar motorista com rota aberta é
// recusado). O comportamento se prova com a sonda transacional
// (`database/sondas/`), no banco; esta guarda impede que uma edição perca as
// peças que fecham o caso — e amarra a sentinela do banco à do app.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { SENTINELA_ROTA_ABERTA } from '@/lib/motorista/rotasAbertasDoMotorista';

const ARQUIVO = '20261024154000_desativar_motorista_com_rota_aberta.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024154000_sonda_migration54.sql',
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

describe('Migration 54: arquivos', () => {
  it('existe em database/ e a cópia em supabase/ é idêntica', () => {
    expect(sql.length).toBeGreaterThan(0);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação', () => {
    expect(exec).toMatch(/^BEGIN;/);
    expect(exec).toMatch(/COMMIT;$/);
  });

  it('o ROLLBACK traz o corpo vivo anterior inteiro (sem a checagem de rota)', () => {
    expect(sql).toMatch(/-- ROLLBACK:/);
    expect(rollback).toMatch(
      /CREATE OR REPLACE FUNCTION public\.alternar_motorista_na_unidade\(p_motorista_id uuid, p_unidade_id uuid, p_ativo boolean\) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS \$function\$/,
    );
    expect(rollback).toMatch(/RETURN 'vinculo';/);
    expect(rollback).toMatch(/RETURN 'pessoa';/);
    expect(rollback).toMatch(/END; \$function\$;/);
    expect(rollback).not.toMatch(new RegExp(SENTINELA_ROTA_ABERTA));
  });

  it('está no MIGRATIONS.md', () => {
    expect(ler(caminhoDoc)).toMatch(
      new RegExp(
        String.raw`### (?:⏳|✅) Migration 54[^\n]*\n[\s\S]{0,500}` + ARQUIVO,
      ),
    );
  });

  it('tem sonda que termina em RAISE EXCEPTION', () => {
    const sonda = ler(caminhoSonda);
    expect(sonda).toMatch(/RAISE EXCEPTION 'SONDA M54 \(desfeita\):%', r;/);
  });
});

describe('Migration 54: a função', () => {
  it('mantém assinatura, retorno e DEFINER com search_path vazio (sem DROP)', () => {
    expect(exec).toMatch(
      /CREATE OR REPLACE FUNCTION public\.alternar_motorista_na_unidade\( ?p_motorista_id uuid, p_unidade_id uuid, p_ativo boolean ?\) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS \$\$/,
    );
    expect(exec).not.toMatch(/DROP FUNCTION/);
  });

  it('confere as rotas abertas desta loja só ao desativar', () => {
    expect(exec).toMatch(/IF NOT p_ativo THEN/);
    expect(exec).toMatch(/r\.motorista_id = p_motorista_id/);
    expect(exec).toMatch(/r\.unidade_id = p_unidade_id/);
    expect(exec).toMatch(/r\.status IN \('pendente', 'em_andamento'\)/);
  });

  it('a checagem vem depois do lock e antes das duas vias (vínculo e pessoa)', () => {
    const lock = exec.indexOf('FOR UPDATE OF u;');
    const checagem = exec.indexOf('IF NOT p_ativo THEN');
    const viaVinculo = exec.indexOf(
      'IF public.motorista_atende_outra_loja(p_motorista_id) THEN',
    );
    const viaPessoa = exec.indexOf(
      'UPDATE public.usuarios SET ativo = p_ativo',
    );
    expect(lock).toBeGreaterThan(-1);
    expect(checagem).toBeGreaterThan(lock);
    expect(viaVinculo).toBeGreaterThan(checagem);
    expect(viaPessoa).toBeGreaterThan(checagem);
  });

  it('recusa com P0001, a sentinela no HINT e as rotas em JSON no DETAIL', () => {
    expect(exec).toMatch(/ERRCODE = 'P0001'/);
    expect(exec).toMatch(new RegExp(`HINT = '${SENTINELA_ROTA_ABERTA}'`));
    expect(exec).toMatch(/DETAIL = v_rotas::text/);
    expect(exec).toMatch(
      /json_build_object\('id', r\.id, 'data', r\.data, 'status', r\.status\)/,
    );
  });
});
