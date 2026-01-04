import {
  groupBy,
  isTimelineLogEvent,
  mapLogToTimelinePreview,
  mapLogToTimelineEvent,
  mapParadaToTimelineEvent,
  mapIncidenteToTimelineEvent,
  formatRelativeTime,
  getDateGroup,
  calculateDurationBetween,
  INCIDENTE_LABELS,
  CRITICAL_INCIDENT_CATEGORIES,
  escapeHtml,
} from '../utils';

describe('lib/utils', () => {
  describe('array utils', () => {
    it('groupBy deve agrupar itens', () => {
      const items = [{ type: 'a', val: 1 }, { type: 'b', val: 2 }, { type: 'a', val: 3 }];
      expect(groupBy(items, 'type')).toEqual({
        a: [{ type: 'a', val: 1 }, { type: 'a', val: 3 }],
        b: [{ type: 'b', val: 2 }],
      });
    });

    it('groupBy deve aceitar funcao de chave', () => {
      const items = [{ val: 1 }, { val: 2 }, { val: 3 }];
      const result = groupBy(items, (item) => (item.val % 2 === 0 ? 'par' : 'impar'));
      expect(result.par).toHaveLength(1);
      expect(result.impar).toHaveLength(2);
    });
  });

  // ============================================================================
  // TIMELINE FUNCTIONS TESTS
  // ============================================================================

  describe('timeline/mapLogToTimelineEvent', () => {
    it('deve mapear rota_criada corretamente', () => {
      const log = {
        id: '123',
        evento: 'rota_criada',
        timestamp: '2025-01-15T10:00:00Z',
        detalhes: { total_paradas: 5 },
      };

      const result = mapLogToTimelineEvent(log);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('log-123');
      expect(result?.type).toBe('status_change');
      expect(result?.title).toBe('Rota Criada');
      expect(result?.description).toContain('5 parada(s)');
      expect(result?.colorKey).toBe('purple');
      expect(result?.icon).toBe('add-circle');
    });

    it('deve mapear motorista_iniciou_rota corretamente', () => {
      const log = {
        id: '456',
        evento: 'motorista_iniciou_rota',
        timestamp: '2025-01-15T10:30:00Z',
        detalhes: null,
      };

      const result = mapLogToTimelineEvent(log);

      expect(result?.title).toBe('Rota Iniciada');
      expect(result?.colorKey).toBe('info');
      expect(result?.icon).toBe('play-circle');
    });

    it('deve mapear sos_acionado como crítico', () => {
      const log = {
        id: '789',
        evento: 'sos_acionado',
        timestamp: '2025-01-15T11:00:00Z',
        detalhes: { motivo: 'Emergência' },
      };

      const result = mapLogToTimelineEvent(log);

      expect(result?.title).toBe('🚨 SOS Acionado');
      expect(result?.isCritical).toBe(true);
      expect(result?.colorKey).toBe('error');
    });

    it('deve retornar null para evento desconhecido', () => {
      const log = {
        id: 'xxx',
        evento: 'evento_invalido',
        timestamp: '2025-01-15T12:00:00Z',
        detalhes: null,
      };

      const result = mapLogToTimelineEvent(log);
      expect(result).toBeNull();
    });

    it('deve mapear outros eventos de status', () => {
      const cancelada = mapLogToTimelineEvent({
        id: 'c1',
        evento: 'rota_cancelada',
        timestamp: '2025-01-15T10:00:00Z',
        detalhes: null,
      });

      const reativada = mapLogToTimelineEvent({
        id: 'r1',
        evento: 'rota_reativada',
        timestamp: '2025-01-15T10:00:00Z',
        detalhes: { reativado_por: 'Admin' },
      });

      expect(cancelada?.title).toBe('Rota Cancelada');
      expect(reativada?.description).toContain('Admin');
    });

    it('deve mapear paradas editadas e removidas', () => {
      const editada = mapLogToTimelineEvent({
        id: 'p1',
        evento: 'parada_editada',
        timestamp: '2025-01-15T10:00:00Z',
        detalhes: { campos_alterados: { endereco: true, telefone: true } },
      });

      const removida = mapLogToTimelineEvent({
        id: 'p2',
        evento: 'parada_removida',
        timestamp: '2025-01-15T10:00:00Z',
        detalhes: { paradas_restantes: 3 },
      });

      expect(editada?.description).toContain('endere');
      expect(removida?.description).toContain('3');
    });

    it('deve mapear resumo final e motorista alterado', () => {
      const finalizada = mapLogToTimelineEvent({
        id: 'f1',
        evento: 'rota_finalizada',
        timestamp: '2025-01-15T10:00:00Z',
        detalhes: { paradas_concluidas: 2, paradas_puladas: 1 },
      });

      const alterado = mapLogToTimelineEvent({
        id: 'm1',
        evento: 'motorista_alterado',
        timestamp: '2025-01-15T10:00:00Z',
        detalhes: { motorista_novo_nome: 'Novo Motorista' },
      });

      expect(finalizada?.title).toContain('Rota');
      expect(alterado?.description).toContain('Novo Motorista');
    });

    it('deve mapear paradas reordenadas e retomadas', () => {
      const reordenadas = mapLogToTimelineEvent({
        id: 'o1',
        evento: 'paradas_reordenadas',
        timestamp: '2025-01-15T10:00:00Z',
        detalhes: { alterado_por: 'Operador' },
      });

      const retomada = mapLogToTimelineEvent({
        id: 'p3',
        evento: 'parada_retomada',
        timestamp: '2025-01-15T10:00:00Z',
        detalhes: { endereco: 'Rua X' },
      });

      expect(reordenadas?.description).toContain('Operador');
      expect(retomada?.title).toBe('Parada Retomada');
    });
  });

  describe('timeline/isTimelineLogEvent', () => {
    it('reconhece eventos conhecidos e similares', () => {
      expect(isTimelineLogEvent('rota_criada')).toBe(true);
      expect(isTimelineLogEvent('Motorista iniciou rota')).toBe(true);
      expect(isTimelineLogEvent('cancelou a rota')).toBe(true);
    });

    it('retorna false para eventos desconhecidos', () => {
      expect(isTimelineLogEvent('evento_nao_mapeado')).toBe(false);
    });
  });

  describe('timeline/mapLogToTimelinePreview', () => {
    it('mapeia eventos de inicio e conclusao', () => {
      const inicio = mapLogToTimelinePreview({
        evento: 'motorista_iniciou_rota',
        timestamp: '2025-01-01T10:00:00Z',
      });
      const fim = mapLogToTimelinePreview({
        evento: 'motorista_concluiu_rota',
        timestamp: '2025-01-01T11:00:00Z',
      });

      expect(inicio?.type).toBe('inicio');
      expect(fim?.type).toBe('conclusao');
    });

    it('mapeia eventos de parada e incidente', () => {
      const parada = mapLogToTimelinePreview({
        evento: 'parada_adicionada',
        timestamp: '2025-01-01T10:30:00Z',
      });
      const sos = mapLogToTimelinePreview({
        evento: 'sos_acionado',
        timestamp: '2025-01-01T10:45:00Z',
      });

      expect(parada?.type).toBe('parada');
      expect(sos?.type).toBe('incidente');
    });

    it('retorna null quando nao mapeavel', () => {
      const result = mapLogToTimelinePreview({
        evento: 'evento_invalido',
        timestamp: '2025-01-01T10:00:00Z',
      });
      expect(result).toBeNull();
    });
  });

  describe('timeline/mapParadaToTimelineEvent', () => {
    it('deve mapear parada concluída corretamente', () => {
      const parada = {
        id: 'p1',
        ordem: 3,
        endereco: 'Rua Teste, 123',
        status: 'concluida' as const,
        concluida_em: '2025-01-15T14:00:00Z',
        foto_url: 'https://example.com/foto.jpg',
      };

      const result = mapParadaToTimelineEvent(parada);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('parada-p1');
      expect(result?.title).toBe('Parada #3 Concluída');
      expect(result?.colorKey).toBe('success');
      expect(result?.hasPhoto).toBe(true);
      expect(result?.photoUrl).toBe('https://example.com/foto.jpg');
    });

    it('deve mapear parada pulada corretamente', () => {
      const parada = {
        id: 'p2',
        ordem: 5,
        endereco: 'Av. Principal, 456',
        status: 'pulada' as const,
        concluida_em: '2025-01-15T15:00:00Z',
      };

      const result = mapParadaToTimelineEvent(parada);

      expect(result?.title).toBe('Parada #5 Pulada');
      expect(result?.colorKey).toBe('warning');
      expect(result?.icon).toBe('remove-circle');
    });

    it('deve ignorar checkpoints (is_checkpoint === false)', () => {
      const parada = {
        id: 'p3',
        ordem: 1,
        endereco: 'Checkpoint',
        status: 'concluida' as const,
        concluida_em: '2025-01-15T16:00:00Z',
        is_checkpoint: false,
      };

      const result = mapParadaToTimelineEvent(parada);
      expect(result).toBeNull();
    });

    it('deve retornar null para parada pendente', () => {
      const parada = {
        id: 'p4',
        ordem: 2,
        endereco: 'Rua Pendente',
        status: 'pendente' as const,
        concluida_em: null,
      };

      const result = mapParadaToTimelineEvent(parada);
      expect(result).toBeNull();
    });
  });

  describe('timeline/mapIncidenteToTimelineEvent', () => {
    it('deve mapear incidente corretamente', () => {
      const incidente = {
        id: 'i1',
        categoria: 'absent',
        descricao: 'Cliente não estava em casa',
        created_at: '2025-01-15T13:00:00Z',
      };

      const result = mapIncidenteToTimelineEvent(incidente);

      expect(result.id).toBe('incidente-i1');
      expect(result.title).toBe(INCIDENTE_LABELS['absent']);
      expect(result.description).toBe('Cliente não estava em casa');
      expect(result.colorKey).toBe('error');
      expect(result.isCritical).toBe(false);
    });

    it('deve marcar incidente crítico corretamente', () => {
      const incidente = {
        id: 'i2',
        categoria: 'accident',
        descricao: 'Colisão leve',
        created_at: '2025-01-15T14:00:00Z',
      };

      const result = mapIncidenteToTimelineEvent(incidente);

      expect(result.isCritical).toBe(true);
      expect(CRITICAL_INCIDENT_CATEGORIES).toContain('accident');
    });

    it('deve truncar descrição longa', () => {
      const longDescription = 'A'.repeat(100);
      const incidente = {
        id: 'i3',
        categoria: 'other',
        descricao: longDescription,
        created_at: '2025-01-15T15:00:00Z',
      };

      const result = mapIncidenteToTimelineEvent(incidente);

      expect(result.description.length).toBeLessThan(longDescription.length);
      expect(result.description).toContain('...');
      expect(result.fullDescription).toBe(longDescription);
    });

    it('deve lidar com categoria desconhecida e sem descricao', () => {
      const incidente = {
        id: 'i4',
        categoria: 'unknown',
        created_at: '2025-01-15T15:00:00Z',
        foto_url: 'http://foto',
      };

      const result = mapIncidenteToTimelineEvent(incidente);

      expect(result.title).toBe('Incidente');
      expect(result.hasPhoto).toBe(true);
      expect(result.description).toBe('');
    });
  });

  describe('timeline/formatRelativeTime', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve retornar "agora" para menos de 1 minuto', () => {
      const timestamp = new Date('2025-01-15T11:59:30Z').toISOString();
      expect(formatRelativeTime(timestamp)).toBe('agora');
    });

    it('deve retornar "há X min" para menos de 1 hora', () => {
      const timestamp = new Date('2025-01-15T11:45:00Z').toISOString();
      expect(formatRelativeTime(timestamp)).toBe('há 15 min');
    });

    it('deve retornar "há Xh" para menos de 24 horas', () => {
      const timestamp = new Date('2025-01-15T09:00:00Z').toISOString();
      expect(formatRelativeTime(timestamp)).toBe('há 3h');
    });

    it('deve retornar "ontem HH:MM" para ontem', () => {
      // Definir horário de "agora" como meio-dia do dia 15
      // E timestamp de ontem às 10:00 (mais de 24h atrás, mas no dia anterior)
      jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
      const timestamp = new Date('2025-01-14T10:00:00Z').toISOString();
      const result = formatRelativeTime(timestamp);
      expect(result).toContain('ontem');
    });

    it('deve retornar data e hora para menos de 7 dias', () => {
      const timestamp = new Date('2025-01-12T10:00:00Z').toISOString();
      const result = formatRelativeTime(timestamp);
      expect(result).toMatch(/\d{2}\/\d{2}/);
    });

    it('deve retornar apenas data para mais de 7 dias', () => {
      const timestamp = new Date('2025-01-01T10:00:00Z').toISOString();
      const result = formatRelativeTime(timestamp);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });

  describe('timeline/getDateGroup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve retornar "Hoje" para eventos de hoje', () => {
      const timestamp = new Date('2025-01-15T08:00:00Z').toISOString();
      expect(getDateGroup(timestamp)).toBe('Hoje');
    });

    it('deve retornar "Ontem" para eventos de ontem', () => {
      const timestamp = new Date('2025-01-14T14:00:00Z').toISOString();
      expect(getDateGroup(timestamp)).toBe('Ontem');
    });

    it('deve retornar data formatada para eventos antigos', () => {
      const timestamp = new Date('2025-01-10T10:00:00Z').toISOString();
      const result = getDateGroup(timestamp);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });

  describe('timeline/calculateDurationBetween', () => {
    it('deve calcular duração entre eventos', () => {
      const start = '2025-01-15T10:00:00Z';
      const end = '2025-01-15T10:15:00Z';

      const result = calculateDurationBetween(start, end);

      expect(result).toContain('15');
      expect(result).toContain('min');
    });

    it('deve retornar null para duração menor que 1 minuto', () => {
      const start = '2025-01-15T10:00:00Z';
      const end = '2025-01-15T10:00:30Z';

      const result = calculateDurationBetween(start, end);
      expect(result).toBeNull();
    });

    it('deve formatar horas corretamente', () => {
      const start = '2025-01-15T10:00:00Z';
      const end = '2025-01-15T12:30:00Z';

      const result = calculateDurationBetween(start, end);

      expect(result).toContain('2h');
      expect(result).toContain('30');
    });

    it('deve retornar apenas horas quando minutos forem zero', () => {
      const start = '2025-01-15T10:00:00Z';
      const end = '2025-01-15T11:00:00Z';

      const result = calculateDurationBetween(start, end);

      expect(result).toContain('1h');
    });
  });

  describe('escapeHtml', () => {
    it('deve escapar caracteres HTML', () => {
      const result = escapeHtml('<div>"teste"&\'</div>');
      expect(result).toBe('&lt;div&gt;&quot;teste&quot;&amp;&#039;&lt;/div&gt;');
    });

    it('deve lidar com valores vazios', () => {
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml(null)).toBe('');
    });
  });
});
