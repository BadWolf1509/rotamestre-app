import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';

import type {
  Parada,
  ParadaFormDataWithCoords,
  RotaOtimizadaState,
} from '@/components/gestor/nova-entrega/types';
import { localizarEnderecoLote } from '@/lib/nova-entrega/localizarEnderecoLote';
import { photonService } from '@/lib/photon';
import { MAX_ROUTE_STOPS } from '@/lib/routeOptimization';

import {
  motivoRecusaLote,
  useParadasManagement,
  type BulkParadaInput,
  type EnderecoLocalizado,
} from '../useParadasManagement';

jest.mock('@/lib/photon', () => ({
  photonService: {
    geocodeAddress: jest.fn(),
  },
}));

jest.mock('@/lib/nova-entrega/localizarEnderecoLote', () => ({
  localizarEnderecoLote: jest.fn(),
}));

const localizarMock = localizarEnderecoLote as jest.Mock;
const sede = { latitude: -7.1, longitude: -34.9, endereco: 'Rua Base' };

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const baseStop: ParadaFormDataWithCoords = {
  tipo: 'entrega',
  endereco: 'Rua A, 123',
  destinatario: 'João',
  telefone: '11999999999',
  observacoes: '',
  latitude: -23.5,
  longitude: -46.6,
};

function createStop(index: number, overrides: Partial<Parada> = {}): Parada {
  return {
    id: `stop-${index}`,
    ordem: index + 1,
    ...baseStop,
    endereco: `Rua ${index}, 100`,
    destinatario: `Cliente ${index}`,
    telefone: `1199999${String(index).padStart(4, '0')}`,
    ...overrides,
  };
}

describe('useParadasManagement', () => {
  const callbacks = {
    onOrdemManualChange: jest.fn(),
    onRotaOtimizadaReset: jest.fn(),
    onDistanciaManualRealReset: jest.fn(),
    showToast: jest.fn(),
    onFormReset: jest.fn(),
  };

  function useSubject(
    initial: Parada[] = [],
    rotaOtimizada: RotaOtimizadaState | null = null,
  ) {
    const [paradas, setParadas] = useState(initial);
    const management = useParadasManagement({
      paradas,
      setParadas,
      rotaOtimizada,
      enderecoUnidade: sede,
      ...callbacks,
    });
    return { paradas, ...management };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts empty with the correct status', () => {
    const { result } = renderHook(() => useSubject());

    expect(result.current.paradas).toEqual([]);
    expect(result.current.retiradasDisponiveis).toEqual([]);
    expect(result.current.paradasStatus).toEqual({
      texto: 'Nenhuma parada adicionada',
      cor: 'default',
      icone: null,
    });
  });

  it('adds a validated stop and invalidates previous optimization', async () => {
    const { result } = renderHook(() => useSubject());

    await act(async () => {
      await result.current.onAddParada(baseStop);
    });

    expect(result.current.paradas).toHaveLength(1);
    expect(result.current.paradas[0]).toMatchObject({
      endereco: baseStop.endereco,
      ordem: 1,
    });
    expect(callbacks.onFormReset).toHaveBeenCalled();
    expect(callbacks.onRotaOtimizadaReset).toHaveBeenCalled();
  });

  it('geocodes a stop only when coordinates are absent', async () => {
    (photonService.geocodeAddress as jest.Mock).mockResolvedValue({
      coordenadas: { latitude: -23.51, longitude: -46.61 },
    });
    const {
      latitude: _latitude,
      longitude: _longitude,
      ...withoutCoords
    } = baseStop;
    const { result } = renderHook(() => useSubject());

    await act(async () => {
      await result.current.onAddParada(withoutCoords);
    });

    expect(photonService.geocodeAddress).toHaveBeenCalledWith(
      baseStop.endereco,
    );
    expect(result.current.paradas[0]).toMatchObject({
      latitude: -23.51,
      longitude: -46.61,
    });
  });

  it('blocks duplicates unless the user explicitly confirms', async () => {
    const { result } = renderHook(() => useSubject([createStop(0)]));
    const duplicate = {
      ...baseStop,
      endereco: 'Rua 0, 100',
      telefone: '11888888888',
    };

    await act(async () => {
      expect(await result.current.onAddParada(duplicate)).toBe(false);
    });
    expect(result.current.paradas).toHaveLength(1);

    await act(async () => {
      expect(
        await result.current.onAddParada(
          { ...duplicate, telefone: '11777777777' },
          undefined,
          undefined,
          true,
        ),
      ).toBe(true);
    });
    expect(result.current.paradas).toHaveLength(2);
  });

  it('enforces the operational stop limit', async () => {
    const initial = Array.from({ length: MAX_ROUTE_STOPS }, (_, index) =>
      createStop(index),
    );
    const { result } = renderHook(() => useSubject(initial));

    await act(async () => {
      expect(
        await result.current.onAddParada({
          ...baseStop,
          endereco: 'Rua excedente',
        }),
      ).toBe(false);
    });

    expect(result.current.paradas).toHaveLength(MAX_ROUTE_STOPS);
    expect(callbacks.showToast).toHaveBeenCalledWith(
      expect.stringContaining('limite'),
      'error',
      5000,
    );
  });

  it('removes a pickup, unlinks dependents and offers a complete undo', () => {
    const pickup = createStop(0, { tipo: 'retirada' });
    const delivery = createStop(1, { vinculo_parada_id: pickup.id });
    const { result } = renderHook(() => useSubject([pickup, delivery]));

    act(() => result.current.removeParada(0));

    expect(result.current.paradas).toHaveLength(1);
    expect(result.current.paradas[0].vinculo_parada_id).toBeUndefined();
    const action = callbacks.showToast.mock.calls.at(-1)?.[3];

    act(() => action?.onPress());
    expect(result.current.paradas).toEqual([pickup, delivery]);
  });

  it('prevents reordering a delivery before its pickup', () => {
    const pickup = createStop(0, { tipo: 'retirada' });
    const delivery = createStop(1, { vinculo_parada_id: pickup.id });
    const { result } = renderHook(() => useSubject([pickup, delivery]));

    act(() => result.current.moveParadaUp(1));

    expect(result.current.paradas[0].id).toBe(pickup.id);
    expect(callbacks.showToast).toHaveBeenCalledWith(
      expect.stringContaining('precisa ocorrer antes'),
      'error',
      5000,
    );
  });

  it('prevents changing a pickup type while deliveries still depend on it', async () => {
    const pickup = createStop(0, { tipo: 'retirada' });
    const delivery = createStop(1, { vinculo_parada_id: pickup.id });
    const { result } = renderHook(() => useSubject([pickup, delivery]));

    await act(async () => {
      expect(
        await result.current.onAddParada(
          { ...pickup, tipo: 'entrega' },
          undefined,
          pickup.id,
        ),
      ).toBe(false);
    });

    expect(result.current.paradas[0].tipo).toBe('retirada');
    expect(callbacks.showToast).toHaveBeenCalledWith(
      expect.stringContaining('retirada inexistente'),
      'error',
      5000,
    );
  });

  it('marks a reordered optimized route as manual', () => {
    const optimized: RotaOtimizadaState = {
      distancia_total_metros: 1000,
      duracao_total_segundos: 300,
      legs: [],
    };
    const { result } = renderHook(() =>
      useSubject([createStop(0), createStop(1)], optimized),
    );

    act(() => result.current.moveParadaDown(0));

    expect(result.current.paradas[0].id).toBe('stop-1');
    expect(callbacks.onOrdemManualChange).toHaveBeenCalledWith(true);
    expect(callbacks.onDistanciaManualRealReset).toHaveBeenCalled();
  });

  it('clears the draft and restores it through the toast action', () => {
    const previous = [createStop(0)];
    const extraUndo = jest.fn();
    const { result } = renderHook(() => useSubject(previous));

    act(() => result.current.clearParadas(extraUndo));
    expect(result.current.paradas).toEqual([]);

    const action = callbacks.showToast.mock.calls.at(-1)?.[3];
    act(() => action?.onPress());

    expect(result.current.paradas).toEqual(previous);
    expect(extraUndo).toHaveBeenCalled();
  });

  describe('importação em lote', () => {
    type ResultadoLocalizar = Awaited<
      ReturnType<ReturnType<typeof useParadasManagement>['localizarLote']>
    >;

    function linha(
      numero: number,
      overrides: Partial<BulkParadaInput> = {},
    ): BulkParadaInput {
      return {
        tipo: 'entrega',
        endereco: `Rua Lote ${numero}, 10`,
        destinatario: `Cliente ${numero}`,
        telefone: `1188888${String(numero).padStart(4, '0')}`,
        observacoes: '',
        linha: numero,
        ...overrides,
      };
    }

    function localizado(
      item: BulkParadaInput,
      overrides: Partial<EnderecoLocalizado> = {},
    ): EnderecoLocalizado {
      return {
        linha: item.linha,
        item,
        enderecoEncontrado: `${item.endereco} - Centro, João Pessoa - PB`,
        latitude: -7.12,
        longitude: -34.88,
        fonte: 'google',
        distanciaSedeKm: 2.5,
        ...overrides,
      };
    }

    function resolvidoPara(endereco: string) {
      return {
        enderecoEncontrado: `${endereco} - Centro, João Pessoa - PB`,
        latitude: -7.12,
        longitude: -34.88,
        fonte: 'google' as const,
        distanciaSedeKm: 2.5,
      };
    }

    it('localizarLote numera os erros pela linha colada e não mexe na lista', async () => {
      const existing = createStop(0);
      localizarMock.mockImplementation(async (endereco: string) =>
        endereco.startsWith('Lugar nenhum') ? null : resolvidoPara(endereco),
      );
      const { result } = renderHook(() => useSubject([existing]));

      let resultado: ResultadoLocalizar | undefined;
      await act(async () => {
        resultado = await result.current.localizarLote([
          linha(3),
          linha(7, { endereco: existing.endereco }),
          linha(9, { endereco: 'Lugar nenhum, 1' }),
        ]);
      });

      expect(resultado).toEqual({
        localizados: [localizado(linha(3))],
        erros: [
          'Linha 7: entrega duplicada (mesmo endereço ou telefone).',
          'Linha 9: endereço não localizado.',
        ],
      });
      expect(localizarMock).toHaveBeenCalledWith('Rua Lote 3, 10', {
        latitude: sede.latitude,
        longitude: sede.longitude,
      });
      // A duplicada não gasta chamada do Places.
      expect(localizarMock).not.toHaveBeenCalledWith(
        existing.endereco,
        expect.anything(),
      );
      expect(result.current.paradas).toEqual([existing]);
      expect(callbacks.onRotaOtimizadaReset).not.toHaveBeenCalled();
    });

    it('localizarLote acusa a duplicada dentro do próprio lote, mas aceita entrega e retirada no mesmo local', async () => {
      localizarMock.mockImplementation(async (endereco: string) =>
        resolvidoPara(endereco),
      );
      const { result } = renderHook(() => useSubject());

      let resultado: ResultadoLocalizar | undefined;
      await act(async () => {
        resultado = await result.current.localizarLote([
          linha(2),
          linha(3, { tipo: 'retirada', endereco: 'Rua Lote 2, 10' }),
          linha(4, { endereco: 'Rua Lote 2, 10', telefone: '11000000000' }),
        ]);
      });

      expect(resultado?.localizados.map((item) => item.linha)).toEqual([2, 3]);
      expect(resultado?.erros).toEqual([
        'Linha 4: entrega duplicada (mesmo endereço ou telefone).',
      ]);
    });

    it('localizarLote para no limite da rota e aponta cada linha que sobrou', async () => {
      localizarMock.mockImplementation(async (endereco: string) =>
        resolvidoPara(endereco),
      );
      const quaseCheia = Array.from({ length: MAX_ROUTE_STOPS - 1 }, (_, i) =>
        createStop(i),
      );
      const { result } = renderHook(() => useSubject(quaseCheia));

      let resultado: ResultadoLocalizar | undefined;
      await act(async () => {
        resultado = await result.current.localizarLote([
          linha(4),
          linha(5),
          linha(6),
        ]);
      });

      expect(resultado?.localizados.map((item) => item.linha)).toEqual([4]);
      expect(resultado?.erros).toEqual([
        'Linha 5: limite da rota atingido.',
        'Linha 6: limite da rota atingido.',
      ]);
      expect(localizarMock).toHaveBeenCalledTimes(1);
    });

    it('localizarLote consulta um endereço por vez', async () => {
      let emVoo = 0;
      let maximo = 0;
      localizarMock.mockImplementation(async (endereco: string) => {
        emVoo += 1;
        maximo = Math.max(maximo, emVoo);
        await new Promise((resolve) => setTimeout(resolve, 0));
        emVoo -= 1;
        return resolvidoPara(endereco);
      });
      const { result } = renderHook(() => useSubject());

      await act(async () => {
        await result.current.localizarLote([linha(1), linha(2), linha(3)]);
      });

      expect(localizarMock).toHaveBeenCalledTimes(3);
      expect(maximo).toBe(1);
    });

    it('localizarLote transforma exceção da localização em erro da linha', async () => {
      localizarMock.mockRejectedValueOnce(new Error('rede'));
      const { result } = renderHook(() => useSubject());

      let resultado: ResultadoLocalizar | undefined;
      await act(async () => {
        resultado = await result.current.localizarLote([linha(12)]);
      });

      expect(resultado).toEqual({
        localizados: [],
        erros: ['Linha 12: endereço não localizado.'],
      });
    });

    it('importParadas cria as paradas com a coordenada confirmada, sem geocodificar', () => {
      const existing = createStop(0);
      const { result } = renderHook(() => useSubject([existing]));

      let importResult;
      act(() => {
        importResult = result.current.importParadas([
          localizado(linha(3), { latitude: -7.2, longitude: -34.95 }),
          localizado(linha(5, { tipo: 'retirada' })),
        ]);
      });

      expect(importResult).toEqual({
        adicionadas: 2,
        ignoradas: 0,
        erros: [],
        linhasAdicionadas: [3, 5],
      });
      expect(localizarMock).not.toHaveBeenCalled();
      expect(photonService.geocodeAddress).not.toHaveBeenCalled();
      expect(result.current.paradas).toHaveLength(3);
      expect(result.current.paradas[1]).toMatchObject({
        endereco: 'Rua Lote 3, 10',
        destinatario: 'Cliente 3',
        latitude: -7.2,
        longitude: -34.95,
        ordem: 2,
      });
      expect(result.current.paradas[1]).not.toHaveProperty('linha');
      expect(result.current.paradas[2]).toMatchObject({
        tipo: 'retirada',
        ordem: 3,
      });
      expect(callbacks.onRotaOtimizadaReset).toHaveBeenCalled();
      expect(callbacks.showToast).toHaveBeenCalledWith(
        '2 parada(s) importada(s).',
        'success',
        5000,
      );
    });

    it('importParadas confere de novo a duplicada contra a lista atual, pela linha colada', () => {
      // Entre localizar e confirmar o gestor pode ter cadastrado a mesma
      // parada à mão: a conferência não pode virar porta para duplicata.
      const existing = createStop(0);
      const { result } = renderHook(() => useSubject([existing]));

      let importResult;
      act(() => {
        importResult = result.current.importParadas([
          localizado(linha(8, { endereco: existing.endereco })),
          localizado(linha(9)),
        ]);
      });

      expect(importResult).toEqual({
        adicionadas: 1,
        ignoradas: 1,
        erros: ['Linha 8: entrega duplicada (mesmo endereço ou telefone).'],
        linhasAdicionadas: [9],
      });
      expect(result.current.paradas).toHaveLength(2);
      expect(callbacks.showToast).toHaveBeenCalledWith(
        '1 parada(s) importada(s). 1 linha não entrou.',
        'info',
        5000,
      );
    });

    it('importParadas respeita o limite da rota e aponta cada linha que sobrou', () => {
      const quaseCheia = Array.from({ length: MAX_ROUTE_STOPS - 1 }, (_, i) =>
        createStop(i),
      );
      const { result } = renderHook(() => useSubject(quaseCheia));

      let importResult;
      act(() => {
        importResult = result.current.importParadas([
          localizado(linha(4)),
          localizado(linha(5)),
        ]);
      });

      expect(importResult).toEqual({
        adicionadas: 1,
        ignoradas: 1,
        erros: ['Linha 5: limite da rota atingido.'],
        linhasAdicionadas: [4],
      });
      expect(result.current.paradas).toHaveLength(MAX_ROUTE_STOPS);
    });

    it('importParadas conta no toast as linhas que caíram antes da conferência', () => {
      // Falha de localização e linha removida pelo gestor não chegam à fase 2,
      // mas também não entraram: um "success" puro esconderia isso.
      const { result } = renderHook(() => useSubject());

      act(() => {
        result.current.importParadas([localizado(linha(2))], {
          foraDoLote: 2,
        });
      });

      expect(callbacks.showToast).toHaveBeenCalledWith(
        '1 parada(s) importada(s). 2 linhas não entraram.',
        'info',
        5000,
      );
    });

    it('localizarLote avisa o andamento, linha a linha', async () => {
      localizarMock.mockImplementation(async (endereco: string) =>
        resolvidoPara(endereco),
      );
      const onProgresso = jest.fn();
      const { result } = renderHook(() => useSubject());

      await act(async () => {
        await result.current.localizarLote([linha(1), linha(2), linha(3)], {
          onProgresso,
        });
      });

      expect(onProgresso.mock.calls).toEqual([
        [1, 3],
        [2, 3],
        [3, 3],
      ]);
    });
  });

  describe('motivoRecusaLote', () => {
    const item: BulkParadaInput = {
      tipo: 'entrega',
      endereco: 'Rua Nova, 1',
      destinatario: 'Fulano',
      telefone: '11977776666',
      observacoes: '',
      linha: 6,
    };

    it('aceita a linha quando há espaço e ela não repete ninguém', () => {
      expect(motivoRecusaLote([createStop(0)], item)).toBeNull();
    });

    it('recusa a duplicada pela linha colada', () => {
      expect(
        motivoRecusaLote([createStop(0, { endereco: item.endereco })], item),
      ).toBe('Linha 6: entrega duplicada (mesmo endereço ou telefone).');
    });

    it('recusa quando a lista já está no limite, antes de olhar duplicata', () => {
      const cheia = Array.from({ length: MAX_ROUTE_STOPS }, (_, i) =>
        createStop(i),
      );
      expect(motivoRecusaLote(cheia, item)).toBe(
        'Linha 6: limite da rota atingido.',
      );
    });
  });
});
