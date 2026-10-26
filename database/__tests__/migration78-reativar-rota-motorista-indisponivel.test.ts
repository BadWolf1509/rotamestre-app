// Guarda estática da Migration 78 (`reativar_rota` devolve
// `motorista_indisponivel` quando o motorista da rota não tem mais vínculo
// ativo de motorista na loja da rota ou está desativado — a mesma regra de
// `criar_rota_com_paradas`). O comportamento se prova com a sonda, desfeita
// pelo RAISE. Esta guarda impede que a conferência saia de depois da trava e
// do `situacao_mudou`, que o EXISTS perca alguma das quatro condições, que a
// rota sem motorista passe a ser recusada, que a ACL da função mude e que as
// cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261027102000_reativar_rota_motorista_indisponivel.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261027102000_sonda_migration78.sql',
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
const corpoFuncao = (() => {
  const i = executavel.indexOf(
    'CREATE OR REPLACE FUNCTION public.reativar_rota(p_rota_id uuid)',
  );
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
})();

describe('Migration 78: reativar_rota confere o motorista', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('mesma assinatura, DEFINER, search_path vazio, ACL de antes', () => {
    expect(corpoFuncao).toMatch(/RETURNS text/);
    expect(corpoFuncao).toMatch(/SECURITY DEFINER/);
    expect(corpoFuncao).toMatch(/SET search_path = ''/);
    expect(executavel).toContain(
      'ALTER FUNCTION public.reativar_rota(uuid) OWNER TO postgres;',
    );
    expect(executavel).toContain(
      'REVOKE ALL ON FUNCTION public.reativar_rota(uuid) FROM PUBLIC, anon;',
    );
    expect(executavel).toContain(
      'GRANT EXECUTE ON FUNCTION public.reativar_rota(uuid) TO authenticated, service_role;',
    );
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.reativar_rota\(uuid\) IS\s+'[^']*Migration 78/,
    );
  });

  it('conjunto fechado de resultados, agora com motorista_indisponivel', () => {
    const retornos = [...corpoFuncao.matchAll(/RETURN '(\w+)'/g)].map(
      (m) => m[1],
    );
    expect(new Set(retornos)).toEqual(
      new Set([
        'sem_permissao',
        'situacao_mudou',
        'motorista_indisponivel',
        'reativada',
      ]),
    );
  });

  it('confere o motorista depois da trava e do situacao_mudou, antes de mexer', () => {
    const trava = corpoFuncao.indexOf('FOR NO KEY UPDATE');
    const situacao = corpoFuncao.indexOf("RETURN 'situacao_mudou'");
    const motorista = corpoFuncao.indexOf("RETURN 'motorista_indisponivel'");
    const update = corpoFuncao.indexOf('UPDATE public.rotas');
    expect(trava).toBeGreaterThan(-1);
    expect(situacao).toBeGreaterThan(trava);
    expect(motorista).toBeGreaterThan(situacao);
    expect(update).toBeGreaterThan(motorista);
  });

  it('a regra é a de criar_rota_com_paradas, e rota sem motorista passa', () => {
    expect(corpoFuncao).toMatch(/v_motorista_id IS NOT NULL AND NOT EXISTS \(/);
    for (const condicao of [
      /uu\.usuario_id = v_motorista_id/,
      /uu\.unidade_id = v_unidade_id/,
      /uu\.papel::text = 'motorista'/,
      /uu\.ativo = true/,
      /u\.ativo = true/,
    ]) {
      expect(corpoFuncao).toMatch(condicao);
    }
  });

  it('rollback colável: volta o corpo da Migration 71', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    expect(rollback).toContain(
      'CREATE OR REPLACE FUNCTION public.reativar_rota(p_rota_id uuid)',
    );
    expect(rollback).not.toContain('motorista_indisponivel');
  });

  it('a sonda cobre os 7 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M78 \(desfeita\)/);
    for (let caso = 1; caso <= 7; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    expect(sonda).toContain('public.reativar_rota(');
    expect(sonda).toMatch(/sonda-m78-/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M78 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 78 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 78: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const i = doc.search(/### .*Migration 78: /);
    const fim = i < 0 ? -1 : doc.indexOf('\n---', i);
    const entrada = i < 0 ? '' : doc.slice(i, fim < 0 ? undefined : fim);
    const publicos = [sql, sonda, entrada].join('\n').toLowerCase();
    for (const termo of [
      'vaza',
      'ataque',
      'brecha',
      'explor',
      'vulnerab',
      'falha',
    ]) {
      expect(publicos).not.toContain(termo);
    }
  });
});
