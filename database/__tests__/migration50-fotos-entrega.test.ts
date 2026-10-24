// Guarda estática da Migration 50 (bucket `fotos-entrega`: comprovante
// vinculado é preservado; o acesso por loja segue o cadastro ativo). O banco
// único é produção e não há pgTAP: o comportamento se prova com a sonda
// transacional (`database/sondas/`). Esta guarda impede que uma edição devolva
// o DELETE só pelo dono, volte a abrir o ramo por loja sem conferir o cadastro,
// mexa nos ramos de perfil e incidente, crie UPDATE no bucket, ou deixe as duas
// cópias (database/ e supabase/) divergirem.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261024121500_fotos_entrega_comprovante_preservado.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024121500_sonda_migration50.sql',
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
// O bloco ROLLBACK, sem o prefixo de comentário.
const rollback = (() => {
  const i = sql.indexOf('-- ROLLBACK:');
  if (i < 0) return '';
  return sql
    .slice(i)
    .split('\n')
    .map((l) => l.replace(/^-- ?/, ''))
    .join('\n');
})();

function corpoDaFuncao(assinatura: string): string {
  const inicio = executavel.indexOf(
    `CREATE OR REPLACE FUNCTION public.${assinatura}`,
  );
  if (inicio < 0) return '';
  const abre = executavel.indexOf('$$', inicio);
  const fecha = executavel.indexOf('$$', abre + 2);
  return executavel.slice(inicio, fecha + 2);
}

// Texto da policy, do CREATE até o `;` que fecha a instrução.
function policy(texto: string, nome: string): string {
  const inicio = texto.indexOf(`CREATE POLICY "${nome}" ON storage.objects`);
  if (inicio < 0) return '';
  return texto.slice(inicio, texto.indexOf(';', inicio) + 1);
}

const DONO =
  /\(owner = \(SELECT auth\.uid\(\)\) OR owner_id = \(SELECT auth\.uid\(\)\)::text\)/;
const RAMO_LOJA =
  /\(storage\.foldername\(name\)\)\[1\] IN \(\s*SELECT f\.unidade_id::text\s+FROM public\.minhas_unidades_com_acesso\(\) AS f\(unidade_id\)\s*\)/;

describe('Migration 50: fotos-entrega — comprovante vinculado e cadastro ativo', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('helper minhas_unidades_com_acesso: DEFINER, search_path vazio, vínculo ativo e (gestor ou pessoa ativa)', () => {
    const corpo = corpoDaFuncao('minhas_unidades_com_acesso()');
    expect(corpo).toMatch(
      /RETURNS SETOF uuid\s+LANGUAGE sql\s+STABLE\s+SECURITY DEFINER\s+SET search_path = ''/,
    );
    expect(corpo).toMatch(/FROM public\.usuario_unidades uu/);
    expect(corpo).toMatch(/uu\.usuario_id = auth\.uid\(\)/);
    expect(corpo).toMatch(/uu\.ativo = true/);
    expect(corpo).toMatch(
      /\(\s*uu\.papel::text = 'gestor'\s+OR public\.usuario_atual_ativo\(\)\s*\)/,
    );
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.minhas_unidades_com_acesso\(\) FROM PUBLIC, anon;/,
    );
    expect(executavel).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.minhas_unidades_com_acesso\(\) TO authenticated, service_role;/,
    );
  });

  it('helper pode_apagar_foto_entrega: só objeto do próprio dono, sem vínculo em parada ou incidente', () => {
    const corpo = corpoDaFuncao('pode_apagar_foto_entrega(p_nome text)');
    expect(corpo).toMatch(
      /RETURNS boolean\s+LANGUAGE sql\s+STABLE\s+SECURITY DEFINER\s+SET search_path = ''/,
    );
    // o próprio objeto, do próprio dono (sem isso, a função responderia sobre
    // caminhos de terceiros)
    expect(corpo).toMatch(/FROM storage\.objects o/);
    expect(corpo).toMatch(/o\.bucket_id = 'fotos-entrega'/);
    expect(corpo).toMatch(/o\.name = p_nome/);
    expect(corpo).toMatch(
      /o\.owner = auth\.uid\(\) OR o\.owner_id = auth\.uid\(\)::text/,
    );
    // nenhuma parada (foto_url e foto_comprovante, path ou URL legada)
    expect(corpo).toMatch(/NOT EXISTS \(\s*SELECT 1\s+FROM public\.paradas p/);
    for (const col of ['p.foto_url', 'p.foto_comprovante', 'i.foto_url']) {
      const c = col.replace('.', '\\.');
      expect(corpo).toMatch(new RegExp(`${c} = p_nome`));
      expect(corpo).toMatch(
        new RegExp(
          `right\\(${c}, length\\(p_nome\\) \\+ 1\\) = '/' \\|\\| p_nome`,
        ),
      );
    }
    expect(corpo).toMatch(/NOT EXISTS \(\s*SELECT 1\s+FROM public\.incidentes i/);
    // o caminho registrado pela fila offline (`subirFotoDaFilaOffline`)
    expect(corpo).toMatch(
      /NOT EXISTS \(\s*SELECT 1\s+FROM public\.logs l\s+WHERE l\.evento = 'foto_comprovante_sem_vinculo'\s+AND l\.detalhes->>'foto_path' = p_nome\s*\)/,
    );
    // a foto de perfil fica fora de propósito: a troca de avatar apaga a atual
    expect(corpo).not.toMatch(/public\.usuarios/);
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.pode_apagar_foto_entrega\(text\) FROM PUBLIC, anon;/,
    );
    expect(executavel).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.pode_apagar_foto_entrega\(text\) TO authenticated, service_role;/,
    );
  });

  it('os helpers existem antes das policies que os chamam', () => {
    const primeiraPolicy = executavel.indexOf('CREATE POLICY');
    expect(primeiraPolicy).toBeGreaterThan(0);
    for (const f of [
      'minhas_unidades_com_acesso()',
      'pode_apagar_foto_entrega(p_nome text)',
    ]) {
      const pos = executavel.indexOf(`CREATE OR REPLACE FUNCTION public.${f}`);
      expect(pos).toBeGreaterThan(0);
      expect(pos).toBeLessThan(primeiraPolicy);
    }
  });

  it('conferência pós-aplicação lê o dono dos helpers', () => {
    expect(sql).toMatch(/pg_get_userbyid\(proowner\)/);
  });

  it('DELETE: dono e pode_apagar_foto_entrega(name), só authenticated', () => {
    const p = policy(executavel, 'fotos-entrega delete');
    expect(p).toMatch(/FOR DELETE TO authenticated/);
    expect(p).toMatch(/bucket_id = 'fotos-entrega'/);
    expect(p).toMatch(DONO);
    expect(p).toMatch(/AND public\.pode_apagar_foto_entrega\(name\)/);
    expect(executavel).toMatch(
      /DROP POLICY IF EXISTS "fotos-entrega delete" ON storage\.objects;/,
    );
  });

  it('SELECT: ramo por loja pelo helper novo; dono, perfil e incidente intactos', () => {
    const p = policy(executavel, 'fotos-entrega select');
    expect(p).toMatch(/FOR SELECT TO authenticated/);
    expect(p).toMatch(RAMO_LOJA);
    expect(p).not.toMatch(/get_my_unidade_ids/);
    expect(p).toMatch(/owner = \(SELECT auth\.uid\(\)\)\s+OR owner_id = \(SELECT auth\.uid\(\)\)::text/);
    expect(p).toMatch(
      /\(storage\.foldername\(name\)\)\[1\] = 'perfis'\s+AND EXISTS \(\s*SELECT 1\s+FROM public\.usuarios u/,
    );
    expect(p).toMatch(
      /AND \(u\.id = objects\.owner OR u\.id::text = objects\.owner_id\)/,
    );
    expect(p).toMatch(
      /\(storage\.foldername\(name\)\)\[1\] = 'incidentes'\s+AND EXISTS \(\s*SELECT 1\s+FROM public\.incidentes i/,
    );
    expect(p).toMatch(
      /AND \(i\.motorista_id = objects\.owner OR i\.motorista_id::text = objects\.owner_id\)/,
    );
  });

  it('INSERT: dono, e perfis/incidentes ou loja pelo helper novo', () => {
    const p = policy(executavel, 'fotos-entrega insert');
    expect(p).toMatch(/FOR INSERT TO authenticated/);
    expect(p).toMatch(DONO);
    expect(p).toMatch(
      /\(storage\.foldername\(name\)\)\[1\] IN \('perfis', 'incidentes'\)/,
    );
    expect(p).toMatch(RAMO_LOJA);
    expect(p).not.toMatch(/get_my_unidade_ids/);
  });

  it('não cria UPDATE no bucket nem mexe em outras tabelas', () => {
    expect(executavel).not.toMatch(/FOR UPDATE/);
    expect(executavel).not.toMatch(/FOR ALL/);
    expect(executavel).not.toMatch(/ON public\.\w+\s+(FOR|TO|USING)/);
    expect(executavel).not.toMatch(/ALTER TABLE/);
  });

  it('ROLLBACK colável: as três policies vivas e o DROP dos dois helpers', () => {
    expect(rollback).not.toBe('');
    for (const nome of [
      'fotos-entrega select',
      'fotos-entrega insert',
      'fotos-entrega delete',
    ]) {
      expect(rollback).toContain(
        `DROP POLICY IF EXISTS "${nome}" ON storage.objects;`,
      );
      expect(policy(rollback, nome)).not.toBe('');
    }
    expect(policy(rollback, 'fotos-entrega select')).toMatch(
      /get_my_unidade_ids\(\)/,
    );
    expect(policy(rollback, 'fotos-entrega insert')).toMatch(
      /get_my_unidade_ids\(\)/,
    );
    expect(policy(rollback, 'fotos-entrega delete')).not.toMatch(
      /pode_apagar_foto_entrega/,
    );
    // os helpers saem depois das policies que os usam
    const posPolicies = rollback.lastIndexOf('CREATE POLICY');
    expect(
      rollback.indexOf('DROP FUNCTION IF EXISTS public.pode_apagar_foto_entrega(text);'),
    ).toBeGreaterThan(posPolicies);
    expect(
      rollback.indexOf('DROP FUNCTION IF EXISTS public.minhas_unidades_com_acesso();'),
    ).toBeGreaterThan(posPolicies);
    expect(rollback).toMatch(/BEGIN;[\s\S]*COMMIT;/);
  });

  it('sonda existe, cobre os casos e termina em RAISE EXCEPTION', () => {
    const sonda = ler(caminhoSonda);
    expect(sonda).not.toBe('');
    expect(sonda).toMatch(/storage\.allow_delete_query/);
    expect(sonda).toMatch(/SET LOCAL ROLE authenticated/);
    expect(sonda).toMatch(/DELETE FROM storage\.objects/);
    // o dono que não enxerga a parada (motivo do SECURITY DEFINER) e o
    // registro da fila offline em logs
    expect(sonda).toMatch(/foto_comprovante_sem_vinculo/);
    expect(sonda).toMatch(/1g OK/);
    expect(sonda).toMatch(/1h OK/);
    // a referência sai pela correção do gestor, não pelo dono
    expect(sonda).toMatch(/4a OK: o gestor de A corrige a foto da parada/);
    expect(sonda).toMatch(/4b OK/);
    // erro inesperado nunca vira aprovação no caso do anon
    expect(sonda).not.toMatch(/11b OK: anon recusado \(' \|\| SQLERRM/);
    expect(sonda.trimEnd()).toMatch(
      /RAISE EXCEPTION 'SONDA M50 \(desfeita\):%', r;\s*END\s*\$\$;$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bCOMMIT\b/);
  });

  it('MIGRATIONS.md registra a Migration 50 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/Migration 50/);
    expect(doc).toContain(ARQUIVO);
  });
});
