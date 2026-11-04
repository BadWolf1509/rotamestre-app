// Guarda estática da Migration 64 (os papéis da API, `anon` e
// `authenticated`, ficam só com SELECT/INSERT/UPDATE/DELETE nas tabelas). O
// comportamento se prova com a sonda (`database/sondas/`), que lê o catálogo.
// Esta guarda impede que a migration revogue além do que a API não usa
// (SELECT, INSERT, UPDATE, DELETE quebrariam o app), que esqueça os
// privilégios-padrão (tabela nova voltaria a nascer com eles), que toque em
// `service_role` ou que as duas cópias divirjam.
import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
  semComentarios,
} from './_helpers/migration';

const ARQUIVO = '20261025153000_api_sem_privilegios_de_manutencao.sql';

const m = carregarMigration(ARQUIVO);
const { sql } = m;
const sonda = lerSonda('20261025153000_sonda_migration64.sql');
const { executavel } = m;
const { rollback } = m;

const PRIVS = 'TRUNCATE, TRIGGER, REFERENCES, MAINTAIN';

describe('Migration 64: API sem privilégios de manutenção nas tabelas', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('revoga os quatro privilégios em todas as tabelas de public', () => {
    expect(executavel).toContain(
      `REVOKE ${PRIVS} ON ALL TABLES IN SCHEMA public FROM anon, authenticated;`,
    );
  });

  it('tabela nova criada pelo postgres já nasce sem eles', () => {
    expect(executavel).toContain(
      `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ${PRIVS} ON TABLES FROM anon, authenticated;`,
    );
  });

  it('não revoga o que a API usa nem toca em service_role', () => {
    const revokes = executavel.match(/REVOKE[^;]*;/g) ?? [];
    expect(revokes).toHaveLength(2);
    for (const r of revokes) {
      // Só a lista de privilégios (entre REVOKE e ON): "ALL TABLES" é o alvo.
      const privilegios = r.slice('REVOKE'.length, r.indexOf(' ON '));
      expect(privilegios.trim()).toBe(PRIVS);
      expect(r).not.toMatch(/service_role|PUBLIC/);
    }
    expect(executavel).not.toMatch(/\bGRANT\b/);
  });

  it('rollback colável devolve o que foi medido, tabela a tabela, e os padrões', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    // Não "todos em todas": usuario_unidades nunca teve TRUNCATE, e anon não
    // tinha nada em rascunhos_rota nem nas visões.
    expect(rollback).not.toMatch(/ON ALL TABLES/);
    expect(rollback).toMatch(
      new RegExp(
        `GRANT ${PRIVS} ON [^;]*public\\.unidades[^;]* TO anon, authenticated;`,
      ),
    );
    expect(rollback).toContain(
      'GRANT TRIGGER, REFERENCES, MAINTAIN ON public.usuario_unidades TO anon, authenticated;',
    );
    expect(rollback).toContain(
      `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ${PRIVS} ON TABLES TO anon, authenticated;`,
    );
    expect(rollback).toMatch(/^COMMIT;/m);
  });

  it('a sonda cobre os cenários e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M64 \(desfeita\)/);
    // 1 a 4 saem de um laço, um caso por privilégio.
    expect(sonda).toContain(
      "VALUES ('1', 'TRUNCATE'), ('2', 'TRIGGER'), ('3', 'REFERENCES'), ('4', 'MAINTAIN')",
    );
    expect(sonda).toContain("' | ' || v_caso || ' OK: ");
    for (const caso of [
      '5 OK', // unidades: em particular, sem TRUNCATE e TRIGGER
      '6 OK', // SELECT/INSERT/UPDATE/DELETE seguem como estavam
      '7 OK', // service_role intocado
      '8 OK', // padrão do postgres sem os quatro
      '9 OK', // tabela criada na sonda nasce sem os quatro
    ]) {
      expect(sonda).toContain(caso);
    }
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M64 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    // DELETE aparece como nome de privilégio; o que não pode é o comando.
    expect(semComentarios(sonda)).not.toMatch(
      /\bDELETE\s+FROM\b|\bTRUNCATE\s+(TABLE\s+)?public\./i,
    );
  });

  it('MIGRATIONS.md registra a Migration 64 com o arquivo', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### .*Migration 64: /);
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
