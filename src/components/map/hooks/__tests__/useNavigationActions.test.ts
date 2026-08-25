import { act, renderHook } from '@testing-library/react-native';

import { showNavigationOptions } from '@/utils/navigation';

import { useNavigationActions } from '../useNavigationActions';

// showNavigationOptions mocked below
jest.mock('@/utils/navigation', () => ({
  showNavigationOptions: jest.fn(),
}));

const makeCameraRef = () => ({
  current: { fitBounds: jest.fn() },
});

const pendente = {
  id: 'p1',
  endereco: 'Rua A, 100',
  latitude: -23.55,
  longitude: -46.63,
  status: 'pendente',
  ordem: 1,
  is_checkpoint: false,
};

const concluida = {
  id: 'p2',
  endereco: 'Rua B, 200',
  latitude: -23.56,
  longitude: -46.64,
  status: 'concluida',
  ordem: 2,
  is_checkpoint: false,
};

describe('useNavigationActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('proximaParadaPendente is undefined when no pending paradas', () => {
    const cameraRef = makeCameraRef();
    const { result } = renderHook(() =>
      useNavigationActions(
        [concluida] as any,
        [concluida] as any,
        cameraRef as any,
      ),
    );
    expect(result.current.proximaParadaPendente).toBeUndefined();
  });

  it('proximaParadaPendente returns first pending parada by ordem', () => {
    const cameraRef = makeCameraRef();
    const parada2 = { ...pendente, id: 'p3', ordem: 0 };
    const { result } = renderHook(() =>
      useNavigationActions(
        [pendente, parada2] as any,
        [pendente, parada2] as any,
        cameraRef as any,
      ),
    );
    expect(result.current.proximaParadaPendente?.id).toBe('p3');
  });

  it('handleNavigate shows warning when no pending paradas', () => {
    const cameraRef = makeCameraRef();
    const { result } = renderHook(() =>
      useNavigationActions([], [], cameraRef as any),
    );
    act(() => {
      result.current.handleNavigate();
    });
    expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith(
      'Nenhuma parada',
      expect.any(String),
    );
    expect(showNavigationOptions).not.toHaveBeenCalled();
  });

  it('handleNavigate calls showNavigationOptions when pending parada exists', () => {
    const cameraRef = makeCameraRef();
    const { result } = renderHook(() =>
      useNavigationActions(
        [pendente] as any,
        [pendente] as any,
        cameraRef as any,
      ),
    );
    act(() => {
      result.current.handleNavigate();
    });
    expect(showNavigationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: pendente.latitude,
        longitude: pendente.longitude,
      }),
    );
  });

  it('handleFitAll calls cameraRef.fitBounds when paradas exist', () => {
    const cameraRef = makeCameraRef();
    const { result } = renderHook(() =>
      useNavigationActions(
        [pendente] as any,
        [pendente] as any,
        cameraRef as any,
      ),
    );
    act(() => {
      result.current.handleFitAll();
    });
    expect(cameraRef.current.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('afasta o enquadramento da coluna de FABs', () => {
    // Regressao: o padding era `right: 50`, menor que a coluna de botoes que
    // flutua sobre o canto inferior direito do mapa, entao marcadores perto da
    // borda direita nasciam ATRAS dos botoes (visto em aparelho no build 3026).
    // A coluna tem a largura do maior FAB (spacing['14'] = 56) e encosta a
    // spacing['4'] = 16 da borda.
    const LARGURA_COLUNA = 56;
    const FOLGA = 16;

    const cameraRef = makeCameraRef();
    const { result } = renderHook(() =>
      useNavigationActions(
        [pendente] as any,
        [pendente] as any,
        cameraRef as any,
      ),
    );
    act(() => {
      result.current.handleFitAll();
    });

    const { padding } = (cameraRef.current.fitBounds as jest.Mock).mock
      .calls[0][1];

    expect(Number.isFinite(padding.right)).toBe(true);
    expect(padding.right).toBeGreaterThanOrEqual(LARGURA_COLUNA + FOLGA);
    expect(padding.bottom).toBeGreaterThanOrEqual(LARGURA_COLUNA + FOLGA);
  });
});
