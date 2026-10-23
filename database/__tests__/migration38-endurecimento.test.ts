// Guarda estática da Migration 38 (endurecimento de usuarios, fotos e
// incidentes). O banco único é produção e não há pgTAP: o comportamento se
// prova com a sonda transacional (`database/sondas/`), rodada no SQL Editor.
// Esta guarda impede que a migration perca, numa edição, uma das peças que
// fecham as falhas, e que as duas cópias (database/ e supabase/) divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261023000000_endurece_usuarios_storage_incidentes.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261023000000_sonda_migration38.sql',
);

const ler = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const sql = ler(caminhoDb);
// Só o que roda: tira comentários de linha (o bloco ROLLBACK é comentado).
const executavel = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n');

describe('Migration 38: endurecimento', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('tem bloco de rollback', () => {
    expect(sql).toMatch(/^-- ROLLBACK:/m);
  });

  it('a) usuarios: remove a policy de INSERT e o privilégio de INSERT', () => {
    expect(executavel).toMatch(
      /DROP POLICY IF EXISTS usuarios_insert_optimized ON public\.usuarios/,
    );
    expect(executavel).toMatch(
      /REVOKE INSERT ON public\.usuarios FROM anon, authenticated/,
    );
  });

  it('b) spatial_ref_sys: tira escrita de anon/authenticated', () => {
    expect(executavel).toMatch(
      /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.spatial_ref_sys FROM anon, authenticated/,
    );
  });

  it('c) fotos de perfil e incidente: o dono do objeto tem de ser o dono da linha', () => {
    const policy = executavel.slice(
      executavel.indexOf('CREATE POLICY "fotos-entrega select"'),
    );
    expect(policy.length).toBeGreaterThan(0);
    // perfis/: a linha de usuarios que referencia o objeto é do dono do objeto
    expect(policy).toMatch(/u\.id = objects\.owner/);
    // incidentes/: o incidente que referencia o objeto é do dono do objeto
    expect(policy).toMatch(/i\.motorista_id = objects\.owner/);
    // e continua por unidade para as fotos de entrega
    expect(policy).toMatch(/get_my_unidade_ids\(\)/);
  });

  it('d) incidentes: gatilho confere rota do motorista e parada da rota', () => {
    expect(executavel).toMatch(
      /CREATE TRIGGER incidentes_confere_rota_parada\s+BEFORE INSERT OR UPDATE OF rota_id, parada_id, motorista_id ON public\.incidentes/,
    );
    expect(executavel).toMatch(/r\.motorista_id = NEW\.motorista_id/);
    expect(executavel).toMatch(/p\.rota_id = NEW\.rota_id/);
  });

  it('e) helpers de RLS: sem EXECUTE para anon/PUBLIC, e as policies que os chamam só para authenticated', () => {
    for (const fn of [
      'current_user_is_gestor_of_unidade(uuid)',
      'get_my_unidade_id()',
      'get_my_unidade_ids()',
      'get_user_papel()',
      'get_user_unidade_id()',
    ]) {
      expect(executavel).toContain(
        `REVOKE EXECUTE ON FUNCTION public.${fn} FROM PUBLIC, anon`,
      );
      // authenticated precisa manter: as policies dependem dele
      expect(executavel).not.toMatch(
        new RegExp(
          `REVOKE[^;]*${fn.replace(/[()]/g, '\\$&')}[^;]*authenticated`,
        ),
      );
    }
    for (const [policy, tabela] of [
      ['usuarios_select_optimized', 'usuarios'],
      ['usuarios_update_optimized', 'usuarios'],
      ['usuario_unidades_select', 'usuario_unidades'],
      ['motorista_locations_select_optimized', 'motorista_locations'],
    ]) {
      expect(executavel).toContain(
        `ALTER POLICY ${policy} ON public.${tabela} TO authenticated`,
      );
    }
  });

  it('e) views vw_* sem escrita e índice em rascunhos_rota(unidade_id)', () => {
    for (const v of [
      'vw_paradas_com_vinculo',
      'vw_performance_motoristas',
      'vw_rotas_resumo',
    ]) {
      expect(executavel).toContain(
        `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.${v} FROM anon, authenticated`,
      );
    }
    expect(executavel).toMatch(
      /CREATE INDEX IF NOT EXISTS \w+ ON public\.rascunhos_rota \(unidade_id\)/,
    );
  });

  it('tem sonda transacional que termina desfazendo tudo', () => {
    const sonda = ler(caminhoSonda);
    expect(sonda).toMatch(/RAISE EXCEPTION 'SONDA/);
    expect(sonda).toMatch(/SET LOCAL ROLE authenticated/);
  });
});
