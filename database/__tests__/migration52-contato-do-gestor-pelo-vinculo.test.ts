// Guarda estática da Migration 52 (contato do gestor segue o vínculo ativo).
// O banco único é produção e não há pgTAP: o comportamento se prova com a
// sonda transacional (`database/sondas/`). Esta guarda impede que uma edição
// volte a escolher a loja ou o gestor pelas colunas de `usuarios`, deixe de
// conferir o cadastro ativo de quem chama, mude a assinatura ou o formato do
// retorno (o app já instalado depende dele), ou deixe as duas cópias
// (database/ e supabase/) divergirem.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261024140000_contato_do_gestor_pelo_vinculo_ativo.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024140000_sonda_migration52.sql',
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
// Só o que roda: o bloco ROLLBACK e o roteiro de conferência são comentados.
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
    'CREATE OR REPLACE FUNCTION public.get_gestor_contato()',
  );
  if (inicio < 0) return '';
  const abre = executavel.indexOf('$$', inicio);
  const fecha = executavel.indexOf('$$', abre + 2);
  return executavel.slice(inicio, fecha + 2);
})();

describe('Migration 52: contato do gestor segue o vínculo ativo', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só e não derruba a função (mantém assinatura e grants)', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
    expect(executavel).not.toMatch(/DROP\s+FUNCTION/i);
  });

  it('assinatura e formato do retorno iguais aos do app já instalado', () => {
    expect(corpo).not.toBe('');
    expect(corpo).toMatch(
      /RETURNS TABLE\(nome text, telefone text, email text\)/,
    );
    expect(corpo).toMatch(/SELECT\s+u\.nome::text,\s*u\.telefone::text,\s*u\.email::text/);
  });

  it('SECURITY DEFINER com search_path vazio e nomes qualificados', () => {
    expect(corpo).toMatch(/SECURITY DEFINER/);
    expect(corpo).toMatch(/SET search_path = ''/);
    // toda tabela lida vem com o schema
    const tabelas = [...corpo.matchAll(/\b(?:FROM|JOIN)\s+([a-z_."]+)/gi)].map(
      (m) => m[1],
    );
    expect(tabelas.length).toBeGreaterThan(0);
    for (const t of tabelas) {
      expect(t).toMatch(/^public\./);
    }
  });

  it('quem chama precisa estar ativo no cadastro (mesmo critério da Migration 49)', () => {
    expect(corpo).toMatch(/IF NOT public\.usuario_atual_ativo\(\) THEN\s+RETURN;/);
  });

  it('a loja sai de vínculo ativo de quem chama, nunca da coluna usuarios.unidade_id', () => {
    // a rota só conta em loja onde quem chama tem vínculo ativo
    expect(corpo).toMatch(
      /uu\.usuario_id = v_usuario_id\s+AND uu\.unidade_id = r\.unidade_id\s+AND uu\.ativo = true/,
    );
    // o fallback antigo pela coluna de usuarios não volta
    expect(corpo).not.toMatch(/SELECT u\.unidade_id\s+FROM public\.usuarios/);
    expect(corpo).not.toMatch(/WHERE u\.unidade_id = v_unidade_id/);
    // regra determinística: rota aberta (em andamento antes de pendente),
    // depois a rota mais recente, depois o vínculo
    expect(corpo).toMatch(/r\.status IN \('em_andamento', 'pendente'\)/);
    expect(corpo).toMatch(/ORDER BY \(r\.status = 'em_andamento'\) DESC, r\.data ASC, r\.created_at ASC, r\.id ASC/);
    expect(corpo).toMatch(/ORDER BY r\.created_at DESC, r\.id DESC/);
    expect(corpo).toMatch(
      /ORDER BY uu\.is_principal DESC NULLS LAST, uu\.created_at ASC NULLS LAST, uu\.unidade_id ASC/,
    );
  });

  it('o gestor devolvido é ativo, com vínculo ativo de gestor naquela loja', () => {
    expect(corpo).toMatch(
      /FROM public\.usuario_unidades uu\s+JOIN public\.usuarios u ON u\.id = uu\.usuario_id\s+WHERE uu\.unidade_id = v_unidade_id\s+AND uu\.ativo = true\s+AND uu\.papel::text = 'gestor'\s+AND u\.ativo = true/,
    );
    expect(corpo).toMatch(/LIMIT 1;\s*END;/);
  });

  it('EXECUTE só para authenticated e service_role', () => {
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_gestor_contato\(\) FROM PUBLIC, anon;/,
    );
    expect(executavel).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_gestor_contato\(\) TO authenticated, service_role;/,
    );
  });

  it('ROLLBACK traz o corpo anterior inteiro, colável, e os grants', () => {
    expect(rollback).toMatch(/BEGIN;/);
    expect(rollback).toMatch(/CREATE OR REPLACE FUNCTION public\.get_gestor_contato\(\)/);
    expect(rollback).toMatch(/SET search_path TO 'public'/);
    expect(rollback).toMatch(/ORDER BY uu\.created_at DESC/);
    expect(rollback).toMatch(/u\.is_gestor_principal DESC NULLS LAST/);
    expect(rollback).toMatch(/RETURN QUERY/);
    expect(rollback).toMatch(/\$function\$;/);
    expect(rollback).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_gestor_contato\(\) TO authenticated, service_role;/,
    );
    expect(rollback).toMatch(/COMMIT;/);
  });

  it('sonda transacional existe, não apaga nada e termina em RAISE', () => {
    const sonda = ler(caminhoSonda);
    expect(sonda).not.toBe('');
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\b/i);
    expect(sonda).toMatch(/RAISE EXCEPTION 'SONDA M52 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/);
  });

  it('MIGRATIONS.md registra a Migration 52 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 52: /);
    expect(doc).toContain(ARQUIVO);
  });
});
