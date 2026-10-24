// Guarda estática da Migration 53 (parada finalizada não se apaga; a concluída
// não muda de endereço/tipo). O comportamento se prova com a sonda
// transacional (`database/sondas/`), no banco; esta guarda impede que uma
// edição perca as peças que fecham o caso.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261024120000_parada_finalizada_imutavel.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024120000_sonda_migration53.sql',
);
const caminhoDoc = join(raiz, 'database', 'MIGRATIONS.md');

const ler = (p: string) =>
  existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '';
const sql = ler(caminhoDb);
const semComentarios = (t: string) =>
  t
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
const normaliza = (s: string) => s.replace(/\s+/g, ' ').trim();
const exec = normaliza(semComentarios(sql));

describe('Migration 53: arquivos', () => {
  it('existe em database/ e a cópia em supabase/ é idêntica', () => {
    expect(sql.length).toBeGreaterThan(0);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação e tem ROLLBACK', () => {
    expect(exec).toMatch(/^BEGIN;/);
    expect(exec).toMatch(/COMMIT;$/);
    expect(sql).toMatch(/-- ROLLBACK:/);
  });

  it('está no MIGRATIONS.md', () => {
    expect(ler(caminhoDoc)).toMatch(
      new RegExp(
        String.raw`### (?:⏳|✅) Migration 53[^\n]*\n[\s\S]{0,500}` + ARQUIVO,
      ),
    );
  });

  it('tem sonda que termina em RAISE EXCEPTION', () => {
    const sonda = ler(caminhoSonda);
    expect(sonda).toMatch(/RAISE EXCEPTION 'SONDA M53 \(desfeita\):%', r;/);
  });
});

describe('Migration 53: trava de DELETE', () => {
  it('gatilho BEFORE DELETE em paradas chama a função', () => {
    expect(exec).toMatch(
      /CREATE OR REPLACE TRIGGER trg_recusa_apagar_parada_finalizada BEFORE DELETE ON public\.paradas FOR EACH ROW EXECUTE FUNCTION public\.recusa_apagar_parada_finalizada\(\);/,
    );
  });

  it('recusa concluida e pulada com a sentinela, só com usuário e fora da cascata', () => {
    expect(exec).toMatch(/auth\.uid\(\) IS NOT NULL/);
    expect(exec).toMatch(/OLD\.status IN \('concluida', 'pulada'\)/);
    expect(exec).toMatch(
      /EXISTS \(SELECT 1 FROM public\.rotas r WHERE r\.id = OLD\.rota_id\)/,
    );
    expect(exec).toMatch(/RAISE EXCEPTION 'PARADA_FINALIZADA:/);
  });
});

describe('Migration 53: trava de UPDATE', () => {
  it('gatilho só dispara nas colunas de local e em parada concluída', () => {
    expect(exec).toMatch(
      /CREATE OR REPLACE TRIGGER trg_recusa_editar_local_de_parada_concluida BEFORE UPDATE OF endereco, tipo, latitude, longitude ON public\.paradas FOR EACH ROW WHEN \(OLD\.status = 'concluida'\) EXECUTE FUNCTION/,
    );
  });

  it('compara OLD e NEW com IS DISTINCT FROM e usa a sentinela', () => {
    for (const col of ['endereco', 'tipo', 'latitude', 'longitude']) {
      expect(exec).toMatch(
        new RegExp(`NEW\.${col} IS DISTINCT FROM OLD\.${col}`),
      );
    }
    expect(exec).toMatch(/RAISE EXCEPTION 'PARADA_CONCLUIDA_IMUTAVEL:/);
  });
});

describe('Migration 53: funções internas', () => {
  it.each([
    'recusa_apagar_parada_finalizada',
    'recusa_editar_local_de_parada_concluida',
  ])('%s é DEFINER, search_path vazio e sem EXECUTE para a API', (nome) => {
    expect(exec).toMatch(
      new RegExp(
        String.raw`CREATE OR REPLACE FUNCTION public\.${nome}\(\) RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS \$\$`,
      ),
    );
    expect(exec).toMatch(
      new RegExp(
        String.raw`REVOKE EXECUTE ON FUNCTION public\.${nome}\(\) FROM PUBLIC, anon, authenticated;`,
      ),
    );
  });
});
