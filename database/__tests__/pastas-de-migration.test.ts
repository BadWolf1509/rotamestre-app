/**
 * database/migrations é a pasta canônica de migrations: só migration entra
 * nela. Script, seed e SQL de diagnóstico ficam de fora (o drift auditor e o
 * `db push` leem a pasta inteira).
 */
import { readdirSync } from 'fs';
import { join } from 'path';

import { ler, PASTA_DB, PASTA_SUPA } from './_helpers/migration';

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

describe('supabase/migrations é subconjunto fiel de database/migrations', () => {
  const CORTE = '20260101000000';
  // Aplicadas antes de a regra ser cobrada (MCP/Dashboard) e registradas como
  // aplicadas no MIGRATIONS.md. A lista só encolhe: não acrescente nome aqui.
  const SO_EM_DATABASE = [
    '20260208000000_fix_rls_multi_unidade.sql',
    '20260713190000_fix_inserir_parada_chegada_conflict.sql',
    '20260827190000_expiracao_rota_fuso_e_guarda_horario.sql',
    '20260831230000_expirar_rotas_em_andamento.sql',
    '20260831234500_lembrete_rota_em_andamento.sql',
    '20260906120000_rls_endurecimento_papel_e_view_admin.sql',
    '20260908000000_realtime_motorista_locations.sql',
    '20261004120000_dedup_logs_por_parada.sql',
  ];

  const sqlDe = (pasta: string) =>
    readdirSync(pasta).filter((n) => n.endsWith('.sql'));
  const emDatabase = sqlDe(PASTA_DB);
  const emSupabase = sqlDe(PASTA_SUPA);

  it('todo arquivo de supabase/migrations existe em database/migrations com o mesmo conteúdo', () => {
    const divergentes = emSupabase.filter(
      (n) =>
        !emDatabase.includes(n) ||
        ler(join(PASTA_SUPA, n)) !== ler(join(PASTA_DB, n)),
    );
    // Cada nome listado: corrija a cópia em supabase/migrations para ficar
    // idêntica à de database/migrations (ou restaure o original em database/).
    expect(divergentes).toEqual([]);
  });

  it('migration a partir do corte tem cópia em supabase/migrations', () => {
    const semCopia = emDatabase.filter(
      (n) =>
        /^\d{14}_/.test(n) &&
        n.slice(0, 14) >= CORTE &&
        !SO_EM_DATABASE.includes(n) &&
        !emSupabase.includes(n),
    );
    // Cada nome listado: copie byte a byte para supabase/migrations.
    expect(semCopia).toEqual([]);
  });

  it('a allowlist só tem quem ainda não tem cópia, e não cresce', () => {
    expect(SO_EM_DATABASE.length).toBeLessThanOrEqual(8);
    // Nome que sumiu de database/ ou que já ganhou cópia em supabase/ sai da lista.
    const obsoletos = SO_EM_DATABASE.filter(
      (n) => !emDatabase.includes(n) || emSupabase.includes(n),
    );
    expect(obsoletos).toEqual([]);
  });

  it('não está cega', () => {
    expect(emSupabase.length).toBeGreaterThanOrEqual(60);
  });
});
