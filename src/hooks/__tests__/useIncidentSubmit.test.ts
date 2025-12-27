/**
 * Tests for useIncidentSubmit hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useIncidentSubmit } from '../useIncidentSubmit';

// Mock storage service
const mockUploadIncidentPhoto = jest.fn();
jest.mock('@/lib/storage', () => ({
  storageService: {
    uploadIncidentPhoto: (...args: unknown[]) => mockUploadIncidentPhoto(...args),
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
    Promise.resolve({ status: 'granted' })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: -23.5505, longitude: -46.6333 },
    })
  ),
  Accuracy: { Balanced: 3 },
}));

// Mock google maps service
jest.mock('@/lib/google', () => ({
  googleMapsService: {
    reverseGeocode: jest.fn(() => Promise.resolve('Rua Teste, 123')),
  },
}));

describe('useIncidentSubmit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadIncidentPhoto.mockResolvedValue('https://storage.com/photo.jpg');
    mockSingle.mockResolvedValue({ data: { id: 'incident-123' }, error: null });
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
        expect.stringContaining('incident_')
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
        error: { message: 'Database error' },
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

      let submitResult: { success: boolean };

      await act(async () => {
        submitResult = await result.current.submit({
          category: 'accident',
          description: 'Descrição',
          photoUri: 'file://photo.jpg',
          motoristaId: 'motorista-123',
        });
      });

      // Deve ter sucesso mesmo sem foto
      expect(submitResult!.success).toBe(true);
      expect(mockUploadIncidentPhoto).toHaveBeenCalledTimes(3);
    });
  });

  describe('reset', () => {
    it('deve resetar o estado', async () => {
      const { result } = renderHook(() => useIncidentSubmit());

      // Simular um erro
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Error' },
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
        })
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
        })
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
