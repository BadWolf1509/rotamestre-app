// Guarda estática da Migration 80 (`vw_performance_motoristas`: "tempo médio"
// passa a ser o tempo REAL das rotas concluídas — `concluida_em - iniciada_em`,
// entre 0 e 24 h, o mesmo critério do dashboard — e "distância total" soma só
// as rotas concluídas). O comportamento se prova com a sonda, desfeita pelo
// RAISE. Esta guarda impede que a view perca o `security_invoker` (a view é
// lida pelo gestor e depende do RLS de `rotas`), que as colunas mudem de nome
// ou de ordem (CREATE OR REPLACE VIEW exige as mesmas), que o tempo volte a
// ser o estimado (`tempo_total`) e que as cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261027104000_desempenho_motorista_pelo_realizado.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261027104000_sonda_migration80.sql',
);
const caminhoDoc = join(raiz, 'database', 'MIGRATIONS.md');

const ler = (p: string) =>
  existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '';
const sql = ler(caminhoDb);
const sonda = ler(caminhoSonda);
const semComentarios = (texto: string) =>
  texto
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
const executavel = semComentarios(sql);
const rollback = (() => {
  const i = sql.indexOf('-- ROLLBACK:');
  if (i < 0) return '';
  return sql
    .slice(i)
    .split('\n')
    .map((l) => l.replace(/^-- ?/, ''))
    .join('\n');
})();
const corpoView = (() => {
  const i = executavel.indexOf(
    'CREATE OR REPLACE VIEW public.vw_performance_motoristas',
  );
  if (i < 0) return '';
  const fim = executavel.indexOf(';', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
})();

const COLUNAS = [
  'id',
  'nome',
  'unidade_id',
  'unidade_nome',
  'total_rotas',
  'rotas_concluidas',
  'rotas_em_andamento',
  'rotas_nao_executadas',
  'rotas_canceladas',
  'taxa_execucao',
  'distancia_total_km',
  'tempo_medio_minutos',
];

describe('Migration 80: desempenho do motorista pelo realizado', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('view com security_invoker e sem SECURITY DEFINER', () => {
    expect(corpoView).toMatch(/WITH \(security_invoker = true\)/);
    expect(executavel).not.toMatch(/SECURITY DEFINER/);
  });

  it('mesmas colunas, na mesma ordem', () => {
    const posicoes = COLUNAS.map((c) => {
      const m = new RegExp(`(?:AS ${c}\\b|u\\.${c}\\b)`).exec(corpoView);
      return m ? m.index : -1;
    });
    for (const p of posicoes) expect(p).toBeGreaterThan(-1);
    const ordenadas = [...posicoes].sort((a, b) => a - b);
    expect(posicoes).toEqual(ordenadas);
  });

  it('distância só das concluídas; tempo real, entre 0 e 24 h, das concluídas', () => {
    expect(corpoView).toMatch(
      /sum\(r\.distancia_total\) FILTER \(WHERE r\.status::text = 'concluida'\) AS distancia_total_km/,
    );
    expect(corpoView).toMatch(
      /extract\(epoch FROM r\.concluida_em - r\.iniciada_em\) \/ 60/,
    );
    expect(corpoView).toMatch(/r\.concluida_em > r\.iniciada_em/);
    expect(corpoView).toMatch(
      /r\.concluida_em - r\.iniciada_em < interval '24 hours'/,
    );
    expect(corpoView).toMatch(/AS tempo_medio_minutos/);
    expect(corpoView).not.toMatch(/tempo_total/);
  });

  it('privilégios: só leitura para authenticated, nada para anon', () => {
    expect(executavel).toContain(
      'REVOKE ALL ON public.vw_performance_motoristas FROM PUBLIC, anon;',
    );
    expect(executavel).toContain(
      'GRANT SELECT ON public.vw_performance_motoristas TO authenticated;',
    );
    expect(executavel).toMatch(
      /COMMENT ON VIEW public\.vw_performance_motoristas IS\s+'[^']*Migration 80/,
    );
  });

  it('rollback colável: volta a definição anterior', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    expect(rollback).toContain('avg(r.tempo_total) AS tempo_medio_minutos');
    expect(rollback).toContain('sum(r.distancia_total) AS distancia_total_km');
    expect(rollback).toMatch(/security_invoker = true/);
  });

  it('a sonda cobre os 5 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M80 \(desfeita\)/);
    for (let caso = 1; caso <= 5; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    expect(sonda).toContain('public.vw_performance_motoristas');
    expect(sonda).toMatch(/sonda-m80-/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M80 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('cabeçalho e MIGRATIONS.md citam os mesmos números medidos', () => {
    const doc = ler(caminhoDoc);
    const i = doc.search(/### .*Migration 80: /);
    const fim = i < 0 ? -1 : doc.indexOf('\n---', i);
    const entrada = (
      i < 0 ? '' : doc.slice(i, fim < 0 ? undefined : fim)
    ).replace(/\s+/g, ' ');
    const cabecalho = sql.replace(/\n--\s*/g, ' ').replace(/\s+/g, ' ');
    for (const trecho of [
      'planejado 59, 47 e 52 min',
      'real sem teto 224, 376 e 242',
      'real com o teto de 24 h da view 204, 230 e 174',
    ]) {
      expect(cabecalho).toContain(trecho);
      expect(entrada).toContain(trecho);
    }
  });

  it('MIGRATIONS.md registra a Migration 80 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 80: /);
    expect(doc).toContain(ARQUIVO);
  });
});
