/**
 * Testes do useNotificationPolling: reserva do realtime de notificações.
 *
 * DP-5: antes ele baixava TODAS as não lidas a cada 30 s, mesmo com o realtime
 * conectado. Agora só roda com o realtime fora (`ativo`) e busca só o que é
 * novo desde a última notificação vista (`desde`).
 */

import { act, renderHook } from '@testing-library/react-native';

import { useNotificationPolling } from '../useNotificationPolling';

type Resposta = { data: unknown[] | null; error: unknown };

const mockChamadas: { metodo: string; args: unknown[] }[] = [];
let mockResposta: Promise<Resposta> = Promise.resolve({
  data: [],
  error: null,
});

function mockConsulta() {
  const builder: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'gte', 'order', 'limit']) {
    builder[metodo] = (...args: unknown[]) => {
      mockChamadas.push({ metodo, args });
      return builder;
    };
  }
  builder.then = (
    ok: (r: Resposta) => unknown,
    falha?: (e: unknown) => unknown,
  ) => mockResposta.then(ok, falha);
  return builder;
}

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => mockConsulta()) },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const { supabase } = jest.requireMock('@/lib/supabase');
const { logger } = jest.requireMock('@/lib/logger');

async function esvaziarPromessas() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function avancar(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await esvaziarPromessas();
}

type Props = Parameters<typeof useNotificationPolling>[0];

function montar(inicial: Partial<Props> = {}) {
  const onNovas = jest.fn();
  const props: Props = {
    userId: 'user-1',
    ativo: true,
    desde: '2026-10-24T10:00:00.000000+00:00',
    onNovas,
    ...inicial,
  };
  const hook = renderHook((p: Props) => useNotificationPolling(p), {
    initialProps: props,
  });
  return { ...hook, onNovas, props };
}

describe('useNotificationPolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockChamadas.length = 0;
    mockResposta = Promise.resolve({ data: [], error: null });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('não consulta sem usuário', async () => {
    montar({ userId: undefined });
    await avancar(90_000);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('com o realtime conectado (ativo: false), não consulta', async () => {
    montar({ ativo: false });
    await avancar(90_000);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('com o realtime fora, consulta a cada 30 s', async () => {
    montar();
    await avancar(30_000);
    expect(supabase.from).toHaveBeenCalledTimes(1);
    await avancar(30_000);
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it('busca só o que é novo desde a última vista, com os detalhes da lista', async () => {
    montar();
    await avancar(30_000);

    expect(supabase.from).toHaveBeenCalledWith('notificacoes');
    expect(mockChamadas).toEqual(
      expect.arrayContaining([
        { metodo: 'eq', args: ['usuario_id', 'user-1'] },
        {
          metodo: 'gte',
          args: ['created_at', '2026-10-24T10:00:00.000000+00:00'],
        },
        { metodo: 'order', args: ['created_at', { ascending: false }] },
      ]),
    );
    const select = mockChamadas.find((c) => c.metodo === 'select');
    expect(String(select?.args[0])).toContain('rota:rotas');
    // Nunca mais a varredura de todas as não lidas.
    expect(mockChamadas).not.toContainEqual({
      metodo: 'eq',
      args: ['lida', false],
    });
  });

  it('usa o `desde` mais recente, sem reiniciar o intervalo', async () => {
    const { rerender, props } = montar();
    rerender({ ...props, desde: '2026-10-24T11:00:00.000000+00:00' });
    await avancar(30_000);

    expect(mockChamadas).toContainEqual({
      metodo: 'gte',
      args: ['created_at', '2026-10-24T11:00:00.000000+00:00'],
    });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('sem nenhuma vista ainda, busca a primeira página sem filtro de data', async () => {
    montar({ desde: null });
    await avancar(30_000);
    expect(mockChamadas.some((c) => c.metodo === 'gte')).toBe(false);
    expect(mockChamadas.some((c) => c.metodo === 'limit')).toBe(true);
  });

  it('entrega as novas a quem chamou', async () => {
    const novas = [{ id: 'n-2', lida: false }];
    mockResposta = Promise.resolve({ data: novas, error: null });
    const { onNovas } = montar();
    await avancar(30_000);
    expect(onNovas).toHaveBeenCalledWith(novas);
  });

  it('não chama ninguém quando não há nada novo', async () => {
    const { onNovas } = montar();
    await avancar(30_000);
    expect(onNovas).not.toHaveBeenCalled();
  });

  // Entre o último evento visto e o SUBSCRIBED o canal não ouve nada: o que
  // chegou nesse intervalo só aparece com uma busca.
  it('quando o realtime volta, faz uma busca de recuperação e para o intervalo', async () => {
    const { rerender, props } = montar();
    rerender({ ...props, ativo: false });
    await esvaziarPromessas();
    expect(supabase.from).toHaveBeenCalledTimes(1);

    await avancar(90_000);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('na recuperação chama onRecuperar uma vez; com o realtime fora, nunca', async () => {
    const onRecuperar = jest.fn();
    const { rerender, props } = montar({ onRecuperar });
    await avancar(60_000);
    expect(onRecuperar).not.toHaveBeenCalled();

    rerender({ ...props, onRecuperar, ativo: false });
    await esvaziarPromessas();
    expect(onRecuperar).toHaveBeenCalledTimes(1);

    await avancar(90_000);
    expect(onRecuperar).toHaveBeenCalledTimes(1);
  });

  // A carga inicial do provider já trouxe a lista: recarregar no primeiro
  // SUBSCRIBED era carga dupla a cada abertura e login.
  it('primeira conexão do realtime não chama onRecuperar', async () => {
    const onRecuperar = jest.fn();
    const { rerender, props } = montar({ onRecuperar });
    await avancar(1_000);

    rerender({ ...props, onRecuperar, ativo: false });
    await esvaziarPromessas();
    expect(onRecuperar).not.toHaveBeenCalled();
  });

  it('queda e volta do realtime chamam onRecuperar uma vez', async () => {
    const onRecuperar = jest.fn();
    const { rerender, props } = montar({ onRecuperar });
    rerender({ ...props, onRecuperar, ativo: false });
    await esvaziarPromessas();

    rerender({ ...props, onRecuperar, ativo: true });
    await avancar(1_000);
    rerender({ ...props, onRecuperar, ativo: false });
    await esvaziarPromessas();
    expect(onRecuperar).toHaveBeenCalledTimes(1);
  });

  it('troca de conta: a primeira conexão da nova conta não chama onRecuperar', async () => {
    const onRecuperar = jest.fn();
    const { rerender, props } = montar({ onRecuperar });
    rerender({ ...props, onRecuperar, ativo: false });
    await esvaziarPromessas();

    rerender({ ...props, onRecuperar, userId: 'user-2', ativo: true });
    await avancar(1_000);
    rerender({ ...props, onRecuperar, userId: 'user-2', ativo: false });
    await esvaziarPromessas();
    expect(onRecuperar).not.toHaveBeenCalled();
  });

  it('descarta a resposta atrasada da conta anterior', async () => {
    let responder: (r: Resposta) => void = () => {};
    mockResposta = new Promise((r) => {
      responder = r;
    });
    const { rerender, props, onNovas } = montar();
    await avancar(30_000);

    rerender({ ...props, userId: 'user-2' });
    await act(async () => {
      responder({ data: [{ id: 'da-conta-antiga' }], error: null });
    });
    await esvaziarPromessas();

    expect(onNovas).not.toHaveBeenCalled();
  });

  it('erro da consulta: avisa com no máximo 2 argumentos e não entrega nada', async () => {
    const erro = { message: 'falhou' };
    mockResposta = Promise.resolve({ data: null, error: erro });
    const { onNovas } = montar();
    await avancar(30_000);

    expect(onNovas).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Polling:Notificacoes]'),
      erro,
    );
  });

  it('para o intervalo ao desmontar', async () => {
    const { unmount } = montar();
    unmount();
    await avancar(90_000);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
