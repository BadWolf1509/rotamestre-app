/**
 * Tests for logs queries
 */

// Mock supabase
const mockInsert = jest.fn();
const mockFrom = jest.fn(() => ({
  insert: mockInsert,
}));

jest.mock('../queryClient', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import { logger } from '@/lib/logger';

import {
  logAction,
  logRotaAction,
  logParadaAction,
  logUserAction,
  LOG_EVENTS,
} from '../logs';

describe('logs queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  describe('logAction', () => {
    // A tabela `logs` tem exatamente: id, usuario_id, rota_id, evento,
    // detalhes, timestamp. NÃO existe coluna `parada_id` — mandá-la fazia o
    // PostgREST recusar o insert com 400, e como o erro só virava logger.warn,
    // o rastro de auditoria morria em silêncio. O vínculo com a parada vai em
    // `detalhes`, que é o padrão já usado em useAddStopForm, useEditStopForm e
    // routeUtils. Estes testes antes afirmavam `parada_id` no insert: eles
    // travaram o defeito no lugar por meses, porque validavam um schema
    // inventado em vez do real.
    it('nunca manda a coluna parada_id, que não existe na tabela', async () => {
      await logAction({
        usuario_id: 'user-123',
        evento: 'parada_concluida',
        rota_id: 'rota-456',
        parada_id: 'parada-789',
      });

      const payload = mockInsert.mock.calls[0][0];
      expect(payload).not.toHaveProperty('parada_id');
      expect(Object.keys(payload).sort()).toEqual([
        'detalhes',
        'evento',
        'rota_id',
        'usuario_id',
      ]);
    });

    it('should insert log entry into logs table', async () => {
      await logAction({
        usuario_id: 'user-123',
        evento: 'test_event',
      });

      expect(mockFrom).toHaveBeenCalledWith('logs');
      expect(mockInsert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        evento: 'test_event',
        rota_id: null,
        detalhes: null,
      });
    });

    it('should include rota_id when provided', async () => {
      await logAction({
        usuario_id: 'user-123',
        evento: 'rota_iniciada',
        rota_id: 'rota-456',
      });

      expect(mockInsert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        evento: 'rota_iniciada',
        rota_id: 'rota-456',
        detalhes: null,
      });
    });

    it('guarda a parada dentro de detalhes, preservando o que já estava lá', async () => {
      await logAction({
        usuario_id: 'user-123',
        evento: 'parada_concluida',
        rota_id: 'rota-456',
        parada_id: 'parada-789',
        detalhes: { metodo: 'manual' },
      });

      expect(mockInsert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        evento: 'parada_concluida',
        rota_id: 'rota-456',
        detalhes: { metodo: 'manual', parada_id: 'parada-789' },
      });
    });

    it('should include detalhes when provided', async () => {
      const detalhes = { old_status: 'pendente', new_status: 'concluida' };

      await logAction({
        usuario_id: 'user-123',
        evento: 'rota_status_alterado',
        detalhes,
      });

      expect(mockInsert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        evento: 'rota_status_alterado',
        rota_id: null,
        detalhes,
      });
    });

    it('should handle null values in optional fields', async () => {
      await logAction({
        usuario_id: 'user-123',
        evento: 'test_event',
        rota_id: null,
        parada_id: null,
        detalhes: null,
      });

      expect(mockInsert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        evento: 'test_event',
        rota_id: null,
        detalhes: null,
      });
    });

    it('should log warning when insert fails', async () => {
      mockInsert.mockResolvedValueOnce({
        error: { message: 'Insert failed' },
      });

      await logAction({
        usuario_id: 'user-123',
        evento: 'test_event',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to log action:',
        expect.objectContaining({
          evento: 'test_event',
          error: { message: 'Insert failed' },
        }),
      );
    });

    it('should catch and log exception', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Network error'));

      await logAction({
        usuario_id: 'user-123',
        evento: 'test_event',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to log action:',
        expect.objectContaining({
          evento: 'test_event',
          error: expect.any(Error),
        }),
      );
    });
  });

  describe('logRotaAction', () => {
    it('should log action with rota context', async () => {
      await logRotaAction('user-123', 'rota-456', 'rota_iniciada');

      expect(mockInsert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        evento: 'rota_iniciada',
        rota_id: 'rota-456',
        detalhes: null,
      });
    });

    it('should include detalhes when provided', async () => {
      const detalhes = { motorista_nome: 'João' };

      await logRotaAction('user-123', 'rota-456', 'rota_atribuida', detalhes);

      expect(mockInsert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        evento: 'rota_atribuida',
        rota_id: 'rota-456',
        detalhes,
      });
    });
  });

  describe('logParadaAction', () => {
    it('should log action with parada and rota context', async () => {
      await logParadaAction(
        'user-123',
        'parada-789',
        'rota-456',
        'parada_concluida',
      );

      expect(mockInsert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        evento: 'parada_concluida',
        rota_id: 'rota-456',
        detalhes: { parada_id: 'parada-789' },
      });
    });

    it('should include detalhes when provided', async () => {
      const detalhes = { foto_url: 'https://example.com/foto.jpg' };

      await logParadaAction(
        'user-123',
        'parada-789',
        'rota-456',
        'parada_foto_enviada',
        detalhes,
      );

      expect(mockInsert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        evento: 'parada_foto_enviada',
        rota_id: 'rota-456',
        detalhes: { ...detalhes, parada_id: 'parada-789' },
      });
    });
  });

  describe('logUserAction', () => {
    it('should log action without rota/parada context', async () => {
      await logUserAction('user-123', 'perfil_atualizado');

      expect(mockInsert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        evento: 'perfil_atualizado',
        rota_id: null,
        detalhes: null,
      });
    });

    it('should include detalhes when provided', async () => {
      const detalhes = { campo_alterado: 'nome' };

      await logUserAction('user-123', 'perfil_atualizado', detalhes);

      expect(mockInsert).toHaveBeenCalledWith({
        usuario_id: 'user-123',
        evento: 'perfil_atualizado',
        rota_id: null,
        detalhes,
      });
    });
  });

  describe('LOG_EVENTS', () => {
    it('should have rota events', () => {
      expect(LOG_EVENTS.ROTA_CRIADA).toBe('rota_criada');
      expect(LOG_EVENTS.ROTA_INICIADA).toBe('rota_iniciada');
      expect(LOG_EVENTS.ROTA_CONCLUIDA).toBe('rota_concluida');
      expect(LOG_EVENTS.ROTA_CANCELADA).toBe('rota_cancelada');
      expect(LOG_EVENTS.ROTA_ATRIBUIDA).toBe('rota_atribuida');
      expect(LOG_EVENTS.ROTA_EXCLUIDA).toBe('rota_excluida');
    });

    it('should have parada events', () => {
      expect(LOG_EVENTS.PARADA_CONCLUIDA).toBe('parada_concluida');
      expect(LOG_EVENTS.PARADA_PULADA).toBe('parada_pulada');
      expect(LOG_EVENTS.PARADA_FOTO_ENVIADA).toBe('parada_foto_enviada');
    });

    it('should have incidente events', () => {
      expect(LOG_EVENTS.INCIDENTE_CRIADO).toBe('incidente_criado');
      expect(LOG_EVENTS.INCIDENTE_STATUS_ALTERADO).toBe(
        'incidente_status_alterado',
      );
    });

    it('should have user events', () => {
      expect(LOG_EVENTS.MOTORISTA_CRIADO).toBe('motorista_criado');
      expect(LOG_EVENTS.MOTORISTA_ATUALIZADO).toBe('motorista_atualizado');
      expect(LOG_EVENTS.MOTORISTA_DESATIVADO).toBe('motorista_desativado');
      expect(LOG_EVENTS.PERFIL_ATUALIZADO).toBe('perfil_atualizado');
    });
  });
});
