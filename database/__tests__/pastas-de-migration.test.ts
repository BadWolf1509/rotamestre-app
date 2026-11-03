/**
 * database/migrations é a pasta canônica de migrations: só migration entra
 * nela. Script, seed e SQL de diagnóstico ficam de fora (o drift auditor e o
 * `db push` leem a pasta inteira).
 */
import { readdirSync } from 'fs';
import { join } from 'path';

const NOME_DE_MIGRATION = /^\d{3,14}_[a-z0-9_]+\.sql$/;

const PASTA_DATABASE = join(__dirname, '..', 'migrations');

describe('database/migrations só guarda migration', () => {
  const nomes = readdirSync(PASTA_DATABASE).filter((n) => n !== 'README.md');

  it('todo arquivo tem nome de migration', () => {
    expect(nomes.filter((n) => !NOME_DE_MIGRATION.test(n))).toEqual([]);
  });

  it('não guarda seed de dados de teste', () => {
    expect(nomes.filter((n) => n.startsWith('99999999999999'))).toEqual([]);
  });
});
