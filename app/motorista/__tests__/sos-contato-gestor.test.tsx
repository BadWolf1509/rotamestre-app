/**
 * Contato do gestor no SOS.
 *
 * O motorista ativo enxerga só a própria linha de `usuarios` (RLS), então a
 * consulta antiga (`from('usuarios').eq('papel','gestor')`) devolvia vazio e o
 * "Ligar para Gestor" nunca achava ninguém. O único caminho que funciona é a
 * RPC SECURITY DEFINER `get_gestor_contato`, a mesma da gaveta.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

import SOSScreen from '../sos';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockMaybeSingle = jest.fn();

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () =>
    Promise.resolve({ status: 'granted', canAskAgain: true }),
  getForegroundPermissionsAsync: () =>
    Promise.resolve({ status: 'granted', canAskAgain: true }),
  getCurrentPositionAsync: () =>
    Promise.resolve({ coords: { latitude: -23.55, longitude: -46.63 } }),
  watchPositionAsync: () => Promise.resolve({ remove: jest.fn() }),
  Accuracy: { Balanced: 3, High: 4, BestForNavigation: 6 },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    rpc: (...a: unknown[]) => {
      mockRpc(...a);
      return { maybeSingle: () => mockMaybeSingle() };
    },
  },
}));

jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    userData: { id: 'motorista-1', nome: 'Teste', unidade_id: 'u1' },
    loading: false,
  }),
}));

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({ routeStatus: { route: null } }),
}));

jest.mock('@/utils/haptics', () => ({
  heavyHaptic: jest.fn(),
  warningHaptic: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const GESTOR = {
  nome: 'Maria Gestora',
  telefone: '(83) 99999-1234',
  email: 'm@x.com',
};

describe('SOS: contato do gestor', () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: GESTOR, error: null });
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  });

  async function renderComGestor() {
    const tela = render(<SOSScreen />);
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    return tela;
  }

  it('busca o gestor pela RPC, sem ler usuarios direto', async () => {
    await renderComGestor();

    expect(mockRpc).toHaveBeenCalledWith('get_gestor_contato');
    expect(mockFrom).not.toHaveBeenCalledWith('usuarios');
  });

  it('ligar abre tel: com o telefone da RPC', async () => {
    const { getByTestId } = await renderComGestor();
    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalled());
    await Promise.resolve();

    fireEvent.press(getByTestId('contato-emergencia-gestor'));

    await waitFor(() =>
      expect(openURL).toHaveBeenCalledWith('tel:+5583999991234'),
    );
  });

  it('WhatsApp abre o app com o texto pronto', async () => {
    const { getByTestId } = await renderComGestor();
    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalled());
    await Promise.resolve();

    fireEvent.press(getByTestId('contato-emergencia-gestor-whatsapp'));

    await waitFor(() => expect(openURL).toHaveBeenCalled());
    const url = openURL.mock.calls[0][0] as string;
    expect(url).toMatch(
      /^(whatsapp:..send.phone=|https:..wa.me.)5583999991234&/,
    );
    expect(url).toContain('5583999991234');
    expect(decodeURIComponent(url)).toContain('EMERGÊNCIA: Preciso de ajuda!');
  });

  it('sem gestor mostra aviso e não abre nada', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { getByTestId } = await renderComGestor();
    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalled());
    await Promise.resolve();

    fireEvent.press(getByTestId('contato-emergencia-gestor'));

    await waitFor(() =>
      expect(global.mockUseAlert.showWarning).toHaveBeenCalled(),
    );
    expect(global.mockUseAlert.showWarning.mock.calls[0][0]).toMatch(/gestor/i);
    expect(openURL).not.toHaveBeenCalled();
  });

  it('cadastro que já traz +55 não duplica o DDI', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...GESTOR, telefone: '+55 83 99999-1234' },
      error: null,
    });
    const { getByTestId } = await renderComGestor();
    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalled());
    await Promise.resolve();

    fireEvent.press(getByTestId('contato-emergencia-gestor'));

    await waitFor(() =>
      expect(openURL).toHaveBeenCalledWith('tel:+5583999991234'),
    );
  });

  it('RPC com erro: mensagem de erro, não "Nenhum gestor disponível"', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'falhou', code: '500' },
    });
    const { getByTestId } = await renderComGestor();
    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalled());
    await Promise.resolve();

    fireEvent.press(getByTestId('contato-emergencia-gestor'));

    await waitFor(() =>
      expect(global.mockUseAlert.showWarning).toHaveBeenCalled(),
    );
    const [titulo, corpo] = global.mockUseAlert.showWarning.mock.calls[0];
    expect(`${titulo} ${corpo}`).toMatch(/não foi possível carregar/i);
    expect(`${titulo} ${corpo}`).not.toMatch(/nenhum gestor disponível/i);
    // O toque no erro tenta a RPC de novo.
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
    expect(openURL).not.toHaveBeenCalled();
  });

  it('toque antes da RPC responder não afirma que não há gestor', async () => {
    mockMaybeSingle.mockReturnValue(new Promise(() => undefined));
    const { getByTestId } = await renderComGestor();

    fireEvent.press(getByTestId('contato-emergencia-gestor'));

    await waitFor(() =>
      expect(global.mockUseAlert.showWarning).toHaveBeenCalled(),
    );
    const [titulo, corpo] = global.mockUseAlert.showWarning.mock.calls[0];
    expect(`${titulo} ${corpo}`).toMatch(/carregando|buscando/i);
    expect(`${titulo} ${corpo}`).not.toMatch(/nenhum gestor disponível/i);
    expect(openURL).not.toHaveBeenCalled();
  });

  it('o botão SOS tem role button e rótulo "Acionar SOS"', async () => {
    const { getByLabelText } = await renderComGestor();

    const botao = getByLabelText('Acionar SOS');
    expect(botao.props.accessibilityRole).toBe('button');
  });
});
