/**
 * Tests for timeline.ts
 * Timeline utility functions for mapping logs, paradas, and incidents to timeline events.
 */

import {
  TIMELINE_LOG_EVENTS,
  INCIDENTE_LABELS,
  CRITICAL_INCIDENT_CATEGORIES,
  isTimelineLogEvent,
  mapLogToTimelinePreview,
  mapLogToTimelineEvent,
  mapParadaToTimelineEvent,
  mapIncidenteToTimelineEvent,
  formatRelativeTime,
  getDateGroup,
  calculateDurationBetween,
  computeNewlyAddedIds,
} from '../timeline';

describe('timeline', () => {
  // ============================================================================
  // CONSTANTS
  // ============================================================================

  describe('TIMELINE_LOG_EVENTS', () => {
    it('should include all expected event types', () => {
      expect(TIMELINE_LOG_EVENTS).toContain('rota_criada');
      expect(TIMELINE_LOG_EVENTS).toContain('motorista_iniciou_rota');
      expect(TIMELINE_LOG_EVENTS).toContain('motorista_concluiu_rota');
      expect(TIMELINE_LOG_EVENTS).toContain('rota_cancelada');
      expect(TIMELINE_LOG_EVENTS).toContain('sos_acionado');
      expect(TIMELINE_LOG_EVENTS).toContain('parada_adicionada');
      expect(TIMELINE_LOG_EVENTS).toContain('parada_editada');
      expect(TIMELINE_LOG_EVENTS).toContain('parada_removida');
      expect(TIMELINE_LOG_EVENTS).toContain('paradas_reordenadas');
      expect(TIMELINE_LOG_EVENTS).toContain('motorista_alterado');
      expect(TIMELINE_LOG_EVENTS).toContain('rota_reativada');
      expect(TIMELINE_LOG_EVENTS).toContain('rota_finalizada');
      expect(TIMELINE_LOG_EVENTS).toContain('parada_reaberta');
      expect(TIMELINE_LOG_EVENTS).toContain('parada_retomada');
    });
  });

  describe('INCIDENTE_LABELS', () => {
    it('should have labels for all incident categories', () => {
      expect(INCIDENTE_LABELS.accident).toBe('Acidente/Incidente');
      expect(INCIDENTE_LABELS.absent).toBe('Cliente ausente');
      expect(INCIDENTE_LABELS.wrong_address).toBe('Endereço incorreto');
      expect(INCIDENTE_LABELS.blocked).toBe('Acesso bloqueado');
      expect(INCIDENTE_LABELS.vehicle).toBe('Problema no veículo');
      expect(INCIDENTE_LABELS.weather).toBe('Condições climáticas');
      expect(INCIDENTE_LABELS.other).toBe('Outros');
    });
  });

  describe('CRITICAL_INCIDENT_CATEGORIES', () => {
    it('should include accident and vehicle', () => {
      expect(CRITICAL_INCIDENT_CATEGORIES).toEqual(['accident', 'vehicle']);
    });
  });

  // ============================================================================
  // isTimelineLogEvent
  // ============================================================================

  describe('isTimelineLogEvent', () => {
    it('should return true for exact event matches', () => {
      expect(isTimelineLogEvent('rota_criada')).toBe(true);
      expect(isTimelineLogEvent('sos_acionado')).toBe(true);
      expect(isTimelineLogEvent('parada_adicionada')).toBe(true);
    });

    it('should return true for case-insensitive matches', () => {
      expect(isTimelineLogEvent('ROTA_CRIADA')).toBe(true);
      expect(isTimelineLogEvent('Motorista_Iniciou_Rota')).toBe(true);
    });

    it('should return true for substring pattern matches', () => {
      expect(isTimelineLogEvent('motorista_iniciou_algo')).toBe(true);
      expect(isTimelineLogEvent('alguem_concluiu_algo')).toBe(true);
      expect(isTimelineLogEvent('rota_finalizou')).toBe(true);
      expect(isTimelineLogEvent('cancelou_rota')).toBe(true);
      expect(isTimelineLogEvent('some_cancel_event')).toBe(true);
      expect(isTimelineLogEvent('route_start')).toBe(true);
    });

    it('should return false for unknown events', () => {
      expect(isTimelineLogEvent('unknown_event')).toBe(false);
      expect(isTimelineLogEvent('photo_uploaded')).toBe(false);
      expect(isTimelineLogEvent('')).toBe(false);
    });
  });

  // ============================================================================
  // mapLogToTimelinePreview
  // ============================================================================

  describe('mapLogToTimelinePreview', () => {
    const ts = '2025-10-15T14:30:00Z';

    it('should map route started events', () => {
      const result = mapLogToTimelinePreview({
        evento: 'motorista_iniciou_rota',
        timestamp: ts,
      });
      expect(result).toEqual({
        timestamp: ts,
        title: 'Rota iniciada',
        type: 'inicio',
      });
    });

    it('should map events containing "iniciou"', () => {
      const result = mapLogToTimelinePreview({
        evento: 'alguem_iniciou_algo',
        timestamp: ts,
      });
      expect(result).toEqual({
        timestamp: ts,
        title: 'Rota iniciada',
        type: 'inicio',
      });
    });

    it('should map events containing "start"', () => {
      const result = mapLogToTimelinePreview({
        evento: 'route_start',
        timestamp: ts,
      });
      expect(result).toEqual({
        timestamp: ts,
        title: 'Rota iniciada',
        type: 'inicio',
      });
    });

    it('should map route completed events', () => {
      const result = mapLogToTimelinePreview({
        evento: 'motorista_concluiu_rota',
        timestamp: ts,
      });
      expect(result).toEqual({
        timestamp: ts,
        title: 'Rota concluída',
        type: 'conclusao',
      });
    });

    it('should map events containing "finaliz"', () => {
      const result = mapLogToTimelinePreview({
        evento: 'rota_finalizada',
        timestamp: ts,
      });
      expect(result).toEqual({
        timestamp: ts,
        title: 'Rota concluída',
        type: 'conclusao',
      });
    });

    it('should map route cancelled events', () => {
      const result = mapLogToTimelinePreview({
        evento: 'rota_cancelada',
        timestamp: ts,
      });
      expect(result).toEqual({
        timestamp: ts,
        title: 'Rota cancelada',
        type: 'outro',
      });
    });

    it('should map events containing "cancelou"', () => {
      const result = mapLogToTimelinePreview({
        evento: 'gestor_cancelou_rota',
        timestamp: ts,
      });
      expect(result).toEqual({
        timestamp: ts,
        title: 'Rota cancelada',
        type: 'outro',
      });
    });

    it('should map rota_criada event', () => {
      const result = mapLogToTimelinePreview({
        evento: 'rota_criada',
        timestamp: ts,
      });
      expect(result).toEqual({
        timestamp: ts,
        title: 'Rota criada',
        type: 'outro',
      });
    });

    it('should map sos_acionado event', () => {
      const result = mapLogToTimelinePreview({
        evento: 'sos_acionado',
        timestamp: ts,
      });
      expect(result).toEqual({
        timestamp: ts,
        title: 'SOS Acionado',
        type: 'incidente',
      });
    });

    it('should map parada_adicionada event', () => {
      const result = mapLogToTimelinePreview({
        evento: 'parada_adicionada',
        timestamp: ts,
      });
      expect(result).toEqual({
        timestamp: ts,
        title: 'Parada atualizada',
        type: 'parada',
      });
    });

    it('should map parada_editada event', () => {
      const result = mapLogToTimelinePreview({
        evento: 'parada_editada',
        timestamp: ts,
      });
      expect(result).toEqual({
        timestamp: ts,
        title: 'Parada atualizada',
        type: 'parada',
      });
    });

    it('should map parada_removida event', () => {
      const result = mapLogToTimelinePreview({
        evento: 'parada_removida',
        timestamp: ts,
      });
      expect(result).toEqual({
        timestamp: ts,
        title: 'Parada atualizada',
        type: 'parada',
      });
    });

    it('should return null for unknown events', () => {
      expect(
        mapLogToTimelinePreview({ evento: 'unknown_event', timestamp: ts }),
      ).toBeNull();
      expect(
        mapLogToTimelinePreview({ evento: 'parada_reaberta', timestamp: ts }),
      ).toBeNull();
      expect(
        mapLogToTimelinePreview({
          evento: 'motorista_alterado',
          timestamp: ts,
        }),
      ).toBeNull();
    });
  });

  // ============================================================================
  // mapLogToTimelineEvent
  // ============================================================================

  describe('mapLogToTimelineEvent', () => {
    const ts = '2025-10-15T14:30:00Z';
    const id = 'abc-123';

    it('should map rota_criada with detalhes', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'rota_criada',
        timestamp: ts,
        detalhes: { total_paradas: 5, tem_vinculos: true, total_vinculos: 2 },
      });
      expect(result).toMatchObject({
        id: `log-${id}`,
        type: 'status_change',
        timestamp: ts,
        title: 'Rota Criada',
        description: 'Rota criada com 5 parada(s) • 2 vínculo(s)',
        icon: 'add-circle',
        colorKey: 'purple',
      });
    });

    it('should map rota_criada without vinculos', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'rota_criada',
        timestamp: ts,
        detalhes: { total_paradas: 3 },
      });
      expect(result?.description).toBe('Rota criada com 3 parada(s)');
    });

    it('should map rota_criada with null detalhes', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'rota_criada',
        timestamp: ts,
        detalhes: null,
      });
      expect(result?.description).toBe('Rota criada com 0 parada(s)');
    });

    it('should map route started event', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'motorista_iniciou_rota',
        timestamp: ts,
        detalhes: null,
      });
      expect(result).toMatchObject({
        type: 'status_change',
        title: 'Rota Iniciada',
        description: 'Motorista iniciou a rota',
        icon: 'play-circle',
        colorKey: 'info',
      });
    });

    it('should map route started event with timestamp in detalhes', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'motorista_iniciou_rota',
        timestamp: ts,
        detalhes: { timestamp: '2025-10-15T14:30:00Z' },
      });
      expect(result?.description).toContain('Motorista iniciou a rota às');
    });

    it('should map route completed event', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'motorista_concluiu_rota',
        timestamp: ts,
      });
      expect(result).toMatchObject({
        type: 'status_change',
        title: 'Rota Concluída',
        description: 'Motorista finalizou a rota',
        icon: 'checkmark-circle',
        colorKey: 'success',
      });
    });

    it('should map route cancelled event', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'rota_cancelada',
        timestamp: ts,
      });
      expect(result).toMatchObject({
        type: 'status_change',
        title: 'Rota Cancelada',
        description: 'Rota foi cancelada',
        icon: 'close-circle',
        colorKey: 'error',
      });
    });

    it('should map route cancelled with timestamp in detalhes', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'rota_cancelada',
        timestamp: ts,
        detalhes: { timestamp: '2025-10-15T16:00:00Z' },
      });
      expect(result?.description).toContain('Rota cancelada às');
    });

    it('should map parada_reaberta with endereco', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'parada_reaberta',
        timestamp: ts,
        detalhes: { endereco: 'Rua das Flores, 123' },
      });
      expect(result).toMatchObject({
        type: 'parada_update',
        title: 'Parada Reaberta',
        description: 'Rua das Flores, 123',
        icon: 'refresh-circle',
        colorKey: 'warning',
      });
    });

    it('should map parada_reaberta without endereco', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'parada_reaberta',
        timestamp: ts,
        detalhes: null,
      });
      expect(result?.description).toBe('Parada voltou para pendente');
    });

    it('should map sos_acionado as critical', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'sos_acionado',
        timestamp: ts,
        detalhes: { motivo: 'Pneu furou' },
      });
      expect(result).toMatchObject({
        type: 'status_change',
        title: '🚨 SOS Acionado',
        description: 'Pneu furou',
        fullDescription: 'Pneu furou',
        icon: 'warning',
        colorKey: 'error',
        isCritical: true,
      });
    });

    it('should map sos_acionado without motivo', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'sos_acionado',
        timestamp: ts,
      });
      expect(result?.description).toBe('Motorista acionou botão de emergência');
    });

    it('should map rota_finalizada — note: caught by "finaliz" substring as Route Completed', () => {
      // rota_finalizada contains "finaliz", so the "Route completed" branch catches it
      // before reaching the dedicated rota_finalizada handler
      const result = mapLogToTimelineEvent({
        id,
        evento: 'rota_finalizada',
        timestamp: ts,
        detalhes: { paradas_concluidas: 8, paradas_puladas: 2 },
      });
      expect(result).toMatchObject({
        type: 'status_change',
        title: 'Rota Concluída',
        icon: 'checkmark-circle',
        colorKey: 'success',
      });
    });

    it('should map parada_adicionada', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'parada_adicionada',
        timestamp: ts,
        detalhes: { endereco: 'Av. Brasil, 500' },
      });
      expect(result).toMatchObject({
        type: 'parada_update',
        title: 'Parada Adicionada',
        description: 'Av. Brasil, 500',
        colorKey: 'success',
      });
    });

    it('should map parada_adicionada without endereco', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'parada_adicionada',
        timestamp: ts,
      });
      expect(result?.description).toBe('Nova parada adicionada à rota');
    });

    it('should map parada_editada with campos_alterados', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'parada_editada',
        timestamp: ts,
        detalhes: {
          campos_alterados: {
            endereco: true,
            destinatario: true,
            telefone: false,
            tipo: false,
            observacoes: true,
          },
        },
      });
      expect(result).toMatchObject({
        type: 'parada_update',
        title: 'Parada Editada',
        icon: 'create',
        colorKey: 'warning',
      });
      expect(result?.description).toBe(
        'Alterado: endereço, destinatário, observações',
      );
    });

    it('should map parada_editada without campos_alterados', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'parada_editada',
        timestamp: ts,
        detalhes: null,
      });
      expect(result?.description).toBe('Parada foi editada');
    });

    it('should map parada_editada with empty campos_alterados', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'parada_editada',
        timestamp: ts,
        detalhes: { campos_alterados: {} },
      });
      expect(result?.description).toBe('Parada foi editada');
    });

    it('should map parada_removida with paradas_restantes', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'parada_removida',
        timestamp: ts,
        detalhes: { paradas_restantes: 4 },
      });
      expect(result).toMatchObject({
        title: 'Parada Removida',
        description: '4 parada(s) restante(s)',
        icon: 'trash',
        colorKey: 'error',
      });
    });

    it('should map motorista_alterado with name', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'motorista_alterado',
        timestamp: ts,
        detalhes: { motorista_novo_nome: 'João Silva' },
      });
      expect(result).toMatchObject({
        title: 'Motorista Alterado',
        description: 'Novo motorista: João Silva',
        colorKey: 'purple',
      });
    });

    it('should map motorista_alterado without name', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'motorista_alterado',
        timestamp: ts,
      });
      expect(result?.description).toBe('Motorista da rota foi alterado');
    });

    it('should map paradas_reordenadas with alterado_por', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'paradas_reordenadas',
        timestamp: ts,
        detalhes: { alterado_por: 'Maria' },
      });
      expect(result).toMatchObject({
        title: 'Rota Reordenada',
        description: 'Ordem alterada por Maria',
        icon: 'swap-vertical',
        colorKey: 'purple',
      });
    });

    it('should map paradas_reordenadas without alterado_por', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'paradas_reordenadas',
        timestamp: ts,
      });
      expect(result?.description).toBe('Ordem das paradas foi alterada');
    });

    it('sinaliza quando a reordenacao desfez a otimizacao', () => {
      const evento = mapLogToTimelineEvent({
        id: '3',
        evento: 'paradas_reordenadas',
        timestamp: '2026-08-04T12:00:00Z',
        detalhes: { alterado_por: 'Amanda', desfez_otimizacao: true },
      });

      expect(evento?.description).toContain('desfez a otimização');
    });

    it('should map rota_reativada with reativado_por', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'rota_reativada',
        timestamp: ts,
        detalhes: { reativado_por: 'Admin' },
      });
      expect(result).toMatchObject({
        title: 'Rota Reativada',
        description: 'Reativada por Admin',
        icon: 'refresh-circle',
        colorKey: 'success',
      });
    });

    it('should map rota_reativada without reativado_por', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'rota_reativada',
        timestamp: ts,
      });
      expect(result?.description).toBe('Rota foi reativada');
    });

    it('should map parada_retomada with endereco', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'parada_retomada',
        timestamp: ts,
        detalhes: { endereco: 'Rua ABC, 99' },
      });
      expect(result).toMatchObject({
        title: 'Parada Retomada',
        description: 'Rua ABC, 99',
        icon: 'arrow-undo-circle',
        colorKey: 'info',
      });
    });

    it('should map parada_retomada without endereco', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'parada_retomada',
        timestamp: ts,
      });
      expect(result?.description).toBe('Parada pulada foi retomada');
    });

    it('narra a otimizacao com o ganho', () => {
      const evento = mapLogToTimelineEvent({
        id: '1',
        evento: 'rota_otimizada',
        timestamp: '2026-08-04T12:00:00Z',
        detalhes: { distancia_antes: 30.5, distancia_depois: 25.9 },
      });

      expect(evento).not.toBeNull();
      expect(evento?.title).toBe('Rota otimizada');
      expect(evento?.description).toContain('30.5');
      expect(evento?.description).toContain('25.9');
    });

    it('narra otimizacao sem ganho conhecido quando falta o "antes"', () => {
      const evento = mapLogToTimelineEvent({
        id: '2',
        evento: 'rota_otimizada',
        timestamp: '2026-08-04T12:00:00Z',
        detalhes: { distancia_antes: null, distancia_depois: 25.9 },
      });

      expect(evento).not.toBeNull();
      expect(evento?.description).not.toContain('null');
    });

    it('should return null for unknown events', () => {
      expect(
        mapLogToTimelineEvent({ id, evento: 'unknown_event', timestamp: ts }),
      ).toBeNull();
    });

    it('should handle detalhes being a non-object (string)', () => {
      const result = mapLogToTimelineEvent({
        id,
        evento: 'rota_criada',
        timestamp: ts,
        detalhes: 'invalid' as any,
      });
      // detalhes is not an object, so it becomes null internally
      expect(result?.description).toBe('Rota criada com 0 parada(s)');
    });
  });

  // ============================================================================
  // mapParadaToTimelineEvent
  // ============================================================================

  describe('mapParadaToTimelineEvent', () => {
    const baseParada = {
      id: 'parada-1',
      ordem: 3,
      endereco: 'Rua das Acácias, 42',
      concluida_em: '2025-10-15T15:00:00Z',
    };

    it('should map concluida parada with photo', () => {
      const result = mapParadaToTimelineEvent({
        ...baseParada,
        status: 'concluida',
        foto_url: 'https://example.com/photo.jpg',
      });
      expect(result).toMatchObject({
        id: 'parada-parada-1',
        type: 'parada_update',
        timestamp: '2025-10-15T15:00:00Z',
        title: 'Parada #3 Concluída',
        description: 'Rua das Acácias, 42',
        icon: 'location',
        colorKey: 'success',
        hasPhoto: true,
        photoUrl: 'https://example.com/photo.jpg',
      });
    });

    it('should map concluida parada without photo', () => {
      const result = mapParadaToTimelineEvent({
        ...baseParada,
        status: 'concluida',
        foto_url: null,
      });
      expect(result?.hasPhoto).toBe(false);
      expect(result?.photoUrl).toBeUndefined();
    });

    it('should map pulada parada', () => {
      const result = mapParadaToTimelineEvent({
        ...baseParada,
        status: 'pulada',
      });
      expect(result).toMatchObject({
        id: 'parada-parada-1',
        type: 'parada_update',
        title: 'Parada #3 Pulada',
        description: 'Rua das Acácias, 42',
        icon: 'remove-circle',
        colorKey: 'warning',
      });
    });

    it('should return null for pendente parada (no concluida_em)', () => {
      const result = mapParadaToTimelineEvent({
        id: 'parada-2',
        ordem: 1,
        endereco: 'Rua X',
        status: 'pendente',
        concluida_em: null,
      });
      expect(result).toBeNull();
    });

    it('should return null when concluida_em is undefined', () => {
      const result = mapParadaToTimelineEvent({
        id: 'parada-2',
        ordem: 1,
        endereco: 'Rua X',
        status: 'concluida',
      });
      expect(result).toBeNull();
    });

    it('should return null when is_checkpoint is false', () => {
      const result = mapParadaToTimelineEvent({
        ...baseParada,
        status: 'concluida',
        is_checkpoint: false,
      });
      expect(result).toBeNull();
    });

    it('should process normally when is_checkpoint is true', () => {
      const result = mapParadaToTimelineEvent({
        ...baseParada,
        status: 'concluida',
        is_checkpoint: true,
      });
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Parada #3 Concluída');
    });

    it('should process normally when is_checkpoint is undefined', () => {
      const result = mapParadaToTimelineEvent({
        ...baseParada,
        status: 'concluida',
      });
      expect(result).not.toBeNull();
    });
  });

  // ============================================================================
  // mapIncidenteToTimelineEvent
  // ============================================================================

  describe('mapIncidenteToTimelineEvent', () => {
    it('should map a critical incident (accident)', () => {
      const result = mapIncidenteToTimelineEvent({
        id: 'inc-1',
        categoria: 'accident',
        descricao: 'Colisão leve no estacionamento',
        created_at: '2025-10-15T16:00:00Z',
        foto_url: 'https://example.com/incident.jpg',
      });
      expect(result).toMatchObject({
        id: 'incidente-inc-1',
        type: 'incidente',
        title: 'Acidente/Incidente',
        icon: 'alert-circle',
        colorKey: 'error',
        isCritical: true,
        hasPhoto: true,
        photoUrl: 'https://example.com/incident.jpg',
      });
      expect(result.description).toBe('Colisão leve no estacionamento');
      expect(result.fullDescription).toBe('Colisão leve no estacionamento');
    });

    it('should map a non-critical incident', () => {
      const result = mapIncidenteToTimelineEvent({
        id: 'inc-2',
        categoria: 'absent',
        descricao: 'Cliente não atendeu',
        created_at: '2025-10-15T16:00:00Z',
      });
      expect(result.isCritical).toBe(false);
      expect(result.title).toBe('Cliente ausente');
      expect(result.hasPhoto).toBe(false);
      expect(result.photoUrl).toBeUndefined();
    });

    it('should truncate long descriptions at 80 characters', () => {
      const longDesc = 'A'.repeat(100);
      const result = mapIncidenteToTimelineEvent({
        id: 'inc-3',
        categoria: 'other',
        descricao: longDesc,
        created_at: '2025-10-15T16:00:00Z',
      });
      expect(result.description).toBe('A'.repeat(80) + '...');
      expect(result.fullDescription).toBe(longDesc);
    });

    it('should not truncate descriptions at exactly 80 characters', () => {
      const exactDesc = 'B'.repeat(80);
      const result = mapIncidenteToTimelineEvent({
        id: 'inc-4',
        categoria: 'other',
        descricao: exactDesc,
        created_at: '2025-10-15T16:00:00Z',
      });
      expect(result.description).toBe(exactDesc);
    });

    it('should handle null descricao', () => {
      const result = mapIncidenteToTimelineEvent({
        id: 'inc-5',
        categoria: 'weather',
        descricao: null,
        created_at: '2025-10-15T16:00:00Z',
      });
      expect(result.description).toBe('');
      expect(result.fullDescription).toBe('');
    });

    it('should fallback title for unknown category', () => {
      const result = mapIncidenteToTimelineEvent({
        id: 'inc-6',
        categoria: 'totally_unknown',
        created_at: '2025-10-15T16:00:00Z',
      });
      expect(result.title).toBe('Incidente');
      expect(result.isCritical).toBe(false);
    });

    it('should mark vehicle category as critical', () => {
      const result = mapIncidenteToTimelineEvent({
        id: 'inc-7',
        categoria: 'vehicle',
        descricao: 'Motor falhou',
        created_at: '2025-10-15T16:00:00Z',
      });
      expect(result.isCritical).toBe(true);
    });
  });

  // ============================================================================
  // formatRelativeTime
  // ============================================================================

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      // Fix "now" to 2025-10-15 14:30:00 UTC
      const fixedNow = new Date('2025-10-15T14:30:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow.getTime());
      // Override the Date constructor for new Date() calls (parameterless)
      const OriginalDate = Date;
      jest.spyOn(globalThis, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) {
          return new OriginalDate(fixedNow.getTime());
        }
        // @ts-ignore - spread constructor args
        return new OriginalDate(...args);
      });
      // Preserve static methods
      (globalThis.Date as any).now = OriginalDate.now;
      (globalThis.Date as any).parse = OriginalDate.parse;
      (globalThis.Date as any).UTC = OriginalDate.UTC;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return "agora" for timestamps less than 1 minute ago', () => {
      expect(formatRelativeTime('2025-10-15T14:29:30Z')).toBe('agora');
      expect(formatRelativeTime('2025-10-15T14:30:00Z')).toBe('agora');
    });

    it('should return "há X min" for timestamps less than 1 hour ago', () => {
      expect(formatRelativeTime('2025-10-15T14:25:00Z')).toBe('há 5 min');
      expect(formatRelativeTime('2025-10-15T13:31:00Z')).toBe('há 59 min');
    });

    it('should return "há Xh" for timestamps less than 24 hours ago', () => {
      expect(formatRelativeTime('2025-10-15T12:30:00Z')).toBe('há 2h');
      expect(formatRelativeTime('2025-10-15T00:30:00Z')).toBe('há 14h');
    });

    it('should return "ontem HH:MM" for yesterday timestamps', () => {
      const result = formatRelativeTime('2025-10-14T10:15:00Z');
      expect(result).toMatch(/^ontem \d{2}:\d{2}$/);
    });

    it('should return date+time format for 2-6 days ago', () => {
      const result = formatRelativeTime('2025-10-12T09:00:00Z');
      // Should be a date string with day/month and time
      expect(result).toMatch(/\d{2}\/\d{2}.*\d{2}:\d{2}/);
    });

    it('should return date-only format for 7+ days ago', () => {
      const result = formatRelativeTime('2025-10-01T09:00:00Z');
      // Should be DD/MM/YYYY
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should accept Date objects', () => {
      const date = new Date('2025-10-15T14:28:00Z');
      expect(formatRelativeTime(date)).toBe('há 2 min');
    });
  });

  // ============================================================================
  // getDateGroup
  // ============================================================================

  describe('getDateGroup', () => {
    beforeEach(() => {
      const fixedNow = new Date('2025-10-15T14:30:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow.getTime());
      const OriginalDate = Date;
      jest.spyOn(globalThis, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) {
          return new OriginalDate(fixedNow.getTime());
        }
        // @ts-ignore
        return new OriginalDate(...args);
      });
      (globalThis.Date as any).now = OriginalDate.now;
      (globalThis.Date as any).parse = OriginalDate.parse;
      (globalThis.Date as any).UTC = OriginalDate.UTC;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return "Hoje" for today timestamps', () => {
      expect(getDateGroup('2025-10-15T08:00:00Z')).toBe('Hoje');
      expect(getDateGroup('2025-10-15T23:59:59Z')).toBe('Hoje');
    });

    it('should return "Ontem" for yesterday timestamps', () => {
      expect(getDateGroup('2025-10-14T12:00:00Z')).toBe('Ontem');
    });

    it('should return formatted date for older timestamps', () => {
      const result = getDateGroup('2025-10-10T12:00:00Z');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should accept Date objects', () => {
      const today = new Date('2025-10-15T10:00:00Z');
      expect(getDateGroup(today)).toBe('Hoje');
    });
  });

  // ============================================================================
  // calculateDurationBetween
  // ============================================================================

  describe('calculateDurationBetween', () => {
    it('should return null for durations less than 1 minute', () => {
      expect(
        calculateDurationBetween(
          '2025-10-15T14:00:00Z',
          '2025-10-15T14:00:30Z',
        ),
      ).toBeNull();
      expect(
        calculateDurationBetween(
          '2025-10-15T14:00:00Z',
          '2025-10-15T14:00:00Z',
        ),
      ).toBeNull();
    });

    it('should format minutes only (< 60 min)', () => {
      expect(
        calculateDurationBetween(
          '2025-10-15T14:00:00Z',
          '2025-10-15T14:15:00Z',
        ),
      ).toBe('↓ 15 min');
      expect(
        calculateDurationBetween(
          '2025-10-15T14:00:00Z',
          '2025-10-15T14:01:00Z',
        ),
      ).toBe('↓ 1 min');
      expect(
        calculateDurationBetween(
          '2025-10-15T14:00:00Z',
          '2025-10-15T14:59:00Z',
        ),
      ).toBe('↓ 59 min');
    });

    it('should format exact hours', () => {
      expect(
        calculateDurationBetween(
          '2025-10-15T14:00:00Z',
          '2025-10-15T15:00:00Z',
        ),
      ).toBe('↓ 1h');
      expect(
        calculateDurationBetween(
          '2025-10-15T14:00:00Z',
          '2025-10-15T17:00:00Z',
        ),
      ).toBe('↓ 3h');
    });

    it('should format hours and minutes', () => {
      expect(
        calculateDurationBetween(
          '2025-10-15T14:00:00Z',
          '2025-10-15T16:30:00Z',
        ),
      ).toBe('↓ 2h 30min');
      expect(
        calculateDurationBetween(
          '2025-10-15T14:00:00Z',
          '2025-10-15T15:05:00Z',
        ),
      ).toBe('↓ 1h 5min');
    });

    it('should use absolute difference (order does not matter)', () => {
      const a = '2025-10-15T14:00:00Z';
      const b = '2025-10-15T14:30:00Z';
      expect(calculateDurationBetween(a, b)).toBe('↓ 30 min');
      expect(calculateDurationBetween(b, a)).toBe('↓ 30 min');
    });

    it('should accept Date objects', () => {
      const start = new Date('2025-10-15T14:00:00Z');
      const end = new Date('2025-10-15T14:45:00Z');
      expect(calculateDurationBetween(start, end)).toBe('↓ 45 min');
    });

    it('should handle mixed string and Date inputs', () => {
      const start = '2025-10-15T14:00:00Z';
      const end = new Date('2025-10-15T16:15:00Z');
      expect(calculateDurationBetween(start, end)).toBe('↓ 2h 15min');
    });
  });
});

describe('computeNewlyAddedIds', () => {
  it('retorna vazio na carga inicial (previousIds vazio)', () => {
    const result = computeNewlyAddedIds(['a', 'b', 'c'], new Set(), false);
    expect(result.size).toBe(0);
  });

  it('retorna apenas ids novos quando já havia eventos', () => {
    const result = computeNewlyAddedIds(
      ['c', 'a', 'b'],
      new Set(['a', 'b']),
      false,
    );
    expect([...result]).toEqual(['c']);
  });

  it('retorna vazio quando a mudança é paginação (eventos antigos anexados)', () => {
    const result = computeNewlyAddedIds(
      ['a', 'b', 'old1'],
      new Set(['a', 'b']),
      true,
    );
    expect(result.size).toBe(0);
  });

  it('retorna vazio quando nada mudou', () => {
    const result = computeNewlyAddedIds(['a', 'b'], new Set(['a', 'b']), false);
    expect(result.size).toBe(0);
  });
});
