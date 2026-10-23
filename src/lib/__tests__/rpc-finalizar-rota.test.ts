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

  it('trava as paradas da rota antes de contar as pendentes', () => {
    const trava = corpo.search(
      /FROM\s+public\.paradas[\s\S]{0,120}?FOR\s+UPDATE/,
    );
    const contagem = corpo.indexOf('count(*)');
    expect(trava).toBeGreaterThan(-1);
    expect(trava).toBeLessThan(contagem);
  });
});
