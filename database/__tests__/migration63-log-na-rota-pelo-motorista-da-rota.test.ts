// Guarda estática da Migration 63 (log na rota só pelo gestor da loja ou pelo
// motorista da própria rota). O comportamento se prova com a sonda
// transacional (`database/sondas/`); esta guarda impede que uma edição tire a
// exigência de a rota ser de quem grava, volte a aceitar qualquer vínculo
// ativo da loja, deixe de exigir pessoa ativa, troque a assinatura (a policy
// `logs_insert_optimized`, o `registrar_sos` e o gatilho do SOS dependem
// dela), mude os GRANTs ou deixe as duas cópias divergirem.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261025152000_log_na_rota_pelo_motorista_da_rota.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261025152000_sonda_migration63.sql',
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

const corpo = (() => {
  const inicio = executavel.indexOf(
    'CREATE OR REPLACE FUNCTION public.pode_registrar_log_na_rota(p_rota_id uuid)',
  );
  if (inicio < 0) return '';
  const abre = executavel.indexOf('$$', inicio);
  const fecha = executavel.indexOf('$$', abre + 2);
  return executavel.slice(inicio, fecha + 2);
})();

describe('Migration 63: log na rota pelo gestor da loja ou pelo motorista da rota', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('mesma assinatura, SQL STABLE DEFINER com search_path vazio', () => {
    expect(corpo).toMatch(
      /RETURNS boolean\s+LANGUAGE sql\s+STABLE\s+SECURITY DEFINER\s+SET search_path = ''/,
    );
    expect(executavel).not.toMatch(/DROP FUNCTION/i);
  });

  it('exige vínculo ativo na loja da rota', () => {
    expect(corpo).toMatch(
      /FROM public\.rotas r\s+JOIN public\.usuario_unidades uu ON uu\.unidade_id = r\.unidade_id\s+WHERE r\.id = p_rota_id\s+AND uu\.usuario_id = auth\.uid\(\)\s+AND uu\.ativo = true/,
    );
  });

  it('fora do gestor, só o motorista da própria rota e com pessoa ativa', () => {
    expect(corpo).toMatch(
      /uu\.papel = 'gestor'\s+OR \(\s*r\.motorista_id = auth\.uid\(\)\s+AND \(SELECT public\.usuario_atual_ativo\(\)\)\s*\)/,
    );
  });

  it('GRANTs: sem anon, com authenticated e service_role', () => {
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.pode_registrar_log_na_rota\(uuid\) FROM PUBLIC, anon;/,
    );
    expect(executavel).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.pode_registrar_log_na_rota\(uuid\) TO authenticated, service_role;/,
    );
  });

  it('não mexe na policy nem no SOS', () => {
    expect(executavel).not.toMatch(/POLICY/i);
    expect(executavel).not.toMatch(
      /registrar_sos|sos_sem_rota_quando_recusada/,
    );
  });

  it('rollback colável volta ao corpo da Migration 49', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(
      /CREATE OR REPLACE FUNCTION public\.pode_registrar_log_na_rota\(p_rota_id uuid\)/,
    );
    expect(rollback).toMatch(
      /uu\.papel = 'gestor'\s+OR \(SELECT public\.usuario_atual_ativo\(\)\)/,
    );
    expect(rollback).toMatch(/^COMMIT;/m);
  });

  it('a sonda cobre os cenários e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M63 \(desfeita\)/);
    for (const caso of [
      '1 OK', // colega da mesma loja não grava log na rota de outro motorista
      '1b OK', // a função responde false para o colega
      '2 OK', // o motorista grava log na própria rota
      '3 OK', // o gestor da loja grava log na rota
      '4 OK', // gestor de outra loja não grava
      '5 OK', // motorista desativado como pessoa não grava
      '6 OK', // motorista com vínculo inativo não grava
      '7 OK', // colega aciona SOS citando a rota alheia: grava sem rota
      '8 OK', // motorista aciona SOS na própria rota: a rota fica
      '9 OK', // log sem rota segue passando
      '10 OK', // catálogo
    ]) {
      expect(sonda).toContain(caso);
    }
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M63 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\b/i);
  });

  it('os INSERTs recusados exigem o 42501 da policy', () => {
    for (const caso of ['1', '4', '5', '6']) {
      expect(sonda).toMatch(
        new RegExp(
          `CASE WHEN SQLSTATE = '42501' AND SQLERRM LIKE '%row-level security%'\\s+` +
            `THEN ' \\| ${caso} OK:`,
        ),
      );
    }
  });

  it('MIGRATIONS.md registra a Migration 63 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 63: /);
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
