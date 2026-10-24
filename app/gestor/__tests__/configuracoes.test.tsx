/**
 * Configurações do gestor: os quatro interruptores de notificação (push
 * geral, incidentes, rotas e resumo diário) gravavam só no AsyncStorage, e
 * ninguém lia (AN3, 1.14.6). Agora gravam em `preferencias_notificacao`
 * (Migration 47), que a Edge Function consulta. O banco aqui é um dublê em
 * memória; a lib e o hook são os reais.
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

import ConfiguracoesGestorScreen from '../configuracoes';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/components/ThemeSettings', () => ({
  ThemeSettings: () => null,
}));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'g1' }, usuarioOfflineId: null }),
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

const interruptor = (id: string) => screen.findByTestId(`switch-${id}`);

describe('Configurações do gestor: notificações', () => {
  it.each([
    ['push-ativo', 'push_ativo'],
    ['incidentes', 'incidentes'],
    ['rotas', 'rotas'],
    ['resumo-diario', 'resumo_diario'],
  ])('%s grava no banco e, reaberta a tela, relê de lá', async (id, coluna) => {
    const { unmount } = render(<ConfiguracoesGestorScreen />);
    const sw = await interruptor(id);
    expect(sw.props.value).toBe(true);

    await act(async () => {
      fireEvent(sw, 'valueChange', false);
    });

    await waitFor(() =>
      expect(banco.get('g1')).toMatchObject({ [coluna]: false }),
    );
    expect(upserts[0]).toMatchObject({ usuario_id: 'g1', [coluna]: false });
    unmount();

    disco.clear();
    render(<ConfiguracoesGestorScreen />);
    await waitFor(async () =>
      expect((await interruptor(id)).props.value).toBe(false),
    );
  });

  it('push geral desligado desabilita as categorias', async () => {
    banco.set('g1', {
      usuario_id: 'g1',
      push_ativo: false,
      incidentes: true,
      rotas: true,
      resumo_diario: true,
    });
    render(<ConfiguracoesGestorScreen />);

    await waitFor(async () =>
      expect((await interruptor('push-ativo')).props.value).toBe(false),
    );
    expect((await interruptor('incidentes')).props.disabled).toBe(true);
  });

  it('sem rede: o interruptor muda na hora e a tela avisa', async () => {
    falhaUpsert = { message: 'Failed to fetch' };
    render(<ConfiguracoesGestorScreen />);
    const sw = await interruptor('rotas');

    await act(async () => {
      fireEvent(sw, 'valueChange', false);
    });

    expect((await interruptor('rotas')).props.value).toBe(false);
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringMatching(/sem conexão/i),
        'info',
        expect.any(Number),
      ),
    );
  });
});
