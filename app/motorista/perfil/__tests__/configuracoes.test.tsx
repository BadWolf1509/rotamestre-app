/**
 * Configurações do motorista: o interruptor "Notificações Push" gravava só no
 * AsyncStorage, e ninguém lia — o push chegava igual (AN3, 1.14.6). Agora ele
 * grava em `preferencias_notificacao` (Migration 47), que a Edge Function
 * consulta. O banco aqui é um dublê em memória; a lib e o hook são os reais.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';

import ConfiguracoesScreen from '../configuracoes';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/components/motorista/NavigationSettings', () => ({
  NavigationSettings: () => null,
}));
jest.mock('@/components/ThemeSettings', () => ({
  ThemeSettings: () => null,
}));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'm1' }, usuarioOfflineId: null }),
}));
jest.mock('@/lib/semRede', () => ({
  semRedeConfirmada: jest.fn(async () => false),
}));
const mockShowToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: { visible: false, message: '', type: 'info', duration: 3000 },
    showToast: mockShowToast,
    hideToast: jest.fn(),
    withToast: jest.fn(),
  }),
}));

let banco: Map<string, Record<string, unknown>>;
let disco: Map<string, string>;
let falhaUpsert: { message: string } | null;
let upserts: Array<Record<string, unknown>>;

beforeEach(() => {
  jest.clearAllMocks();
  banco = new Map();
  disco = new Map();
  falhaUpsert = null;
  upserts = [];
  const { logger } = require('@/lib/logger');
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
  (supabase.from as jest.Mock).mockImplementation(() => ({
    select: () => ({
      eq: (_c: string, uid: string) => ({
        maybeSingle: async () => ({
          data: banco.get(uid) ?? null,
          error: null,
        }),
      }),
    }),
    upsert: async (valores: Record<string, unknown>) => {
      upserts.push(valores);
      if (falhaUpsert) return { error: falhaUpsert };
      banco.set(valores.usuario_id as string, valores);
      return { error: null };
    },
  }));
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (k: string) => disco.get(k) ?? null,
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (k: string, v: string) => {
      disco.set(k, v);
    },
  );
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(
    async (k: string) => {
      disco.delete(k);
    },
  );
});

const interruptor = () => screen.findByTestId('switch-push-ativo');

describe('Configurações do motorista: Notificações Push', () => {
  it('grava no banco e, reaberta a tela, relê de lá', async () => {
    const { unmount } = render(<ConfiguracoesScreen />);
    const sw = await interruptor();
    expect(sw.props.value).toBe(true);

    await act(async () => {
      fireEvent(sw, 'valueChange', false);
    });

    await waitFor(() =>
      expect(banco.get('m1')).toMatchObject({ push_ativo: false }),
    );
    expect(upserts[0]).toMatchObject({ usuario_id: 'm1', push_ativo: false });
    unmount();

    // Sem cópia no aparelho: o valor só pode vir do banco.
    disco.clear();
    render(<ConfiguracoesScreen />);
    await waitFor(async () =>
      expect((await interruptor()).props.value).toBe(false),
    );
  });

  it('sem rede: o interruptor muda na hora e a tela avisa, sem travar', async () => {
    falhaUpsert = { message: 'Failed to fetch' };
    render(<ConfiguracoesScreen />);
    const sw = await interruptor();

    await act(async () => {
      fireEvent(sw, 'valueChange', false);
    });

    expect((await interruptor()).props.value).toBe(false);
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringMatching(/sem conexão/i),
        'info',
        expect.any(Number),
      ),
    );
  });

  it('rede pendurada (gravação sem resposta): o interruptor não espera', async () => {
    render(<ConfiguracoesScreen />);
    const sw = await interruptor();
    (supabase.from as jest.Mock).mockImplementation(() => ({
      upsert: () => new Promise(() => {}),
    }));

    await act(async () => {
      fireEvent(sw, 'valueChange', false);
    });

    expect((await interruptor()).props.value).toBe(false);
  });

  it('a leitura do servidor que chega depois do toque não desfaz o toque', async () => {
    let responder: (v: unknown) => void = () => {};
    (supabase.from as jest.Mock).mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            new Promise((r) => {
              responder = r;
            }),
        }),
      }),
      upsert: async () => ({ error: null }),
    }));
    render(<ConfiguracoesScreen />);
    const sw = await interruptor();

    await act(async () => {
      fireEvent(sw, 'valueChange', false);
    });
    await act(async () => {
      responder({ data: { push_ativo: true }, error: null });
    });

    expect((await interruptor()).props.value).toBe(false);
  });

  it('o valor antigo do aparelho migra para o banco', async () => {
    disco.set('@rotamestre:notifications_enabled', 'false');
    render(<ConfiguracoesScreen />);

    await waitFor(() =>
      expect(banco.get('m1')).toMatchObject({ push_ativo: false }),
    );
    expect((await interruptor()).props.value).toBe(false);
    expect(disco.has('@rotamestre:notifications_enabled')).toBe(false);
  });
});
