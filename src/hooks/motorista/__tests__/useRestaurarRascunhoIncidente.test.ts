import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import {
  _resetTravaDeRestauracaoIncidente,
  useRestaurarRascunhoIncidente,
} from '../useRestaurarRascunhoIncidente';

const mockLerRascunho = jest.fn();
const mockLimparRascunho = jest.fn();

jest.mock('@/lib/motorista/rascunhoIncidente', () => ({
  lerRascunhoIncidente: (...args: unknown[]) => mockLerRascunho(...args),
  limparRascunhoIncidente: (...args: unknown[]) => mockLimparRascunho(...args),
}));

const ROTA = { id: 'rota-9' };
const PARADAS = [{ id: 'parada-1' }, { id: 'parada-2' }];
const RASCUNHO = {
  paradaId: 'parada-1',
  rotaId: 'rota-9',
  passo: 2,
  categoria: 'blocked',
  descricao: 'portao fechado',
  fotoUri: '',
  cameraAberta: true,
  em: 1_000,
};

function comPlataforma(os: string, teste: () => Promise<void>) {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
  return teste().finally(() => {
    Object.defineProperty(Platform, 'OS', {
      get: () => original,
      configurable: true,
    });
  });
}

describe('useRestaurarRascunhoIncidente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetTravaDeRestauracaoIncidente();
    mockLerRascunho.mockResolvedValue(null);
    mockLimparRascunho.mockResolvedValue(undefined);
  });

  it('reabre o wizard na parada do rascunho', async () => {
    // Sem isto o rascunho fica salvo e ninguém o busca: depois da recriação o
    // app volta para a Início, o wizard não monta, e o efeito de restauração
    // que vive DENTRO dele nunca roda. Medido no aparelho em 05/09/2026.
    await comPlataforma('android', async () => {
      mockLerRascunho.mockResolvedValue(RASCUNHO);
      const aoRestaurar = jest.fn();

      renderHook(() =>
        useRestaurarRascunhoIncidente(ROTA, PARADAS, aoRestaurar),
      );

      await waitFor(() => {
        expect(aoRestaurar).toHaveBeenCalledWith(PARADAS[0]);
      });
      // Quem consome o rascunho é o próprio wizard, ao montar.
      expect(mockLimparRascunho).not.toHaveBeenCalled();
    });
  });

  it('não reabre duas vezes o mesmo rascunho', async () => {
    // Início e Paradas montam o wizard; sem trava, as duas reabririam.
    await comPlataforma('android', async () => {
      mockLerRascunho.mockResolvedValue(RASCUNHO);
      const telaA = jest.fn();
      const telaB = jest.fn();

      renderHook(() => useRestaurarRascunhoIncidente(ROTA, PARADAS, telaA));
      renderHook(() => useRestaurarRascunhoIncidente(ROTA, PARADAS, telaB));

      await waitFor(() => expect(telaA).toHaveBeenCalledTimes(1));
      expect(telaB).not.toHaveBeenCalled();
    });
  });

  it('apaga rascunho de outra rota e não reabre', async () => {
    await comPlataforma('android', async () => {
      mockLerRascunho.mockResolvedValue({ ...RASCUNHO, rotaId: 'outra' });
      const aoRestaurar = jest.fn();

      renderHook(() =>
        useRestaurarRascunhoIncidente(ROTA, PARADAS, aoRestaurar),
      );

      await waitFor(() => expect(mockLimparRascunho).toHaveBeenCalled());
      expect(aoRestaurar).not.toHaveBeenCalled();
    });
  });

  it('apaga rascunho de parada que sumiu da rota', async () => {
    await comPlataforma('android', async () => {
      mockLerRascunho.mockResolvedValue(RASCUNHO);
      const aoRestaurar = jest.fn();

      renderHook(() =>
        useRestaurarRascunhoIncidente(ROTA, [PARADAS[1]], aoRestaurar),
      );

      await waitFor(() => expect(mockLimparRascunho).toHaveBeenCalled());
      expect(aoRestaurar).not.toHaveBeenCalled();
    });
  });

  it('não roda fora do Android', async () => {
    await comPlataforma('ios', async () => {
      mockLerRascunho.mockResolvedValue(RASCUNHO);
      const aoRestaurar = jest.fn();

      renderHook(() =>
        useRestaurarRascunhoIncidente(ROTA, PARADAS, aoRestaurar),
      );

      expect(mockLerRascunho).not.toHaveBeenCalled();
      expect(aoRestaurar).not.toHaveBeenCalled();
    });
  });
});
