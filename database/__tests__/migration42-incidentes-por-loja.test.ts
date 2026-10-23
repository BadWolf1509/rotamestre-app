// Guarda estática da Migration 42 (incidentes visíveis só na loja da rota).
// O banco único é produção e não há pgTAP: o comportamento se prova com a
// sonda transacional (`database/sondas/`), rodada no SQL Editor. Esta guarda
// impede que a migration perca, numa edição, o filtro pela loja da rota, que o
// ramo antigo (vínculo do motorista) volte a valer para incidente COM rota, e
// que as duas cópias (database/ e supabase/) divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261023120000_incidentes_visiveis_so_na_loja_da_rota.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261023120000_sonda_migration42.sql',
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

// Extrai o conteúdo do parêntese que abre logo depois de `palavra`, a partir
// de `inicio`, casando parênteses (as expressões têm subconsultas aninhadas).
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

const normaliza = (s: string) => s.replace(/\s+/g, ' ').trim();

// Cada expressão tem de ter exatamente estes três ramos.
function confereExpressao(expr: string) {
  // 1. o próprio motorista
  expect(expr).toMatch(/incidentes\.motorista_id = \(SELECT auth\.uid\(\)\)/);
  // 2. incidente com rota: gestor ativo da loja DA ROTA
  expect(expr).toMatch(
    /incidentes\.rota_id IS NOT NULL\s+AND EXISTS \(\s*SELECT 1\s+FROM public\.usuario_unidades uu\s+JOIN public\.rotas r ON r\.id = incidentes\.rota_id/,
  );
  expect(expr).toMatch(/uu\.unidade_id = r\.unidade_id/);
  expect(expr).toMatch(/uu\.papel::text = 'gestor'/);
  expect(expr).toMatch(/uu\.ativo = true/);
  // 3. o ramo antigo (vínculo do motorista) só para incidente SEM rota:
  //    toda ocorrência do join antigo vem guardada por `rota_id IS NULL`.
  const ocorrenciasRamoAntigo = (expr.match(/motorista_uu\.usuario_id/g) ?? [])
    .length;
  const ramoAntigoGuardado = (
    expr.match(
      /incidentes\.rota_id IS NULL\s+AND EXISTS \(\s*SELECT 1\s+FROM public\.usuario_unidades my_uu\s+JOIN public\.usuario_unidades motorista_uu/g,
    ) ?? []
  ).length;
  expect(ocorrenciasRamoAntigo).toBe(1);
  expect(ramoAntigoGuardado).toBe(1);
  // auth.uid() sempre em subconsulta (initplan), nunca por linha
  expect(expr.replace(/\(SELECT auth\.uid\(\)\)/g, '')).not.toMatch(
    /auth\.uid\(\)/,
  );
}

describe('Migration 42: incidentes visíveis só na loja da rota', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('incidentes_select: só authenticated, filtrando pela loja da rota', () => {
    const p = alterPolicy('incidentes_select');
    expect(p.encontrada).toBe(true);
    confereExpressao(p.using);
  });

  it('incidentes_update: USING e WITH CHECK iguais, filtrando pela loja da rota', () => {
    const p = alterPolicy('incidentes_update');
    expect(p.encontrada).toBe(true);
    confereExpressao(p.using);
    // WITH CHECK explícito e igual ao USING: o gestor não move o incidente
    // para uma rota de outra loja (nem para fora do que ele enxerga).
    expect(p.withCheck).not.toBe('');
    expect(normaliza(p.withCheck)).toBe(normaliza(p.using));
  });

  it('não recria as policies (mantém nomes e não abre janela sem policy)', () => {
    expect(executavel).not.toMatch(/DROP POLICY/);
    expect(executavel).not.toMatch(/CREATE POLICY/);
  });

  it('tem bloco de rollback com o texto atual das duas policies', () => {
    expect(sql).toMatch(/^-- ROLLBACK:/m);
    const rollback = sql.slice(sql.search(/^-- ROLLBACK:/m));
    expect(rollback).toMatch(
      /ALTER POLICY incidentes_select ON public\.incidentes\s*\n?--\s*TO public/,
    );
    expect(rollback).toMatch(
      /ALTER POLICY incidentes_update ON public\.incidentes\s*\n?--\s*TO public/,
    );
    // o ramo antigo, sem guarda de rota, volta no select, no USING do update
    // e no WITH CHECK do update (ALTER POLICY não remove a cláusula; a mesma
    // expressão do USING equivale a não ter WITH CHECK)
    expect(
      (
        rollback.match(
          /motorista_uu\.usuario_id = incidentes\.motorista_id/g,
        ) ?? []
      ).length,
    ).toBe(3);
    expect(rollback).toMatch(/--\s*WITH CHECK \(/);
  });

  it('a sonda existe, testa como authenticated, não apaga nada e termina desfeita', () => {
    const sonda = ler(caminhoSonda);
    expect(sonda).not.toBe('');
    const sondaExec = semComentarios(sonda);
    expect(sondaExec).toMatch(/SET LOCAL ROLE authenticated/);
    expect(sondaExec).toMatch(/request\.jwt\.claims/);
    expect(sondaExec).not.toMatch(/\bDELETE\b/i);
    expect(sondaExec).toMatch(/RAISE EXCEPTION 'SONDA M42 \(desfeita\)/);
    // a última instrução do bloco é o RAISE
    const corpo = sondaExec.slice(0, sondaExec.lastIndexOf('END'));
    expect(corpo.trim()).toMatch(
      /RAISE EXCEPTION 'SONDA M42 \(desfeita\)[^;]*;$/,
    );
  });

  it('está documentada como pendente no MIGRATIONS.md', () => {
    const doc = ler(caminhoDoc);
    // ⏳ a aplicar ou ✅ aplicada: a entrada existe nos dois estados.
    expect(doc).toMatch(/### (⏳|✅) Migration 42:/);
    expect(doc).toContain(ARQUIVO);
  });
});
