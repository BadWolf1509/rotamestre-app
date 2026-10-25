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
import { StyleSheet } from 'react-native';

import SOSScreen from '../sos';

const mockRequestForegroundPermissionsAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();
const mockWatchPositionAsync = jest.fn();

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...a: unknown[]) =>
    mockRequestForegroundPermissionsAsync(...a),
  // Consulta antes de pedir (#570): 'undetermined' mantém o pedido exercitado.
  getForegroundPermissionsAsync: () =>
    Promise.resolve({ status: 'undetermined', canAskAgain: true }),
  getCurrentPositionAsync: (...a: unknown[]) =>
    mockGetCurrentPositionAsync(...a),
  watchPositionAsync: (...a: unknown[]) => mockWatchPositionAsync(...a),
  Accuracy: { Balanced: 3, High: 4, BestForNavigation: 6 },
}));

const mockInsert = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: (...a: unknown[]) => mockInsert(...a) }),
    rpc: (...a: unknown[]) => mockRpc(...a),
  },
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
    // registrar_sos (Migration 46) devolve quantos gestores foram avisados.
    mockRpc.mockResolvedValue({ data: 1, error: null });
    global.mockUseAlert.showConfirm.mockResolvedValue(true);
  });

  it('a confirmação usa o ícone de alerta, não a lixeira do danger', async () => {
    const { getByText } = render(<SOSScreen />);
    await waitFor(() => expect(mockGetCurrentPositionAsync).toHaveBeenCalled());

    const opcoes = await acionarSOS(getByText);

    // Sem `icon`, `type: 'danger'` desenha a lixeira (ICON_MAP.danger).
    expect(opcoes.type).toBe('danger');
    expect(opcoes.icon).toBe('alert-circle-outline');
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

      await waitFor(() => expect(mockRpc).toHaveBeenCalled());
      const [nome, args] = mockRpc.mock.calls[0];
      expect(nome).toBe('registrar_sos');
      // E não inventa coordenada que não existe.
      expect(args.p_detalhes.localizacao).toBeUndefined();
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

      await waitFor(() => expect(mockRpc).toHaveBeenCalled());
      expect(mockRpc.mock.calls[0][1].p_detalhes.localizacao).toEqual(
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

  /**
   * B1 (1.14.6): sem rota, o gatilho só achava a loja pelo vínculo principal —
   * 1 de 11 vínculos ativos de motorista tinha a marca — e ninguém era avisado.
   * A tela dizia "Seu gestor foi notificado" do mesmo jeito. Agora o servidor
   * devolve quantos gestores receberam, e a tela só promete o que aconteceu.
   */
  describe('quantos gestores receberam o SOS', () => {
    /** O que os diálogos disseram ao motorista. */
    function textoDosDialogos() {
      return JSON.stringify([
        ...(global.mockUseAlert.showSuccess as jest.Mock).mock.calls,
        ...(global.mockUseAlert.showWarning as jest.Mock).mock.calls,
        ...(global.mockUseAlert.showError as jest.Mock).mock.calls,
      ]);
    }

    it('manda a descrição e a rota (ou null) para registrar_sos', async () => {
      const { getByText, getByPlaceholderText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );
      fireEvent.changeText(
        getByPlaceholderText(/Pneu furado/i),
        'Pneu furado na BR',
      );

      await acionarSOS(getByText);

      await waitFor(() => expect(mockRpc).toHaveBeenCalled());
      const [nome, args] = mockRpc.mock.calls[0];
      expect(nome).toBe('registrar_sos');
      expect(args.p_detalhes.descricao).toBe('Pneu furado na BR');
      expect(args.p_rota_id).toBeNull();
      // O log sai pela RPC, não por INSERT direto (que não diz quem recebeu).
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('com 1 ou mais gestores avisados, mantém a mensagem atual', async () => {
      mockRpc.mockResolvedValue({ data: 2, error: null });
      const { getByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      await acionarSOS(getByText);

      await waitFor(() =>
        expect(global.mockUseAlert.showSuccess).toHaveBeenCalled(),
      );
      const [titulo, corpo] = (global.mockUseAlert.showSuccess as jest.Mock)
        .mock.calls[0];
      expect(titulo).toBe('SOS Enviado');
      expect(corpo).toMatch(/Seu gestor foi notificado da emergência/);
    });

    it('com 0 gestores avisados, nunca diz "notificado" e diz que ninguém recebeu', async () => {
      mockRpc.mockResolvedValue({ data: 0, error: null });
      const { getByText, findByText, queryByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      await acionarSOS(getByText);

      await waitFor(() =>
        expect(global.mockUseAlert.showWarning).toHaveBeenCalled(),
      );
      expect(global.mockUseAlert.showSuccess).not.toHaveBeenCalled();
      const [titulo, corpo] = (global.mockUseAlert.showWarning as jest.Mock)
        .mock.calls[0];
      expect(`${titulo} ${corpo}`).toMatch(/nenhum gestor recebeu/i);
      expect(textoDosDialogos()).not.toMatch(/notificad/i);

      // Os botões de ligar ganham destaque: o aviso fica na tela, junto deles.
      expect(await findByText(/Nenhum gestor recebeu o seu SOS/i)).toBeTruthy();
      expect(queryByText(/notificad/i)).toBeNull();
    });

    it('com 0 gestores e sem localização, também nunca diz "notificado"', async () => {
      mockGetCurrentPositionAsync.mockRejectedValue(new Error('sem fix'));
      mockRpc.mockResolvedValue({ data: 0, error: null });
      const { getByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      await acionarSOS(getByText);

      await waitFor(() =>
        expect(global.mockUseAlert.showWarning).toHaveBeenCalled(),
      );
      expect(global.mockUseAlert.showSuccess).not.toHaveBeenCalled();
      const [titulo, corpo] = (global.mockUseAlert.showWarning as jest.Mock)
        .mock.calls[0];
      expect(`${titulo} ${corpo}`).toMatch(/nenhum gestor recebeu/i);
      expect(textoDosDialogos()).not.toMatch(/notificad/i);
    });

    it('sem a RPC no servidor, registra pelo INSERT antigo e não promete aviso', async () => {
      // App publicado antes da Migration 46: o SOS não pode se perder.
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function' },
      });
      const { getByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      await acionarSOS(getByText);

      await waitFor(() => expect(mockInsert).toHaveBeenCalled());
      expect(mockInsert.mock.calls[0][0].evento).toBe('sos_acionado');
      await waitFor(() =>
        expect(global.mockUseAlert.showWarning).toHaveBeenCalled(),
      );
      expect(global.mockUseAlert.showSuccess).not.toHaveBeenCalled();
      const [titulo, corpo] = (global.mockUseAlert.showWarning as jest.Mock)
        .mock.calls[0];
      expect(`${titulo} ${corpo}`).toMatch(/não foi possível confirmar/i);
      expect(textoDosDialogos()).not.toMatch(/notificad/i);
    });

    it('outro erro da RPC vira o erro de envio, sem INSERT duplicado', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'sem permissão' },
      });
      const { getByText } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );

      await acionarSOS(getByText);

      await waitFor(() =>
        expect(global.mockUseAlert.showError).toHaveBeenCalled(),
      );
      expect(mockInsert).not.toHaveBeenCalled();
      expect(global.mockUseAlert.showSuccess).not.toHaveBeenCalled();
    });

    it('RPC rejeitada (sem rede): diz que não confirmou o envio e destaca os botões', async () => {
      mockRpc.mockRejectedValue(new TypeError('Network request failed'));
      const { getByText, findByText, getByTestId } = render(<SOSScreen />);
      await waitFor(() =>
        expect(mockGetCurrentPositionAsync).toHaveBeenCalled(),
      );
      const destaqueAntes = StyleSheet.flatten(
        getByTestId('contato-emergencia-policia').props.style,
      ).borderWidth;

      await acionarSOS(getByText);

      await waitFor(() =>
        expect(global.mockUseAlert.showError).toHaveBeenCalled(),
      );
      const { title, message } = (global.mockUseAlert.showError as jest.Mock)
        .mock.calls[0][0];
      expect(`${title} ${message}`).toMatch(
        /não foi possível confirmar o envio/i,
      );
      expect(textoDosDialogos()).not.toMatch(/notificad/i);

      // A faixa sobre os botões, e os botões destacados, como com 0 gestores.
      expect(
        await findByText(/Não foi possível confirmar o envio do seu SOS/i),
      ).toBeTruthy();
      for (const id of ['gestor', 'policia', 'samu', 'bombeiros']) {
        const estilo = StyleSheet.flatten(
          getByTestId(`contato-emergencia-${id}`).props.style,
        );
        expect(estilo.borderWidth).toBe(2);
        expect(estilo.borderWidth).not.toBe(destaqueAntes);
      }
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
