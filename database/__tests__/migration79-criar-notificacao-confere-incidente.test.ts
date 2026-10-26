// Guarda estática da Migration 79 (`criar_notificacao`: o INSERT que não grava
// deixa um WARNING no log do Postgres em vez de sumir calado, e a chamada
// direta confere que o incidente informado é de uma loja onde quem chama é
// gestor ativo). O comportamento se prova com a sonda, desfeita pelo RAISE.
// Esta guarda impede que o RETURN NULL do INSERT perca o WARNING (os gatilhos
// dependem do NULL para não derrubar a escrita principal), que a conferência
// do incidente passe a valer no caminho dos gatilhos, que a ACL mude e que as
// cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261027103000_criar_notificacao_confere_incidente.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261027103000_sonda_migration79.sql',
);
const caminhoDoc = join(raiz, 'database', 'MIGRATIONS.md');
const ASSINATURA =
  'public.criar_notificacao(uuid, character varying, character varying, text, uuid, uuid, uuid)';

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
    'CREATE OR REPLACE FUNCTION public.criar_notificacao(',
  );
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
})();

describe('Migration 79: criar_notificacao avisa quando não grava e confere o incidente', () => {
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
    expect(corpoFuncao).toMatch(/p_incidente_id uuid DEFAULT NULL::uuid\s*\)/);
    expect(corpoFuncao).toMatch(/RETURNS uuid/);
    expect(corpoFuncao).toMatch(/SECURITY DEFINER/);
    expect(corpoFuncao).toMatch(/SET search_path = ''/);
    expect(executavel).toContain(
      `ALTER FUNCTION ${ASSINATURA} OWNER TO postgres;`,
    );
    expect(executavel).toContain(
      `REVOKE ALL ON FUNCTION ${ASSINATURA} FROM PUBLIC, anon;`,
    );
    expect(executavel).toContain(
      `GRANT EXECUTE ON FUNCTION ${ASSINATURA} TO authenticated, service_role;`,
    );
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.criar_notificacao\([^)]*\) IS\s+'[^']*Migration 79/,
    );
  });

  it('INSERT que não grava: WARNING com o motivo, e segue devolvendo NULL', () => {
    expect(corpoFuncao).toMatch(
      /EXCEPTION WHEN OTHERS THEN\s+RAISE WARNING 'criar_notificacao não gravou[^']*'[^;]*SQLSTATE[^;]*SQLERRM;\s+RETURN NULL;/,
    );
  });

  it('chamada direta confere o incidente pela loja de quem chama', () => {
    const ramoDireto = corpoFuncao.indexOf(
      'IF pg_trigger_depth() = 0 AND v_chamador IS NOT NULL THEN',
    );
    const incidente = corpoFuncao.indexOf(
      'IF p_incidente_id IS NOT NULL AND NOT EXISTS (',
    );
    const insert = corpoFuncao.indexOf('INSERT INTO public.notificacoes');
    expect(ramoDireto).toBeGreaterThan(-1);
    expect(incidente).toBeGreaterThan(ramoDireto);
    expect(insert).toBeGreaterThan(incidente);
    const trecho = corpoFuncao.slice(incidente, insert);
    expect(trecho).toMatch(/FROM public\.incidentes i/);
    expect(trecho).toMatch(/c\.unidade_id = i\.unidade_id/);
    expect(trecho).toMatch(/c\.usuario_id = v_chamador/);
    expect(trecho).toMatch(/c\.papel = 'gestor'/);
    expect(trecho).toMatch(/WHERE i\.id = p_incidente_id/);
    expect(trecho).toMatch(
      /RAISE EXCEPTION 'Incidente não pertence a uma loja do gestor\.'\s+USING ERRCODE = 'insufficient_privilege'/,
    );
  });

  it('mantém as três conferências que já existiam', () => {
    for (const msg of [
      'Sem permissão para notificar este usuário.',
      'Sem permissão para notificar sobre esta rota.',
      'Parada não pertence à rota informada.',
    ]) {
      expect(corpoFuncao).toContain(msg);
    }
  });

  it('rollback colável: volta o corpo da Migration 32 sem o WARNING', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    expect(rollback).toContain(
      'CREATE OR REPLACE FUNCTION public.criar_notificacao(',
    );
    expect(rollback).not.toContain('RAISE WARNING');
    expect(rollback).not.toContain('p_incidente_id IS NOT NULL AND NOT EXISTS');
  });

  it('a sonda cobre os 6 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M79 \(desfeita\)/);
    for (let caso = 1; caso <= 6; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    expect(sonda).toContain('public.criar_notificacao(');
    expect(sonda).toMatch(/sonda-m79-/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M79 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 79 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 79: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const i = doc.search(/### .*Migration 79: /);
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
