/**
 * Tests for routeUtils.ts
 * Funções de manipulação de rotas
 */

import {
  recalcularRota,
  reordenarParadas,
  normalizarOrdemParadas,
  removerParadaERecalcular,
  notificarMotoristaRotaEditada,
  NotificacaoRotaEditadaTipo,
} from '../routeUtils';

// Mock do Supabase
const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// Mock do Google Maps service
const mockGetDirectionsSequential = jest.fn();

jest.mock('@/lib/google', () => ({
  googleMapsService: {
    getDirectionsSequential: (...args: unknown[]) => mockGetDirectionsSequential(...args),
  },
}));

// Helper para criar chain de métodos do Supabase
function createSupabaseChain(finalResult: { data?: unknown; error?: unknown }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(finalResult),
  };
  // Para chamadas que não usam single()
  chain.eq.mockImplementation(() => ({
    ...chain,
    then: (resolve: (value: typeof finalResult) => void) => Promise.resolve(finalResult).then(resolve),
  }));
  return chain;
}

describe('routeUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Silenciar logs durante os testes
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recalcularRota', () => {
    const validEnderecoUnidade = { latitude: -23.55, longitude: -46.63 };
    const mockRotaId = 'rota-123';
    const mockParadas = [
      { id: 'p1', ordem: 1, latitude: -23.56, longitude: -46.64, is_checkpoint: true },
      { id: 'p2', ordem: 2, latitude: -23.57, longitude: -46.65, is_checkpoint: true },
    ];

    it('deve retornar erro se coordenadas da unidade são inválidas', async () => {
      const result = await recalcularRota(mockRotaId, mockParadas, null as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Coordenadas da unidade inválidas');
    });

    it('deve retornar erro se latitude é undefined', async () => {
      const result = await recalcularRota(mockRotaId, mockParadas, {
        latitude: undefined as any,
        longitude: -46.63,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Coordenadas da unidade inválidas');
    });

    it('deve retornar erro se longitude é NaN', async () => {
      const result = await recalcularRota(mockRotaId, mockParadas, {
        latitude: -23.55,
        longitude: NaN,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Coordenadas da unidade inválidas');
    });

    it('deve atualizar com valores zerados se não há waypoints válidos', async () => {
      const chain = createSupabaseChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const paradasSemCoordenadas = [
        { id: 'p1', ordem: 1, latitude: null, longitude: null },
      ];

      const result = await recalcularRota(mockRotaId, paradasSemCoordenadas, validEnderecoUnidade);

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('rotas');
      expect(chain.update).toHaveBeenCalledWith({
        distancia_total: 0,
        tempo_total: 0,
        polyline: null,
      });
    });

    it('deve filtrar paradas com is_checkpoint === false', async () => {
      const chain = createSupabaseChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const paradasMistas = [
        { id: 'p1', ordem: 0, latitude: -23.55, longitude: -46.63, is_checkpoint: false }, // Checkpoint de partida
        { id: 'p2', ordem: 1, latitude: -23.56, longitude: -46.64, is_checkpoint: true },
        { id: 'p3', ordem: 2, latitude: -23.57, longitude: -46.65 }, // is_checkpoint undefined = parada real
      ];

      mockGetDirectionsSequential.mockResolvedValue({
        distancia_total_metros: 5000,
        duracao_total_segundos: 600,
        polyline: 'encoded_polyline',
      });

      await recalcularRota(mockRotaId, paradasMistas, validEnderecoUnidade);

      // Deve chamar getDirectionsSequential com apenas 2 waypoints (excluindo o checkpoint)
      expect(mockGetDirectionsSequential).toHaveBeenCalledWith(
        validEnderecoUnidade,
        validEnderecoUnidade,
        [
          { latitude: -23.56, longitude: -46.64 },
          { latitude: -23.57, longitude: -46.65 },
        ]
      );
    });

    it('deve retornar erro se Google Directions falhar', async () => {
      mockGetDirectionsSequential.mockResolvedValue(null);

      const result = await recalcularRota(mockRotaId, mockParadas, validEnderecoUnidade);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Não foi possível calcular a rota');
    });

    it('deve atualizar rota com sucesso quando Google Directions retorna dados', async () => {
      const chain = createSupabaseChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      mockGetDirectionsSequential.mockResolvedValue({
        distancia_total_metros: 10000, // 10km
        duracao_total_segundos: 1200, // 20 minutos
        polyline: 'test_polyline_encoded',
      });

      const result = await recalcularRota(mockRotaId, mockParadas, validEnderecoUnidade);

      expect(result.success).toBe(true);
      expect(chain.update).toHaveBeenCalledWith({
        distancia_total: 10, // 10000m / 1000 = 10km
        tempo_total: 20, // 1200s / 60 = 20min
        polyline: 'test_polyline_encoded',
      });
    });

    it('deve retornar erro se update do Supabase falhar', async () => {
      const chain = createSupabaseChain({ data: null, error: null });
      // Sobrescrever para simular erro
      chain.eq.mockImplementation(() => ({
        then: (resolve: (value: { data: null; error: { message: string } }) => void) =>
          Promise.resolve({ data: null, error: { message: 'Update failed' } }).then(resolve),
      }));
      mockFrom.mockReturnValue(chain);

      mockGetDirectionsSequential.mockResolvedValue({
        distancia_total_metros: 10000,
        duracao_total_segundos: 1200,
        polyline: 'test',
      });

      const result = await recalcularRota(mockRotaId, mockParadas, validEnderecoUnidade);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Erro ao salvar dados da rota');
    });

    it('deve capturar exceções e retornar erro', async () => {
      mockGetDirectionsSequential.mockRejectedValue(new Error('Network error'));

      const result = await recalcularRota(mockRotaId, mockParadas, validEnderecoUnidade);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('reordenarParadas', () => {
    it('deve retornar sucesso para lista vazia', async () => {
      const result = await reordenarParadas([]);
      expect(result.success).toBe(true);
    });

    it('deve chamar RPC com os parâmetros corretos', async () => {
      mockRpc.mockResolvedValue({ data: { success: true, updated: 3 }, error: null });

      const paradas = [
        { id: 'p1', ordem: 1, latitude: -23.55, longitude: -46.63 },
        { id: 'p2', ordem: 2, latitude: -23.56, longitude: -46.64 },
        { id: 'p3', ordem: 3, latitude: -23.57, longitude: -46.65 },
      ];

      const result = await reordenarParadas(paradas);

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('reordenar_paradas', {
        p_parada_ids: ['p1', 'p2', 'p3'],
        p_novas_ordens: [1, 2, 3],
      });
    });

    it('deve usar fallback se RPC não existe (erro 42883)', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: '42883', message: 'function does not exist' },
      });

      // Mock do supabase.from para o fallback
      const chain = createSupabaseChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const paradas = [{ id: 'p1', ordem: 1, latitude: -23.55, longitude: -46.63 }];

      const result = await reordenarParadas(paradas);

      // Fallback deve ser chamado
      expect(mockFrom).toHaveBeenCalledWith('paradas');
      expect(result.success).toBe(true);
    });

    it('deve retornar erro se RPC retorna erro genérico', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: '50000', message: 'Some database error' },
      });

      const paradas = [{ id: 'p1', ordem: 1, latitude: -23.55, longitude: -46.63 }];

      const result = await reordenarParadas(paradas);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Erro ao reordenar paradas');
    });

    it('deve retornar erro se RPC retorna data.success = false', async () => {
      mockRpc.mockResolvedValue({
        data: { success: false, error: 'Custom RPC error' },
        error: null,
      });

      const paradas = [{ id: 'p1', ordem: 1, latitude: -23.55, longitude: -46.63 }];

      const result = await reordenarParadas(paradas);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Custom RPC error');
    });

    it('deve capturar exceções', async () => {
      mockRpc.mockRejectedValue(new Error('RPC exception'));

      const paradas = [{ id: 'p1', ordem: 1, latitude: -23.55, longitude: -46.63 }];

      const result = await reordenarParadas(paradas);

      expect(result.success).toBe(false);
      expect(result.error).toBe('RPC exception');
    });

    it('deve usar fallback com sucesso quando RPC não existe', async () => {
      // RPC retorna erro "does not exist"
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: null, message: 'function reordenar_paradas does not exist' },
      });

      // Mock para fallback (step 1 e step 2)
      let updateCount = 0;
      mockFrom.mockImplementation(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation(() => {
          updateCount++;
          return Promise.resolve({ data: null, error: null });
        }),
      }));

      const paradas = [
        { id: 'p1', ordem: 1, latitude: -23.55, longitude: -46.63 },
        { id: 'p2', ordem: 2, latitude: -23.56, longitude: -46.64 },
      ];

      const result = await reordenarParadas(paradas);

      expect(result.success).toBe(true);
      // Fallback faz 2 etapas: temp values (2 updates) + final values (2 updates) = 4 updates
      expect(updateCount).toBe(4);
    });

    it('deve retornar erro no fallback se step 1 falhar', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: '42883', message: 'function does not exist' },
      });

      let updateCount = 0;
      mockFrom.mockImplementation(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation(() => {
          updateCount++;
          // Falhar na primeira atualização
          if (updateCount === 1) {
            return Promise.resolve({ data: null, error: { message: 'Step 1 error' } });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      }));

      const paradas = [{ id: 'p1', ordem: 1, latitude: -23.55, longitude: -46.63 }];

      const result = await reordenarParadas(paradas);

      expect(result.success).toBe(false);
      expect(result.error).toContain('valores temporários');
    });

    it('deve retornar erro no fallback se step 2 falhar', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: '42883', message: 'function does not exist' },
      });

      let updateCount = 0;
      mockFrom.mockImplementation(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation(() => {
          updateCount++;
          // Falhar na segunda atualização (step 2)
          if (updateCount === 2) {
            return Promise.resolve({ data: null, error: { message: 'Step 2 error' } });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      }));

      const paradas = [{ id: 'p1', ordem: 1, latitude: -23.55, longitude: -46.63 }];

      const result = await reordenarParadas(paradas);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ordem correta');
    });
  });

  describe('normalizarOrdemParadas', () => {
    const mockRotaId = 'rota-456';

    it('deve retornar erro se fetch falhar', async () => {
      const chain = createSupabaseChain({ data: null, error: { message: 'Fetch error' } });
      chain.order.mockImplementation(() => ({
        then: (resolve: (value: { data: null; error: { message: string } }) => void) =>
          Promise.resolve({ data: null, error: { message: 'Fetch error' } }).then(resolve),
      }));
      mockFrom.mockReturnValue(chain);

      const result = await normalizarOrdemParadas(mockRotaId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Erro ao buscar paradas');
    });

    it('deve retornar sucesso se nenhuma mudança é necessária', async () => {
      // Paradas já estão na ordem correta
      const paradasCorretas = [
        { id: 'partida', ordem: 0, is_checkpoint: false, observacoes: 'Partida' },
        { id: 'p1', ordem: 1, is_checkpoint: true, observacoes: null },
        { id: 'p2', ordem: 2, is_checkpoint: true, observacoes: null },
        { id: 'chegada', ordem: 3, is_checkpoint: false, observacoes: 'Chegada' },
      ];

      const chain = createSupabaseChain({ data: paradasCorretas, error: null });
      chain.order.mockImplementation(() => ({
        then: (resolve: (value: { data: typeof paradasCorretas; error: null }) => void) =>
          Promise.resolve({ data: paradasCorretas, error: null }).then(resolve),
      }));
      mockFrom.mockReturnValue(chain);

      const result = await normalizarOrdemParadas(mockRotaId);

      expect(result.success).toBe(true);
      // update não deve ser chamado
      expect(chain.update).not.toHaveBeenCalled();
    });

    it('deve reordenar paradas quando ordem está incorreta', async () => {
      // Paradas com ordem incorreta (partida em 5, chegada em 1)
      const paradasDesordenadas = [
        { id: 'partida', ordem: 5, is_checkpoint: false, observacoes: 'Partida' },
        { id: 'p1', ordem: 3, is_checkpoint: true, observacoes: null },
        { id: 'chegada', ordem: 1, is_checkpoint: false, observacoes: 'Chegada' },
      ];

      let updateCallCount = 0;

      // Mock mais simples que funciona para o fluxo completo
      mockFrom.mockImplementation((table: string) => {
        if (table === 'paradas') {
          return {
            select: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation((field: string, value: unknown) => {
              if (field === 'rota_id') {
                // Primeira chamada é para buscar paradas
                return {
                  order: jest.fn().mockResolvedValue({ data: paradasDesordenadas, error: null }),
                };
              }
              // Chamadas subsequentes são para update
              updateCallCount++;
              return Promise.resolve({ data: null, error: null });
            }),
            order: jest.fn().mockResolvedValue({ data: paradasDesordenadas, error: null }),
          };
        }
        return createSupabaseChain({ data: null, error: null });
      });

      const result = await normalizarOrdemParadas(mockRotaId);

      expect(result.success).toBe(true);
      // Deve ter chamado update múltiplas vezes (2 etapas x 3 paradas = 6 chamadas)
      expect(updateCallCount).toBeGreaterThan(0);
    });

    it('deve retornar erro se step 1 (temp values) falhar', async () => {
      const paradasDesordenadas = [
        { id: 'partida', ordem: 5, is_checkpoint: false, observacoes: 'Partida' },
        { id: 'p1', ordem: 3, is_checkpoint: true, observacoes: null },
      ];

      let callCount = 0;
      mockFrom.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation((field: string) => {
          if (field === 'rota_id') {
            return {
              order: jest.fn().mockResolvedValue({ data: paradasDesordenadas, error: null }),
            };
          }
          callCount++;
          // Falhar no primeiro update (step 1)
          if (callCount === 1) {
            return Promise.resolve({ data: null, error: { message: 'Update failed' } });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      }));

      const result = await normalizarOrdemParadas(mockRotaId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('valores temporários');
    });

    it('deve retornar erro se step 2 (target values) falhar', async () => {
      const paradasDesordenadas = [
        { id: 'partida', ordem: 5, is_checkpoint: false, observacoes: 'Partida' },
      ];

      let callCount = 0;
      mockFrom.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation((field: string) => {
          if (field === 'rota_id') {
            return {
              order: jest.fn().mockResolvedValue({ data: paradasDesordenadas, error: null }),
            };
          }
          callCount++;
          // Falhar no segundo update (step 2) - depois do step 1 concluir
          if (callCount === 2) {
            return Promise.resolve({ data: null, error: { message: 'Step 2 failed' } });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      }));

      const result = await normalizarOrdemParadas(mockRotaId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ordem correta');
    });

    it('deve capturar exceções', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await normalizarOrdemParadas(mockRotaId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('removerParadaERecalcular', () => {
    const mockParadaId = 'parada-to-remove';
    const mockRotaId = 'rota-789';
    const mockEnderecoUnidade = { latitude: -23.55, longitude: -46.63 };
    const mockParadasRestantes = [
      { id: 'p1', ordem: 1, latitude: -23.56, longitude: -46.64 },
    ];

    it('deve retornar erro se reordenação falhar', async () => {
      // Mock para delete (sucesso)
      const deleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockFrom.mockReturnValueOnce(deleteChain);

      // Mock para reordenarParadas (RPC falha)
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: '50000', message: 'RPC error' },
      });

      const result = await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('reordenar');
    });

    it('deve retornar erro se recálculo falhar', async () => {
      // Mock para delete (sucesso)
      const deleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockFrom.mockReturnValueOnce(deleteChain);

      // Mock para reordenarParadas (RPC sucesso)
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      // Mock para recalcularRota - Google Directions falha
      mockGetDirectionsSequential.mockResolvedValue(null);

      const result = await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Não foi possível calcular');
    });

    it('deve retornar erro se delete falhar', async () => {
      const chain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'Delete failed' } }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Erro ao remover parada');
    });

    it('deve deletar, reordenar e recalcular com sucesso', async () => {
      // Mock para delete
      const deleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockFrom.mockReturnValueOnce(deleteChain);

      // Mock para reordenarParadas (RPC)
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      // Mock para recalcularRota (update)
      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockFrom.mockReturnValue(updateChain);

      mockGetDirectionsSequential.mockResolvedValue({
        distancia_total_metros: 5000,
        duracao_total_segundos: 300,
        polyline: 'test',
      });

      const result = await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade
      );

      expect(result.success).toBe(true);
      expect(deleteChain.delete).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith('reordenar_paradas', expect.any(Object));
    });

    it('deve registrar log quando usuarioId é fornecido', async () => {
      const deleteChain = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      const insertChain = {
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockFrom
        .mockReturnValueOnce(deleteChain) // delete
        .mockReturnValueOnce(updateChain) // update (recalcular)
        .mockReturnValueOnce(insertChain); // insert log

      mockRpc.mockResolvedValue({ data: { success: true }, error: null });
      mockGetDirectionsSequential.mockResolvedValue({
        distancia_total_metros: 5000,
        duracao_total_segundos: 300,
        polyline: 'test',
      });

      const usuarioId = 'user-123';
      await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade,
        usuarioId
      );

      // Verificar que log foi inserido
      expect(mockFrom).toHaveBeenCalledWith('logs');
    });

    it('deve capturar exceções', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });
  });

  describe('notificarMotoristaRotaEditada', () => {
    const baseParams = {
      rotaId: 'rota-notify',
      motoristaId: 'motorista-123',
      tipo: 'rota_parada_adicionada' as NotificacaoRotaEditadaTipo,
      titulo: 'Rota Atualizada',
      mensagem: 'Uma nova parada foi adicionada à sua rota',
    };

    it('deve retornar erro se rota não for encontrada', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await notificarMotoristaRotaEditada(baseParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rota não encontrada');
    });

    it('deve retornar sucesso sem notificar se rota está concluída', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { status: 'concluida' }, error: null }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await notificarMotoristaRotaEditada(baseParams);

      expect(result.success).toBe(true);
      // RPC não deve ser chamado
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('deve retornar sucesso sem notificar se rota está cancelada', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { status: 'cancelada' }, error: null }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await notificarMotoristaRotaEditada(baseParams);

      expect(result.success).toBe(true);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('deve criar notificação para rota pendente', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { status: 'pendente' }, error: null }),
      };
      mockFrom.mockReturnValue(chain);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await notificarMotoristaRotaEditada(baseParams);

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('criar_notificacao', {
        p_usuario_id: baseParams.motoristaId,
        p_tipo: baseParams.tipo,
        p_titulo: baseParams.titulo,
        p_mensagem: baseParams.mensagem,
        p_rota_id: baseParams.rotaId,
        p_parada_id: null,
        p_incidente_id: null,
      });
    });

    it('deve criar notificação para rota em_andamento com paradaId', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { status: 'em_andamento' }, error: null }),
      };
      mockFrom.mockReturnValue(chain);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const paramsWithParada = {
        ...baseParams,
        paradaId: 'parada-xyz',
      };

      const result = await notificarMotoristaRotaEditada(paramsWithParada);

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('criar_notificacao', {
        p_usuario_id: baseParams.motoristaId,
        p_tipo: baseParams.tipo,
        p_titulo: baseParams.titulo,
        p_mensagem: baseParams.mensagem,
        p_rota_id: baseParams.rotaId,
        p_parada_id: 'parada-xyz',
        p_incidente_id: null,
      });
    });

    it('deve retornar erro se RPC criar_notificacao falhar', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { status: 'pendente' }, error: null }),
      };
      mockFrom.mockReturnValue(chain);
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

      const result = await notificarMotoristaRotaEditada(baseParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Erro ao criar notificação');
    });

    it('deve capturar exceções', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Connection timeout');
      });

      const result = await notificarMotoristaRotaEditada(baseParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });

    it('deve testar todos os tipos de notificação', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { status: 'pendente' }, error: null }),
      };
      mockFrom.mockReturnValue(chain);
      mockRpc.mockResolvedValue({ data: null, error: null });

      const tipos: NotificacaoRotaEditadaTipo[] = [
        'rota_parada_adicionada',
        'rota_parada_removida',
        'rota_parada_editada',
        'rota_reordenada',
      ];

      for (const tipo of tipos) {
        const result = await notificarMotoristaRotaEditada({ ...baseParams, tipo });
        expect(result.success).toBe(true);
      }

      expect(mockRpc).toHaveBeenCalledTimes(4);
    });
  });
});
