// Guarda estática da Migration 87 (pendência 30(i)): `resolvido_em` do
// incidente mantido por gatilho, com a regra que o app já grava
// (`useIncidentesModals`): entra em `resolvido` sem a data → `now()`; sai de
// `resolvido` → nulo; `resolvido` → `resolvido` não mexe; valor mandado fica.
// O comportamento se prova com a sonda.
import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
} from './_helpers/migration';

const ARQUIVO = '20261108122000_incidentes_resolvido_em.sql';

const m = carregarMigration(ARQUIVO);
const { executavel, rollback } = m;
const sonda = lerSonda('20261108122000_sonda_migration87.sql');

const INICIO = 'CREATE OR REPLACE FUNCTION public.incidentes_resolvido_em()';
const corpo = (() => {
  const i = executavel.indexOf(INICIO);
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
})();

describe('Migration 87: resolvido_em por gatilho', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('função INVOKER, search_path vazio, sem EXECUTE para a API', () => {
    expect(corpo).not.toBe('');
    expect(corpo).toMatch(/SECURITY INVOKER/);
    expect(corpo).not.toMatch(/SECURITY DEFINER/);
    expect(corpo).toMatch(/SET search_path = ''/);
    expect(executavel).toContain(
      'ALTER FUNCTION public.incidentes_resolvido_em() OWNER TO postgres;',
    );
    expect(executavel).toContain(
      'REVOKE ALL ON FUNCTION public.incidentes_resolvido_em() FROM PUBLIC, anon, authenticated;',
    );
    expect(executavel).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.incidentes_resolvido_em/,
    );
  });

  it('gatilho BEFORE INSERT OR UPDATE OF status, recriado com DROP antes', () => {
    const drop = executavel.indexOf(
      'DROP TRIGGER IF EXISTS trg_incidentes_resolvido_em ON public.incidentes;',
    );
    const create = executavel.search(
      /CREATE TRIGGER trg_incidentes_resolvido_em\s+BEFORE INSERT OR UPDATE OF status ON public\.incidentes\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.incidentes_resolvido_em\(\);/,
    );
    expect(drop).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(drop);
  });

  it('só resolvido conta; preenche só o nulo ao entrar; limpa ao sair', () => {
    expect(corpo).toMatch(/IF NEW\.status = 'resolvido' THEN/);
    expect(corpo).toMatch(
      /NEW\.resolvido_em IS NULL\s+AND \(TG_OP = 'INSERT' OR OLD\.status IS DISTINCT FROM 'resolvido'\)/,
    );
    expect(corpo).toMatch(/NEW\.resolvido_em := now\(\);/);
    expect(corpo).toMatch(
      /ELSIF TG_OP = 'UPDATE' AND OLD\.status = 'resolvido' THEN\s+NEW\.resolvido_em := NULL;/,
    );
    expect(corpo).not.toMatch(/'fechado'/);
    // Uma atribuição de cada: nunca sobrescreve a hora mandada pelo app.
    expect((corpo.match(/NEW\.resolvido_em :=/g) ?? []).length).toBe(2);
  });

  it('COMMENT da Migration 87', () => {
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.incidentes_resolvido_em\(\) IS\s+'Migration 87:/,
    );
  });

  it('rollback colável: tira o gatilho e a função', () => {
    expect(rollback).toContain(
      'DROP TRIGGER IF EXISTS trg_incidentes_resolvido_em ON public.incidentes;',
    );
    expect(rollback).toContain(
      'DROP FUNCTION IF EXISTS public.incidentes_resolvido_em();',
    );
  });

  it('sonda transacional desfeita pelo RAISE, com o resumo N OK | N FALHOU', () => {
    expect(sonda).toMatch(/^DO \$\$/m);
    expect(sonda).toMatch(
      /RAISE EXCEPTION 'SONDA M87 \(desfeita\): % OK \| % FALHOU/,
    );
    for (const termo of [
      "status = 'resolvido'",
      "status = 'aberto'",
      "status = 'fechado'",
      'resolvido_em = v_hora_app',
      'trg_incidentes_resolvido_em',
      'SET LOCAL ROLE authenticated;',
      '@example.invalid',
    ]) {
      expect(sonda).toContain(termo);
    }
    expect(sonda).not.toMatch(/^\s*COMMIT;/m);
  });

  it('MIGRATIONS.md registra a 87', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### (⏳|✅) Migration 87:/);
    expect(doc).toContain(ARQUIVO);
  });
});
