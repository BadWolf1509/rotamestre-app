/**
 * M8-3: pedido que chega durante `avancarProxima` (ou na releitura final)
 * marca `rodarDeNovo` quando o laço de envio já terminou. Ninguém o
 * consumia: a ação só subia no próximo gatilho. O `finally` agora reagenda
 * uma sincronização, uma vez, e nunca quando a rodada parou esperando rede.
 */
import { supabase } from '@/lib/supabase';

import {
  _resetFilaAcoesParada,
  criarAcaoParada,
  enfileirarAcaoParada,
  processarFilaAcoesParada,
  type PortaParadas,
} from '../filaAcoesParada';

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

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn() },
}));

const acao = (paradaId: string, tipo: 'concluir' | 'pular' = 'concluir') =>
  criarAcaoParada({
    tipo,
    paradaId,
    rotaId: 'rota-1',
    motoristaId: 'mot-1',
    em: '2026-10-23T12:00:00.000Z',
    ...(tipo === 'pular' ? { motivo: 'outro' as const } : {}),
  });

function portaAberta(avancarProxima: PortaParadas['avancarProxima']) {
  const porta: PortaParadas = {
    lerParada: async () => ({
      status: 'em_andamento',
      rota_id: 'rota-1',
      rota: { status: 'em_andamento', motorista_id: 'mot-1' },
    }),
    atualizarSeAberta: async () => true,
    avancarProxima,
  };
  return porta;
}

const esperar = (ms = 20) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  jest.requireMock('@react-native-async-storage/async-storage').__mapa.clear();
  _resetFilaAcoesParada();
  jest.clearAllMocks();
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: 'mot-1' } } },
    error: null,
  });
  // O reenvio usa a porta real; o erro sem código é "esperar rede", sem
  // contar tentativa nem descartar a ação.
  (supabase.from as jest.Mock).mockImplementation(() => {
    throw new Error('banco indisponível no teste');
  });
});

describe('processarFilaAcoesParada: pedido que chega depois do laço de envio', () => {
  it('ação nova durante o avancarProxima sobe sem novo gatilho, em uma só nova rodada', async () => {
    await enfileirarAcaoParada(acao('p1'));
    let liberar: () => void = () => undefined;
    const porta = portaAberta(
      () =>
        new Promise<void>((r) => {
          liberar = r;
        }),
    );

    const primeira = processarFilaAcoesParada({
      usuarioAtual: 'mot-1',
      porta,
    });
    await esperar();
    // A rodada já saiu do laço e está presa no avancarProxima.
    await enfileirarAcaoParada(acao('p2', 'pular'));
    await processarFilaAcoesParada({ usuarioAtual: 'mot-1', porta });
    expect(supabase.from).not.toHaveBeenCalled();

    liberar();
    await primeira;
    await esperar();

    expect(supabase.from).toHaveBeenCalledWith('paradas');
    // Uma única rodada extra: não vira laço.
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    await esperar();
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
  });

  it('sem pedido durante a rodada, nada é reagendado', async () => {
    await enfileirarAcaoParada(acao('p1'));
    await processarFilaAcoesParada({
      usuarioAtual: 'mot-1',
      porta: portaAberta(async () => undefined),
    });
    await esperar();
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
  });

  it('rodada que parou esperando rede não reagenda, mesmo com pedido marcado', async () => {
    await enfileirarAcaoParada(acao('p1'));
    let liberar: () => void = () => undefined;
    const porta = portaAberta(async () => undefined);
    porta.lerParada = async () => {
      await new Promise<void>((r) => {
        liberar = r;
      });
      throw new TypeError('Network request failed');
    };

    const primeira = processarFilaAcoesParada({
      usuarioAtual: 'mot-1',
      porta,
    });
    await esperar();
    await processarFilaAcoesParada({ usuarioAtual: 'mot-1', porta });
    liberar();
    await primeira;
    await esperar();

    expect(supabase.auth.getSession).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
