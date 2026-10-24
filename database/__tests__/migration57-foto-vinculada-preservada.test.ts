// Guarda estática da Migration 57 (foto de comprovante vinculada não é
// desfeita pelo motorista). O banco único é produção e não há pgTAP: o
// comportamento se prova com a sonda transacional (`database/sondas/`). Esta
// guarda impede que uma edição tire a isenção do gestor ou de quem não tem
// sessão, deixe a ligação tardia NULL → valor de fora, solte a regra da parada
// finalizada, exponha as funções de gatilho ou deixe as duas cópias divergirem.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261024190000_foto_comprovante_vinculada_preservada.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024190000_sonda_migration57.sql',
);
const caminhoDoc = join(raiz, 'database', 'MIGRATIONS.md');

// CRLF fora: com `core.autocrlf=true` (Windows) o checkout troca as quebras.
const ler = (p: string) =>
  existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '';
const sql = ler(caminhoDb);
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

function corpoDaFuncao(nome: string): string {
  const inicio = executavel.indexOf(
    `CREATE OR REPLACE FUNCTION public.${nome}()`,
  );
  if (inicio < 0) return '';
  const abre = executavel.indexOf('$$', inicio);
  const fecha = executavel.indexOf('$$', abre + 2);
  return executavel.slice(inicio, fecha + 2);
}

function gatilho(nome: string): string {
  const inicio = executavel.indexOf(`CREATE TRIGGER ${nome}`);
  if (inicio < 0) return '';
  return executavel.slice(inicio, executavel.indexOf(';', inicio) + 1);
}

const CABECALHO_DEFINER =
  /RETURNS trigger\s+LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = ''/;
const ISENCAO_GESTOR =
  /uu\.usuario_id = auth\.uid\(\)\s+AND uu\.ativo = true\s+AND uu\.papel::text = 'gestor'/;

describe('Migration 57: foto de comprovante vinculada', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('paradas: DEFINER, sem sessão passa, gestor ativo da loja da rota passa', () => {
    const corpo = corpoDaFuncao('paradas_foto_vinculada_preservada');
    expect(corpo).toMatch(CABECALHO_DEFINER);
    expect(corpo).toMatch(/IF auth\.uid\(\) IS NULL THEN\s+RETURN NEW;/);
    expect(corpo).toMatch(
      /FROM public\.rotas r\s+JOIN public\.usuario_unidades uu ON uu\.unidade_id = r\.unidade_id\s+WHERE r\.id = OLD\.rota_id/,
    );
    expect(corpo).toMatch(ISENCAO_GESTOR);
  });

  it('paradas: foto não volta a NULL; na finalizada, não troca nem reabre', () => {
    const corpo = corpoDaFuncao('paradas_foto_vinculada_preservada');
    expect(corpo).toMatch(
      /\(OLD\.foto_url IS NOT NULL AND NEW\.foto_url IS NULL\)\s+OR \(OLD\.foto_comprovante IS NOT NULL AND NEW\.foto_comprovante IS NULL\)/,
    );
    expect(corpo).toMatch(
      /v_finalizada boolean := OLD\.status::text IN \('concluida', 'pulada'\)/,
    );
    expect(corpo).toMatch(
      /OLD\.foto_url IS NOT NULL AND NEW\.foto_url IS DISTINCT FROM OLD\.foto_url/,
    );
    expect(corpo).toMatch(
      /OLD\.foto_comprovante IS NOT NULL AND NEW\.foto_comprovante IS DISTINCT FROM OLD\.foto_comprovante/,
    );
    expect(corpo).toMatch(
      /v_tinha_foto AND NEW\.status::text NOT IN \('concluida', 'pulada'\)/,
    );
    // a ligação tardia (NULL → valor) não é recusada: nenhuma regra olha
    // OLD.foto_url IS NULL
    expect(corpo).not.toMatch(/OLD\.foto_url IS NULL/);
    expect(corpo.match(/RAISE EXCEPTION 'FOTO_VINCULADA:/g)).toHaveLength(2);
  });

  it('paradas: gatilho BEFORE UPDATE OF nas colunas de foto e status, com WHEN', () => {
    const g = gatilho('trg_paradas_foto_vinculada_preservada');
    expect(g).toMatch(
      /BEFORE UPDATE OF foto_url, foto_comprovante, status ON public\.paradas\s+FOR EACH ROW\s+WHEN/,
    );
    expect(g).toMatch(/OLD\.foto_url IS DISTINCT FROM NEW\.foto_url/);
    expect(g).toMatch(
      /OLD\.foto_comprovante IS DISTINCT FROM NEW\.foto_comprovante/,
    );
    expect(g).toMatch(
      /OLD\.status IS DISTINCT FROM NEW\.status\s+AND OLD\.status::text IN \('concluida', 'pulada'\)/,
    );
    expect(g).toMatch(
      /EXECUTE FUNCTION public\.paradas_foto_vinculada_preservada\(\);/,
    );
    expect(executavel).toMatch(
      /DROP TRIGGER IF EXISTS trg_paradas_foto_vinculada_preservada ON public\.paradas;/,
    );
  });

  it('incidentes: só NULL → valor para quem não é gestor ativo da loja', () => {
    const corpo = corpoDaFuncao('incidentes_foto_vinculada_preservada');
    expect(corpo).toMatch(CABECALHO_DEFINER);
    expect(corpo).toMatch(
      /IF auth\.uid\(\) IS NULL OR OLD\.foto_url IS NULL THEN\s+RETURN NEW;/,
    );
    expect(corpo).toMatch(/WHERE uu\.unidade_id = OLD\.unidade_id/);
    expect(corpo).toMatch(ISENCAO_GESTOR);
    expect(corpo).toMatch(/RAISE EXCEPTION 'FOTO_VINCULADA:/);
    const g = gatilho('trg_incidentes_foto_vinculada_preservada');
    expect(g).toMatch(
      /BEFORE UPDATE OF foto_url ON public\.incidentes\s+FOR EACH ROW\s+WHEN \(OLD\.foto_url IS DISTINCT FROM NEW\.foto_url\)/,
    );
  });

  it('funções de gatilho sem EXECUTE para PUBLIC, anon e authenticated', () => {
    for (const f of [
      'paradas_foto_vinculada_preservada',
      'incidentes_foto_vinculada_preservada',
    ]) {
      expect(executavel).toContain(
        `REVOKE ALL ON FUNCTION public.${f}() FROM PUBLIC, anon, authenticated;`,
      );
    }
    expect(executavel).not.toMatch(/GRANT EXECUTE/);
  });

  it('não mexe em policy nem em tabela', () => {
    expect(executavel).not.toMatch(/POLICY/);
    expect(executavel).not.toMatch(/ALTER TABLE/);
  });

  it('ROLLBACK colável: gatilhos e funções', () => {
    expect(rollback).toMatch(/BEGIN;[\s\S]*COMMIT;/);
    expect(rollback).toContain(
      'DROP TRIGGER IF EXISTS trg_paradas_foto_vinculada_preservada ON public.paradas;',
    );
    expect(rollback).toContain(
      'DROP TRIGGER IF EXISTS trg_incidentes_foto_vinculada_preservada ON public.incidentes;',
    );
    expect(rollback).toContain(
      'DROP FUNCTION IF EXISTS public.paradas_foto_vinculada_preservada();',
    );
    expect(rollback).toContain(
      'DROP FUNCTION IF EXISTS public.incidentes_foto_vinculada_preservada();',
    );
  });

  it('sonda existe, cobre os casos e termina em RAISE EXCEPTION', () => {
    const sonda = ler(caminhoSonda);
    expect(sonda).not.toBe('');
    expect(sonda).toMatch(/SET LOCAL ROLE authenticated/);
    for (const caso of [
      '1a OK',
      '1c OK',
      '1d OK',
      '1f OK',
      '1g OK',
      '2a OK',
      '2d OK',
      '3a OK',
      '3b OK',
      '4a OK',
      '4b OK',
      '5 OK',
      '6b OK',
    ]) {
      expect(sonda).toContain(caso);
    }
    // a ligação tardia na mesma forma do app
    expect(sonda).toMatch(/WHERE id = v_ps AND foto_url IS NULL/);
    expect(sonda.trimEnd()).toMatch(
      /RAISE EXCEPTION 'SONDA M57 \(desfeita\):%', r;\s*END\s*\$\$;$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bCOMMIT\b/);
  });

  it('o app liga a foto da fila só com foto_url nula (a regra conta com isso)', () => {
    const storage = ler(join(raiz, 'src', 'lib', 'storage.ts'));
    expect(storage).toMatch(
      /\.update\(\{ foto_url: path \}\)\s+\.eq\('id', paradaId\)\s+\.is\('foto_url', null\)/,
    );
  });

  it('MIGRATIONS.md registra a Migration 57 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/Migration 57/);
    expect(doc).toContain(ARQUIVO);
  });
});
