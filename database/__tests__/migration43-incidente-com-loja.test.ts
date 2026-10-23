// Guarda estática da Migration 43 (o incidente grava a própria loja).
// O banco único é produção e não há pgTAP: o comportamento se prova com a
// sonda transacional (`database/sondas/`), rodada no SQL Editor. Esta guarda
// impede que a migration perca, numa edição, as peças que fecham o caso do
// incidente sem rota: a coluna, o gatilho que a preenche e a congela, o
// backfill, as três policies pela loja gravada (sem o ramo "rota_id IS NULL →
// vínculo do motorista") e o aviso ao gestor pela mesma loja.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261024000000_incidente_com_loja.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024000000_sonda_migration43.sql',
);
const caminhoDoc = join(raiz, 'database', 'MIGRATIONS.md');

const ler = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const sql = ler(caminhoDb);
const semComentarios = (texto: string) =>
  texto
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
// Só o que roda: o bloco ROLLBACK e o roteiro de conferência são comentados.
const executavel = semComentarios(sql);
const normaliza = (s: string) => s.replace(/\s+/g, ' ').trim();

// Conteúdo do parêntese que abre logo depois de `palavra` (a partir de
// `inicio`), casando parênteses — as expressões têm subconsultas.
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

function alterPolicy(nome: string) {
  const re = new RegExp(
    `ALTER POLICY ${nome} ON public\\.incidentes\\s+TO authenticated\\s+USING`,
  );
  const m = re.exec(executavel);
  if (!m) return { encontrada: false, using: '', withCheck: '' };
  const using = blocoEntreParenteses(executavel, 'USING', m.index);
  const fimUsing = executavel.indexOf(using, m.index) + using.length;
  const resto = executavel.slice(fimUsing, executavel.indexOf(';', fimUsing));
  const withCheck = /WITH CHECK/.test(resto)
    ? blocoEntreParenteses(executavel, 'WITH CHECK', fimUsing)
    : '';
  return { encontrada: true, using, withCheck };
}

// Ramo do gestor: vínculo ativo de gestor NA LOJA GRAVADA no incidente.
const RAMO_GESTOR =
  /EXISTS \(\s*SELECT 1\s+FROM public\.usuario_unidades uu\s+WHERE uu\.usuario_id = \(SELECT auth\.uid\(\)\)\s+AND uu\.papel::text = 'gestor'\s+AND uu\.ativo = true\s+AND uu\.unidade_id = incidentes\.unidade_id\s*\)/;

function confereSemRamoAntigo(expr: string) {
  // nem o ramo do vínculo do motorista, nem a loja derivada da rota
  expect(expr).not.toMatch(/motorista_uu/);
  expect(expr).not.toMatch(/rota_id IS NULL/);
  expect(expr).not.toMatch(/public\.rotas/);
  // auth.uid() sempre em subconsulta (initplan), nunca por linha
  expect(expr.replace(/\(SELECT auth\.uid\(\)\)/g, '')).not.toMatch(
    /auth\.uid\(\)/,
  );
}

function corpoDaFuncao(nome: string): string {
  const re = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${nome}\\([^)]*\\)[\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`,
  );
  return re.exec(executavel)?.[1] ?? '';
}

describe('Migration 43: o incidente grava a própria loja', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('acrescenta incidentes.unidade_id com FK para unidades e índice', () => {
    expect(executavel).toMatch(
      /ALTER TABLE public\.incidentes\s+ADD COLUMN IF NOT EXISTS unidade_id uuid\s+REFERENCES public\.unidades\(id\) ON DELETE CASCADE/,
    );
    expect(executavel).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_incidentes_unidade_id\s+ON public\.incidentes \(unidade_id\)/,
    );
  });

  it('a loja vem de um helper único: a da rota; sem rota, a única loja ativa do motorista, depois a principal, depois a de usuarios, depois a mais antiga', () => {
    const corpo = corpoDaFuncao('unidade_do_incidente');
    expect(corpo).not.toBe('');
    const n = normaliza(corpo);
    // 1. com rota: a loja da rota
    expect(n).toMatch(/FROM public\.rotas r WHERE r\.id = p_rota_id/);
    // 2..5. sem rota: vínculos ativos do motorista, em ordem determinística
    expect(n).toMatch(/FROM public\.usuario_unidades uu/);
    expect(n).toMatch(/uu\.usuario_id = p_motorista_id/);
    expect(n).toMatch(/uu\.ativo = true/);
    expect(n).toMatch(
      /ORDER BY uu\.is_principal DESC NULLS LAST, \(uu\.unidade_id = u\.unidade_id\) DESC NULLS LAST, uu\.created_at, uu\.unidade_id/,
    );
    // helper fechado: sem EXECUTE para quem chama pela API
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.unidade_do_incidente\(uuid, uuid\) FROM PUBLIC, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.unidade_do_incidente\(p_motorista_id uuid, p_rota_id uuid\)[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/,
    );
  });

  it('gatilho BEFORE INSERT OR UPDATE: o servidor decide a loja e ela não muda quando a rota vira NULL', () => {
    const corpo = corpoDaFuncao('incidentes_define_unidade');
    expect(corpo).not.toBe('');
    const n = normaliza(corpo);
    // INSERT: ignora o que o cliente mandou
    expect(n).toMatch(
      /IF TG_OP = 'INSERT' THEN NEW\.unidade_id := public\.unidade_do_incidente\(NEW\.motorista_id, NEW\.rota_id\);/,
    );
    // UPDATE: rota nova (não nula) → loja da rota nova
    expect(n).toMatch(
      /IF NEW\.rota_id IS NOT NULL AND NEW\.rota_id IS DISTINCT FROM OLD\.rota_id THEN NEW\.unidade_id := public\.unidade_do_incidente\(NEW\.motorista_id, NEW\.rota_id\);/,
    );
    // fora disso a loja gravada fica (inclusive no ON DELETE SET NULL da rota)
    expect(n).toMatch(/ELSE NEW\.unidade_id := OLD\.unidade_id;/);
    expect(executavel).toMatch(
      /CREATE (?:OR REPLACE )?TRIGGER incidentes_define_unidade\s+BEFORE INSERT OR UPDATE ON public\.incidentes\s+FOR EACH ROW EXECUTE FUNCTION public\.incidentes_define_unidade\(\);/,
    );
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.incidentes_define_unidade\(\) FROM PUBLIC, anon, authenticated;/,
    );
  });

  it('preenche os existentes pelo mesmo helper, antes de criar o gatilho', () => {
    const backfill = executavel.search(
      /UPDATE public\.incidentes i\s+SET unidade_id = public\.unidade_do_incidente\(i\.motorista_id, i\.rota_id\)\s+WHERE i\.unidade_id IS NULL;/,
    );
    const gatilho = executavel.search(
      /CREATE (?:OR REPLACE )?TRIGGER incidentes_define_unidade/,
    );
    expect(backfill).toBeGreaterThan(-1);
    expect(gatilho).toBeGreaterThan(backfill);
  });

  it('incidentes_select: o próprio motorista ou gestor ativo da loja gravada', () => {
    const p = alterPolicy('incidentes_select');
    expect(p.encontrada).toBe(true);
    expect(p.using).toMatch(
      /incidentes\.motorista_id = \(SELECT auth\.uid\(\)\)/,
    );
    expect(p.using).toMatch(RAMO_GESTOR);
    confereSemRamoAntigo(p.using);
  });

  it('incidentes_update: USING e WITH CHECK iguais, pela loja gravada', () => {
    const p = alterPolicy('incidentes_update');
    expect(p.encontrada).toBe(true);
    expect(p.using).toMatch(RAMO_GESTOR);
    confereSemRamoAntigo(p.using);
    expect(p.withCheck).not.toBe('');
    expect(normaliza(p.withCheck)).toBe(normaliza(p.using));
  });

  it('incidentes_delete_optimized: só gestor ativo da loja gravada, para authenticated', () => {
    const p = alterPolicy('incidentes_delete_optimized');
    expect(p.encontrada).toBe(true);
    expect(p.using).toMatch(RAMO_GESTOR);
    expect(p.using).not.toMatch(/motorista_id/);
    confereSemRamoAntigo(p.using);
  });

  it('não recria policies (mantém nomes e não abre janela sem policy)', () => {
    expect(executavel).not.toMatch(/DROP POLICY/);
    expect(executavel).not.toMatch(/CREATE POLICY/);
  });

  it('o aviso ao gestor usa a loja gravada no incidente', () => {
    const corpo = normaliza(corpoDaFuncao('notify_incidente_criado'));
    expect(corpo).toMatch(/v_unidade_id := NEW\.unidade_id;/);
    // a escolha antiga pelo vínculo (LIMIT 1 sem ordem) não volta
    expect(corpo).not.toMatch(/usuario_unidades/);
    expect(corpo).toMatch(/public\.gestores_ativos_da_unidade\(v_unidade_id\)/);
  });

  it('tem bloco de rollback que devolve as policies e o aviso de antes', () => {
    expect(sql).toMatch(/^-- ROLLBACK:/m);
    const rollback = sql.slice(sql.search(/^-- ROLLBACK:/m));
    expect(rollback).toMatch(/--\s*ALTER POLICY incidentes_select/);
    expect(rollback).toMatch(/--\s*ALTER POLICY incidentes_update/);
    expect(rollback).toMatch(/--\s*ALTER POLICY incidentes_delete_optimized/);
    expect(rollback).toMatch(
      /--\s*CREATE OR REPLACE FUNCTION public\.notify_incidente_criado/,
    );
    expect(rollback).toMatch(
      /--\s*DROP TRIGGER IF EXISTS incidentes_define_unidade/,
    );
    expect(rollback).toMatch(
      /--\s*ALTER TABLE public\.incidentes DROP COLUMN IF EXISTS unidade_id/,
    );
  });

  it('a sonda existe, testa como authenticated, só apaga o que criou e termina desfeita', () => {
    const sonda = ler(caminhoSonda);
    expect(sonda).not.toBe('');
    const sondaExec = semComentarios(sonda);
    expect(sondaExec).toMatch(/SET LOCAL ROLE authenticated/);
    expect(sondaExec).toMatch(/request\.jwt\.claims/);
    // DELETE só de linha criada pela própria sonda (variável v_*): a rota
    // (dispara o ON DELETE SET NULL, o caso central) e os incidentes do teste
    // da policy de DELETE.
    const deletes = sondaExec.match(/\bDELETE\b[^;]*;/gi) ?? [];
    expect(deletes.length).toBeGreaterThan(0);
    for (const d of deletes) {
      expect(normaliza(d)).toMatch(
        /^DELETE FROM public\.(rotas|incidentes) WHERE id = v_[a-z_]+;$/,
      );
    }
    expect(sondaExec).toMatch(/DELETE FROM public\.rotas WHERE id = v_rota_b;/);
    expect(sondaExec).toMatch(/RAISE EXCEPTION 'SONDA M43 \(desfeita\)/);
    const corpo = sondaExec.slice(0, sondaExec.lastIndexOf('END'));
    expect(corpo.trim()).toMatch(
      /RAISE EXCEPTION 'SONDA M43 \(desfeita\)[^;]*;$/,
    );
  });

  it('está documentada no MIGRATIONS.md', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### (⏳|✅) Migration 43:/);
    expect(doc).toContain(ARQUIVO);
  });
});
