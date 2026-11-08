// Guarda estática (B8-6): RPC chamada por uma Edge Function não some do banco
// sem a função mudar junto.
//
// As Edge Functions (`supabase/functions/**`) chamam RPCs que o app em `src/`
// não chama. Uma varredura de funções mortas que olhe só `src/` as apagaria,
// e o efeito seria calado: a cota do Places (`consumir_cota_places`) é
// fail-open e, sem a RPC, a busca segue sem teto com só um `console.error`;
// as limpezas da `expire-routes` também só vão para o log.
//
// Regra: para cada nome em `rpc('nome'` (com ou sem `.` antes, porque a cota
// recebe o `rpc` injetado) fora dos testes das funções, a última migration em
// `database/migrations/` que cria a função (CREATE [OR REPLACE] FUNCTION) não
// pode ser seguida de DROP FUNCTION nem de REVOKE ALL/EXECUTE ON FUNCTION com
// esse nome. REVOKE na mesma migration que cria é o padrão de toda função
// nova (tira PUBLIC/anon) e vale; DROP depois do CREATE na mesma migration
// não. Se uma migration precisar mesmo revogar ou apagar, ela recria a
// função (ou a Edge Function para de chamá-la) e esta guarda passa.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

import { ler, PASTA_DB, RAIZ, semComentarios } from './_helpers/migration';

const PASTA_FUNCOES = join(RAIZ, 'supabase', 'functions');

function arquivosTs(pasta: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === '__tests__' || nome === 'node_modules') continue;
      saida.push(...arquivosTs(caminho));
    } else if (nome.endsWith('.ts') && !nome.endsWith('.test.ts')) {
      saida.push(caminho);
    }
  }
  return saida;
}

/** nome da RPC → arquivos de função que a chamam. */
function rpcsDasFuncoes(): Map<string, string[]> {
  const rpcs = new Map<string, string[]>();
  for (const arquivo of arquivosTs(PASTA_FUNCOES)) {
    const fonte = readFileSync(arquivo, 'utf8');
    for (const [, nome] of fonte.matchAll(/\brpc\(\s*'([a-z_][a-z0-9_]*)'/g)) {
      const lista = rpcs.get(nome) ?? [];
      lista.push(relative(RAIZ, arquivo).replace(/\\/g, '/'));
      rpcs.set(nome, lista);
    }
  }
  return rpcs;
}

const migrations = readdirSync(PASTA_DB)
  .filter((n) => n.endsWith('.sql'))
  .sort()
  .map((arquivo) => ({
    arquivo,
    sql: semComentarios(ler(join(PASTA_DB, arquivo))),
  }));

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Violações da regra para uma RPC (vazio = ok). */
function violacoesDe(nome: string): string[] {
  const n = escapar(nome);
  const criacao = new RegExp(
    String.raw`CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?${n}"?\s*\(`,
    'gi',
  );
  const remocao = new RegExp(String.raw`DROP\s+FUNCTION\b[^;]*\b${n}\b`, 'gi');
  const revogacao = new RegExp(
    String.raw`REVOKE\s+(?:ALL|EXECUTE)\b[^;]*\bON\s+FUNCTION\b[^;]*\b${n}\b`,
    'gi',
  );

  let ultima = -1;
  let posicaoNaUltima = -1;
  migrations.forEach(({ sql }, i) => {
    for (const achado of sql.matchAll(criacao)) {
      ultima = i;
      posicaoNaUltima = achado.index ?? 0;
    }
  });
  if (ultima < 0) {
    return [`${nome}: nenhuma migration em database/migrations a cria`];
  }

  const violacoes: string[] = [];
  const naUltima = migrations[ultima];
  for (const achado of naUltima.sql.matchAll(remocao)) {
    if ((achado.index ?? 0) > posicaoNaUltima) {
      violacoes.push(`${nome}: DROP depois do CREATE em ${naUltima.arquivo}`);
    }
  }
  for (const { arquivo, sql } of migrations.slice(ultima + 1)) {
    if (remocao.test(sql)) violacoes.push(`${nome}: DROP em ${arquivo}`);
    remocao.lastIndex = 0;
    if (revogacao.test(sql)) violacoes.push(`${nome}: REVOKE em ${arquivo}`);
    revogacao.lastIndex = 0;
  }
  return violacoes;
}

const rpcs = rpcsDasFuncoes();

describe('RPCs chamadas pelas Edge Functions', () => {
  it('a varredura enxerga as RPCs conhecidas (não está cega)', () => {
    for (const nome of [
      'consumir_cota_places',
      'limpar_uso_places_antigo',
      'limpar_notificacoes_antigas',
      'limpar_localizacoes_antigas',
      'expire_old_pending_routes',
      'remind_pending_routes',
      'motorista_ativo_por_telefone',
    ]) {
      expect(rpcs.has(nome)).toBe(true);
    }
  });

  it('nenhuma é apagada nem revogada depois da última migration que a cria', () => {
    const violacoes = [...rpcs.keys()].sort().flatMap(violacoesDe);
    expect(violacoes).toEqual([]);
  });
});
