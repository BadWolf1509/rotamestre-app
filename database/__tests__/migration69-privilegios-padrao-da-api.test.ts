// Guarda estática da Migration 69 (privilégios-padrão da API: função nova do
// `postgres` nasce sem EXECUTE para PUBLIC/anon, e `anon` fica só com leitura
// nas tabelas de public). O comportamento se prova com a sonda
// (`database/sondas/`), que lê o catálogo e cria uma função e uma tabela de
// nome único, desfeitas pelo RAISE. Esta guarda impede que a migration revogue
// de `authenticated`/`service_role` (quebraria o app e as Edge Functions), que
// conceda algo, que o rollback perca a granularidade medida, que a sonda
// escreva em tabela de verdade ou que as duas cópias divirjam.
import { join } from 'path';

import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
  RAIZ,
  semComentarios,
} from './_helpers/migration';

const ARQUIVO = '20261025164000_privilegios_padrao_da_api.sql';
const caminhoSkill = join(
  RAIZ,
  '.claude',
  'skills',
  'new-migration',
  'SKILL.md',
);

const m = carregarMigration(ARQUIVO);
const { sql } = m;
const sonda = lerSonda('20261025164000_sonda_migration69.sql');
const { executavel } = m;
const { rollback } = m;

// Única concessão: mantém para função de extensão futura do postgres o
// EXECUTE que authenticated/service_role hoje têm via PUBLIC.
const GRANT_EXTENSIONS =
  'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA extensions GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;';

const LINHAS = [
  'ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;',
  'REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;',
  GRANT_EXTENSIONS,
];

describe('Migration 69: privilégios-padrão da API', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('contém exatamente as cinco instruções, cada uma numa linha', () => {
    const linhas = executavel.split('\n').map((l) => l.trim());
    for (const l of LINHAS) {
      expect(linhas).toContain(l);
    }
    // Nada além delas: só BEGIN, COMMIT e as cinco.
    const instrucoes = executavel
      .split(';')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    expect(instrucoes).toEqual([
      'BEGIN',
      ...LINHAS.map((l) => l.slice(0, -1)),
      'COMMIT',
    ]);
  });

  it('só concede o EXECUTE de extensions e não revoga de authenticated ou service_role', () => {
    const grants = (executavel.match(/^.*\bGRANT\b.*$/gm) ?? []).map((g) =>
      g.trim(),
    );
    expect(grants).toEqual([GRANT_EXTENSIONS]);
    expect(executavel).not.toMatch(/GRANT[^;]*\b(anon|PUBLIC)\b/);
    const revokes = executavel.match(/\bREVOKE[^;]*;/g) ?? [];
    expect(revokes).toHaveLength(4);
    for (const r of revokes) {
      expect(r).not.toMatch(/authenticated|service_role/);
      // SELECT de anon fica (telas pré-login e o e2e leem com a chave pública).
      expect(r).not.toMatch(/\bSELECT\b/);
    }
  });

  it('rollback colável devolve o que foi medido, tabela a tabela, e os padrões', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    expect(rollback).not.toMatch(/ON ALL TABLES/);
    expect(rollback).toMatch(
      /GRANT INSERT, UPDATE, DELETE ON [^;]*public\.unidades[^;]* TO anon;/,
    );
    for (const tabela of [
      'admin_logs',
      'incidentes',
      'logs',
      'motorista_locations',
      'paradas',
      'plan_prices',
      'push_notification_logs',
      'unidades',
    ]) {
      expect(rollback).toMatch(
        new RegExp(
          `GRANT INSERT, UPDATE, DELETE ON [^;]*public\\.${tabela}\\b[^;]* TO anon;`,
        ),
      );
    }
    expect(rollback).toContain('GRANT INSERT, DELETE ON public.rotas TO anon;');
    expect(rollback).toContain(
      'GRANT DELETE ON public.notificacoes, public.usuarios TO anon;',
    );
    expect(rollback).toContain(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO PUBLIC;',
    );
    expect(rollback).toContain(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;',
    );
    expect(rollback).toContain(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT INSERT, UPDATE, DELETE ON TABLES TO anon;',
    );
    expect(rollback).toContain(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA extensions REVOKE EXECUTE ON FUNCTIONS FROM authenticated, service_role;',
    );
  });

  it('a sonda cobre os nove casos e termina desfeita por RAISE', () => {
    for (let caso = 1; caso <= 9; caso += 1) {
      expect(sonda).toContain(`${caso} OK`);
    }
    // Caso 9: função criada em extensions, sem CREATE EXTENSION.
    expect(sonda).toMatch(/CREATE FUNCTION extensions\./);
    expect(semComentarios(sonda)).not.toMatch(/CREATE\s+EXTENSION/i);
    // Casos 6, 7 e 9 só provam algo se o objeto for criado pelo postgres.
    expect(sonda).toMatch(/current_user/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M69 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    // DELETE aparece como nome de privilégio; o que não pode é o comando.
    expect(semComentarios(sonda)).not.toMatch(
      /\bDELETE\s+FROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+public\./i,
    );
  });

  it('MIGRATIONS.md registra a Migration 69 com o arquivo', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### .*Migration 69: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('a skill new-migration cita a Migration 69 e mantém o REVOKE explícito', () => {
    const skill = ler(caminhoSkill);
    const secao = skill.slice(
      skill.indexOf('### 2. Security definer functions'),
      skill.indexOf('### 3.'),
    );
    expect(secao).toContain('Migration 69');
    expect(secao).toMatch(/REVOKE[^\n]*FROM PUBLIC, anon/);
    expect(secao).toMatch(/supabase_auth_admin/);
    expect(secao).toMatch(/fora de public\/storage\/extensions/);
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
