// Guarda estática da Migration 74 (sequências de public sem privilégio para
// `anon`: REVOKE nas existentes e no privilégio-padrão do `postgres`). O
// comportamento se prova com a sonda (`database/sondas/`), que lê o catálogo e
// cria uma sequência e uma tabela serial de nome único, desfeitas pelo RAISE.
// Esta guarda impede que a migration revogue de `authenticated`/`service_role`
// (o app e as Edge Functions usariam sequência nova sem USAGE), que conceda
// algo, que o rollback perca o que foi medido, que a sonda escreva em tabela
// de verdade ou que as duas cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261026124000_sequencias_sem_anon.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261026124000_sonda_migration74.sql',
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

const LINHAS = [
  'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;',
];

describe('Migration 74: sequências de public sem privilégio para anon', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só, com exatamente as duas instruções', () => {
    const instrucoes = executavel
      .split(';')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    expect(instrucoes).toEqual([
      'BEGIN',
      ...LINHAS.map((l) => l.slice(0, -1)),
      'COMMIT',
    ]);
    const linhas = executavel.split('\n').map((l) => l.trim());
    for (const l of LINHAS) {
      expect(linhas).toContain(l);
    }
  });

  it('não concede nada e não toca authenticated nem service_role', () => {
    expect(executavel).not.toMatch(/\bGRANT\b/);
    const revokes = executavel.match(/\bREVOKE[^;]*;/g) ?? [];
    expect(revokes).toHaveLength(2);
    for (const r of revokes) {
      expect(r).not.toMatch(/authenticated|service_role|PUBLIC/);
      expect(r).toMatch(/FROM anon;$/);
    }
  });

  it('rollback colável devolve o padrão medido e diz que não havia sequência', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    expect(rollback).toContain(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO anon;',
    );
    expect(rollback.toLowerCase()).toMatch(/n[ãa]o havia sequ[êe]ncia/);
    expect(rollback).not.toMatch(/ON ALL SEQUENCES/);
  });

  it('a sonda cobre os cinco casos e termina desfeita por RAISE', () => {
    for (let caso = 1; caso <= 5; caso += 1) {
      expect(sonda).toContain(`${caso} OK`);
    }
    expect(sonda).toMatch(/CREATE SEQUENCE public\./);
    expect(sonda).toMatch(/\(id serial\)/);
    expect(sonda).toMatch(/current_user/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M74 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(
      /\bDELETE\s+FROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+public\./i,
    );
  });

  it('MIGRATIONS.md registra a Migration 74 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 74: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const i = doc.search(/### .*Migration 74: /);
    const entrada = i < 0 ? '' : doc.slice(i);
    const publicos = [sql, sonda, entrada].join('\n').toLowerCase();
    for (const termo of [
      'vaza',
      'ataque',
      'atacante',
      'brecha',
      'explor',
      'vulnerab',
      'falha',
    ]) {
      expect(publicos).not.toContain(termo);
    }
  });
});
