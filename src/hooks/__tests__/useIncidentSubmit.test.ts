/**
 * Tests for useIncidentSubmit hook
 */

import { renderHook, act } from '@testing-library/react-native';

import {
  useIncidentSubmit,
  type IncidentSubmitResult,
} from '../useIncidentSubmit';

// Mock storage service
const mockUploadIncidentPhoto = jest.fn();
jest.mock('@/lib/storage', () => ({
  storageService: {
    uploadIncidentPhoto: (...args: unknown[]) =>
      mockUploadIncidentPhoto(...args),
  },
}));

// Mock supabase
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle,
        }),
      }),
    })),
  },
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' }),
  ),
  // Consulta antes de pedir (#570): 'undetermined' mantém o pedido exercitado.
  getForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'undetermined', canAskAgain: true }),
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: -23.5505, longitude: -46.6333 },
    }),
  ),
  Accuracy: { Balanced: 3 },
}));

// Mock Photon service (migrado de Google)
jest.mock('@/lib/photon', () => ({
  photonService: {
    reverseGeocode: jest.fn(() => Promise.resolve('Rua Teste, 123')),
  },
}));

// "Sem rede" confirmado (queda observada ou NetInfo desconectado)
const mockSemRede = jest.fn();
jest.mock('@/lib/semRede', () => ({
  semRedeConfirmada: (...a: unknown[]) => mockSemRede(...a),
}));

const mockEnfileirar = jest.fn();
jest.mock('@/lib/motorista/filaIncidentes', () => ({
  enfileirarIncidente: (...a: unknown[]) => mockEnfileirar(...a),
}));

describe('useIncidentSubmit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSemRede.mockResolvedValue(false);
    mockEnfileirar.mockResolvedValue(undefined);
    mockUploadIncidentPhoto.mockResolvedValue('https://storage.com/photo.jpg');
    mockSingle.mockResolvedValue({ data: { id: 'incident-123' }, error: null });
  });

  describe('sem internet', () => {
    it('com a falta de rede confirmada, guarda o reporte no aparelho e diz que será enviado', async () => {
      mockSemRede.mockResolvedValue(true);
      const { result } = renderHook(() => useIncidentSubmit());

      let r: IncidentSubmitResult | undefined;
      await act(async () => {
        r = await result.current.submit({
          category: 'accident',
          description: 'Pneu furado',
          photoUri: 'file://photo.jpg',
          paradaId: 'parada-1',
          rotaId: 'rota-1',
          motoristaId: 'motorista-123',
        });
      });

      expect(r!.success).toBe(true);
      expect(r!.enfileirado).toBe(true);
      // Nada de rede: nem foto, nem insert, nem Photon
      expect(mockUploadIncidentPhoto).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockEnfileirar).toHaveBeenCalledTimes(1);
      const guardado = mockEnfileirar.mock.calls[0][0];
      expect(guardado).toMatchObject({
        motoristaId: 'motorista-123',
        rotaId: 'rota-1',
        paradaId: 'parada-1',
        categoria: 'accident',
        descricao: 'Pneu furado',
        fotoLocal: 'file://photo.jpg',
        endereco: 'Localização não informada',
        tentativas: 0,
      });
      expect(guardado.id).toMatch(/^[0-9a-f-]{36}$/);
      // Pedido do motorista: só o NetInfo desconectado vale; a queda
      // observada há segundos não impede de tentar
      expect(mockSemRede).toHaveBeenCalledWith({ ignorarQuedaObservada: true });
    });

    it('se nem guardar no aparelho der, o motorista sabe que o reporte NÃO ficou salvo', async () => {
      mockSemRede.mockResolvedValue(true);
      mockEnfileirar.mockRejectedValueOnce(new Error('disco cheio'));
      const { result } = renderHook(() => useIncidentSubmit());

      let r: IncidentSubmitResult | undefined;
      await act(async () => {
        r = await result.current.submit({
          category: 'accident',
          description: 'Pneu furado',
          motoristaId: 'motorista-123',
        });
      });

      expect(r!.success).toBe(false);
      expect(r!.error).toMatch(/não foi salvo/);
    });

    it('a rede falha no insert: vai para a fila com o MESMO id, sem pedir ao motorista para conferir', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'TypeError: Network request failed', code: '' },
      });
      const { result } = renderHook(() => useIncidentSubmit());

      let r: IncidentSubmitResult | undefined;
      await act(async () => {
        r = await result.current.submit({
          category: 'accident',
          description: 'Pneu furado',
          endereco: 'Rua A',
          photoUri: 'file://photo.jpg',
          motoristaId: 'motorista-123',
        });
      });

      expect(r!.success).toBe(true);
      expect(r!.enfileirado).toBe(true);
      // O insert pode ter gravado: a fila reenvia com o mesmo id e a chave
      // primária impede a segunda linha.
      const idDoInsert = mockInsert.mock.calls[0][0].id;
      expect(idDoInsert).toMatch(/^[0-9a-f-]{36}$/);
      const guardado = mockEnfileirar.mock.calls[0][0];
      expect(guardado.id).toBe(idDoInsert);
      // A foto já subiu: vai o path, não a foto de novo
      expect(guardado.fotoPath).toBe('https://storage.com/photo.jpg');
      expect(guardado.fotoLocal).toBeUndefined();
    });

    it('o insert não é repetido na hora: 5xx vai para a fila, que reenvia sem duplicar', async () => {
      // 5xx de gateway depois do commit: a resposta se perde, a linha não
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'upstream', status: 503 },
      });
      const { result } = renderHook(() => useIncidentSubmit());

      let r: IncidentSubmitResult | undefined;
      await act(async () => {
        r = await result.current.submit({
          category: 'accident',
          description: 'Pneu furado',
          endereco: 'Rua A',
          motoristaId: 'motorista-123',
        });
      });

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(r!.enfileirado).toBe(true);
    });

    it('recusa definitiva do banco não vai para a fila: o erro chega ao motorista', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'violates check constraint', code: '23514' },
      });
      const { result } = renderHook(() => useIncidentSubmit());

      let r: IncidentSubmitResult | undefined;
      await act(async () => {
        r = await result.current.submit({
          category: 'accident',
          description: 'Pneu furado',
          endereco: 'Rua A',
          motoristaId: 'motorista-123',
        });
      });

      expect(r!.success).toBe(false);
      expect(mockEnfileirar).not.toHaveBeenCalled();
    });
  });

  describe('Estado inicial', () => {
    it('deve iniciar com valores padrão', () => {
      const { result } = renderHook(() => useIncidentSubmit());

      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.uploadProgress).toBe(0);
      expect(result.current.uploadRetryCount).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });

  describe('submit', () => {
    it('deve submeter incidente com sucesso sem foto', async () => {
      const { result } = renderHook(() => useIncidentSubmit());

      let submitResult: { success: boolean; incidentId?: string };

      await act(async () => {
        submitResult = await result.current.submit({
          category: 'accident',
          description: 'Descrição do problema',
          motoristaId: 'motorista-123',
        });
      });

      expect(submitResult!.success).toBe(true);
      expect(submitResult!.incidentId).toBe('incident-123');
      expect(mockUploadIncidentPhoto).not.toHaveBeenCalled();
    });

    it('deve submeter incidente com foto', async () => {
      const { result } = renderHook(() => useIncidentSubmit());

      await act(async () => {
        await result.current.submit({
          category: 'accident',
          description: 'Descrição do problema',
          photoUri: 'file://photo.jpg',
          motoristaId: 'motorista-123',
        });
      });

      expect(mockUploadIncidentPhoto).toHaveBeenCalledWith(
        'file://photo.jpg',
        expect.stringContaining('incident_'),
      );
    });

    it('deve atualizar isSubmitting durante submissão', async () => {
      const { result } = renderHook(() => useIncidentSubmit());

      expect(result.current.isSubmitting).toBe(false);

      const submitPromise = act(async () => {
        await result.current.submit({
          category: 'accident',
          description: 'Descrição',
          motoristaId: 'motorista-123',
        });
      });

      // Durante a submissão, isSubmitting deve ser true
      // Após, deve voltar a false
      await submitPromise;
      expect(result.current.isSubmitting).toBe(false);
    });

    it('deve retornar erro quando falha no banco', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', code: '23514' },
      });

      const { result } = renderHook(() => useIncidentSubmit());

      let submitResult: { success: boolean; error?: string };

      await act(async () => {
        submitResult = await result.current.submit({
          category: 'accident',
          description: 'Descrição',
          motoristaId: 'motorista-123',
        });
      });

      expect(submitResult!.success).toBe(false);
      expect(submitResult!.error).toContain('Database error');
    });
  });

  describe('Upload com retry', () => {
    it('deve fazer retry no upload quando falha', async () => {
      // Falha nas primeiras 2 tentativas, sucesso na terceira
      mockUploadIncidentPhoto
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('https://storage.com/photo.jpg');

      const { result } = renderHook(() => useIncidentSubmit());

      await act(async () => {
        await result.current.submit({
          category: 'accident',
          description: 'Descrição',
          photoUri: 'file://photo.jpg',
          motoristaId: 'motorista-123',
        });
      });

      // Deve ter tentado 3 vezes
      expect(mockUploadIncidentPhoto).toHaveBeenCalledTimes(3);
    });

    it('deve continuar sem foto após todas as tentativas falharem', async () => {
      mockUploadIncidentPhoto.mockRejectedValue(new Error('Upload failed'));

      const { result } = renderHook(() => useIncidentSubmit());

      let submitResult: { success: boolean; fotoPerdida?: boolean };

      await act(async () => {
        submitResult = await result.current.submit({
          category: 'accident',
          description: 'Descrição',
          photoUri: 'file://photo.jpg',
          motoristaId: 'motorista-123',
        });
      });

      // Deve ter sucesso mesmo sem foto, e dizer que a foto se perdeu
      expect(submitResult!.success).toBe(true);
      expect(submitResult!.fotoPerdida).toBe(true);
      expect(mockUploadIncidentPhoto).toHaveBeenCalledTimes(3);
    });

    it('com a foto enviada, fotoPerdida é false', async () => {
      const { result } = renderHook(() => useIncidentSubmit());

      let submitResult: { success: boolean; fotoPerdida?: boolean };

      await act(async () => {
        submitResult = await result.current.submit({
          category: 'accident',
          description: 'Descrição',
          photoUri: 'file://photo.jpg',
          motoristaId: 'motorista-123',
        });
      });

      expect(submitResult!.success).toBe(true);
      expect(submitResult!.fotoPerdida).toBe(false);
    });

    it('sem foto escolhida, fotoPerdida é false', async () => {
      const { result } = renderHook(() => useIncidentSubmit());

      let submitResult: { success: boolean; fotoPerdida?: boolean };

      await act(async () => {
        submitResult = await result.current.submit({
          category: 'accident',
          description: 'Descrição',
          motoristaId: 'motorista-123',
        });
      });

      expect(submitResult!.success).toBe(true);
      expect(submitResult!.fotoPerdida).toBe(false);
    });
  });

  describe('reset', () => {
    it('deve resetar o estado', async () => {
      const { result } = renderHook(() => useIncidentSubmit());

      // Simular uma recusa definitiva (erro sem código iria para a fila)
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Error', code: '23514' },
      });

      await act(async () => {
        await result.current.submit({
          category: 'accident',
          description: 'Descrição',
          motoristaId: 'motorista-123',
        });
      });

      expect(result.current.error).not.toBeNull();

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.uploadProgress).toBe(0);
      expect(result.current.uploadRetryCount).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Geolocalização', () => {
    it('deve obter endereço via geolocalização quando não fornecido', async () => {
      const { result } = renderHook(() => useIncidentSubmit());

      await act(async () => {
        await result.current.submit({
          category: 'accident',
          description: 'Descrição',
          motoristaId: 'motorista-123',
          // Sem endereco
        });
      });

      // Verificar que o incidente foi criado com endereço obtido via geolocalização
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          endereco: 'Rua Teste, 123',
        }),
      );
    });

    it('deve usar endereço fornecido quando disponível', async () => {
      const { result } = renderHook(() => useIncidentSubmit());

      await act(async () => {
        await result.current.submit({
          category: 'accident',
          description: 'Descrição',
          motoristaId: 'motorista-123',
          endereco: 'Endereço manual',
        });
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          endereco: 'Endereço manual',
        }),
      );
    });
  });

  describe('Logs', () => {
    it('deve criar log quando rotaId é fornecido', async () => {
      const { supabase } = require('@/lib/supabase');

      const { result } = renderHook(() => useIncidentSubmit());

      await act(async () => {
        await result.current.submit({
          category: 'accident',
          description: 'Descrição',
          motoristaId: 'motorista-123',
          rotaId: 'rota-456',
        });
      });

      // Deve ter chamado from('incidentes') e from('logs')
      expect(supabase.from).toHaveBeenCalledWith('incidentes');
      expect(supabase.from).toHaveBeenCalledWith('logs');
    });

    it('não deve criar log quando rotaId não é fornecido', async () => {
      const { supabase } = require('@/lib/supabase');
      supabase.from.mockClear();

      const { result } = renderHook(() => useIncidentSubmit());

      await act(async () => {
        await result.current.submit({
          category: 'accident',
          description: 'Descrição',
          motoristaId: 'motorista-123',
          // Sem rotaId
        });
      });

      // Deve ter chamado apenas from('incidentes')
      const calls = supabase.from.mock.calls.map((c: string[]) => c[0]);
      expect(calls).toContain('incidentes');
      expect(calls).not.toContain('logs');
    });
  });
});
