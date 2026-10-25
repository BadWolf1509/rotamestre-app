// Guarda estática da Migration 49 (rotas e paradas do motorista pelo vínculo
// ativo com a loja e pela pessoa ativa; SOS sem rota quando a rota não é mais
// dele). O banco único é produção e não há pgTAP: o comportamento se prova com
// a sonda transacional (`database/sondas/`). Esta guarda impede que uma edição
// devolva ao motorista um ramo que não confere vínculo e pessoa ativos (nas
// policies ou nas funções SECURITY DEFINER que ele chama), volte a recusar o
// SOS pela rota, mexa no acesso do gestor, ou deixe as duas cópias
// (database/ e supabase/) divergirem.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261024111000_rotas_paradas_pelo_vinculo_ativo.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024111000_sonda_migration49.sql',
);
const caminhoDoc = join(raiz, 'database', 'MIGRATIONS.md');

// CRLF fora: com `core.autocrlf=true` (Windows) o checkout troca as quebras.
const ler = (p: string) =>
  existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '';
const sql = ler(caminhoDb);
const semComentarios = (texto: string) =>
  texto
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
// Só o que roda: o bloco ROLLBACK e o roteiro de conferência são comentados.
const executavel = semComentarios(sql);

const HELPER = '\\(SELECT public\\.usuario_atual_ativo\\(\\)\\)';

function blocoEntreParenteses(
  texto: string,
  palavra: string,
  inicio: number,
): string {
  const pos = texto.indexOf(palavra, inicio);
  if (pos < 0) return '';
  const abre = texto.indexOf('(', pos + palavra.length);
  let nivel = 0;
  for (let i = abre; i < texto.length; i++) {
    if (texto[i] === '(') nivel++;
    if (texto[i] === ')') nivel--;
    if (nivel === 0) return texto.slice(abre + 1, i);
  }
  return '';
}

function usingDe(policy: string, tabela: string): string {
  const re = new RegExp(
    `ALTER POLICY ${policy} ON public\\.${tabela}\\s+TO authenticated\\s+USING`,
  );
  const m = re.exec(executavel);
  return m ? blocoEntreParenteses(executavel, 'USING', m.index) : '';
}

function corpoDaFuncao(assinatura: string): string {
  const inicio = executavel.indexOf(
    `CREATE OR REPLACE FUNCTION public.${assinatura}`,
  );
  if (inicio < 0) return '';
  const abre = executavel.indexOf('$$', inicio);
  const fecha = executavel.indexOf('$$', abre + 2);
  return executavel.slice(inicio, fecha + 2);
}

// Um único EXISTS no vínculo ativo; dentro dele, gestor OU (motorista da rota
// E pessoa ativa). Nenhum ramo do motorista fora do EXISTS.
function confereVinculoEPessoaAtivos(expr: string, alias: string) {
  expect(expr).not.toBe('');
  expect(expr.trim()).toMatch(/^EXISTS \(/);
  expect(expr).toMatch(/uu\.usuario_id = \(SELECT auth\.uid\(\)\)/);
  expect(expr).toMatch(new RegExp(`uu\\.unidade_id = ${alias}\\.unidade_id`));
  expect(expr).toMatch(/uu\.ativo = true/);
  expect(expr).toMatch(
    new RegExp(
      `\\(\\s*uu\\.papel::text = 'gestor'\\s+OR \\(\\s*${alias}\\.motorista_id = \\(SELECT auth\\.uid\\(\\)\\)\\s+AND ${HELPER}\\s*\\)\\s*\\)`,
    ),
  );
  // o motorista só entra pelo EXISTS: nenhum "OR motorista_id" no nível de fora
  const foraDoExists = expr.replace(/EXISTS \([\s\S]*\)\s*$/, '');
  expect(foraDoExists).not.toMatch(/motorista_id/);
  // auth.uid() sempre em subconsulta (initplan)
  expect(expr.replace(/\(SELECT auth\.uid\(\)\)/g, '')).not.toMatch(
    /auth\.uid\(\)/,
  );
}

describe('Migration 49: rotas e paradas do motorista pelo vínculo ativo', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('helper usuario_atual_ativo: STABLE, DEFINER, search_path vazio, só do próprio auth.uid()', () => {
    const corpo = corpoDaFuncao('usuario_atual_ativo()');
    expect(corpo).toMatch(/RETURNS boolean\s+LANGUAGE sql\s+STABLE\s+SECURITY DEFINER\s+SET search_path = ''/);
    expect(corpo).toMatch(
      /COALESCE\(\s*\(SELECT u\.ativo FROM public\.usuarios u WHERE u\.id = auth\.uid\(\)\),\s*false\s*\)/,
    );
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.usuario_atual_ativo\(\) FROM PUBLIC, anon;/,
    );
    expect(executavel).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.usuario_atual_ativo\(\) TO authenticated, service_role;/,
    );
    // existe antes da primeira policy que o chama
    expect(
      executavel.indexOf('CREATE OR REPLACE FUNCTION public.usuario_atual_ativo()'),
    ).toBeLessThan(executavel.indexOf('ALTER POLICY'));
  });

  it('rotas_select e rotas_update: vínculo ativo, e gestor ou motorista ativo', () => {
    expect.hasAssertions();
    confereVinculoEPessoaAtivos(usingDe('rotas_select', 'rotas'), 'rotas');
    confereVinculoEPessoaAtivos(usingDe('rotas_update', 'rotas'), 'rotas');
  });

  it('paradas_select e paradas_update: a mesma regra, pela rota da parada', () => {
    for (const policy of ['paradas_select', 'paradas_update']) {
      const expr = usingDe(policy, 'paradas');
      confereVinculoEPessoaAtivos(expr, 'r');
      expect(expr).toMatch(
        /FROM public\.rotas r\s+JOIN public\.usuario_unidades uu ON uu\.unidade_id = r\.unidade_id/,
      );
      expect(expr).toMatch(/r\.id = paradas\.rota_id/);
    }
  });

  it('não recria policies, não troca WITH CHECK e não mexe em INSERT/DELETE', () => {
    expect(executavel).not.toMatch(/DROP POLICY|CREATE POLICY/);
    expect(executavel).not.toMatch(/WITH CHECK/);
    expect(executavel).not.toMatch(
      /rotas_insert|rotas_delete|paradas_insert|paradas_delete/,
    );
  });

  it('finalizar_rota: motorista da rota, pessoa ativa e vínculo ativo, no WHERE que trava', () => {
    const corpo = corpoDaFuncao('finalizar_rota(p_rota_id uuid)');
    expect(corpo).toMatch(/SECURITY DEFINER\s+SET search_path = public/);
    expect(corpo).toMatch(
      new RegExp(
        `WHERE r\\.id = p_rota_id\\s+AND r\\.motorista_id = auth\\.uid\\(\\)\\s+AND ${HELPER}\\s+AND EXISTS \\(\\s*SELECT 1\\s+FROM public\\.usuario_unidades uu\\s+WHERE uu\\.usuario_id = auth\\.uid\\(\\)\\s+AND uu\\.unidade_id = r\\.unidade_id\\s+AND uu\\.ativo = true\\s*\\)\\s+FOR NO KEY UPDATE OF r;`,
      ),
    );
    // sentinelas que o app traduz (src/lib/errorMapping.ts)
    for (const s of [
      'NAO_AUTENTICADO',
      'ROTA_NAO_ENCONTRADA',
      'ROTA_NAO_EM_ANDAMENTO',
      'ROTA_PARADAS_PENDENTES',
    ]) {
      expect(corpo).toContain(s);
    }
  });

  it('reordenar_paradas: gestor, ou motorista da rota ativo, sempre com vínculo ativo', () => {
    const corpo = corpoDaFuncao('reordenar_paradas(');
    expect(corpo).toMatch(/SECURITY DEFINER\s+SET search_path = ''/);
    const guarda = blocoEntreParenteses(
      corpo,
      'IF NOT EXISTS',
      corpo.indexOf('IF NOT EXISTS'),
    );
    expect(guarda).toMatch(/r\.id = v_rota_id/);
    expect(guarda).toMatch(/uu\.unidade_id = r\.unidade_id/);
    expect(guarda).toMatch(/uu\.usuario_id = auth\.uid\(\)/);
    expect(guarda).toMatch(/uu\.ativo = true/);
    expect(guarda).toMatch(
      new RegExp(
        `\\(\\s*uu\\.papel = 'gestor'\\s+OR \\(\\s*r\\.motorista_id = auth\\.uid\\(\\)\\s+AND ${HELPER}\\s*\\)\\s*\\)`,
      ),
    );
  });

  it('pode_registrar_log_na_rota: vínculo ativo, e gestor ou pessoa ativa', () => {
    const corpo = corpoDaFuncao('pode_registrar_log_na_rota(p_rota_id uuid)');
    expect(corpo).toMatch(/SECURITY DEFINER\s+SET search_path = ''/);
    expect(corpo).toMatch(/RETURNS boolean/);
    expect(corpo).toMatch(/uu\.unidade_id = r\.unidade_id/);
    expect(corpo).toMatch(/uu\.usuario_id = auth\.uid\(\)/);
    expect(corpo).toMatch(/uu\.ativo = true/);
    expect(corpo).toMatch(
      new RegExp(`\\(\\s*uu\\.papel = 'gestor'\\s+OR ${HELPER}\\s*\\)`),
    );
    // nenhum ramo do motorista sem vínculo
    expect(corpo).not.toMatch(/OR\s+r\.motorista_id/);
  });

  it('registrar_sos: rota sem permissão vira SOS sem rota, nunca recusa', () => {
    const corpo = corpoDaFuncao('registrar_sos(p_detalhes jsonb');
    expect(corpo).toMatch(/SECURITY DEFINER\s+SET search_path = ''/);
    expect(corpo).not.toMatch(/Sem permissão para registrar SOS/);
    // a checagem roda protegida: erro nela também cai para "sem rota"
    expect(corpo).toMatch(
      /IF v_rota_id IS NOT NULL THEN\s+BEGIN\s+v_permitida := public\.pode_registrar_log_na_rota\(v_rota_id\);\s+EXCEPTION WHEN OTHERS THEN[\s\S]*?v_permitida := false;\s+END;\s+IF v_permitida IS NOT TRUE THEN\s+v_rota_id := NULL;/,
    );
    expect(corpo.match(/pode_registrar_log_na_rota/g)).toHaveLength(1);
    expect(corpo).toMatch(
      /\(v_detalhes - 'rota_id' - 'rota_status'\)\s+\|\| jsonb_build_object\('rota_recusada', true\)/,
    );
    expect(corpo).toMatch(
      /VALUES \(v_uid, v_rota_id, 'sos_acionado', v_detalhes\)/,
    );
    // a busca do SOS deduplicado usa a mesma rota que foi gravada
    expect(corpo).toMatch(/l\.rota_id IS NOT DISTINCT FROM v_rota_id/);
    // a sessão continua obrigatória
    expect(corpo).toMatch(/IF v_uid IS NULL THEN RAISE EXCEPTION/);
  });

  it('gatilho do SOS direto: BEFORE INSERT, antes da deduplicação, só com sessão', () => {
    const nome = 'logs_sos_sem_rota_quando_recusada';
    // BEFORE da mesma tabela dispara em ordem alfabética
    expect(nome < 'prevent_duplicate_log_trigger').toBe(true);
    expect(executavel).toMatch(
      new RegExp(
        `CREATE TRIGGER ${nome}\\s+BEFORE INSERT ON public\\.logs\\s+FOR EACH ROW\\s+WHEN \\(NEW\\.evento::text = 'sos_acionado' AND NEW\\.rota_id IS NOT NULL\\)\\s+EXECUTE FUNCTION public\\.sos_sem_rota_quando_recusada\\(\\);`,
      ),
    );
    const corpo = corpoDaFuncao('sos_sem_rota_quando_recusada()');
    expect(corpo).toMatch(/RETURNS trigger/);
    expect(corpo).toMatch(/SECURITY DEFINER\s+SET search_path = ''/);
    // sem sessão, a linha passa como veio; a checagem roda protegida e, se
    // falhar, o SOS segue sem rota (nunca falha)
    expect(corpo).toMatch(
      /BEGIN\s+IF auth\.uid\(\) IS NULL THEN\s+RETURN NEW;\s+END IF;\s+v_permitida := public\.pode_registrar_log_na_rota\(NEW\.rota_id\);\s+EXCEPTION WHEN OTHERS THEN[\s\S]*?v_permitida := false;\s+END;\s+IF v_permitida IS NOT TRUE THEN\s+NEW\.rota_id := NULL;/,
    );
    expect(corpo.match(/pode_registrar_log_na_rota/g)).toHaveLength(1);
    expect(corpo).toMatch(
      /\(COALESCE\(NEW\.detalhes, '\{\}'::jsonb\) - 'rota_id' - 'rota_status'\)\s+\|\| jsonb_build_object\('rota_recusada', true\)/,
    );
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.sos_sem_rota_quando_recusada\(\) FROM PUBLIC, anon, authenticated;/,
    );
  });

  it('funções chamáveis: EXECUTE só para authenticated e service_role', () => {
    for (const assinatura of [
      'finalizar_rota\\(uuid\\)',
      'reordenar_paradas\\(uuid\\[\\], integer\\[\\]\\)',
      'pode_registrar_log_na_rota\\(uuid\\)',
      'registrar_sos\\(jsonb, uuid\\)',
      'usuario_atual_ativo\\(\\)',
    ]) {
      expect(executavel).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${assinatura} FROM PUBLIC, anon;`,
        ),
      );
      expect(executavel).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${assinatura} TO authenticated, service_role;`,
        ),
      );
    }
  });

  it('rollback colável: policies, corpos inteiros, gatilho e helper por último', () => {
    expect(sql).toMatch(/^-- ROLLBACK:/m);
    const rollback = sql.slice(sql.search(/^-- ROLLBACK:/m));
    for (const [policy, tabela] of [
      ['rotas_select', 'rotas'],
      ['rotas_update', 'rotas'],
      ['paradas_select', 'paradas'],
      ['paradas_update', 'paradas'],
    ]) {
      expect(rollback).toMatch(
        new RegExp(
          `ALTER POLICY ${policy} ON public\\.${tabela}\\s*\\n--\\s*TO public`,
        ),
      );
    }
    expect(rollback).toMatch(
      /DROP TRIGGER IF EXISTS logs_sos_sem_rota_quando_recusada ON public\.logs;/,
    );
    expect(rollback).toMatch(
      /DROP FUNCTION IF EXISTS public\.sos_sem_rota_quando_recusada\(\);/,
    );
    // finalizar_rota também com o corpo inteiro (não por referência a arquivo
    // com BEGIN/COMMIT próprios)
    expect(rollback).not.toMatch(/20261023100000_finalizar_rota_rpc\.sql/);
    expect(rollback).toMatch(
      /--\s+AND r\.motorista_id = auth\.uid\(\)\s*\n--\s+FOR NO KEY UPDATE;/,
    );
    // corpos inteiros, prontos para colar
    for (const f of [
      'finalizar_rota',
      'reordenar_paradas',
      'pode_registrar_log_na_rota',
      'registrar_sos',
    ]) {
      expect(rollback).toMatch(
        new RegExp(`-- CREATE OR REPLACE FUNCTION public\\.${f}\\(`),
      );
    }
    expect(rollback).toMatch(/--\s+RETURN jsonb_build_object\('success', true, 'updated', v_count\);/);
    expect(rollback).toMatch(/Sem permissão para registrar SOS nesta rota/);
    // o helper sai depois de tudo que o usa
    const drop = rollback.indexOf('DROP FUNCTION IF EXISTS public.usuario_atual_ativo();');
    expect(drop).toBeGreaterThan(0);
    expect(drop).toBeGreaterThan(rollback.lastIndexOf('ALTER POLICY'));
    expect(drop).toBeGreaterThan(rollback.lastIndexOf('CREATE OR REPLACE FUNCTION'));
  });

  it('a sonda existe, testa como authenticated, não apaga nada e termina desfeita', () => {
    const sonda = ler(caminhoSonda);
    expect(sonda).not.toBe('');
    const sondaExec = semComentarios(sonda);
    expect(sondaExec).toMatch(/SET LOCAL ROLE authenticated/);
    expect(sondaExec).toMatch(/request\.jwt\.claims/);
    expect(sondaExec).not.toMatch(/\bDELETE\b/i);
    // vínculo desativado em A, ativo em B
    expect(sondaExec).toMatch(
      /UPDATE public\.usuario_unidades SET ativo = false\s+WHERE usuario_id = v_m AND unidade_id = v_ua;/,
    );
    // pessoa desativada com vínculo ativo; gestor com vínculo desativado
    expect(sondaExec).toMatch(/'motorista', v_ua, false\)/);
    expect(sondaExec).toMatch(/\(v_m3, v_ua, 'motorista', true, true\)/);
    expect(sondaExec).toMatch(/\(v_ga_off, v_ua, 'gestor', false, true\)/);
    for (const chamada of [
      'public.finalizar_rota(v_rota_a)',
      'public.finalizar_rota(v_rota_m3)',
      'public.reordenar_paradas(ARRAY[v_pa_real]',
      'public.pode_registrar_log_na_rota(v_rota_a)',
      'public.usuario_atual_ativo()',
      "VALUES (v_m, v_rota_a, 'sos_acionado'",
      "'rota_status', 'em_andamento'), v_rota_a)",
    ]) {
      expect(sondaExec).toContain(chamada);
    }
    // o SOS com a rota recusada é aceito sem rota (nunca esperado como erro)
    expect(sondaExec).toMatch(/rota_recusada/);
    expect(sondaExec).not.toMatch(/registrar_sos recusa a rota de A/);
    // SOS de quem não tem loja ativa, o ramo do gestor pelo vínculo e a
    // checagem da rota com erro forçado (renomeando o helper e voltando)
    expect(sondaExec).toContain("(v_m4, v_ua, 'motorista', false, true)");
    expect(sondaExec).toContain("(v_gp_off, v_ua, 'gestor', true, true)");
    expect(sondaExec).toContain("'gestor', v_ua, false)");
    expect(sondaExec).toContain(
      'ALTER FUNCTION public.usuario_atual_ativo() RENAME TO usuario_atual_ativo_sonda_m49;',
    );
    expect(sondaExec).toContain(
      'ALTER FUNCTION public.usuario_atual_ativo_sonda_m49() RENAME TO usuario_atual_ativo;',
    );
    expect(sondaExec).toContain("'gestores_avisados')::int = 0");
    const corpo = sondaExec.slice(0, sondaExec.lastIndexOf('END'));
    expect(corpo.trim()).toMatch(
      /RAISE EXCEPTION 'SONDA M49 \(desfeita\)[^;]*;$/,
    );
  });

  it('está documentada no MIGRATIONS.md', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### (⏳|✅) Migration 49:/);
    expect(doc).toContain(ARQUIVO);
    expect(doc).toMatch(/usuario_atual_ativo/);
    expect(doc).toMatch(/logs_sos_sem_rota_quando_recusada/);
  });
});
