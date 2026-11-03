// Guarda estática da Migration 56 (o incidente sobrevive à exclusão do
// motorista). O banco único é produção e não há pgTAP: o comportamento se prova
// com a sonda transacional (`database/sondas/`), rodada no SQL Editor. Esta
// guarda impede que uma edição perca as três peças que fecham o caso:
//   - a FK em SET NULL (com CASCADE o incidente da loja some com a conta);
//   - a coluna aceitando NULL (sem isso o SET NULL falha);
//   - o gatilho pulando a conferência da rota quando o motorista é NULL (sem
//     isso o DELETE do usuário falha com 42501) E recusando NULL no INSERT.
import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
} from './_helpers/migration';

const ARQUIVO = '20261024130000_incidente_sobrevive_ao_motorista.sql';

const m = carregarMigration(ARQUIVO);
const { executavel } = m;
const normaliza = (s: string) => s.replace(/\s+/g, ' ').trim();
const exec = normaliza(executavel);

describe('Migration 56: o incidente sobrevive ao motorista', () => {
  itExisteNasDuasPastas(m);

  it('a coluna aceita NULL e a FK passa a ON DELETE SET NULL (nunca CASCADE)', () => {
    expect(exec).toMatch(
      /ALTER TABLE public\.incidentes ALTER COLUMN motorista_id DROP NOT NULL;/,
    );
    expect(exec).toMatch(
      /ADD CONSTRAINT incidentes_motorista_id_fkey FOREIGN KEY \(motorista_id\) REFERENCES public\.usuarios\(id\) ON DELETE SET NULL;/,
    );
    expect(exec).not.toMatch(
      /motorista_id\) REFERENCES public\.usuarios\(id\) ON DELETE CASCADE/,
    );
  });

  it('roda numa transação com lock_timeout (usuarios/incidentes são lidas o tempo todo)', () => {
    expect(exec).toMatch(/^BEGIN; SET LOCAL lock_timeout = '5s';/);
    expect(exec).toMatch(/COMMIT;$/);
  });

  it('o gatilho aceita o SET NULL: só confere a rota quando há motorista', () => {
    expect(exec).toMatch(
      /IF v_rota_mudou AND NEW\.motorista_id IS NOT NULL AND NEW\.rota_id IS NOT NULL AND NOT EXISTS/,
    );
  });

  it('o NOT NULL que saiu volta como regra do INSERT (23502), no gatilho', () => {
    expect(exec).toMatch(
      /IF TG_OP = 'INSERT' AND NEW\.motorista_id IS NULL THEN RAISE EXCEPTION '[^']+' USING ERRCODE = '23502';/,
    );
  });

  it('mantém SECURITY DEFINER com search_path vazio e as conferências de rota e parada', () => {
    expect(exec).toMatch(
      /CREATE OR REPLACE FUNCTION public\.incidentes_confere_rota_parada\(\) RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''/,
    );
    expect(exec).toMatch(/A rota do incidente não é deste motorista\./);
    expect(exec).toMatch(
      /A parada do incidente não pertence à rota informada\./,
    );
  });

  it('não toca na loja do incidente nem nas policies (a visibilidade segue unidade_id)', () => {
    expect(exec).not.toMatch(/ALTER POLICY|CREATE POLICY|DROP POLICY/);
    expect(exec).not.toMatch(/unidade_id/);
  });

  it('tem sonda transacional que termina em RAISE e exercita a exclusão do motorista', () => {
    const sonda = lerSonda('20261024130000_sonda_migration56.sql');
    expect(sonda).not.toBe('');
    expect(sonda).toMatch(/DELETE FROM auth\.users WHERE id = v_m;/);
    expect(sonda).toMatch(/RAISE EXCEPTION 'SONDA M56 \(desfeita\):%', r;/);
    expect(sonda).toMatch(/INSERT com motorista NULL passou/);
  });

  it('está documentada no MIGRATIONS.md', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toContain(ARQUIVO);
    expect(doc).toMatch(/Migration 56/);
  });
});
