// Apoio comum das guardas estáticas de migration (`database/__tests__/migration*.test.ts`).
// Não casa o `testMatch` do Jest (pasta `_helpers`), então não vira suíte.
// Caminhos saem de `__dirname`, nunca de `process.cwd()`: a guarda roda igual
// de dentro de um worktree ou de qualquer outro diretório.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const RAIZ = join(__dirname, '..', '..', '..');
export const PASTA_DB = join(RAIZ, 'database', 'migrations');
export const PASTA_SUPA = join(RAIZ, 'supabase', 'migrations');
export const PASTA_SONDAS = join(RAIZ, 'database', 'sondas');
export const CAMINHO_DOC = join(RAIZ, 'database', 'MIGRATIONS.md');

/** Lê o arquivo normalizando `\r\n` (checkout no Windows); ausente → `''`. */
export const ler = (caminho: string): string =>
  existsSync(caminho)
    ? readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n')
    : '';

/** Tira do `--` ao fim de cada linha (não trata `/* *\/`). */
export const semComentarios = (sql: string): string =>
  sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');

/** Do primeiro `-- ROLLBACK:` ao fim, sem o prefixo `-- `; sem marcador → `''`. */
export const rollbackDe = (sql: string): string => {
  const i = sql.indexOf('-- ROLLBACK:');
  if (i < 0) return '';
  return sql
    .slice(i)
    .split('\n')
    .map((l) => l.replace(/^-- ?/, ''))
    .join('\n');
};

export interface Migration {
  arquivo: string;
  caminhoDb: string;
  caminhoSupa: string;
  sql: string;
  executavel: string;
  rollback: string;
}

export function carregarMigration(arquivo: string): Migration {
  const caminhoDb = join(PASTA_DB, arquivo);
  const caminhoSupa = join(PASTA_SUPA, arquivo);
  const sql = ler(caminhoDb);
  return {
    arquivo,
    caminhoDb,
    caminhoSupa,
    sql,
    executavel: semComentarios(sql),
    rollback: rollbackDe(sql),
  };
}

/** Texto da sonda transacional em `database/sondas/` (`''` se ausente). */
export const lerSonda = (arquivo: string): string =>
  ler(join(PASTA_SONDAS, arquivo));

/** Registra o `it` padrão: a migration existe nas duas pastas, idêntica. */
export function itExisteNasDuasPastas(m: Migration): void {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(m.caminhoDb)).toBe(true);
    expect(existsSync(m.caminhoSupa)).toBe(true);
    expect(ler(m.caminhoSupa)).toBe(m.sql);
  });
}
