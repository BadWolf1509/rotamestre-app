/**
 * Guarda da RPC `finalizar_rota` (Migration 40): o que o motorista vê quando
 * ela recusa, e duas propriedades do SQL que só a sonda prova de verdade.
 *
 * POR QUE EXISTE. As mensagens do `RAISE EXCEPTION` chegam ao `showError`, que
 * passa por `errorMapping.ts`. Mensagem que não casa com nenhum padrão vira
 * "Algo deu errado / erro inesperado" — inútil para quem está no fim da rota
 * com sinal ruim. A ligação entre as duas pontas é a sentinela (`ROTA_*`,
 * `NAO_AUTENTICADO`) no começo da mensagem; esta guarda lê o `.sql` e confere
 * que cada `RAISE` cai numa mensagem própria.
 *
 * O QUE ELA NÃO PEGA: o comportamento do SQL. Idempotência, trava e recusas
 * são provadas pela sonda transacional (ver MIGRATIONS.md, Migration 40); as
 * checagens textuais abaixo só impedem que alguém tire a trava ou o ramo
 * idempotente sem perceber.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { getErrorMessage } from '../errorMapping';

const RAIZ = join(__dirname, '..', '..', '..');
const ARQUIVO = 'database/migrations/20261023100000_finalizar_rota_rpc.sql';

function corpoDaFuncao(): string {
  const sql = readFileSync(join(RAIZ, ARQUIVO), 'utf8');
  const inicio = sql.indexOf('FUNCTION public.finalizar_rota');
  const fim = sql.indexOf('\n$$;', inicio);
  if (inicio === -1 || fim === -1) {
    throw new Error(`Corpo de finalizar_rota não encontrado em ${ARQUIVO}`);
  }
  return sql.slice(inicio, fim);
}

const corpo = corpoDaFuncao();
const mensagens = [...corpo.matchAll(/RAISE EXCEPTION '([^']+)'/g)].map(
  (m) => m[1],
);

describe('finalizar_rota: mensagens para o motorista', () => {
  it('extrai as mensagens de RAISE (senão a guarda passaria vazia)', () => {
    expect(mensagens.length).toBeGreaterThanOrEqual(4);
  });

  it.each(mensagens)('"%s" tem mensagem própria, não o genérico', (msg) => {
    expect(getErrorMessage({ message: msg }).code).not.toBe('UNKNOWN_ERROR');
  });

  it('paradas pendentes dizem o que fazer', () => {
    const r = getErrorMessage({
      message: mensagens.find((m) => m.includes('pendente')) ?? '',
    });
    expect(r.title).toMatch(/paradas pendentes/i);
  });

  // A recusa vale para cancelada, pendente, não executada: o texto não pode
  // afirmar uma causa ("encerrada pelo gestor ou expirou") que talvez não seja.
  it('"não está em andamento" é neutro quanto à causa', () => {
    const r = getErrorMessage({
      message:
        mensagens.find((m) => m.startsWith('ROTA_NAO_EM_ANDAMENTO')) ?? '',
    });
    expect(r.code).toBe('ROUTE_NOT_IN_PROGRESS');
    expect(r.message).toMatch(/não está mais em andamento/i);
    expect(r.message).not.toMatch(/gestor|expirou/i);
  });
});

describe('finalizar_rota: propriedades do SQL', () => {
  it('rota já concluída pelo próprio motorista retorna sem erro (idempotente)', () => {
    // Resposta perdida por sinal ruim + novo toque não pode virar erro.
    const ramoIdempotente = corpo.search(
      /IF\s+v_status\s*=\s*'concluida'\s+THEN\s+RETURN;/,
    );
    const recusaDeStatus = corpo.indexOf('ROTA_NAO_EM_ANDAMENTO');
    expect(ramoIdempotente).toBeGreaterThan(-1);
    expect(ramoIdempotente).toBeLessThan(recusaDeStatus);
  });

  it('trava as paradas da rota (NO KEY UPDATE) antes de contar as pendentes', () => {
    const trava = corpo.search(
      /FROM\s+public\.paradas[\s\S]{0,120}?FOR\s+NO\s+KEY\s+UPDATE/,
    );
    const contagem = corpo.indexOf('count(*)');
    expect(trava).toBeGreaterThan(-1);
    expect(trava).toBeLessThan(contagem);
  });

  // `inserir_parada` faz INSERT em paradas, que pega FOR KEY SHARE na rota
  // pela FK. FOR UPDATE conflita com KEY SHARE (deadlock gestor-insere x
  // motorista-finaliza); FOR NO KEY UPDATE não conflita e basta, porque
  // nenhuma chave muda.
  it('nenhuma trava FOR UPDATE simples (só NO KEY UPDATE)', () => {
    expect(corpo).not.toMatch(/FOR\s+UPDATE/);
  });

  it('trava só a rota do próprio motorista (dono no WHERE, NO KEY UPDATE)', () => {
    expect(corpo).toMatch(
      /FROM\s+public\.rotas\s+r\s+WHERE\s+r\.id\s*=\s*p_rota_id\s+AND\s+r\.motorista_id\s*=\s*auth\.uid\(\)\s+FOR\s+NO\s+KEY\s+UPDATE/,
    );
  });

  it('"não existe" e "não é sua" caem no mesmo ramo (NOT FOUND)', () => {
    expect(corpo).toMatch(
      /IF\s+NOT\s+FOUND\s+THEN\s+RAISE\s+EXCEPTION\s+'ROTA_NAO_ENCONTRADA/,
    );
  });
});
