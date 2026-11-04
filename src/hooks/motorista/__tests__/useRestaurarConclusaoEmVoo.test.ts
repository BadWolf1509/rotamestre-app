import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import {
  _resetTravaDeRestauracao,
  useRestaurarConclusaoEmVoo,
} from '../useRestaurarConclusaoEmVoo';

const mockLerConclusaoEmVoo = jest.fn();
const mockLimparConclusaoEmVoo = jest.fn();

jest.mock('@/lib/motorista/conclusaoEmVoo', () => ({
  lerConclusaoEmVoo: (...args: unknown[]) => mockLerConclusaoEmVoo(...args),
  limparConclusaoEmVoo: (...args: unknown[]) =>
    mockLimparConclusaoEmVoo(...args),
  // A decisão em si tem testes próprios em `conclusaoEmVoo.test.ts`; aqui
  // usamos a implementação real para o hook não passar por cima dela.
  paradaParaReabrir: jest.requireActual('@/lib/motorista/conclusaoEmVoo')
    .paradaParaReabrir,
}));

const ROTA = { id: 'rota-9', status: 'em_andamento' };
const PARADAS = [{ id: 'parada-1', status: 'pendente' }];
const MARCADOR = { paradaId: 'parada-1', rotaId: 'rota-9', em: 1_000 };

function comPlataforma(os: string, teste: () => Promise<void>) {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', {
    get: () => os,
    configurable: true,
  });
  return teste().finally(() => {
    Object.defineProperty(Platform, 'OS', {
      get: () => original,
      configurable: true,
    });
  });
}

describe('useRestaurarConclusaoEmVoo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetTravaDeRestauracao();
    mockLerConclusaoEmVoo.mockResolvedValue(null);
    mockLimparConclusaoEmVoo.mockResolvedValue(undefined);
  });

  it('reabre a parada do marcador', async () => {
    await comPlataforma('android', async () => {
      mockLerConclusaoEmVoo.mockResolvedValue(MARCADOR);
      const aoRestaurar = jest.fn();

      renderHook(() => useRestaurarConclusaoEmVoo(ROTA, PARADAS, aoRestaurar));

      await waitFor(() => {
        expect(aoRestaurar).toHaveBeenCalledWith(PARADAS[0]);
      });
      // Quem apaga o marcador é o CameraUpload, ao trocá-lo pela foto.
      expect(mockLimparConclusaoEmVoo).not.toHaveBeenCalled();
    });
  });

  it('duas telas montadas não reabrem o mesmo marcador duas vezes', async () => {
    // Início e Paradas concluem parada; sem a trava de módulo, as duas
    // abririam o modal para a mesma foto.
    await comPlataforma('android', async () => {
      mockLerConclusaoEmVoo.mockResolvedValue(MARCADOR);
      const telaA = jest.fn();
      const telaB = jest.fn();

      renderHook(() => useRestaurarConclusaoEmVoo(ROTA, PARADAS, telaA));
      renderHook(() => useRestaurarConclusaoEmVoo(ROTA, PARADAS, telaB));

      await waitFor(() => {
        expect(telaA).toHaveBeenCalledTimes(1);
      });
      expect(telaB).not.toHaveBeenCalled();
    });
  });

  it('uma segunda interrupção volta a ser restaurável', async () => {
    // A trava é por marcador, não por sessão: marcador novo (outro instante)
    // tem de passar, senão a segunda foto do dia se perde.
    await comPlataforma('android', async () => {
      mockLerConclusaoEmVoo.mockResolvedValue(MARCADOR);
      const aoRestaurar = jest.fn();

      const primeira = renderHook(() =>
        useRestaurarConclusaoEmVoo(ROTA, PARADAS, aoRestaurar),
      );
      await waitFor(() => expect(aoRestaurar).toHaveBeenCalledTimes(1));
      primeira.unmount();

      mockLerConclusaoEmVoo.mockResolvedValue({ ...MARCADOR, em: 2_000 });
      renderHook(() => useRestaurarConclusaoEmVoo(ROTA, PARADAS, aoRestaurar));

      await waitFor(() => expect(aoRestaurar).toHaveBeenCalledTimes(2));
    });
  });

  it('não reabre quando as paradas mudam com a câmera de outra tela aberta', async () => {
    // A Início fica montada por trás das abas. Quando a aba Paradas abre a
    // câmera, o marcador passa a existir; se a rota recarregar antes de a
    // câmera responder, a Início reabria a mesma parada num segundo modal,
    // que reaparecia depois de a conclusão terminar.
    await comPlataforma('android', async () => {
      const aoRestaurar = jest.fn();
      const tela = renderHook(
        ({ paradas }) => useRestaurarConclusaoEmVoo(ROTA, paradas, aoRestaurar),
        { initialProps: { paradas: PARADAS } },
      );
      await waitFor(() => expect(mockLerConclusaoEmVoo).toHaveBeenCalled());

      mockLerConclusaoEmVoo.mockResolvedValue(MARCADOR);
      tela.rerender({ paradas: [{ id: 'parada-1', status: 'em_andamento' }] });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(aoRestaurar).not.toHaveBeenCalled();
    });
  });

  it('confere o marcador quando a rota chega depois da montagem', async () => {
    // Na recriação da Activity a tela remonta antes de a rota carregar: a
    // primeira conferência tem de esperar rota e paradas.
    await comPlataforma('android', async () => {
      mockLerConclusaoEmVoo.mockResolvedValue(MARCADOR);
      const aoRestaurar = jest.fn();
      const tela = renderHook(
        ({ rota }: { rota: typeof ROTA | null }) =>
          useRestaurarConclusaoEmVoo(rota, PARADAS, aoRestaurar),
        { initialProps: { rota: null as typeof ROTA | null } },
      );

      tela.rerender({ rota: ROTA });

      await waitFor(() => {
        expect(aoRestaurar).toHaveBeenCalledWith(PARADAS[0]);
      });
    });
  });

  it('reabre mesmo se as paradas mudarem no meio da conferência', async () => {
    // Depois da recriação entra primeiro o retrato guardado e logo a resposta
    // da rede: a única conferência não pode se perder nessa troca.
    await comPlataforma('android', async () => {
      let entregarMarcador: (m: typeof MARCADOR) => void = () => {};
      mockLerConclusaoEmVoo.mockReturnValue(
        new Promise((resolve) => {
          entregarMarcador = resolve;
        }),
      );
      const aoRestaurar = jest.fn();
      const tela = renderHook(
        ({ paradas }) => useRestaurarConclusaoEmVoo(ROTA, paradas, aoRestaurar),
        { initialProps: { paradas: PARADAS } },
      );

      tela.rerender({ paradas: [{ id: 'parada-1', status: 'pendente' }] });
      entregarMarcador(MARCADOR);

      await waitFor(() => {
        expect(aoRestaurar).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('apaga marcador que perdeu o sentido e não reabre nada', async () => {
    await comPlataforma('android', async () => {
      mockLerConclusaoEmVoo.mockResolvedValue(MARCADOR);
      const aoRestaurar = jest.fn();
      const jaConcluida = [{ id: 'parada-1', status: 'concluida' }];

      renderHook(() =>
        useRestaurarConclusaoEmVoo(ROTA, jaConcluida, aoRestaurar),
      );

      await waitFor(() => {
        expect(mockLimparConclusaoEmVoo).toHaveBeenCalled();
      });
      expect(aoRestaurar).not.toHaveBeenCalled();
    });
  });

  it('não faz nada sem rota carregada', async () => {
    await comPlataforma('android', async () => {
      mockLerConclusaoEmVoo.mockResolvedValue(MARCADOR);
      const aoRestaurar = jest.fn();

      renderHook(() => useRestaurarConclusaoEmVoo(null, PARADAS, aoRestaurar));

      // Nem chega a ler: sem rota não há como julgar o marcador.
      expect(mockLerConclusaoEmVoo).not.toHaveBeenCalled();
      expect(aoRestaurar).not.toHaveBeenCalled();
    });
  });

  it('não roda fora do Android', async () => {
    // `getPendingResultAsync` é Android-only e o bug é da recriação de
    // Activity; no iOS/web não há o que restaurar.
    await comPlataforma('ios', async () => {
      mockLerConclusaoEmVoo.mockResolvedValue(MARCADOR);
      const aoRestaurar = jest.fn();

      renderHook(() => useRestaurarConclusaoEmVoo(ROTA, PARADAS, aoRestaurar));

      expect(mockLerConclusaoEmVoo).not.toHaveBeenCalled();
      expect(aoRestaurar).not.toHaveBeenCalled();
    });
  });
});
