// Guarda estática da Migration 48 (logs, posições e logs de push lidos pela
// loja da rota). O banco único é produção e não há pgTAP: o comportamento se
// prova com a sonda transacional (`database/sondas/`). Esta guarda impede que
// uma edição tire o filtro pela loja da rota, devolva a leitura pelo vínculo
// do autor, abra a linha sem rota ao gestor, ou deixe as duas cópias
// (database/ e supabase/) divergirem.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261024110000_logs_posicoes_push_pela_loja_da_rota.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024110000_sonda_migration48.sql',
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

// Dono OU gestor ativo da loja da rota; nada pelo vínculo do autor.
function confereDonoOuLojaDaRota(expr: string, tabela: string, dono: string) {
  expect(expr).not.toBe('');
  expect(expr).toMatch(
    new RegExp(`${tabela}\\.${dono} = \\(SELECT auth\\.uid\\(\\)\\)`),
  );
  expect(expr).toMatch(
    new RegExp(
      `${tabela}\\.rota_id IS NOT NULL\\s+AND EXISTS \\(\\s*SELECT 1\\s+FROM public\\.usuario_unidades uu\\s+JOIN public\\.rotas r ON r\\.id = ${tabela}\\.rota_id`,
    ),
  );
  expect(expr).toMatch(/uu\.usuario_id = \(SELECT auth\.uid\(\)\)/);
  expect(expr).toMatch(/uu\.papel::text = 'gestor'/);
  expect(expr).toMatch(/uu\.ativo = true/);
  expect(expr).toMatch(/uu\.unidade_id = r\.unidade_id/);
  // linha sem rota: só o dono (nenhum ramo para rota_id IS NULL)
  expect(expr).not.toMatch(/rota_id IS NULL/);
  // nada de vínculo do autor nem de get_my_unidade_ids (inclui motorista)
  expect(expr).not.toMatch(/my_uu|log_user_uu|motorista_uu|target_uu/);
  expect(expr).not.toMatch(/get_my_unidade_ids/);
  // auth.uid() sempre em subconsulta (initplan)
  expect(expr.replace(/\(SELECT auth\.uid\(\)\)/g, '')).not.toMatch(
    /auth\.uid\(\)/,
  );
}

describe('Migration 48: logs, posições e logs de push pela loja da rota', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('logs_select: o autor ou o gestor ativo da loja da rota', () => {
    expect.hasAssertions();
    confereDonoOuLojaDaRota(usingDe('logs_select', 'logs'), 'logs', 'usuario_id');
  });

  it('motorista_locations_select_optimized: o motorista ou o gestor ativo da loja da rota', () => {
    expect.hasAssertions();
    confereDonoOuLojaDaRota(
      usingDe('motorista_locations_select_optimized', 'motorista_locations'),
      'motorista_locations',
      'motorista_id',
    );
  });

  it('push_notification_logs_select_scoped: só pelo helper da loja da rota da notificação', () => {
    const expr = usingDe(
      'push_notification_logs_select_scoped',
      'push_notification_logs',
    );
    expect(expr).toMatch(
      /push_notification_logs\.notificacao_id IS NOT NULL\s+AND public\.notificacao_da_loja_do_gestor\(push_notification_logs\.notificacao_id\)/,
    );
    expect(expr).not.toMatch(/target_uu|my_uu|usuario_id/);
  });

  it('helper: DEFINER, search_path vazio, gestor ativo da loja da rota, sem EXECUTE para anon', () => {
    const corpo = executavel.slice(
      executavel.indexOf(
        'CREATE OR REPLACE FUNCTION public.notificacao_da_loja_do_gestor(p_notificacao_id uuid)',
      ),
    );
    expect(corpo).toMatch(/RETURNS boolean/);
    expect(corpo).toMatch(/SECURITY DEFINER\s+SET search_path = ''/);
    expect(corpo).toMatch(/JOIN public\.rotas r ON r\.id = n\.rota_id/);
    expect(corpo).toMatch(/uu\.unidade_id = r\.unidade_id/);
    expect(corpo).toMatch(/uu\.usuario_id = auth\.uid\(\)/);
    expect(corpo).toMatch(/uu\.papel::text = 'gestor'/);
    expect(corpo).toMatch(/uu\.ativo = true/);
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.notificacao_da_loja_do_gestor\(uuid\) FROM PUBLIC, anon;/,
    );
    expect(executavel).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.notificacao_da_loja_do_gestor\(uuid\) TO authenticated, service_role;/,
    );
    // o helper existe antes da policy que o chama
    expect(executavel.indexOf('CREATE OR REPLACE FUNCTION')).toBeLessThan(
      executavel.indexOf('ALTER POLICY push_notification_logs_select_scoped'),
    );
  });

  it('não recria policies e não mexe no INSERT de logs', () => {
    expect(executavel).not.toMatch(/DROP POLICY|CREATE POLICY/);
    expect(executavel).not.toMatch(/logs_insert_optimized/);
  });

  it('INSERT de posição: o próprio motorista, numa rota dele ou sem rota', () => {
    const re =
      /ALTER POLICY motorista_locations_insert_optimized ON public\.motorista_locations\s+TO authenticated\s+WITH CHECK/;
    const m = re.exec(executavel);
    expect(m).not.toBeNull();
    const check = blocoEntreParenteses(executavel, 'WITH CHECK', m!.index);
    expect(check).toMatch(
      /motorista_locations\.motorista_id = \(SELECT auth\.uid\(\)\)\s+AND \(/,
    );
    expect(check).toMatch(/motorista_locations\.rota_id IS NULL\s+OR EXISTS/);
    expect(check).toMatch(/r\.id = motorista_locations\.rota_id/);
    expect(check).toMatch(/r\.motorista_id = \(SELECT auth\.uid\(\)\)/);
  });

  it('tem bloco de rollback com as quatro policies e a remoção do helper', () => {
    expect(sql).toMatch(/^-- ROLLBACK:/m);
    const rollback = sql.slice(sql.search(/^-- ROLLBACK:/m));
    expect(rollback).toMatch(/ALTER POLICY logs_select ON public\.logs\s*\n--\s*TO public/);
    expect(rollback).toMatch(
      /ALTER POLICY motorista_locations_select_optimized ON public\.motorista_locations\s*\n--\s*TO authenticated/,
    );
    expect(rollback).toMatch(
      /ALTER POLICY push_notification_logs_select_scoped ON public\.push_notification_logs\s*\n--\s*TO public/,
    );
    expect(rollback).toMatch(
      /ALTER POLICY motorista_locations_insert_optimized ON public\.motorista_locations\s*\n--\s*TO public\s*\n--\s*WITH CHECK \(\(motorista_id = \(SELECT auth\.uid\(\)\)\)\);/,
    );
    expect(rollback).toMatch(
      /DROP FUNCTION IF EXISTS public\.notificacao_da_loja_do_gestor\(uuid\);/,
    );
  });

  it('a sonda existe, testa como authenticated, não apaga nada e termina desfeita', () => {
    const sonda = ler(caminhoSonda);
    expect(sonda).not.toBe('');
    const sondaExec = semComentarios(sonda);
    expect(sondaExec).toMatch(/SET LOCAL ROLE authenticated/);
    expect(sondaExec).toMatch(/request\.jwt\.claims/);
    expect(sondaExec).not.toMatch(/\bDELETE\b/i);
    const corpo = sondaExec.slice(0, sondaExec.lastIndexOf('END'));
    expect(corpo.trim()).toMatch(
      /RAISE EXCEPTION 'SONDA M48 \(desfeita\)[^;]*;$/,
    );
  });

  it('está documentada no MIGRATIONS.md', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### (⏳|✅) Migration 48:/);
    expect(doc).toContain(ARQUIVO);
  });
});
