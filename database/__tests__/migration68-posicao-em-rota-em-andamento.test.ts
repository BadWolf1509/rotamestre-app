// Guarda estática da Migration 68 (posição gravada só em rota em andamento,
// com margem para a fila offline, e por motorista ativo). O comportamento se
// prova com a sonda (`database/sondas/`), que grava posições como
// `authenticated`. Esta guarda impede que a margem passe a comparar `now()`
// (recusaria a fila offline enviada horas depois), que o cadastro ativo ou o
// vínculo ativo saiam da policy, que outra policy seja recriada junto e que
// as duas cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261025163000_posicao_em_rota_em_andamento.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261025163000_sonda_migration68.sql',
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
const umaLinha = (texto: string) => texto.replace(/\s+/g, ' ');

/** Trecho de `inicio` até o primeiro `fim` depois dele ('' se não houver). */
const trecho = (texto: string, inicio: string, fim: string) => {
  const i = texto.indexOf(inicio);
  if (i < 0) return '';
  const f = texto.indexOf(fim, i + inicio.length);
  return f < 0 ? '' : texto.slice(i, f + fim.length);
};

const CABECA =
  'CREATE POLICY motorista_locations_insert_optimized ON public.motorista_locations';
const policy = trecho(executavel, CABECA, ';\n');

describe('Migration 68: posição gravada só em rota em andamento, por motorista ativo', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('recria uma só policy, motorista_locations_insert_optimized, FOR INSERT TO authenticated', () => {
    expect(executavel).toContain(
      'DROP POLICY IF EXISTS motorista_locations_insert_optimized ON public.motorista_locations;',
    );
    expect(executavel.match(/CREATE POLICY/g)).toHaveLength(1);
    expect(executavel.match(/DROP POLICY/g)).toHaveLength(1);
    expect(policy).not.toBe('');
    expect(policy).toMatch(/FOR INSERT\s+TO authenticated/);
    expect(executavel).not.toMatch(/motorista_locations_select_optimized/);
  });

  it('a policy exige cadastro ativo, vínculo ativo, rota em andamento ou concluída dentro da margem', () => {
    const p = umaLinha(policy);
    expect(p).toContain('motorista_id = (SELECT auth.uid())');
    expect(p).toContain('(SELECT public.usuario_atual_ativo())');
    expect(p).toContain('rota_id IS NULL');
    expect(p).toContain('r.motorista_id = (SELECT auth.uid())');
    expect(p).toContain('uu.usuario_id = (SELECT auth.uid())');
    expect(p).toContain('uu.ativo = true');
    expect(p).toContain("r.status = 'em_andamento'");
    expect(p).toContain("r.status = 'concluida'");
    expect(p).toContain(
      `motorista_locations."timestamp" <= r.concluida_em + interval '10 minutes'`,
    );
  });

  it('a margem compara o horário da posição, não o relógio do banco', () => {
    expect(policy).not.toMatch(/now\(\)/i);
    expect(policy).not.toMatch(/current_timestamp/i);
  });

  it('não mexe em gatilhos nem em funções', () => {
    expect(executavel).not.toMatch(
      /\b(CREATE|DROP|ALTER)\s+(OR REPLACE\s+)?(TRIGGER|FUNCTION)\b/,
    );
  });

  it('rollback colável recria a policy viva de 25/10', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    const viva = umaLinha(trecho(rollback, CABECA, ';\n'));
    expect(viva).not.toBe('');
    expect(viva).toMatch(/FOR INSERT TO authenticated/);
    expect(viva).toContain(
      '(motorista_id = ( SELECT auth.uid() AS uid)) AND ((rota_id IS NULL) OR (EXISTS ( SELECT 1 FROM rotas r WHERE ((r.id = motorista_locations.rota_id) AND (r.motorista_id = ( SELECT auth.uid() AS uid))))))',
    );
    expect(viva).not.toMatch(/usuario_atual_ativo|concluida_em/);
    expect(rollback).toMatch(/^COMMIT;/m);
  });

  it('a sonda cobre os 11 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M68 \(desfeita\)/);
    for (const caso of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '9b', '10', '11']) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M68 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).toMatch(/WHEN insufficient_privilege/);
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(semComentarios(sonda)).not.toMatch(/\bUPDATE\s+public\.rotas\b/i);
  });

  it('MIGRATIONS.md registra a Migration 68 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 68: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const entrada = doc.slice(doc.search(/### .*Migration 68: /));
    const publicos = [sql, sonda, entrada].join('\n').toLowerCase();
    for (const termo of [
      'vaza',
      'ataque',
      'atacante',
      'brecha',
      'explor',
      'vulnerab',
    ]) {
      expect(publicos).not.toContain(termo);
    }
  });
});
