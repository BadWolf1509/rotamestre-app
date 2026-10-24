import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';

import type { RouteData } from '@/context/route-status/types';

import { useGarantirRastreamentoDaRota } from '../useGarantirRastreamentoDaRota';

jest.mock('@/lib/logger');

const mockGarantir = jest.fn();
const mockRequestAndStart = jest.fn();
const mockGetContexto = jest.fn();
const mockTaskAtiva = jest.fn();
const mockParar = jest.fn();
jest.mock('@/services/unifiedLocationTracking', () => ({
  garantirRastreamentoDaRota: (...args: unknown[]) => mockGarantir(...args),
  requestAndStartTracking: (...args: unknown[]) => mockRequestAndStart(...args),
  getTrackingContext: () => mockGetContexto(),
  isBackgroundTrackingActive: () => mockTaskAtiva(),
  stopBackgroundTracking: () => mockParar(),
}));

const mockLerSessao = jest.fn();
jest.mock('@/lib/auth/sessao', () => ({
  lerSessao: () => mockLerSessao(),
}));

let ouvintesAppState: Array<(estado: string) => void> = [];

function voltarAoPrimeiroPlano() {
  act(() => {
    ouvintesAppState.forEach((cb) => cb('active'));
  });
}

const rotaEmAndamento: RouteData = {
  id: 'rota-1',
  unidade_id: 'unidade-1',
  unidade_nome: 'Loja',
  status: 'em_andamento',
  iniciada_em: '2026-10-21T11:00:00Z',
};
const motorista = { id: 'motorista-1', nome: 'Ana' };

describe('useGarantirRastreamentoDaRota', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ouvintesAppState = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _tipo: string,
      cb: (estado: string) => void,
    ) => {
      ouvintesAppState.push(cb);
      return {
        remove: () => {
          ouvintesAppState = ouvintesAppState.filter((f) => f !== cb);
        },
      };
    }) as unknown as typeof AppState.addEventListener);
    mockGarantir.mockResolvedValue('ativo');
    mockRequestAndStart.mockResolvedValue({
      started: true,
      hasBackgroundPermission: true,
    });
    mockGetContexto.mockResolvedValue(null);
    mockTaskAtiva.mockResolvedValue(false);
    mockParar.mockResolvedValue(undefined);
    mockLerSessao.mockResolvedValue({
      session: { user: { id: 'motorista-1' } },
      offline: false,
    });
  });

  it('garante o rastreamento ao abrir com rota própria em andamento', async () => {
    renderHook(() =>
      useGarantirRastreamentoDaRota({
        route: rotaEmAndamento,
        motorista,
        cargaConfirmada: true,
      }),
    );

    await waitFor(() => expect(mockGarantir).toHaveBeenCalledTimes(1));
    expect(mockGarantir).toHaveBeenCalledWith({
      rotaId: 'rota-1',
      motoristaId: 'motorista-1',
      motoristaNome: 'Ana',
      startedAt: '2026-10-21T11:00:00Z',
    });
  });

  it('não faz nada com rota pendente', async () => {
    renderHook(() =>
      useGarantirRastreamentoDaRota({
        route: { ...rotaEmAndamento, status: 'pendente' },
        motorista,
        cargaConfirmada: true,
      }),
    );
    voltarAoPrimeiroPlano();

    await new Promise((r) => setTimeout(r, 0));
    expect(mockGarantir).not.toHaveBeenCalled();
  });

  it('não faz nada na web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');

    renderHook(() =>
      useGarantirRastreamentoDaRota({
        route: rotaEmAndamento,
        motorista,
        cargaConfirmada: true,
      }),
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(mockGarantir).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('confere de novo quando o app volta ao primeiro plano', async () => {
    renderHook(() =>
      useGarantirRastreamentoDaRota({
        route: rotaEmAndamento,
        motorista,
        cargaConfirmada: true,
      }),
    );
    await waitFor(() => expect(mockGarantir).toHaveBeenCalledTimes(1));

    voltarAoPrimeiroPlano();

    await waitFor(() => expect(mockGarantir).toHaveBeenCalledTimes(2));
  });

  it('mostra o aviso quando falta a permissão de segundo plano, sem pedir', async () => {
    mockGarantir.mockResolvedValue('sem-segundo-plano');

    const { result } = renderHook(() =>
      useGarantirRastreamentoDaRota({
        route: rotaEmAndamento,
        motorista,
        cargaConfirmada: true,
      }),
    );

    await waitFor(() => expect(result.current.avisoVisivel).toBe(true));
    expect(mockRequestAndStart).not.toHaveBeenCalled();
  });

  it('o aviso leva ao fluxo com a divulgação e some quando o rastreamento liga', async () => {
    mockGarantir.mockResolvedValueOnce('sem-segundo-plano');
    const { result } = renderHook(() =>
      useGarantirRastreamentoDaRota({
        route: rotaEmAndamento,
        motorista,
        cargaConfirmada: true,
      }),
    );
    await waitFor(() => expect(result.current.avisoVisivel).toBe(true));

    mockGarantir.mockResolvedValue('ativo');
    await act(async () => {
      await result.current.ativar();
    });

    expect(mockRequestAndStart).toHaveBeenCalledWith(
      expect.objectContaining({ rotaId: 'rota-1', motoristaId: 'motorista-1' }),
    );
    expect(result.current.avisoVisivel).toBe(false);
  });

  it('dispensar é definitivo enquanto o app vive', async () => {
    mockGarantir.mockResolvedValue('sem-segundo-plano');
    const { result } = renderHook(() =>
      useGarantirRastreamentoDaRota({
        route: rotaEmAndamento,
        motorista,
        cargaConfirmada: true,
      }),
    );
    await waitFor(() => expect(result.current.avisoVisivel).toBe(true));

    act(() => result.current.dispensar());
    voltarAoPrimeiroPlano();

    await waitFor(() => expect(mockGarantir).toHaveBeenCalledTimes(2));
    // Deixa a segunda conferência terminar antes de olhar o aviso.
    await act(async () => {});
    expect(result.current.avisoVisivel).toBe(false);
  });

  it('não sobrepõe duas conferências ao mesmo tempo', async () => {
    let liberar: (v: string) => void = () => {};
    mockGarantir.mockImplementationOnce(
      () => new Promise((resolve) => (liberar = resolve)),
    );
    renderHook(() =>
      useGarantirRastreamentoDaRota({
        route: rotaEmAndamento,
        motorista,
        cargaConfirmada: true,
      }),
    );
    await waitFor(() => expect(mockGarantir).toHaveBeenCalledTimes(1));

    voltarAoPrimeiroPlano();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGarantir).toHaveBeenCalledTimes(1);

    await act(async () => liberar('ativo'));
  });
  // MOT-1: a rota pode acabar fora deste aparelho (web, outro aparelho,
  // expiração, reatribuição). Sem isto a task seguia gravando por horas.
  describe('desliga o rastreamento fora da rota em andamento', () => {
    const contextoGravado = {
      rotaId: 'rota-1',
      motoristaId: 'motorista-1',
      motoristaNome: 'Ana',
      startedAt: '2026-10-21T11:00:00Z',
    };

    it('para quando a rota carregada já está concluída', async () => {
      mockGetContexto.mockResolvedValue(contextoGravado);

      renderHook(() =>
        useGarantirRastreamentoDaRota({
          route: { ...rotaEmAndamento, status: 'concluida' },
          motorista,
          cargaConfirmada: true,
        }),
      );

      await waitFor(() => expect(mockParar).toHaveBeenCalledTimes(1));
      expect(mockGarantir).not.toHaveBeenCalled();
    });

    it('para quando a carga diz que não há rota', async () => {
      mockGetContexto.mockResolvedValue(contextoGravado);

      renderHook(() =>
        useGarantirRastreamentoDaRota({
          route: null,
          motorista,
          cargaConfirmada: true,
        }),
      );

      await waitFor(() => expect(mockParar).toHaveBeenCalledTimes(1));
    });

    it('para quando o contexto é de outra rota e a carregada não anda', async () => {
      mockGetContexto.mockResolvedValue({ ...contextoGravado, rotaId: 'rota-velha' });

      renderHook(() =>
        useGarantirRastreamentoDaRota({
          route: { ...rotaEmAndamento, status: 'pendente' },
          motorista,
          cargaConfirmada: true,
        }),
      );

      await waitFor(() => expect(mockParar).toHaveBeenCalledTimes(1));
    });

    it('para a task que roda sem contexto (notificação órfã)', async () => {
      mockTaskAtiva.mockResolvedValue(true);

      renderHook(() =>
        useGarantirRastreamentoDaRota({
          route: null,
          motorista,
          cargaConfirmada: true,
        }),
      );

      await waitFor(() => expect(mockParar).toHaveBeenCalledTimes(1));
    });

    it('não para com a rota em andamento', async () => {
      mockGetContexto.mockResolvedValue(contextoGravado);
      mockTaskAtiva.mockResolvedValue(true);

      renderHook(() =>
        useGarantirRastreamentoDaRota({
          route: rotaEmAndamento,
          motorista,
          cargaConfirmada: true,
        }),
      );

      await waitFor(() => expect(mockGarantir).toHaveBeenCalledTimes(1));
      await act(async () => {});
      expect(mockParar).not.toHaveBeenCalled();
    });

    it('não para enquanto a carga não foi confirmada pelo banco (abrindo, ou sem rede)', async () => {
      mockGetContexto.mockResolvedValue(contextoGravado);
      mockTaskAtiva.mockResolvedValue(true);

      renderHook(() =>
        useGarantirRastreamentoDaRota({
          route: null,
          motorista,
          cargaConfirmada: false,
        }),
      );

      await act(async () => {});
      await new Promise((r) => setTimeout(r, 0));
      expect(mockParar).not.toHaveBeenCalled();
    });

    it('não chama o stop quando não há nada rodando', async () => {
      renderHook(() =>
        useGarantirRastreamentoDaRota({
          route: null,
          motorista,
          cargaConfirmada: true,
        }),
      );

      await waitFor(() => expect(mockTaskAtiva).toHaveBeenCalled());
      await act(async () => {});
      expect(mockParar).not.toHaveBeenCalled();
    });

    // Token vencido + rede fraca: o refresh falha, a consulta sai com a
    // chave publishable e a RLS devolve vazio SEM erro. "Sem rota" ali não
    // é resposta do banco sobre este motorista.
    it('sem rota e sem a sessão do motorista confirmada, não para (consulta anônima)', async () => {
      mockGetContexto.mockResolvedValue(contextoGravado);
      mockTaskAtiva.mockResolvedValue(true);
      mockLerSessao.mockResolvedValue({ session: null, offline: true });

      renderHook(() =>
        useGarantirRastreamentoDaRota({
          route: null,
          motorista,
          cargaConfirmada: true,
        }),
      );

      await waitFor(() => expect(mockLerSessao).toHaveBeenCalled());
      await act(async () => {});
      expect(mockParar).not.toHaveBeenCalled();
    });

    it('sem rota e com a sessão de outra conta, não para', async () => {
      mockGetContexto.mockResolvedValue(contextoGravado);
      mockLerSessao.mockResolvedValue({
        session: { user: { id: 'outra-conta' } },
        offline: false,
      });

      renderHook(() =>
        useGarantirRastreamentoDaRota({
          route: null,
          motorista,
          cargaConfirmada: true,
        }),
      );

      await waitFor(() => expect(mockLerSessao).toHaveBeenCalled());
      await act(async () => {});
      expect(mockParar).not.toHaveBeenCalled();
    });

    it('não para se outra rota foi iniciada entre a leitura do contexto e o stop', async () => {
      mockGetContexto
        .mockResolvedValueOnce(contextoGravado)
        .mockResolvedValue({ ...contextoGravado, rotaId: 'rota-nova' });

      renderHook(() =>
        useGarantirRastreamentoDaRota({
          route: { ...rotaEmAndamento, status: 'concluida' },
          motorista,
          cargaConfirmada: true,
        }),
      );

      await waitFor(() => expect(mockGetContexto).toHaveBeenCalledTimes(2));
      await act(async () => {});
      expect(mockParar).not.toHaveBeenCalled();
    });

    it('não para se o contexto apareceu (rota recém-iniciada) depois da leitura', async () => {
      mockTaskAtiva.mockResolvedValue(true);
      mockGetContexto
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ ...contextoGravado, rotaId: 'rota-nova' });

      renderHook(() =>
        useGarantirRastreamentoDaRota({
          route: { ...rotaEmAndamento, status: 'pendente' },
          motorista,
          cargaConfirmada: true,
        }),
      );

      await waitFor(() => expect(mockGetContexto).toHaveBeenCalledTimes(2));
      await act(async () => {});
      expect(mockParar).not.toHaveBeenCalled();
    });

    it('na web não mexe no rastreamento', async () => {
      jest.replaceProperty(Platform, 'OS', 'web');
      mockGetContexto.mockResolvedValue(contextoGravado);

      renderHook(() =>
        useGarantirRastreamentoDaRota({
          route: null,
          motorista,
          cargaConfirmada: true,
        }),
      );

      await new Promise((r) => setTimeout(r, 0));
      expect(mockParar).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });
});
