/**
 * Troca de conta com ação pendente: A deslogou, B entrou, a fila de A ainda
 * roda. Com a sessão de B, a RLS esconde a parada de A (lerParada devolve
 * null) — o que parece "parada removida", mas é só a conta errada na frente.
 * A ação espera (erro de sessão), não é descartada.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  aplicarAcaoParada,
  criarAcaoParada,
  ehErroDeSessao,
  enfileirarAcaoParada,
  lerDescartesDaFila,
  lerFilaAcoesParada,
  processarFilaAcoesParada,
  _resetFilaAcoesParada,
  type PortaParadas,
} from '../motorista/filaAcoesParada';

import type { EstadoSessao } from '../auth/sessao';

jest.mock('@react-native-async-storage/async-storage', () => {
  const mapa = new Map<string, string>();
  return {
    __mapa: mapa,
    getItem: jest.fn(async (k: string) => mapa.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mapa.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      mapa.delete(k);
    }),
  };
});

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const sessaoDe = (id: string): (() => Promise<EstadoSessao>) =>
  jest.fn(async () => ({
    session: { user: { id } } as EstadoSessao['session'],
    offline: false,
  }));

const portaSemParada = (): PortaParadas => ({
  lerParada: jest.fn(async () => null),
  atualizarSeAberta: jest.fn(async () => true),
  avancarProxima: jest.fn(async () => undefined),
});

const acaoDeA = () =>
  criarAcaoParada({
    tipo: 'concluir',
    paradaId: 'p1',
    rotaId: 'r1',
    motoristaId: 'A',
  });

beforeEach(() => {
  (AsyncStorage as unknown as { __mapa: Map<string, string> }).__mapa.clear();
  _resetFilaAcoesParada();
});

describe('fila de ações na troca de conta', () => {
  it('parada invisível com sessão de outra conta espera', async () => {
    const acao = acaoDeA();
    await enfileirarAcaoParada(acao);
    const porta = portaSemParada();

    const erro = await aplicarAcaoParada(acao, porta, sessaoDe('B')).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeDefined();
    expect(ehErroDeSessao(erro)).toBe(true);

    const r = await processarFilaAcoesParada({
      usuarioAtual: 'A',
      porta,
      lerSessaoAtual: sessaoDe('B'),
    });
    expect(r.descartadas).toHaveLength(0);
    expect(r.restantes).toBe(1);
    expect(await lerFilaAcoesParada()).toHaveLength(1);
    expect(await lerDescartesDaFila('A')).toHaveLength(0);
  });

  it('parada invisível com a sessão do dono continua parada_removida', async () => {
    const acao = acaoDeA();
    const r = await aplicarAcaoParada(acao, portaSemParada(), sessaoDe('A'));
    expect(r).toEqual({ tipo: 'descartada', motivo: 'parada_removida' });
  });
});
