// Guarda estática da Migration 73 (coluna `paradas.observacao_pulo` e gatilho
// `trg_paradas_observacao_do_gestor`: quem não é gestor ativo da loja da rota
// não muda `observacoes`; o texto do pulo mandado pelo app instalado, que
// ainda grava em `observacoes`, vai para `observacao_pulo`). O comportamento
// se prova com a sonda (`database/sondas/`), que reproduz os corpos de UPDATE
// do app e é desfeita pelo RAISE. Esta guarda impede que o gatilho passe a
// recusar o UPDATE (o pulo do app instalado e da fila offline dele não pode
// virar erro), que o WHEN mude (o gatilho roda em todo UPDATE de parada que
// passar por ele), que a exceção do gestor ativo / sessão nula suma, que a
// função ganhe EXECUTE para PUBLIC, anon ou authenticated, que o rollback
// perca a devolução do texto e que as cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261026123000_observacao_do_pulo.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261026123000_sonda_migration73.sql',
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
    'CREATE OR REPLACE FUNCTION public.paradas_observacao_do_gestor()',
  );
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
})();

describe('Migration 73: observação do pulo em coluna própria', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('acrescenta observacao_pulo text com IF NOT EXISTS e COMMENT', () => {
    expect(executavel).toMatch(
      /ALTER TABLE public\.paradas\s+ADD COLUMN IF NOT EXISTS observacao_pulo text;/,
    );
    expect(executavel).not.toMatch(/observacao_pulo text NOT NULL/);
    expect(executavel).toMatch(
      /COMMENT ON COLUMN public\.paradas\.observacao_pulo IS\s+'[^']*Migration 73/,
    );
    // Herda o UPDATE de tabela de authenticated: nenhum privilégio por coluna.
    expect(executavel).not.toMatch(/(GRANT|REVOKE)[^;]*\(\s*observac/);
  });

  it('função do gatilho: DEFINER, search_path vazio, dono postgres, COMMENT', () => {
    expect(executavel).toMatch(
      /CREATE OR REPLACE FUNCTION public\.paradas_observacao_do_gestor\(\)\s+RETURNS trigger/,
    );
    expect(corpoFuncao).toMatch(/LANGUAGE plpgsql/);
    expect(corpoFuncao).toMatch(/SECURITY DEFINER/);
    expect(corpoFuncao).toMatch(/SET search_path = ''/);
    expect(executavel).toContain(
      'ALTER FUNCTION public.paradas_observacao_do_gestor() OWNER TO postgres;',
    );
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.paradas_observacao_do_gestor\(\) IS\s+'[^']*Migration 73/,
    );
  });

  it('gatilho BEFORE UPDATE com o WHEN de observacoes/pulada', () => {
    expect(executavel).toContain(
      'DROP TRIGGER IF EXISTS trg_paradas_observacao_do_gestor ON public.paradas;',
    );
    expect(executavel).toMatch(
      /CREATE TRIGGER trg_paradas_observacao_do_gestor\s+BEFORE UPDATE ON public\.paradas\s+FOR EACH ROW\s+WHEN \(OLD\.observacoes IS DISTINCT FROM NEW\.observacoes OR \(NEW\.status = 'pulada' AND OLD\.status IS DISTINCT FROM 'pulada'\)\)\s+EXECUTE FUNCTION public\.paradas_observacao_do_gestor\(\);/,
    );
  });

  it('gestor ativo da loja e sessão nula passam sem mudança', () => {
    expect(corpoFuncao).toMatch(/auth\.uid\(\) IS NULL THEN\s+RETURN NEW/);
    expect(corpoFuncao).toMatch(
      /r\.id = OLD\.rota_id[\s\S]*uu\.usuario_id = auth\.uid\(\)[\s\S]*uu\.ativo = true[\s\S]*uu\.papel::text = 'gestor'[\s\S]*RETURN NEW/,
    );
  });

  it('pulo sem a coluna nova (app instalado) leva o texto para observacao_pulo', () => {
    expect(corpoFuncao).toMatch(
      /NEW\.status = 'pulada'\s+AND OLD\.status IS DISTINCT FROM 'pulada'\s+AND NEW\.observacao_pulo IS NOT DISTINCT FROM OLD\.observacao_pulo/,
    );
    expect(corpoFuncao).toMatch(
      /NEW\.observacao_pulo := CASE\s+WHEN NEW\.observacoes IS DISTINCT FROM OLD\.observacoes THEN NEW\.observacoes\s+END;/,
    );
  });

  it('o restante devolve a observação antiga', () => {
    expect(corpoFuncao).toMatch(
      /NEW\.observacoes := OLD\.observacoes;\s+RETURN NEW;/,
    );
  });

  it('não usa RAISE (o pulo do app instalado não pode ser recusado)', () => {
    expect(corpoFuncao).not.toBe('');
    expect(corpoFuncao).not.toMatch(/RAISE/);
  });

  it('função do gatilho sem EXECUTE para PUBLIC, anon e authenticated', () => {
    expect(executavel).toContain(
      'REVOKE ALL ON FUNCTION public.paradas_observacao_do_gestor() FROM PUBLIC, anon, authenticated;',
    );
    expect(executavel).not.toMatch(
      /GRANT[^;]*paradas_observacao_do_gestor[^;]*\b(anon|PUBLIC|authenticated)\b/,
    );
  });

  it('rollback colável: devolve o texto do pulo a observacoes e apaga gatilho, função e coluna', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    expect(rollback).toMatch(
      /UPDATE public\.paradas\s+SET observacoes = observacao_pulo\s+WHERE status = 'pulada' AND observacao_pulo IS NOT NULL/,
    );
    const i = (t: string) => rollback.indexOf(t);
    const update = rollback.search(/UPDATE public\.paradas/);
    const trig = i(
      'DROP TRIGGER IF EXISTS trg_paradas_observacao_do_gestor ON public.paradas;',
    );
    const func = i(
      'DROP FUNCTION IF EXISTS public.paradas_observacao_do_gestor();',
    );
    const col = i(
      'ALTER TABLE public.paradas DROP COLUMN IF EXISTS observacao_pulo;',
    );
    // O UPDATE do rollback roda ANTES do DROP do gatilho; como roda sem
    // sessão (postgres), o gatilho o deixa passar.
    expect(update).toBeGreaterThan(-1);
    expect(trig).toBeGreaterThan(update);
    expect(func).toBeGreaterThan(trig);
    expect(col).toBeGreaterThan(func);
  });

  it('a sonda cobre os 14 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M73 \(desfeita\)/);
    for (let caso = 1; caso <= 14; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    // Corpos de UPDATE do app reproduzidos (filaAcoesParada / useEditStopForm).
    expect(sonda).toMatch(/status IN \('pendente', 'em_andamento'\)/);
    expect(sonda).toMatch(/observacoes = 'Ficou para amanhã'/);
    expect(sonda).toMatch(/observacao_pulo = 'Portão fechado'/);
    for (const rpc of [
      'reordenar_paradas',
      'inserir_parada',
      'cancelar_rota',
      'reativar_rota',
      'finalizar_rota',
    ]) {
      expect(sonda).toContain(`public.${rpc}(`);
    }
    expect(sonda).toMatch(
      /to_regprocedure\('public\.paradas_observacao_do_gestor\(\)'\)/,
    );
    expect(sonda).toMatch(/sonda-m73-/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M73 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 73 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 73: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const i = doc.search(/### .*Migration 73: /);
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
