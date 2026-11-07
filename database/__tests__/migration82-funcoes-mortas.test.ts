// Guarda estática da Migration 82 (dez funções SECURITY DEFINER sem uso
// apagadas com DROP FUNCTION IF EXISTS e a assinatura exata). O efeito se
// prova com a sonda, desfeita pelo RAISE. Esta guarda impede que entre
// CASCADE (apagaria em silêncio o que passasse a depender delas), que a lista
// cresça ou perca uma assinatura, que `get_my_unidade_ids`/
// `usuario_atual_ativo` (os helpers vigentes) sejam apagados junto, que o
// rollback perca um corpo ou a ACL e que as cópias divirjam.
import {
  CAMINHO_DOC,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
  semComentarios,
} from './_helpers/migration';

const ARQUIVO = '20261107101000_apagar_funcoes_mortas.sql';

const m = carregarMigration(ARQUIVO);
const { sql, executavel, rollback } = m;
const sonda = lerSonda('20261107101000_sonda_migration82.sql');

const ASSINATURAS = [
  'public.get_user_role(uuid)',
  'public.get_user_unidade(uuid)',
  'public.get_user_unidades(uuid)',
  'public.get_user_papel_in_unidade(uuid, uuid)',
  'public.user_belongs_to_unidade(uuid, uuid)',
  'public.user_is_gestor_in_any_unidade(uuid)',
  'public.obter_paradas_ordenadas(uuid)',
  'public.rotas_ativas_motorista(uuid)',
  'public.estatisticas_rota(uuid)',
  'public.notify_push_on_insert()',
];

const nomeDe = (a: string): string => a.slice('public.'.length, a.indexOf('('));

describe('Migration 82: apagar dez funções sem uso', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('DROP FUNCTION IF EXISTS com a assinatura exata das dez, e só delas', () => {
    for (const a of ASSINATURAS) {
      expect(executavel).toContain(`DROP FUNCTION IF EXISTS ${a};`);
    }
    const drops = executavel.match(/DROP FUNCTION[^;]*;/g) ?? [];
    expect(drops).toHaveLength(ASSINATURAS.length);
  });

  it('sem CASCADE e sem outro DDL', () => {
    expect(executavel).not.toMatch(/\bCASCADE\b/i);
    expect(executavel).not.toMatch(/\b(CREATE|ALTER)\b/);
    expect(executavel).not.toMatch(/\b(GRANT|REVOKE)\b/);
    expect(executavel).not.toMatch(
      /\bDROP (TABLE|VIEW|POLICY|TRIGGER|SCHEMA)\b/,
    );
  });

  it('não apaga os helpers vigentes nem get_user_unidade() sem argumento', () => {
    expect(executavel).not.toContain('get_my_unidade_ids');
    expect(executavel).not.toContain('usuario_atual_ativo');
    expect(executavel).not.toMatch(/get_user_unidade\(\)/);
  });

  it('rollback colável: corpo, ACL e COMMENT de cada uma', () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/^COMMIT;/m);
    for (const a of ASSINATURAS) {
      expect(rollback).toContain(
        `CREATE OR REPLACE FUNCTION public.${nomeDe(a)}(`,
      );
      expect(rollback).toContain(
        `REVOKE ALL ON FUNCTION ${a} FROM PUBLIC, anon, authenticated;`,
      );
      expect(rollback).toContain(
        `GRANT EXECUTE ON FUNCTION ${a} TO service_role;`,
      );
    }
    expect(rollback.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(
      ASSINATURAS.length,
    );
    expect(rollback.match(/SECURITY DEFINER/g)).toHaveLength(
      ASSINATURAS.length,
    );
    expect(rollback.match(/COMMENT ON FUNCTION/g)).toHaveLength(5);
    expect(rollback).toContain('RETURNS SETOF public.rotas');
  });

  it('a sonda cobre os 3 casos e termina desfeita por RAISE', () => {
    expect(sonda).toMatch(/SONDA M82 \(desfeita\)/);
    for (let caso = 1; caso <= 3; caso += 1) {
      expect(sonda).toContain(`' | ${caso} OK: `);
    }
    for (const a of ASSINATURAS) {
      expect(sonda).toContain(`'${a.replace(/, /g, ',')}'`);
    }
    expect(sonda).toContain("to_regprocedure('public.get_user_unidade()')");
    expect(sonda).toContain("to_regprocedure('public.get_my_unidade_ids()')");
    expect(sonda).toMatch(/SET LOCAL ROLE authenticated/);
    expect(sonda).toMatch(/sonda-m82-/);
    const ultimoRaise = sonda.lastIndexOf('RAISE EXCEPTION');
    expect(sonda.slice(ultimoRaise)).toMatch(
      /^RAISE EXCEPTION 'SONDA M82 \(desfeita\):%', r;\s*END\s*\$\$;\s*$/,
    );
    expect(semComentarios(sonda)).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('MIGRATIONS.md registra a Migration 82 com o arquivo', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### .*Migration 82: /);
    expect(doc).toContain(ARQUIVO);
  });

  it('texto neutro nos arquivos públicos', () => {
    const doc = ler(CAMINHO_DOC);
    const i = doc.search(/### .*Migration 82: /);
    const fim = i < 0 ? -1 : doc.indexOf('\n---', i);
    const entrada = i < 0 ? '' : doc.slice(i, fim < 0 ? undefined : fim);
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
