import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useNovaEntrega } from '../useNovaEntrega';

const mockShowToast = jest.fn();
const mockHideToast = jest.fn();

let mockUnidadeAtivaState: {
  unidadeAtiva: string | null;
  unidadeAtivaData: any | null;
} = {
  unidadeAtiva: null,
  unidadeAtivaData: null,
};

let mockUserData: any = {
  id: 'user-1',
  unidades: { nome: 'Unidade Teste' },
};

const mockGoogleMapsService = {
  getDirections: jest.fn(),
  getDirectionsSequential: jest.fn(),
};

// Mock Photon service (migrado de Google para geocoding)
const mockPhotonService = {
  geocodeAddress: jest.fn(),
};

const mockOtimizarRotaComDependencias = jest.fn();
const mockValidarRotaParaOtimizacao = jest.fn();

jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: { visible: false, message: '', type: 'info' },
    showToast: mockShowToast,
    hideToast: mockHideToast,
  }),
}));

jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => mockUnidadeAtivaState,
}));

jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: mockUserData }),
}));

jest.mock('@/lib/google', () => ({
  googleMapsService: mockGoogleMapsService,
}));

jest.mock('@/lib/photon', () => ({
  photonService: mockPhotonService,
}));

jest.mock('@/lib/routeOptimization', () => ({
  otimizarRotaComDependencias: (...args: any[]) => mockOtimizarRotaComDependencias(...args),
  validarRotaParaOtimizacao: (...args: any[]) => mockValidarRotaParaOtimizacao(...args),
  MAX_WAYPOINTS: 3,
  WAYPOINTS_RECOMENDADO: 2,
}));

const createParadaData = (overrides: Partial<any> = {}) => ({
  endereco: 'Rua Teste, 123',
  tipo: 'entrega' as const,
  destinatario: 'Cliente Teste',
  telefone: '11999999999',
  observacoes: '',
  latitude: -7.1,
  longitude: -34.9,
  ...overrides,
});

const setUnidadeComCoordenadas = () => {
  mockUnidadeAtivaState = {
    unidadeAtiva: null,
    unidadeAtivaData: {
      sede_latitude: -7.1,
      sede_longitude: -34.9,
      sede_endereco: 'Rua Base',
      endereco: 'Rua Base',
      cidade: 'Cidade',
      uf: 'PB',
      cep: '58000-000',
      nome: 'Base',
    },
  };
};

describe('useNovaEntrega', () => {
  beforeEach(() => {
    mockShowToast.mockReset();
    mockHideToast.mockReset();
    mockPhotonService.geocodeAddress.mockReset();
    mockGoogleMapsService.getDirections.mockReset();
    mockGoogleMapsService.getDirectionsSequential.mockReset();
    mockOtimizarRotaComDependencias.mockReset();
    mockValidarRotaParaOtimizacao.mockReset();

    mockUnidadeAtivaState = { unidadeAtiva: null, unidadeAtivaData: null };
    mockUserData = { id: 'user-1', unidades: { nome: 'Unidade Teste' } };
    mockValidarRotaParaOtimizacao.mockReturnValue({ valido: true, avisos: [], erros: [] });
  });

  it('atualiza paradasStatus conforme quantidade', async () => {
    const { result } = renderHook(() => useNovaEntrega());

    await act(async () => {
      await result.current.onAddParada(createParadaData() as any);
    });
    await waitFor(() => expect(result.current.paradas.length).toBe(1));
    expect(result.current.paradasStatus.cor).toBe('default');

    await act(async () => {
      await result.current.onAddParada(createParadaData({ endereco: 'Rua 2' }) as any);
    });
    await waitFor(() => expect(result.current.paradas.length).toBe(2));
    expect(result.current.paradasStatus.cor).toBe('default');

    await act(async () => {
      await result.current.onAddParada(createParadaData({ endereco: 'Rua 3' }) as any);
    });
    await waitFor(() => expect(result.current.paradas.length).toBe(3));
    expect(result.current.paradasStatus.cor).toBe('warning');

    await act(async () => {
      await result.current.onAddParada(createParadaData({ endereco: 'Rua 4' }) as any);
    });
    await waitFor(() => expect(result.current.paradas.length).toBe(4));
    expect(result.current.paradasStatus.cor).toBe('error');
  });

  it('tenta geocodificar quando faltam coordenadas e falha', async () => {
    mockPhotonService.geocodeAddress.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useNovaEntrega());

    await act(async () => {
      await result.current.onAddParada({
        endereco: 'Rua Sem Coordenadas',
        tipo: 'entrega',
        destinatario: 'Cliente',
        telefone: '11999999999',
      } as any);
    });

    expect(result.current.paradas.length).toBe(0);
    expect(mockShowToast).toHaveBeenCalled();
  });

  it('adiciona parada vinculada e remove vinculo ao excluir retirada', async () => {
    const { result } = renderHook(() => useNovaEntrega());

    await act(async () => {
      await result.current.onAddParada(createParadaData({ tipo: 'retirada' }) as any);
    });
    await waitFor(() => expect(result.current.paradas.length).toBe(1));

    const retiradaId = result.current.paradas[0].id;

    await act(async () => {
      await result.current.onAddParada(createParadaData({ endereco: 'Rua Entrega' }) as any, retiradaId);
    });
    await waitFor(() => expect(result.current.paradas.length).toBe(2));

    const hasVinculoToast = mockShowToast.mock.calls.some((call) =>
      String(call[0]).includes('Entrega vinculada')
    );
    expect(hasVinculoToast).toBe(true);

    act(() => {
      result.current.removeParada(0);
    });

    await waitFor(() => expect(result.current.paradas.length).toBe(1));
    expect(result.current.paradas[0].vinculo_parada_id).toBeUndefined();
  });

  it('nao calcula distancia real sem endereco ou paradas', async () => {
    const { result } = renderHook(() => useNovaEntrega());

    await act(async () => {
      await result.current.calcularDistanciaReal();
    });

    expect(mockGoogleMapsService.getDirectionsSequential).not.toHaveBeenCalled();
  });

  it('informa quando nao ha paradas para otimizar', async () => {
    const { result } = renderHook(() => useNovaEntrega());

    await act(async () => {
      await result.current.otimizarRota();
    });

    const hasToast = mockShowToast.mock.calls.some((call) =>
      String(call[0]).includes('Adicione')
    );
    expect(hasToast).toBe(true);
  });

  it('informa quando falta endereco da unidade', async () => {
    const { result } = renderHook(() => useNovaEntrega());

    await act(async () => {
      await result.current.onAddParada(createParadaData() as any);
    });
    await waitFor(() => expect(result.current.paradas.length).toBe(1));

    await act(async () => {
      await result.current.otimizarRota();
    });

    const hasToast = mockShowToast.mock.calls.some((call) =>
      String(call[0]).includes('unidade')
    );
    expect(hasToast).toBe(true);
  });

  it('interrompe otimizacao quando validacao falha', async () => {
    setUnidadeComCoordenadas();
    mockValidarRotaParaOtimizacao.mockReturnValueOnce({
      valido: false,
      avisos: [],
      erros: ['Erro de validacao'],
    });

    const { result } = renderHook(() => useNovaEntrega());

    await waitFor(() => expect(result.current.enderecoUnidade).not.toBeNull());

    await act(async () => {
      await result.current.onAddParada(createParadaData({ endereco: 'Rua 1' }) as any);
    });
    await waitFor(() => expect(result.current.paradas.length).toBe(1));

    await act(async () => {
      await result.current.otimizarRota();
    });

    const hasErro = mockShowToast.mock.calls.some((call) =>
      String(call[0]).includes('Erro de validacao')
    );
    expect(hasErro).toBe(true);
    expect(mockGoogleMapsService.getDirections).not.toHaveBeenCalled();
  });

  it('otimiza rota com dependencias quando ha vinculos', async () => {
    setUnidadeComCoordenadas();
    mockValidarRotaParaOtimizacao.mockReturnValueOnce({
      valido: true,
      avisos: ['Aviso'],
      erros: [],
    });

    const { result } = renderHook(() => useNovaEntrega());

    await waitFor(() => expect(result.current.enderecoUnidade).not.toBeNull());

    await act(async () => {
      await result.current.onAddParada(createParadaData({ tipo: 'retirada' }) as any);
    });
    await waitFor(() => expect(result.current.paradas.length).toBe(1));

    const retiradaId = result.current.paradas[0].id;

    await act(async () => {
      await result.current.onAddParada(createParadaData({ endereco: 'Rua 2' }) as any, retiradaId);
    });
    await waitFor(() => expect(result.current.paradas.length).toBe(2));

    const [parada1, parada2] = result.current.paradas;

    mockOtimizarRotaComDependencias.mockResolvedValueOnce({
      paradasOrdenadas: [
        { id: parada2.id },
        { id: parada1.id },
      ],
      distanciaTotalMetros: 9000,
      duracaoTotalSegundos: 600,
      polyline: 'poly',
    });

    await act(async () => {
      await result.current.otimizarRota();
    });

    await waitFor(() => expect(result.current.rotaOtimizada).not.toBeNull());
    expect(result.current.rotaOtimizada?.distancia_total_metros).toBe(9000);
    expect(mockOtimizarRotaComDependencias).toHaveBeenCalled();

    const hasAviso = mockShowToast.mock.calls.some((call) =>
      String(call[0]).includes('Aviso')
    );
    expect(hasAviso).toBe(true);
  });
});
