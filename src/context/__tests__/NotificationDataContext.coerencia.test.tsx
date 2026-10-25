/**
 * Coerência da lista e do contador de notificações (DP-5, DP-6/AN6, AN5).
 *
 * O contador derivava por delta: +1 em todo INSERT (inclusive o repetido) e
 * ±1 em todo UPDATE (inclusive o que não mudava `lida`). Agora ele é a soma
 * das não lidas da lista com as não lidas que ficaram fora da página
 * carregada (count exato da carga). Marcar como lida muda a tela na hora.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

type Resposta = { data?: unknown; error?: unknown; count?: number | null };
type Chamada = { metodo: string; args: unknown[] };

// --- Banco simulado -------------------------------------------------------
let mockPagina: (usuario: string, offset: number) => Promise<Resposta>;
let mockContagem: (usuario: string) => Promise<Resposta>;
let mockUpdate: (chamadas: Chamada[]) => Promise<Resposta>;
const mockConsultas: Chamada[][] = [];

function mockBuilder() {
  const chamadas: Chamada[] = [];
  mockConsultas.push(chamadas);
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'update', 'eq', 'order', 'range', 'gte', 'limit']) {
    b[m] = (...args: unknown[]) => {
      chamadas.push({ metodo: m, args });
      return b;
    };
  }
  b.then = (ok: (r: Resposta) => unknown, falha?: (e: unknown) => unknown) => {
    const usuario = String(
      chamadas.find((c) => c.metodo === 'eq' && c.args[0] === 'usuario_id')
        ?.args[1],
    );
    let p: Promise<Resposta>;
    if (chamadas.some((c) => c.metodo === 'update')) p = mockUpdate(chamadas);
    else if (
      chamadas.some(
        (c) =>
          c.metodo === 'select' &&
          (c.args[1] as { head?: boolean } | undefined)?.head,
      )
    )
      p = mockContagem(usuario);
    else {
      const range = chamadas.find((c) => c.metodo === 'range');
      p = mockPagina(usuario, range ? Number(range.args[0]) : 0);
    }
    return p.then(ok, falha);
  };
  return b;
}

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => mockBuilder()) },
}));

// --- Sessão ---------------------------------------------------------------
let mockUserData: { id: string } | null = { id: 'user-a' };
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: mockUserData }),
}));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ session: { access_token: 'tok' } }),
}));

// --- Realtime e polling capturados ---------------------------------------
let mockConectado = false;
const mockRealtime: {
  onInsert?: (n: Notificacao) => void;
  onUpdate?: (n: Notificacao) => void;
} = {};
jest.mock('@/hooks/useNotificationRealtime', () => ({
  useNotificationRealtime: (o: {
    onInsert: (n: Notificacao) => void;
    onUpdate: (n: Notificacao) => void;
  }) => {
    mockRealtime.onInsert = o.onInsert;
    mockRealtime.onUpdate = o.onUpdate;
    return { conectado: mockConectado };
  },
}));
const mockPolling: {
  ativo?: boolean;
  desde?: string | null;
  userId?: string;
  onNovas?: (n: NotificacaoComDetalhes[]) => void;
} = {};
jest.mock('@/hooks/useNotificationPolling', () => ({
  useNotificationPolling: (o: typeof mockPolling) => {
    Object.assign(mockPolling, o);
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/utils/notificationFeedback', () => ({
  triggerNewNotificationFeedback: jest.fn(),
}));
jest.mock('@/utils/toast', () => ({ toast: { info: jest.fn(), error: jest.fn() } }));

import type {
  Notificacao,
  NotificacaoComDetalhes,
} from '@/types/notifications';
import { triggerNewNotificationFeedback } from '@/utils/notificationFeedback';
import { toast } from '@/utils/toast';

import {
  NotificationDataProvider,
  useNotificationData,
} from '../NotificationDataContext';

function notif(
  id: string,
  lida: boolean,
  created_at = '2026-10-24T10:00:00+00:00',
  usuario_id = 'user-a',
): NotificacaoComDetalhes {
  return {
    id,
    usuario_id,
    tipo: 'nova_rota_atribuida',
    titulo: id,
    mensagem: id,
    rota_id: null,
    parada_id: null,
    incidente_id: null,
    lida,
    created_at,
  };
}

function ok(r: Resposta) {
  return Promise.resolve({ error: null, ...r });
}

function montar() {
  return renderHook(() => useNotificationData(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <NotificationDataProvider>{children}</NotificationDataProvider>
    ),
  });
}

async function carregado(result: { current: { loading: boolean } }) {
  await waitFor(() => expect(result.current.loading).toBe(false));
}

describe('NotificationDataContext: coerência da lista e do contador', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsultas.length = 0;
    mockUserData = { id: 'user-a' };
    mockConectado = false;
    // Página: 3 notificações, 2 não lidas. Banco: 5 não lidas ao todo.
    mockPagina = () =>
      ok({
        data: [
          notif('n3', false, '2026-10-24T12:00:00+00:00'),
          notif('n2', true, '2026-10-24T11:00:00+00:00'),
          notif('n1', false, '2026-10-24T10:00:00+00:00'),
        ],
      });
    mockContagem = () => ok({ count: 5 });
    mockUpdate = () => ok({});
  });

  it('o contador soma as não lidas da lista com as que ficaram fora da página', async () => {
    const { result } = montar();
    await carregado(result);
    expect(result.current.naoLidas).toBe(5);
  });

  describe('realtime', () => {
    it('INSERT repetido entra uma vez só, conta uma vez e avisa uma vez', async () => {
      const { result } = montar();
      await carregado(result);
      const nova = notif('n4', false, '2026-10-24T13:00:00+00:00');

      act(() => mockRealtime.onInsert!(nova));
      act(() => mockRealtime.onInsert!(nova));

      expect(result.current.notificacoes.filter((n) => n.id === 'n4')).toHaveLength(1);
      expect(result.current.naoLidas).toBe(6);
      expect(triggerNewNotificationFeedback).toHaveBeenCalledTimes(1);
    });

    it('UPDATE que não muda `lida` não mexe no contador', async () => {
      const { result } = montar();
      await carregado(result);

      act(() => mockRealtime.onUpdate!({ ...notif('n3', false), titulo: 'novo' }));

      expect(result.current.naoLidas).toBe(5);
    });

    it('UPDATE que marca lida desconta uma vez, mesmo repetido', async () => {
      const { result } = montar();
      await carregado(result);

      act(() => mockRealtime.onUpdate!(notif('n3', true)));
      act(() => mockRealtime.onUpdate!(notif('n3', true)));

      expect(result.current.naoLidas).toBe(4);
    });

    it('UPDATE marcando lida uma notificação fora da página desconta das de fora', async () => {
      const { result } = montar();
      await carregado(result);

      act(() => mockRealtime.onUpdate!(notif('antiga', true)));

      expect(result.current.naoLidas).toBe(4);
      expect(result.current.notificacoes.some((n) => n.id === 'antiga')).toBe(false);
    });
  });

  describe('marcar como lida', () => {
    it('atualiza a tela na hora, antes da resposta do servidor', async () => {
      let responder: (r: Resposta) => void = () => {};
      mockUpdate = () =>
        new Promise((r) => {
          responder = r;
        });
      const { result } = montar();
      await carregado(result);

      let pendente: Promise<void> = Promise.resolve();
      act(() => {
        pendente = result.current.marcarComoLida('n3');
      });

      expect(result.current.naoLidas).toBe(4);
      expect(result.current.notificacoes.find((n) => n.id === 'n3')?.lida).toBe(true);
      await act(async () => {
        await Promise.resolve(); // o `then` do update registra o responder
        responder({ error: null });
        await pendente;
      });
      expect(result.current.naoLidas).toBe(4);
    });

    it('reverte e avisa quando o servidor falha', async () => {
      mockUpdate = () => ok({ error: { message: 'falhou' } });
      const { result } = montar();
      await carregado(result);

      await act(async () => {
        await result.current.marcarComoLida('n3');
      });

      expect(result.current.naoLidas).toBe(5);
      expect(result.current.notificacoes.find((n) => n.id === 'n3')?.lida).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('marcar todas zera na hora e reverte se o servidor falhar', async () => {
      let responder: (r: Resposta) => void = () => {};
      mockUpdate = () =>
        new Promise((r) => {
          responder = r;
        });
      const { result } = montar();
      await carregado(result);

      let pendente: Promise<void> = Promise.resolve();
      act(() => {
        pendente = result.current.marcarTodasComoLidas();
      });
      expect(result.current.naoLidas).toBe(0);

      await act(async () => {
        await Promise.resolve(); // o `then` do update registra o responder
        responder({ error: { message: 'falhou' } });
        await pendente;
      });
      expect(result.current.naoLidas).toBe(5);
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('sessão (AN5)', () => {
    it('logout zera a lista e o contador', async () => {
      const { result, rerender } = montar();
      await carregado(result);

      mockUserData = null;
      rerender({});

      expect(result.current.notificacoes).toEqual([]);
      expect(result.current.naoLidas).toBe(0);
    });

    it('troca de conta: some a lista da anterior e a resposta atrasada dela é descartada', async () => {
      const { result, rerender } = montar();
      await carregado(result);

      // A carga da conta B fica pendente; a da A ainda pode chegar atrasada.
      let responderA: (r: Resposta) => void = () => {};
      let responderB: (r: Resposta) => void = () => {};
      mockPagina = (usuario) =>
        new Promise((r) => {
          if (usuario === 'user-a') responderA = r;
          else responderB = r;
        });
      mockContagem = (usuario) => ok({ count: usuario === 'user-b' ? 1 : 9 });
      // Um refresh da conta A em voo no momento da troca.
      await act(async () => {
        result.current.refresh();
        await Promise.resolve(); // a consulta da A registra o responderA
      });

      mockUserData = { id: 'user-b' };
      rerender({});
      expect(result.current.notificacoes).toEqual([]);
      expect(result.current.naoLidas).toBe(0);

      await act(async () => {
        await Promise.resolve();
        responderA({ data: [notif('da-a', false)], error: null });
      });
      expect(mockConsultas.some((c) => c.some((x) => x.args[1] === 'user-a' && x.metodo === 'eq'))).toBe(true);
      expect(result.current.notificacoes).toEqual([]);
      expect(result.current.naoLidas).toBe(0);

      await act(async () => {
        responderB({
          data: [notif('da-b', false, undefined, 'user-b')],
          error: null,
        });
      });
      await waitFor(() =>
        expect(result.current.notificacoes.map((n) => n.id)).toEqual(['da-b']),
      );
      expect(result.current.naoLidas).toBe(1);
    });
  });

  describe('polling de reserva (DP-5)', () => {
    it('só fica ativo com o realtime fora', async () => {
      const { result, rerender } = montar();
      await carregado(result);
      expect(mockPolling.ativo).toBe(true);

      mockConectado = true;
      rerender({});
      expect(mockPolling.ativo).toBe(false);
    });

    it('busca desde a notificação mais nova da lista', async () => {
      const { result } = montar();
      await carregado(result);
      expect(mockPolling.desde).toBe('2026-10-24T12:00:00+00:00');
    });

    it('as novas do polling entram sem duplicar e contam', async () => {
      const { result } = montar();
      await carregado(result);

      act(() =>
        mockPolling.onNovas!([
          notif('n4', false, '2026-10-24T13:00:00+00:00'),
          notif('n3', false, '2026-10-24T12:00:00+00:00'),
        ]),
      );

      expect(result.current.notificacoes.map((n) => n.id)).toEqual([
        'n4',
        'n3',
        'n2',
        'n1',
      ]);
      expect(result.current.naoLidas).toBe(6);
    });
  });

  it('carregar mais não duplica e não conta duas vezes as que vieram de fora', async () => {
    mockPagina = (_u, offset) =>
      offset === 0
        ? ok({
            data: Array.from({ length: 20 }, (_, i) =>
              notif(`p${i}`, true, `2026-10-24T10:${String(59 - i).padStart(2, '0')}:00+00:00`),
            ),
          })
        : ok({
            // Uma repetida (a lista andou) e duas não lidas de fora.
            data: [
              notif('p19', true),
              notif('velha1', false, '2026-10-23T10:00:00+00:00'),
              notif('velha2', false, '2026-10-23T09:00:00+00:00'),
            ],
          });
    mockContagem = () => ok({ count: 2 });
    const { result } = montar();
    await carregado(result);
    expect(result.current.naoLidas).toBe(2);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.notificacoes).toHaveLength(22);
    expect(result.current.naoLidas).toBe(2);
  });
});
