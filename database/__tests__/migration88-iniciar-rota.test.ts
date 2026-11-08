// Guarda estática da Migration 88 (pendência 30(j)): `iniciar_rota(uuid)`
// inicia a rota numa transação (rota em andamento, partida concluída, 1ª
// parada real em andamento), com a regra de quem pode iniciá-la de hoje (a
// policy `rotas_update` e a `finalizar_rota`) e resultado num conjunto
// fechado. O comportamento se prova com a sonda.
import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
} from './_helpers/migration';

const ARQUIVO = '20261108123000_iniciar_rota_rpc.sql';

const m = carregarMigration(ARQUIVO);
const { executavel, rollback } = m;
const sonda = lerSonda('20261108123000_sonda_migration88.sql');

const INICIO = 'CREATE OR REPLACE FUNCTION public.iniciar_rota(p_rota_id uuid)';
const corpo = (() => {
  const i = executavel.indexOf(INICIO);
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
})();

const RESULTADOS = [
  'iniciada',
  'ja_iniciada',
  'situacao_mudou',
  'sem_permissao',
];

describe('Migration 88: iniciar_rota', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('RETURNS text, SECURITY DEFINER, search_path vazio', () => {
    expect(corpo).not.toBe('');
    expect(corpo).toMatch(/RETURNS text/);
    expect(corpo).toMatch(/SECURITY DEFINER/);
    expect(corpo).toMatch(/SET search_path = ''/);
  });

  it('devolve só os quatro resultados combinados', () => {
    const devolvidos = [...corpo.matchAll(/RETURN '([a-z_]+)';/g)].map(
      (x) => x[1],
    );
    expect(new Set(devolvidos)).toEqual(new Set(RESULTADOS));
    expect(corpo).not.toMatch(/RAISE EXCEPTION/);
  });

  it('sem sessão → sem_permissao antes de ler a rota', () => {
    const semSessao = corpo.search(
      /IF auth\.uid\(\) IS NULL THEN\s+RETURN 'sem_permissao';/,
    );
    expect(semSessao).toBeGreaterThan(-1);
    expect(semSessao).toBeLessThan(corpo.indexOf('FROM public.rotas r'));
  });

  it('trava só a rota do próprio motorista, ativo, com vínculo ativo na loja', () => {
    const trava =
      corpo.match(/SELECT r\.status[\s\S]*?FOR NO KEY UPDATE OF r;/)?.[0] ?? '';
    expect(trava).toMatch(/r\.motorista_id = auth\.uid\(\)/);
    expect(trava).toMatch(/\(SELECT public\.usuario_atual_ativo\(\)\)/);
    expect(trava).toMatch(/uu\.usuario_id = auth\.uid\(\)/);
    expect(trava).toMatch(/uu\.unidade_id = r\.unidade_id/);
    expect(trava).toMatch(/uu\.ativo = true/);
    expect(corpo).toMatch(
      /FOR NO KEY UPDATE OF r;\s+IF NOT FOUND THEN\s+RETURN 'sem_permissao';/,
    );
    expect(corpo).not.toMatch(/FOR UPDATE\b/);
  });

  it('fora de pendente/em_andamento → situacao_mudou, antes de qualquer escrita', () => {
    const situacao = corpo.search(
      /IF v_status NOT IN \('pendente', 'em_andamento'\) THEN\s+RETURN 'situacao_mudou';/,
    );
    expect(situacao).toBeGreaterThan(-1);
    expect(situacao).toBeLessThan(corpo.indexOf('UPDATE public.'));
  });

  it('trava as paradas depois da rota e antes de escrever', () => {
    const travaParadas = corpo.indexOf(
      'PERFORM 1 FROM public.paradas p WHERE p.rota_id = p_rota_id FOR NO KEY UPDATE;',
    );
    expect(travaParadas).toBeGreaterThan(
      corpo.indexOf('FOR NO KEY UPDATE OF r;'),
    );
    expect(travaParadas).toBeLessThan(corpo.indexOf('UPDATE public.'));
  });

  it('pendente: rota em andamento com iniciada_em', () => {
    expect(corpo).toMatch(
      /IF v_status = 'pendente' THEN\s+UPDATE public\.rotas\s+SET status = 'em_andamento',\s+iniciada_em = v_agora\s+WHERE id = p_rota_id;/,
    );
  });

  it('partida (ordem 0, is_checkpoint false) concluída só se pendente, com a hora do início', () => {
    expect(corpo).toMatch(
      /UPDATE public\.paradas\s+SET status = 'concluida',\s+concluida_em = coalesce\(v_iniciada_em, v_agora\)\s+WHERE rota_id = p_rota_id\s+AND is_checkpoint = false\s+AND ordem = 0\s+AND status = 'pendente';/,
    );
  });

  it('1ª parada real pendente em andamento só se nenhuma real já estiver', () => {
    expect(corpo).toMatch(
      /IF NOT EXISTS \([\s\S]*?p\.is_checkpoint IS DISTINCT FROM false\s+AND p\.status = 'em_andamento'\s+\) THEN/,
    );
    expect(corpo).toMatch(
      /SET status = 'em_andamento'\s+WHERE id = \([\s\S]*?p\.is_checkpoint IS DISTINCT FROM false\s+AND p\.status = 'pendente'\s+ORDER BY p\.ordem\s+LIMIT 1\s+\)\s+AND status = 'pendente';/,
    );
  });

  it('em_andamento → ja_iniciada, depois de completar o que faltar', () => {
    const ja = corpo.search(
      /IF v_status = 'em_andamento' THEN\s+RETURN 'ja_iniciada';/,
    );
    expect(ja).toBeGreaterThan(corpo.lastIndexOf('UPDATE public.paradas'));
  });

  it('ACL: dono postgres, sem PUBLIC/anon, EXECUTE de authenticated e service_role', () => {
    expect(executavel).toContain(
      'ALTER FUNCTION public.iniciar_rota(uuid) OWNER TO postgres;',
    );
    expect(executavel).toContain(
      'REVOKE ALL ON FUNCTION public.iniciar_rota(uuid) FROM PUBLIC, anon;',
    );
    expect(executavel).toContain(
      'GRANT EXECUTE ON FUNCTION public.iniciar_rota(uuid) TO authenticated, service_role;',
    );
  });

  it('COMMENT da Migration 88 com os quatro resultados', () => {
    const comment =
      executavel.match(
        /COMMENT ON FUNCTION public\.iniciar_rota\(uuid\) IS\s+'(Migration 88:[^']*)'/,
      )?.[1] ?? '';
    expect(comment).not.toBe('');
    expect(comment).toContain(RESULTADOS.join(' | '));
  });

  it('rollback colável: apaga a função', () => {
    expect(rollback).toContain(
      'DROP FUNCTION IF EXISTS public.iniciar_rota(uuid);',
    );
  });

  it('sonda transacional desfeita pelo RAISE, com os quatro resultados', () => {
    expect(sonda).toMatch(/^DO \$\$/m);
    expect(sonda).toMatch(
      /RAISE EXCEPTION 'SONDA M88 \(desfeita\): % OK \| % FALHOU/,
    );
    for (const termo of [
      'public.iniciar_rota(',
      ...RESULTADOS.map((x) => `'${x}'`),
      "'rota_iniciada'",
      'SET LOCAL ROLE authenticated;',
      '@example.invalid',
    ]) {
      expect(sonda).toContain(termo);
    }
    expect(sonda).not.toMatch(/^\s*COMMIT;/m);
  });

  it('MIGRATIONS.md registra a 88', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### (⏳|✅) Migration 88:/);
    expect(doc).toContain(ARQUIVO);
  });
});
