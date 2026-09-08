/**
 * Testes da tela de SOS, com foco no que ela promete ao motorista.
 *
 * POR QUE EXISTEM. A tela dizia "Isso vai notificar seu gestor e registrar sua
 * localização atual" na confirmação — incondicionalmente — e "Seu gestor foi
 * notificado da emergência" no sucesso, também incondicionalmente. O bloco que
 * anexa a coordenada é um `if (location)`. Ou seja: sem permissão, ou com o GPS
 * ainda sem fix, o motorista em emergência era informado de que sua localização
 * tinha sido registrada quando nada tinha sido. O gestor recebia o incidente
 * sem coordenada e ninguém sabia.
 *
 * O caso provável não é a permissão negada — é o GPS frio.
 * `getCurrentPositionAsync` com `High` roda uma vez na montagem e costuma
 * demorar ou falhar nos primeiros segundos, que é exatamente quando alguém
 * abre a tela de SOS.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import SOSScreen from '../sos';

const mockRequestForegroundPermissionsAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();
const mockWatchPositionAsync = jest.fn();

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...a: unknown[]) =>
    mockRequestForegroundPermissionsAsync(...a),
  getCurrentPositionAsync: (...a: unknown[]) =>
    mockGetCurrentPositionAsync(...a),
  watchPositionAsync: (...a: unknown[]) => mockWatchPositionAsync(...a),
  Accuracy: { Balanced: 3, High: 4, BestForNavigation: 6 },
}));

const mockInsert = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ insert: (...a: unknown[]) => mockInsert(...a) }) },
}));

jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'motorista-1', nome: 'Teste' } }),
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

const COORDS = { coords: { latitude: -23.5505, longitude: -46.6333 } };

/** Aciona o SOS e devolve o que foi passado ao diálogo de confirmação. */
async function acionarSOS(getByText: (t: string) => unknown) {
  fireEvent.press(getByText('ACIONAR SOS') as never);
  await waitFor(() => {
    expect(global.mockUseAlert.showConfirm).toHaveBeenCalled();
  });
  return (global.mockUseAlert.showConfirm as jest.Mock).mock.calls[0][0];
}

describe('tela de SOS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });
    mockGetCurrentPositionAsync.mockResolvedValue(COORDS);
    mockWatchPositionAsync.mockResolvedValue({ remove: jest.fn() });
    mockInsert.mockResolvedValue({ error: null });
    global.mockUseAlert.showConfirm.mockResolvedValue(true);
  });

  describe('quando NÃO há localização', () => {
    beforeEach(() => {
      // GPS frio: a permissão existe, o fix não vem.
      mockGetCurrentPositionAsync.mockRejectedValue(new Error('sem fix'));
    });

    it('a confirmação avisa que o gestor não saberá onde o motorista está', async () => {
      const { getByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      const opcoes = await acionarSOS(getByText);

      // A mentira antiga era prometer "registrar sua localização atual" aqui.
      expect(opcoes.message).not.toMatch(/registrar sua localização atual/i);
      expect(opcoes.message).toMatch(/sem sua localização/i);
    });

    it('o subtítulo do botão não promete enviar o que não existe', async () => {
      const { getByText, queryByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      // O subtítulo era FIXO e prometia "enviar sua localização" na mesma tela
      // que já mostrava "o gestor não vai saber onde você está". O #492 tinha
      // corrigido o diálogo e deixado esta linha para trás.
      await waitFor(() =>
        expect(
          queryByText(
            /Toque para notificar seu gestor e enviar sua localização/i,
          ),
        ).toBeNull(),
      );
      expect(getByText(/descreva onde você está/i)).toBeTruthy();
    });

    it('o sucesso diz que foi enviado sem localização', async () => {
      const { getByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      await acionarSOS(getByText);

      await waitFor(() => {
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalled();
      });
      const [titulo, corpo] = (global.mockUseAlert.showSuccess as jest.Mock)
        .mock.calls[0];
      expect(`${titulo} ${corpo}`).toMatch(/sem (a sua |sua )?localização/i);
    });

    it('envia o SOS mesmo assim — emergência nunca é bloqueada por GPS', async () => {
      const { getByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      await acionarSOS(getByText);

      await waitFor(() => expect(mockInsert).toHaveBeenCalled());
      const payload = mockInsert.mock.calls[0][0];
      expect(payload.evento).toBe('sos_acionado');
      // E não inventa coordenada que não existe.
      expect(payload.detalhes.localizacao).toBeUndefined();
    });
  });

  describe('quando HÁ localização', () => {
    it('a confirmação mantém a promessa, porque agora ela é verdadeira', async () => {
      const { getByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      const opcoes = await acionarSOS(getByText);

      expect(opcoes.message).toMatch(/localização/i);
      expect(opcoes.message).not.toMatch(/sem sua localização/i);
    });

    it('o subtítulo do botão promete a localização, porque agora ela existe', async () => {
      const { getByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      await waitFor(() =>
        expect(
          getByText(
            /Toque para notificar seu gestor e enviar sua localização/i,
          ),
        ).toBeTruthy(),
      );
    });

    it('a coordenada vai no payload', async () => {
      const { getByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      await acionarSOS(getByText);

      await waitFor(() => expect(mockInsert).toHaveBeenCalled());
      expect(mockInsert.mock.calls[0][0].detalhes.localizacao).toEqual(
        expect.objectContaining({
          latitude: COORDS.coords.latitude,
          longitude: COORDS.coords.longitude,
        }),
      );
    });
  });

  describe('quando a permissão é negada', () => {
    beforeEach(() => {
      mockRequestForegroundPermissionsAsync.mockResolvedValue({
        status: 'denied',
        canAskAgain: false,
      });
    });

    it('não chama getCurrentPositionAsync', async () => {
      render(<SOSScreen />);
      await waitFor(() =>
        expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalled(),
      );
      expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it('a confirmação avisa que vai sem localização', async () => {
      const { getByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalled(),
      );

      const opcoes = await acionarSOS(getByText);

      expect(opcoes.message).toMatch(/sem sua localização/i);
    });
  });

  describe('o watcher que preenche a localização atrasada', () => {
    it('fica ativo enquanto falta coordenada', async () => {
      mockGetCurrentPositionAsync.mockRejectedValue(new Error('sem fix'));
      render(<SOSScreen />);

      // O GPS frio é o caso provável: o one-shot falha e o watcher assume,
      // preenchendo assim que o fix chegar.
      await waitFor(() => expect(mockWatchPositionAsync).toHaveBeenCalled());
    });

    it('não é criado quando o one-shot já resolveu', async () => {
      render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      expect(mockWatchPositionAsync).not.toHaveBeenCalled();
    });
  });
});
