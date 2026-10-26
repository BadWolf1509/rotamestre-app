// Guarda estática da Migration 66 (incidente atualizado só pelo gestor da
// loja). O comportamento se prova com a sonda (`database/sondas/`), que monta
// o cenário como `authenticated`. Esta guarda impede que a policy de UPDATE
// volte a ter o ramo do motorista (`motorista_id = auth.uid()`), que a regra
// do gestor mude de forma entre USING e WITH CHECK, que outra policy seja
// recriada junto e que as duas cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261025161000_incidente_atualizado_pelo_gestor.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261025161000_sonda_migration66.sql',
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

/** Trecho de `inicio` até o primeiro `fim` depois dele ('' se não houver). */
const trecho = (texto: string, inicio: string, fim: string) => {
  const i = texto.indexOf(inicio);
  if (i < 0) return '';
  const f = texto.indexOf(fim, i + inicio.length);
  return f < 0 ? '' : texto.slice(i, f + fim.length);
};

const policy = trecho(
  executavel,
  'CREATE POLICY incidentes_update ON public.incidentes',
  ';\n',
);

describe('Migration 66: incidente atualizado só pelo gestor da loja', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('recria incidentes_update como FOR UPDATE TO authenticated', () => {
    expect(executavel).toContain(
      'DROP POLICY IF EXISTS incidentes_update ON public.incidentes;',
    );
    expect(policy).not.toBe('');
    expect(policy).toMatch(/FOR UPDATE\s+TO authenticated/);
  });

  it('a policy não tem o ramo do motorista e confere o gestor em USING e WITH CHECK', () => {
    expect(policy).toMatch(/USING/);
    expect(policy).toMatch(/WITH CHECK/);
    expect(policy).not.toMatch(/motorista_id/);
    expect(policy.match(/papel::text = 'gestor'/g)).toHaveLength(2);
    expect(policy.match(/uu\.ativo = true/g)).toHaveLength(2);
    expect(policy.match(/uu\.unidade_id = incidentes\.unidade_id/g)).toHaveLength(
      2,
    );
    expect(policy.match(/uu\.usuario_id = \(SELECT auth\.uid\(\)\)/g)).toHaveLength(
      2,
    );
  });

  it('não recria nenhuma outra policy', () => {
    expect(executavel.match(/CREATE POLICY/g)).toHaveLength(1);
    expect(executavel.match(/DROP POLICY/g)).toHaveLength(1);
    expect(executavel).not.toMatch(/incidentes_(select|insert|delete)/);
  });

  it('não mexe em gatilhos nem em funções', () => {
    expect(executavel).not.toMatch(/\b(CREATE|DROP|ALTER)\s+(OR REPLACE\s+)?(TRIGGER|FUNCTION)\b/);
  });

  it('rollback colável recria a policy viva de 25/10, com o ramo do motorista', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    const viva = trecho(
      rollback,
      'CREATE POLICY incidentes_update ON public.incidentes',
      ';\n',
    );
    expect(viva).not.toBe('');
    expect(viva).toMatch(/FOR UPDATE\s+TO authenticated/);
    expect(viva.match(/motorista_id = \( SELECT auth\.uid\(\) AS uid\)/g)).toHaveLength(
      2,
    );
    expect(viva.match(/'gestor'::text/g)).toHaveLength(2);
    expect(rollback).toMatch(/^COMMIT;/m);
  });

  it('a sonda cobre os cenários e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M66 \(desfeita\)/);
    for (const caso of ['1', '2', '3', '4', '5', '6', '7', '8']) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M66 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 66 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 66: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const entrada = doc.slice(doc.search(/### .*Migration 66: /));
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
