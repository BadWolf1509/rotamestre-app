// Guarda estática da Migration 65 (bucket fotos-entrega: na pasta da loja, o
// gestor lê pela loja e o motorista lê as fotos das próprias rotas). O
// comportamento se prova com a sonda (`database/sondas/`), que monta o
// cenário como `authenticated`. Esta guarda impede que a policy de SELECT
// volte ao helper por loja (`minhas_unidades_com_acesso`), que a função nova
// perca o `search_path` vazio, a conferência do formato uuid antes do cast ou
// as condições de `paradas_select`, que as policies de INSERT/DELETE sejam
// recriadas junto e que as duas cópias divirjam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261025160000_fotos_entrega_pela_propria_rota.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261025160000_sonda_migration65.sql',
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

/** Trecho de `inicio` até o primeiro `fim` depois dele ('' se não houver). */
const trecho = (texto: string, inicio: string, fim: string) => {
  const i = texto.indexOf(inicio);
  if (i < 0) return '';
  const f = texto.indexOf(fim, i + inicio.length);
  return f < 0 ? '' : texto.slice(i, f + fim.length);
};

const corpoFuncao = trecho(
  executavel,
  'CREATE OR REPLACE FUNCTION public.foto_de_rota_minha',
  '$$;',
);
const policySelect = trecho(
  executavel,
  'CREATE POLICY "fotos-entrega select"',
  ');\n',
);

describe('Migration 65: fotos de entrega pelo gestor da loja e pelo motorista da rota', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('cria foto_de_rota_minha DEFINER com search_path vazio e sem EXECUTE para anon', () => {
    expect(executavel).toMatch(
      /CREATE OR REPLACE FUNCTION public\.foto_de_rota_minha\(p_nome text\)/,
    );
    expect(corpoFuncao).toMatch(/SECURITY DEFINER[\s\S]*SET search_path = ''/);
    expect(corpoFuncao).toMatch(/\bSTABLE\b/);
    expect(executavel).toContain(
      'REVOKE ALL ON FUNCTION public.foto_de_rota_minha(text) FROM PUBLIC, anon;',
    );
    expect(executavel).toContain(
      'GRANT EXECUTE ON FUNCTION public.foto_de_rota_minha(text) TO authenticated, service_role;',
    );
  });

  it('a função confere a rota do motorista com vínculo ativo e cadastro ativo', () => {
    expect(corpoFuncao).not.toBe('');
    expect(corpoFuncao).toMatch(/motorista_id = auth\.uid\(\)/);
    expect(corpoFuncao).toMatch(/uu\.usuario_id = auth\.uid\(\)/);
    expect(corpoFuncao).toMatch(/uu\.ativo = true/);
    expect(corpoFuncao).toMatch(/public\.usuario_atual_ativo\(\)/);
    // a loja do path é a loja da rota
    expect(corpoFuncao).toMatch(/r\.unidade_id = v_partes\[1\]::uuid/);
    // confere o formato uuid antes do cast
    expect(corpoFuncao).toMatch(/~\*? '\^\[0-9a-f\]/);
    const formato = corpoFuncao.search(/!~\*? '\^\[0-9a-f\]/);
    const cast = corpoFuncao.indexOf('::uuid');
    expect(formato).toBeGreaterThan(-1);
    expect(cast).toBeGreaterThan(formato);
    expect(corpoFuncao).toMatch(/LANGUAGE plpgsql/);
  });

  it('a policy de SELECT não usa mais minhas_unidades_com_acesso nem get_my_unidade_ids', () => {
    expect(policySelect).not.toBe('');
    expect(policySelect).not.toMatch(
      /minhas_unidades_com_acesso|get_my_unidade_ids/,
    );
    expect(policySelect).toMatch(/papel::text = 'gestor'/);
    expect(policySelect).toMatch(/public\.foto_de_rota_minha\(name\)/);
    expect(policySelect).toMatch(/'perfis'/);
    expect(policySelect).toMatch(/'incidentes'/);
    expect(policySelect).toMatch(/TO authenticated/);
    expect(policySelect).toMatch(/owner = \(SELECT auth\.uid\(\)\)/);
    expect(executavel).toContain(
      'DROP POLICY IF EXISTS "fotos-entrega select" ON storage.objects;',
    );
  });

  it('não recria as policies de INSERT e DELETE', () => {
    expect(executavel).not.toMatch(/"fotos-entrega (insert|delete)"/);
  });

  it('o helper da loja segue e só o COMMENT diz que agora é do INSERT', () => {
    expect(executavel).not.toMatch(
      /(CREATE OR REPLACE|DROP) FUNCTION[^;]*minhas_unidades_com_acesso/,
    );
    expect(executavel).toMatch(
      /COMMENT ON FUNCTION public\.minhas_unidades_com_acesso\(\) IS[\s\S]*INSERT/,
    );
  });

  it('rollback colável recria a policy viva de 25/10 e apaga a função', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    const select = trecho(
      rollback,
      'CREATE POLICY "fotos-entrega select"',
      ');\n',
    );
    expect(select).toMatch(/minhas_unidades_com_acesso\(\)/);
    expect(select).toMatch(/'perfis'/);
    expect(select).toMatch(/'incidentes'/);
    expect(rollback).toContain(
      'DROP FUNCTION IF EXISTS public.foto_de_rota_minha(text);',
    );
    expect(rollback).toContain(
      "'Lojas com vínculo ativo de quem chama, em que é gestor ou está ativo no cadastro. Usada nas policies do bucket fotos-entrega (Migration 50).'",
    );
    // a policy volta antes de a função sair (a policy nova depende dela)
    expect(
      rollback.indexOf('CREATE POLICY "fotos-entrega select"'),
    ).toBeLessThan(
      rollback.indexOf('DROP FUNCTION IF EXISTS public.foto_de_rota_minha'),
    );
    expect(rollback).toMatch(/^COMMIT;/m);
  });

  it('a sonda cobre os cenários e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M65 \(desfeita\)/);
    // 1 a 14 e o 10b (o gestor lê o próprio avatar)
    const casos = [
      ...Array.from({ length: 14 }, (_, i) => String(i + 1)),
      '10b',
    ];
    expect(casos).toHaveLength(15);
    for (const caso of casos) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    // 10: inalterado — o motorista não lê o avatar do gestor (espera 0)
    expect(sonda).toMatch(
      /name = o_perfil;\s*r := r \|\| CASE WHEN v_n = 0\s*THEN ' \| 10 OK: /,
    );
    // 14: formato do nome, sem erro
    for (const nome of ["'perfis/x.jpg'", "'zzz/yyy/x.jpg'", "'/sub/x.jpg'"]) {
      expect(sonda).toContain(nome);
    }
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M65 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 65 com o arquivo', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .*Migration 65: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(caminhoDoc);
    const entrada = doc.slice(doc.search(/### .*Migration 65: /));
    const publicos = [sql, sonda, entrada].join('\n').toLowerCase();
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
