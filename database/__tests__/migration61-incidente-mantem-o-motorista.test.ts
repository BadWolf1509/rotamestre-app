// Guarda estática da Migration 61 (o incidente mantém o motorista que o
// registrou). O banco único é produção e não há pgTAP: o comportamento se
// prova com a sonda transacional (`database/sondas/`). Esta guarda impede que
// uma edição tire a isenção de quem não tem sessão, abra exceção para algum
// papel, deixe de fora o incidente sem rota, tire a cláusula WHEN (que deixa
// passar o ON DELETE SET NULL da FK), exponha a função de gatilho ou deixe as
// duas cópias divergirem.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261025150000_incidente_mantem_o_motorista.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261025150000_sonda_migration61.sql',
);
const caminhoDoc = join(raiz, 'database', 'MIGRATIONS.md');

// CRLF fora: com `core.autocrlf=true` (Windows) o checkout troca as quebras.
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

const FUNCAO = 'incidentes_mantem_o_motorista';
const GATILHO = 'trg_incidentes_mantem_o_motorista';

const corpo = (() => {
  const inicio = executavel.indexOf(
    `CREATE OR REPLACE FUNCTION public.${FUNCAO}()`,
  );
  if (inicio < 0) return '';
  const abre = executavel.indexOf('$$', inicio);
  const fecha = executavel.indexOf('$$', abre + 2);
  return executavel.slice(inicio, fecha + 2);
})();

const gatilho = (() => {
  const inicio = executavel.indexOf(`CREATE TRIGGER ${GATILHO}`);
  if (inicio < 0) return '';
  return executavel.slice(inicio, executavel.indexOf(';', inicio) + 1);
})();

describe('Migration 61: o incidente mantém o motorista que o registrou', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('função DEFINER com search_path vazio e dono postgres; sem sessão passa', () => {
    expect(corpo).toMatch(
      /RETURNS trigger\s+LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = ''/,
    );
    expect(corpo).toMatch(/IF auth\.uid\(\) IS NULL THEN\s+RETURN NEW;/);
    expect(executavel).toMatch(
      new RegExp(`ALTER FUNCTION public\\.${FUNCAO}\\(\\) OWNER TO postgres;`),
    );
  });

  it('com sessão recusa sempre com 42501, sem ramo por papel, rota ou loja', () => {
    expect(corpo).toMatch(/RAISE EXCEPTION '[^']+'\s+USING ERRCODE = '42501'/);
    expect(corpo.match(/RAISE EXCEPTION/g)).toHaveLength(1);
    expect(corpo).not.toMatch(/gestor|usuario_unidades|rota_id|unidade_id/i);
  });

  it('gatilho BEFORE UPDATE OF motorista_id, sempre que a coluna muda', () => {
    expect(gatilho).toMatch(
      new RegExp(
        `BEFORE UPDATE OF motorista_id ON public\\.incidentes\\s+FOR EACH ROW\\s+` +
          `WHEN \\(OLD\\.motorista_id IS DISTINCT FROM NEW\\.motorista_id\\)\\s+` +
          `EXECUTE FUNCTION public\\.${FUNCAO}\\(\\);`,
      ),
    );
    expect(executavel).toMatch(
      new RegExp(`DROP TRIGGER IF EXISTS ${GATILHO} ON public\\.incidentes;`),
    );
  });

  it('NULL só passa vindo de outro gatilho (a ação ON DELETE SET NULL da FK)', () => {
    expect(corpo).toMatch(
      /IF NEW\.motorista_id IS NULL AND pg_trigger_depth\(\) > 1 THEN\s+RETURN NEW;/,
    );
  });

  it('a função de gatilho não é executável por PUBLIC, anon nem authenticated', () => {
    expect(executavel).toMatch(
      new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${FUNCAO}\\(\\) FROM PUBLIC, anon, authenticated;`,
      ),
    );
    expect(executavel).not.toMatch(/GRANT\s+EXECUTE/i);
  });

  it('não reescreve policies nem os gatilhos que já existem em incidentes', () => {
    expect(executavel).not.toMatch(/POLICY/i);
    expect(executavel).not.toMatch(
      /FUNCTION public\.incidentes_(define_unidade|confere_rota_parada|troca_de_rota_pelo_gestor)/,
    );
  });

  it('rollback colável desfaz gatilho e função', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(
      new RegExp(`DROP TRIGGER IF EXISTS ${GATILHO} ON public\\.incidentes;`),
    );
    expect(rollback).toMatch(
      new RegExp(`DROP FUNCTION IF EXISTS public\\.${FUNCAO}\\(\\);`),
    );
    expect(rollback).toMatch(/^COMMIT;/m);
  });

  it('a sonda cobre os cenários e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M61 \(desfeita\)/);
    for (const caso of [
      '1 OK', // gestor põe pessoa de fora em incidente sem rota
      '1b OK', // e essa pessoa não passa a ler o incidente
      '1c OK', // o incidente continua com o motorista original
      '2 OK', // gestor põe outro motorista da mesma loja
      '3 OK', // gestor põe outra pessoa em incidente com rota
      '4 OK', // gestor resolve o incidente (status, observações)
      '5 OK', // motorista edita o próprio incidente
      '6 OK', // gestor não grava NULL direto
      '6b OK', // motorista não grava o próprio NULL
      '7 OK', // sem sessão a troca passa
      '7b OK', // service_role troca
      '8 OK', // motorista cria incidente (INSERT)
      '9a OK',
      '9b OK',
    ]) {
      expect(sonda).toContain(caso);
    }
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M61 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\b/i);
  });

  it('os casos recusados exigem o SQLSTATE 42501 e a mensagem do gatilho', () => {
    for (const caso of ['1', '2', '3', '6']) {
      expect(sonda).toMatch(
        new RegExp(
          `CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE 'O incidente mantém o motorista%'\\s+` +
            `THEN ' \\| ${caso} OK:`,
        ),
      );
    }
    expect(sonda).not.toMatch(
      /WHEN OTHERS THEN\s+r := r \|\| ' \| \d+[a-z]? OK/,
    );
  });

  it('MIGRATIONS.md registra a Migration 61 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 61: /);
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
      'falha de seg',
    ]) {
      expect(publicos).not.toContain(termo);
    }
  });
});
