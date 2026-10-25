// Guarda estática da Migration 62 (todo incidente tem loja). O comportamento
// se prova com a sonda transacional (`database/sondas/`); esta guarda impede
// que a migration vire um backfill escondido (UPDATE/DELETE de dados), que a
// restrição seja trocada por uma CHECK NOT VALID que nunca é validada, que a
// função de cálculo da loja seja reescrita junto ou que as duas cópias
// divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261025151000_incidente_sempre_com_loja.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261025151000_sonda_migration62.sql',
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

describe('Migration 62: todo incidente tem loja', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('confere que não há incidente sem loja antes de mudar a coluna', () => {
    const conferencia = executavel.search(
      /IF EXISTS \(SELECT 1 FROM public\.incidentes WHERE unidade_id IS NULL\) THEN\s+RAISE EXCEPTION/,
    );
    const alter = executavel.indexOf(
      'ALTER TABLE public.incidentes ALTER COLUMN unidade_id SET NOT NULL;',
    );
    expect(conferencia).toBeGreaterThan(-1);
    expect(alter).toBeGreaterThan(conferencia);
  });

  it('a coluna vira NOT NULL de fato, sem CHECK NOT VALID', () => {
    expect(executavel).toMatch(
      /ALTER TABLE public\.incidentes ALTER COLUMN unidade_id SET NOT NULL;/,
    );
    expect(executavel).not.toMatch(/NOT VALID/i);
  });

  it('não altera dados nem a função que calcula a loja', () => {
    expect(executavel).not.toMatch(/\bUPDATE\s+public\./i);
    expect(executavel).not.toMatch(/\bDELETE\b/i);
    expect(executavel).not.toMatch(/FUNCTION/i);
  });

  it('rollback colável devolve a coluna a anulável', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(
      /ALTER TABLE public\.incidentes ALTER COLUMN unidade_id DROP NOT NULL;/,
    );
    expect(rollback).toMatch(/^COMMIT;/m);
  });

  it('a sonda cobre os cenários e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M62 \(desfeita\)/);
    for (const caso of [
      '1 OK', // catálogo: coluna NOT NULL
      '2 OK', // incidente que não acha loja é recusado (23502)
      '3 OK', // motorista com vínculo cria incidente sem rota, com loja
      '4 OK', // motorista cria incidente na rota, loja da rota
      '5 OK', // gestor grava unidade_id NULL direto: a loja continua
      '6 OK', // desligar a rota: a loja continua
      '7 OK', // sem sessão, UPDATE comum passa
    ]) {
      expect(sonda).toContain(caso);
    }
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M62 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\b/i);
  });

  it('o caso recusado exige o SQLSTATE 23502 na coluna unidade_id', () => {
    expect(sonda).toMatch(
      /CASE WHEN SQLSTATE = '23502' AND SQLERRM LIKE '%unidade_id%'\s+THEN ' \| 2 OK:/,
    );
  });

  it('MIGRATIONS.md registra a Migration 62 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 62: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const publicos = [sql, sonda].join('\n').toLowerCase();
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
