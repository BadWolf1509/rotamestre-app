// Guarda estática da Migration 72 (RPC `nomes_motoristas_das_rotas`: o
// gestor ativo da loja recebe o nome do motorista de cada rota pedida quando
// esse motorista tem ou teve vínculo com a loja da rota — o caso em que a RLS
// de `usuarios` esconde a pessoa porque o vínculo ficou inativo). O
// comportamento se prova com a sonda (`database/sondas/`), que monta o cenário
// como `authenticated` e é desfeita pelo RAISE. Esta guarda impede que a
// função perca SECURITY DEFINER / search_path vazio / STABLE, que passe a
// devolver outra coluna de `usuarios`, que o vínculo do motorista passe a
// exigir `ativo` (ou deixe de exigir a mesma loja), que o teto de 1000 ids
// suma, que o EXECUTE volte a PUBLIC ou anon e que as cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261026122000_nomes_motoristas_das_rotas.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261026122000_sonda_migration72.sql',
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

describe('Migration 72: RPC nomes_motoristas_das_rotas', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('declara nomes_motoristas_das_rotas(uuid[]) RETURNS TABLE(rota_id uuid, nome text), STABLE, DEFINER, search_path vazio', () => {
    expect(executavel).toMatch(
      /CREATE OR REPLACE FUNCTION public\.nomes_motoristas_das_rotas\(p_rota_ids uuid\[\]\)\s+RETURNS TABLE\s*\(rota_id uuid, nome text\)/,
    );
    expect(executavel).toMatch(/LANGUAGE plpgsql/);
    expect(executavel).toMatch(/\bSTABLE\b/);
    expect(executavel).not.toMatch(/\bVOLATILE\b/);
    expect(executavel).toMatch(/SECURITY DEFINER/);
    expect(executavel).toMatch(/SET search_path = ''/);
    expect(executavel).toContain(
      'ALTER FUNCTION public.nomes_motoristas_das_rotas(uuid[]) OWNER TO postgres;',
    );
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.nomes_motoristas_das_rotas\(uuid\[\]\) IS\s+'[^']*Migration 72/,
    );
  });

  it('exige gestor ativo da loja da rota e vínculo (ativo ou não) do motorista na mesma loja', () => {
    // A sessão é lida uma vez, depois do teto, e usada no filtro do gestor.
    expect(executavel).toMatch(/v_uid := auth\.uid\(\);/);
    expect(executavel).toMatch(/g\.usuario_id = v_uid/);
    expect(executavel).toMatch(/papel[^;]*'gestor'[^;]*ativo = true/);
    // o vínculo do motorista NÃO filtra por ativo
    expect(executavel).toMatch(
      /usuario_unidades\s+\w+\s+WHERE\s+\w+\.usuario_id = r\.motorista_id\s+AND\s+\w+\.unidade_id = r\.unidade_id\s*\)/,
    );
  });

  it('só devolve rota_id e nome (nada de email/telefone)', () => {
    expect(executavel).not.toMatch(/\b(email|telefone|foto_url)\b/);
    // `usuarios.nome` é varchar(255): sem o cast, o RETURN QUERY não bate
    // com o RETURNS TABLE (42804).
    expect(executavel).toMatch(/RETURN QUERY\s+SELECT r\.id, u\.nome::text\s+FROM/);
    // Só leitura.
    expect(executavel).not.toMatch(/\b(INSERT INTO|UPDATE public|DELETE FROM)\b/);
  });

  it('recusa lista com mais de 1000 ids (22023)', () => {
    expect(executavel).toMatch(
      /cardinality\(p_rota_ids\) > 1000[\s\S]*RAISE EXCEPTION 'LISTA_GRANDE: no máximo 1000 rotas por chamada\.' USING ERRCODE = '22023'/,
    );
  });

  it('REVOKE de PUBLIC e anon; EXECUTE para authenticated e service_role', () => {
    expect(executavel).toContain(
      'REVOKE ALL ON FUNCTION public.nomes_motoristas_das_rotas(uuid[]) FROM PUBLIC, anon;',
    );
    expect(executavel).toContain(
      'GRANT EXECUTE ON FUNCTION public.nomes_motoristas_das_rotas(uuid[]) TO authenticated, service_role;',
    );
    expect(executavel).not.toMatch(/GRANT[^;]*\b(anon|PUBLIC)\b/);
  });

  it('rollback: DROP FUNCTION IF EXISTS public.nomes_motoristas_das_rotas(uuid[]);', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    expect(rollback).toContain(
      'DROP FUNCTION IF EXISTS public.nomes_motoristas_das_rotas(uuid[]);',
    );
  });

  it('a sonda cobre os 11 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M72 \(desfeita\)/);
    for (let caso = 1; caso <= 11; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    // Catálogo lido sem abortar quando a função ainda não existe.
    expect(sonda).toMatch(
      /to_regprocedure\('public\.nomes_motoristas_das_rotas\(uuid\[\]\)'\)/,
    );
    expect(sonda).toMatch(/sonda-m72-/);
    // Chamada real como anon, esperando 42501.
    expect(sonda).toMatch(/SET LOCAL ROLE anon;[\s\S]*'42501'/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M72 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 72 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 72: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const i = doc.search(/### .*Migration 72: /);
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
