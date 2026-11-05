/**
 * Tests for routeUtils.ts
 * Funções de manipulação de rotas
 */

import { criarCadeia } from '@/__tests__/helpers/cadeiaSupabase';
import { logger } from '@/lib/logger';

import {
  recalcularRota,
  reordenarParadas,
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

const mockMarcarOtimizacao = jest.fn();
jest.mock('@/lib/gestor/otimizacaoRota', () => ({
  marcarOtimizacaoAlterada: (...args: unknown[]) =>
    mockMarcarOtimizacao(...args),
}));

// Mock do Google Maps service
const mockGetDirectionsSequential = jest.fn();

jest.mock('@/lib/google', () => ({
  googleMapsService: {
    getDirectionsSequential: (...args: unknown[]) =>
      mockGetDirectionsSequential(...args),
  },
}));

// Fica local (não usa criarCadeia): só o `.select` final resolve, então o
// teste quebra se a remoção deixar de pedir as linhas apagadas (`.select('id')`).
// DELETE de parada: `.delete().eq('id').eq('status', 'pendente').select('id')`.
function cadeiaDelete(resultado: { data: unknown; error: unknown }) {
  const cadeia = {
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue(resultado),
  };
  return cadeia;
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
      {
        id: 'p1',
        ordem: 1,
        latitude: -23.56,
        longitude: -46.64,
        is_checkpoint: true,
      },
      {
        id: 'p2',
        ordem: 2,
        latitude: -23.57,
        longitude: -46.65,
        is_checkpoint: true,
      },
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

    it('deve retornar erro se coordenadas da unidade estão fora do intervalo', async () => {
      const result = await recalcularRota(mockRotaId, mockParadas, {
        latitude: -23.55,
        longitude: 181,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Coordenadas da unidade inválidas');
    });

    it('deve atualizar com valores zerados se não há waypoints válidos', async () => {
      const chain = criarCadeia({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const paradasSemCoordenadas = [
        { id: 'p1', ordem: 1, latitude: null, longitude: null },
      ];

      const result = await recalcularRota(
        mockRotaId,
        paradasSemCoordenadas,
        validEnderecoUnidade,
      );

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('rotas');
      expect(chain.update).toHaveBeenCalledWith({
        distancia_total: 0,
        tempo_total: 0,
        polyline: null,
      });
    });

    it('deve filtrar paradas com is_checkpoint === false', async () => {
      const chain = criarCadeia({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const paradasMistas = [
        {
          id: 'p1',
          ordem: 0,
          latitude: -23.55,
          longitude: -46.63,
          is_checkpoint: false,
        }, // Checkpoint de partida
        {
          id: 'p2',
          ordem: 1,
          latitude: -23.56,
          longitude: -46.64,
          is_checkpoint: true,
        },
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
        ],
      );
    });

    it('deve retornar erro se Google Directions falhar', async () => {
      const chain = criarCadeia({ data: null, error: null });
      mockFrom.mockReturnValue(chain);
      mockGetDirectionsSequential.mockResolvedValue(null);

      const result = await recalcularRota(
        mockRotaId,
        mockParadas,
        validEnderecoUnidade,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Não foi possível calcular a rota');
      expect(chain.update).toHaveBeenCalledWith({
        distancia_total: null,
        tempo_total: null,
        polyline: null,
      });
    });

    it('B-GES-1: rota estimada em linha reta (OSRM fora) não é gravada como real', async () => {
      const chain = criarCadeia({ data: null, error: null });
      mockFrom.mockReturnValue(chain);
      mockGetDirectionsSequential.mockResolvedValue({
        distancia_total_metros: 13000,
        duracao_total_segundos: 1500,
        polyline: '',
        is_estimated: true,
      });

      const result = await recalcularRota(
        mockRotaId,
        mockParadas,
        validEnderecoUnidade,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Não foi possível calcular a rota');
      // só a invalidação (null) pode ter sido gravada: nunca a distância inventada
      expect(chain.update).toHaveBeenCalledTimes(1);
      expect(chain.update).toHaveBeenCalledWith({
        distancia_total: null,
        tempo_total: null,
        polyline: null,
      });
    });

    it('deve atualizar rota com sucesso quando Google Directions retorna dados', async () => {
      const chain = criarCadeia({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      mockGetDirectionsSequential.mockResolvedValue({
        distancia_total_metros: 10000, // 10km
        duracao_total_segundos: 1200, // 20 minutos
        polyline: 'test_polyline_encoded',
      });

      const result = await recalcularRota(
        mockRotaId,
        mockParadas,
        validEnderecoUnidade,
      );

      expect(result.success).toBe(true);
      expect(chain.update).toHaveBeenCalledWith({
        distancia_total: 10, // 10000m / 1000 = 10km
        tempo_total: 20, // 1200s / 60 = 20min
        polyline: 'test_polyline_encoded',
      });
    });

    it('deve retornar erro se update do Supabase falhar', async () => {
      const chain = criarCadeia({ data: null, error: null });
      // Sobrescrever para simular erro
      chain.eq.mockImplementation(() => ({
        then: (
          resolve: (value: { data: null; error: { message: string } }) => void,
        ) =>
          Promise.resolve({
            data: null,
            error: { message: 'Update failed' },
          }).then(resolve),
      }));
      mockFrom.mockReturnValue(chain);

      mockGetDirectionsSequential.mockResolvedValue({
        distancia_total_metros: 10000,
        duracao_total_segundos: 1200,
        polyline: 'test',
      });

      const result = await recalcularRota(
        mockRotaId,
        mockParadas,
        validEnderecoUnidade,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Erro ao salvar dados da rota');
    });

    it('deve capturar exceções e retornar erro', async () => {
      mockGetDirectionsSequential.mockRejectedValue(new Error('Network error'));

      const result = await recalcularRota(
        mockRotaId,
        mockParadas,
        validEnderecoUnidade,
      );

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
      mockRpc.mockResolvedValue({
        data: { success: true, updated: 3 },
        error: null,
      });

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

    it('R-DB-1: RPC inexistente (42883) é erro simples, sem reserva não atômica', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: '42883', message: 'function does not exist' },
      });

      const result = await reordenarParadas([
        { id: 'p1', ordem: 1, latitude: -23.55, longitude: -46.63 },
      ]);

      expect(result).toEqual({
        success: false,
        error: 'Erro ao reordenar paradas.',
      });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('deve retornar erro se RPC retorna erro genérico', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: '50000', message: 'Some database error' },
      });

      const paradas = [
        { id: 'p1', ordem: 1, latitude: -23.55, longitude: -46.63 },
      ];

      const result = await reordenarParadas(paradas);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Erro ao reordenar paradas');
    });

    it('deve retornar erro se RPC retorna data.success = false', async () => {
      const erro = jest.spyOn(logger, 'error').mockImplementation(() => {});
      mockRpc.mockResolvedValue({
        data: { success: false, error: 'Custom RPC error' },
        error: null,
      });

      const paradas = [
        { id: 'p1', ordem: 1, latitude: -23.55, longitude: -46.63 },
      ];

      const result = await reordenarParadas(paradas);

      expect(result.success).toBe(false);
      // B-DB-1: o SQLERRM cru não vai para o toast; só para o logger.
      expect(result.error).toBe('Erro ao reordenar paradas.');
      expect(erro).toHaveBeenCalledWith(
        '[reordenarParadas] RPC returned error',
        { error: 'Custom RPC error' },
      );
    });

    it('deve capturar exceções', async () => {
      mockRpc.mockRejectedValue(new Error('RPC exception'));

      const paradas = [
        { id: 'p1', ordem: 1, latitude: -23.55, longitude: -46.63 },
      ];

      const result = await reordenarParadas(paradas);

      expect(result.success).toBe(false);
      // B-DB-1: texto da exceção só no logger, nunca no toast.
      expect(result.error).toBe('Erro ao reordenar paradas.');
    });
  });

  describe('removerParadaERecalcular', () => {
    const mockParadaId = 'parada-to-remove';
    const mockRotaId = 'rota-789';
    const mockEnderecoUnidade = { latitude: -23.55, longitude: -46.63 };
    const mockParadasRestantes = [
      { id: 'p1', ordem: 1, latitude: -23.56, longitude: -46.64 },
    ];

    it('marca a rota otimizada como alterada quando a remoção acontece (G12)', async () => {
      mockMarcarOtimizacao.mockResolvedValue(true);
      mockFrom.mockReturnValueOnce(
        cadeiaDelete({ data: [{ id: mockParadaId }], error: null }),
      );
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });
      mockGetDirectionsSequential.mockResolvedValue(null);

      await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade,
      );

      expect(mockMarcarOtimizacao).toHaveBeenCalledTimes(1);
      expect(mockMarcarOtimizacao).toHaveBeenCalledWith(mockRotaId);
    });

    it('não marca nada quando o DELETE não apagou a parada (G12)', async () => {
      mockFrom.mockReturnValueOnce(cadeiaDelete({ data: [], error: null }));

      const result = await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade,
      );

      expect(result.success).toBe(false);
      expect(mockMarcarOtimizacao).not.toHaveBeenCalled();
    });

    it('deve confirmar remoção com ressalva se reordenação falhar', async () => {
      // Mock para delete (sucesso)
      const deleteChain = cadeiaDelete({
        data: [{ id: mockParadaId }],
        error: null,
      });
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
        mockEnderecoUnidade,
      );

      expect(result.success).toBe(true);
      expect(result.routeRecalculationFailed).toBe(true);
      expect(result.error).toContain('reordenar');
    });

    it('deve confirmar remoção com ressalva se recálculo falhar', async () => {
      // Mock para delete (sucesso)
      const deleteChain = cadeiaDelete({
        data: [{ id: mockParadaId }],
        error: null,
      });
      mockFrom.mockReturnValueOnce(deleteChain);

      // Mock para reordenarParadas (RPC sucesso)
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      // Mock para recalcularRota - Google Directions falha
      mockGetDirectionsSequential.mockResolvedValue(null);

      const result = await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade,
      );

      expect(result.success).toBe(true);
      expect(result.routeRecalculationFailed).toBe(true);
      expect(result.error).toContain('Não foi possível calcular');
    });

    it('deve retornar erro se delete falhar', async () => {
      const chain = cadeiaDelete({
        data: null,
        error: { message: 'Delete failed' },
      });
      mockFrom.mockReturnValue(chain);

      const result = await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Erro ao remover parada');
    });

    it('deve deletar, reordenar e recalcular com sucesso', async () => {
      // Mock para delete
      const deleteChain = cadeiaDelete({
        data: [{ id: mockParadaId }],
        error: null,
      });
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
        mockEnderecoUnidade,
      );

      expect(result.success).toBe(true);
      expect(deleteChain.delete).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith(
        'reordenar_paradas',
        expect.any(Object),
      );
    });

    it('deve registrar log quando usuarioId é fornecido', async () => {
      const deleteChain = cadeiaDelete({
        data: [{ id: mockParadaId }],
        error: null,
      });
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
        usuarioId,
      );

      // Verificar que log foi inserido
      expect(mockFrom).toHaveBeenCalledWith('logs');
    });

    it('parada_removida: parada_id vai em detalhes e recusa do banco avisa por logger.warn (B7)', async () => {
      const aviso = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      const insert = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'recusado' } });
      mockFrom
        .mockReturnValueOnce(
          cadeiaDelete({ data: [{ id: mockParadaId }], error: null }),
        )
        // releitura das paradas que sobraram
        .mockReturnValueOnce(
          criarCadeia({
            data: [{ id: 'p1', ordem: 1, latitude: -23.56, longitude: -46.64 }],
            error: null,
          }),
        )
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        })
        .mockReturnValueOnce({ insert });
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });
      mockGetDirectionsSequential.mockResolvedValue(null);

      const result = await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade,
        'user-123',
      );

      expect(insert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        rota_id: mockRotaId,
        evento: 'parada_removida',
        detalhes: { parada_id: mockParadaId, paradas_restantes: 1 },
      });
      expect(aviso).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ evento: 'parada_removida' }),
      );
      expect(result.success).toBe(true);
    });

    it('R-GES-2: renumera pelas paradas que o BANCO tem, não pelo retrato velho da tela', async () => {
      mockFrom
        .mockReturnValueOnce(
          cadeiaDelete({ data: [{ id: mockParadaId }], error: null }),
        )
        .mockReturnValueOnce(
          criarCadeia({
            data: [
              // partida (checkpoint) fora; outro gestor acrescentou 'novo'
              {
                id: 'base',
                ordem: 0,
                latitude: 0,
                longitude: 0,
                is_checkpoint: false,
              },
              {
                id: 'p1',
                ordem: 1,
                latitude: -23.56,
                longitude: -46.64,
                is_checkpoint: true,
              },
              {
                id: 'novo',
                ordem: 2,
                latitude: -23.57,
                longitude: -46.65,
                is_checkpoint: true,
              },
            ],
            error: null,
          }),
        )
        .mockReturnValue(criarCadeia({ data: null, error: null }));
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });
      mockGetDirectionsSequential.mockResolvedValue(null);

      await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes, // a tela só conhece p1
        mockEnderecoUnidade,
      );

      expect(mockRpc).toHaveBeenCalledWith('reordenar_paradas', {
        p_parada_ids: ['p1', 'novo'],
        p_novas_ordens: [1, 2],
      });
    });

    it('R-GES-2: releitura falhando cai no retrato da tela', async () => {
      mockFrom
        .mockReturnValueOnce(
          cadeiaDelete({ data: [{ id: mockParadaId }], error: null }),
        )
        .mockReturnValueOnce(
          criarCadeia({ data: null, error: { message: 'rede' } }),
        )
        .mockReturnValue(criarCadeia({ data: null, error: null }));
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });
      mockGetDirectionsSequential.mockResolvedValue(null);
      jest.spyOn(logger, 'warn').mockImplementation(() => {});

      await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade,
      );

      expect(mockRpc).toHaveBeenCalledWith('reordenar_paradas', {
        p_parada_ids: ['p1'],
        p_novas_ordens: [1],
      });
    });

    it('só apaga parada que ainda não foi finalizada (condiciona o DELETE ao status)', async () => {
      const deleteChain = cadeiaDelete({
        data: [{ id: mockParadaId }],
        error: null,
      });
      mockFrom.mockReturnValueOnce(deleteChain);
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
      mockGetDirectionsSequential.mockResolvedValue(null);

      await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade,
      );

      // Só `pendente`: é a mesma regra da tela (podeAlterarParada). Parada que o
      // motorista já iniciou (em_andamento) também não se remove.
      expect(deleteChain.eq).toHaveBeenCalledWith('status', 'pendente');
    });

    it('zero linhas apagadas (o motorista concluiu a parada): erro explicado, sem reordenar', async () => {
      mockFrom.mockReturnValue(cadeiaDelete({ data: [], error: null }));

      const result = await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Esta parada não pode mais ser removida: o motorista já a iniciou ou finalizou, ou ela não existe mais. A tela foi atualizada.',
      );
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('o banco recusa a parada finalizada (PARADA_FINALIZADA): mostra o motivo em português', async () => {
      mockFrom.mockReturnValue(
        cadeiaDelete({
          data: null,
          error: {
            code: 'P0001',
            message:
              'PARADA_FINALIZADA: a parada já foi concluída e não pode ser removida.',
          },
        }),
      );

      const result = await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Esta parada já foi finalizada pelo motorista e não pode ser removida.',
      );
      expect(result.error).not.toMatch(/PARADA_FINALIZADA|P0001/);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('deve capturar exceções', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await removerParadaERecalcular(
        mockParadaId,
        mockRotaId,
        mockParadasRestantes,
        mockEnderecoUnidade,
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
        single: jest
          .fn()
          .mockResolvedValue({ data: null, error: { message: 'Not found' } }),
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
        single: jest
          .fn()
          .mockResolvedValue({ data: { status: 'concluida' }, error: null }),
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
        single: jest
          .fn()
          .mockResolvedValue({ data: { status: 'cancelada' }, error: null }),
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
        single: jest
          .fn()
          .mockResolvedValue({ data: { status: 'pendente' }, error: null }),
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
        single: jest
          .fn()
          .mockResolvedValue({ data: { status: 'em_andamento' }, error: null }),
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
        single: jest
          .fn()
          .mockResolvedValue({ data: { status: 'pendente' }, error: null }),
      };
      mockFrom.mockReturnValue(chain);
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

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
        single: jest
          .fn()
          .mockResolvedValue({ data: { status: 'pendente' }, error: null }),
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
        const result = await notificarMotoristaRotaEditada({
          ...baseParams,
          tipo,
        });
        expect(result.success).toBe(true);
      }

      expect(mockRpc).toHaveBeenCalledTimes(4);
    });
  });
});
