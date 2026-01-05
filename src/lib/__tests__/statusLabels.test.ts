/**
 * Tests for statusLabels.ts
 * Labels de status em Portugues (PT-BR)
 */

import {
  RotaStatus,
  ROTA_STATUS_LABELS,
  getRotaStatusLabel,
  ParadaStatus,
  PARADA_STATUS_LABELS,
  PARADA_STATUS_LABELS_WITH_ICON,
  getParadaStatusLabel,
  PARADA_IN_ROUTE_LABEL,
  getParadaContextLabel,
  FiltroStatus,
  FILTRO_STATUS_OPTIONS,
  getFiltroStatusLabel,
} from '../statusLabels';

describe('statusLabels', () => {
  // ============================================
  // ROTA STATUS LABELS
  // ============================================

  describe('ROTA_STATUS_LABELS', () => {
    it('deve conter todos os status de rota com labels corretos', () => {
      expect(ROTA_STATUS_LABELS.pendente).toBe('Pendente');
      expect(ROTA_STATUS_LABELS.em_andamento).toBe('Em Andamento');
      expect(ROTA_STATUS_LABELS.concluida).toBe('Concluída');
      expect(ROTA_STATUS_LABELS.cancelada).toBe('Cancelada');
      expect(ROTA_STATUS_LABELS.nao_executada).toBe('Não Executada');
    });

    it('deve ter exatamente 5 status de rota', () => {
      const keys = Object.keys(ROTA_STATUS_LABELS);
      expect(keys).toHaveLength(5);
    });

    it('deve usar acentos corretos nos labels', () => {
      expect(ROTA_STATUS_LABELS.concluida).toContain('í');
      expect(ROTA_STATUS_LABELS.nao_executada).toContain('ã');
    });
  });

  describe('getRotaStatusLabel', () => {
    it('deve retornar label correto para status pendente', () => {
      expect(getRotaStatusLabel('pendente')).toBe('Pendente');
    });

    it('deve retornar label correto para status em_andamento', () => {
      expect(getRotaStatusLabel('em_andamento')).toBe('Em Andamento');
    });

    it('deve retornar label correto para status concluida', () => {
      expect(getRotaStatusLabel('concluida')).toBe('Concluída');
    });

    it('deve retornar label correto para status cancelada', () => {
      expect(getRotaStatusLabel('cancelada')).toBe('Cancelada');
    });

    it('deve retornar label correto para status nao_executada', () => {
      expect(getRotaStatusLabel('nao_executada')).toBe('Não Executada');
    });

    it('deve retornar o proprio valor para status desconhecido', () => {
      expect(getRotaStatusLabel('status_invalido')).toBe('status_invalido');
    });

    it('deve retornar string vazia quando recebe string vazia', () => {
      expect(getRotaStatusLabel('')).toBe('');
    });

    it('deve funcionar com tipo RotaStatus explicitamente tipado', () => {
      const status: RotaStatus = 'concluida';
      expect(getRotaStatusLabel(status)).toBe('Concluída');
    });

    it('deve retornar valor original para status com espacos', () => {
      expect(getRotaStatusLabel('status com espacos')).toBe('status com espacos');
    });

    it('deve retornar valor original para status em maiusculas', () => {
      expect(getRotaStatusLabel('PENDENTE')).toBe('PENDENTE');
    });
  });

  // ============================================
  // PARADA STATUS LABELS
  // ============================================

  describe('PARADA_STATUS_LABELS', () => {
    it('deve conter todos os status de parada com labels corretos', () => {
      expect(PARADA_STATUS_LABELS.pendente).toBe('Pendente');
      expect(PARADA_STATUS_LABELS.concluida).toBe('Concluída');
      expect(PARADA_STATUS_LABELS.pulada).toBe('Pulada');
    });

    it('deve ter exatamente 3 status de parada', () => {
      const keys = Object.keys(PARADA_STATUS_LABELS);
      expect(keys).toHaveLength(3);
    });
  });

  describe('PARADA_STATUS_LABELS_WITH_ICON', () => {
    it('deve conter icone para status concluida', () => {
      expect(PARADA_STATUS_LABELS_WITH_ICON.concluida).toContain('Concluída');
    });

    it('deve conter icone para status pulada', () => {
      expect(PARADA_STATUS_LABELS_WITH_ICON.pulada).toContain('Pulada');
    });

    it('deve manter pendente sem icone especial', () => {
      expect(PARADA_STATUS_LABELS_WITH_ICON.pendente).toBe('Pendente');
    });

    it('deve ter exatamente 3 status com icones', () => {
      const keys = Object.keys(PARADA_STATUS_LABELS_WITH_ICON);
      expect(keys).toHaveLength(3);
    });
  });

  describe('getParadaStatusLabel', () => {
    describe('sem icone (withIcon = false)', () => {
      it('deve retornar label correto para status pendente', () => {
        expect(getParadaStatusLabel('pendente')).toBe('Pendente');
      });

      it('deve retornar label correto para status concluida', () => {
        expect(getParadaStatusLabel('concluida')).toBe('Concluída');
      });

      it('deve retornar label correto para status pulada', () => {
        expect(getParadaStatusLabel('pulada')).toBe('Pulada');
      });

      it('deve retornar o proprio valor para status desconhecido', () => {
        expect(getParadaStatusLabel('desconhecido')).toBe('desconhecido');
      });

      it('deve retornar string vazia quando recebe string vazia', () => {
        expect(getParadaStatusLabel('')).toBe('');
      });
    });

    describe('com icone (withIcon = true)', () => {
      it('deve retornar label sem icone para status pendente', () => {
        expect(getParadaStatusLabel('pendente', true)).toBe('Pendente');
      });

      it('deve retornar label com icone para status concluida', () => {
        const label = getParadaStatusLabel('concluida', true);
        expect(label).toContain('Concluída');
      });

      it('deve retornar label com icone para status pulada', () => {
        const label = getParadaStatusLabel('pulada', true);
        expect(label).toContain('Pulada');
      });

      it('deve retornar o proprio valor para status desconhecido', () => {
        expect(getParadaStatusLabel('outro_status', true)).toBe('outro_status');
      });
    });

    describe('parametro withIcon default', () => {
      it('deve usar false como default para withIcon', () => {
        const semIcone = getParadaStatusLabel('concluida');
        const comIconeFalse = getParadaStatusLabel('concluida', false);
        expect(semIcone).toBe(comIconeFalse);
      });
    });

    it('deve funcionar com tipo ParadaStatus explicitamente tipado', () => {
      const status: ParadaStatus = 'pulada';
      expect(getParadaStatusLabel(status)).toBe('Pulada');
    });
  });

  // ============================================
  // PARADA IN-ROUTE LABELS
  // ============================================

  describe('PARADA_IN_ROUTE_LABEL', () => {
    it('deve ter valor correto', () => {
      expect(PARADA_IN_ROUTE_LABEL).toBe('Em Rota');
    });
  });

  describe('getParadaContextLabel', () => {
    describe('quando rota esta ativa (isRouteActive = true)', () => {
      it('deve retornar "Em Rota" para parada pendente', () => {
        expect(getParadaContextLabel('pendente', true)).toBe('Em Rota');
      });

      it('deve retornar "Em Rota" para parada pendente com icone', () => {
        expect(getParadaContextLabel('pendente', true, true)).toBe('Em Rota');
      });

      it('deve retornar label normal para parada concluida', () => {
        expect(getParadaContextLabel('concluida', true)).toBe('Concluída');
      });

      it('deve retornar label com icone para parada concluida', () => {
        const label = getParadaContextLabel('concluida', true, true);
        expect(label).toContain('Concluída');
      });

      it('deve retornar label normal para parada pulada', () => {
        expect(getParadaContextLabel('pulada', true)).toBe('Pulada');
      });

      it('deve retornar label com icone para parada pulada', () => {
        const label = getParadaContextLabel('pulada', true, true);
        expect(label).toContain('Pulada');
      });
    });

    describe('quando rota nao esta ativa (isRouteActive = false)', () => {
      it('deve retornar label normal para parada pendente', () => {
        expect(getParadaContextLabel('pendente', false)).toBe('Pendente');
      });

      it('deve retornar label normal para parada concluida', () => {
        expect(getParadaContextLabel('concluida', false)).toBe('Concluída');
      });

      it('deve retornar label normal para parada pulada', () => {
        expect(getParadaContextLabel('pulada', false)).toBe('Pulada');
      });

      it('deve retornar label com icone quando withIcon = true', () => {
        const label = getParadaContextLabel('concluida', false, true);
        expect(label).toContain('Concluída');
      });
    });

    describe('com status desconhecido', () => {
      it('deve retornar o proprio valor quando rota ativa', () => {
        expect(getParadaContextLabel('status_desconhecido', true)).toBe('status_desconhecido');
      });

      it('deve retornar o proprio valor quando rota inativa', () => {
        expect(getParadaContextLabel('status_desconhecido', false)).toBe('status_desconhecido');
      });
    });

    describe('parametro withIcon default', () => {
      it('deve usar false como default para withIcon', () => {
        const semIcone = getParadaContextLabel('concluida', false);
        const comIconeFalse = getParadaContextLabel('concluida', false, false);
        expect(semIcone).toBe(comIconeFalse);
      });
    });
  });

  // ============================================
  // FILTRO STATUS LABELS
  // ============================================

  describe('FILTRO_STATUS_OPTIONS', () => {
    it('deve conter "todas" como primeira opcao', () => {
      expect(FILTRO_STATUS_OPTIONS[0]).toBe('todas');
    });

    it('deve conter todos os status de rota', () => {
      expect(FILTRO_STATUS_OPTIONS).toContain('pendente');
      expect(FILTRO_STATUS_OPTIONS).toContain('em_andamento');
      expect(FILTRO_STATUS_OPTIONS).toContain('concluida');
      expect(FILTRO_STATUS_OPTIONS).toContain('cancelada');
      expect(FILTRO_STATUS_OPTIONS).toContain('nao_executada');
    });

    it('deve ter exatamente 6 opcoes', () => {
      expect(FILTRO_STATUS_OPTIONS).toHaveLength(6);
    });

    it('deve manter a ordem correta das opcoes', () => {
      expect(FILTRO_STATUS_OPTIONS).toEqual([
        'todas',
        'pendente',
        'em_andamento',
        'concluida',
        'cancelada',
        'nao_executada',
      ]);
    });
  });

  describe('getFiltroStatusLabel', () => {
    it('deve retornar "Todas" para status "todas"', () => {
      expect(getFiltroStatusLabel('todas')).toBe('Todas');
    });

    it('deve retornar label de rota para status pendente', () => {
      expect(getFiltroStatusLabel('pendente')).toBe('Pendente');
    });

    it('deve retornar label de rota para status em_andamento', () => {
      expect(getFiltroStatusLabel('em_andamento')).toBe('Em Andamento');
    });

    it('deve retornar label de rota para status concluida', () => {
      expect(getFiltroStatusLabel('concluida')).toBe('Concluída');
    });

    it('deve retornar label de rota para status cancelada', () => {
      expect(getFiltroStatusLabel('cancelada')).toBe('Cancelada');
    });

    it('deve retornar label de rota para status nao_executada', () => {
      expect(getFiltroStatusLabel('nao_executada')).toBe('Não Executada');
    });

    it('deve funcionar com tipo FiltroStatus explicitamente tipado', () => {
      const status: FiltroStatus = 'em_andamento';
      expect(getFiltroStatusLabel(status)).toBe('Em Andamento');
    });

    it('deve retornar o proprio valor para status desconhecido (fallback)', () => {
      // Forcar um status invalido para testar o fallback do nullish coalescing
      const statusInvalido = 'status_inexistente' as FiltroStatus;
      expect(getFiltroStatusLabel(statusInvalido)).toBe('status_inexistente');
    });
  });

  // ============================================
  // TESTES DE CONSISTENCIA
  // ============================================

  describe('consistencia entre labels', () => {
    it('status pendente deve ser consistente entre rota e parada', () => {
      expect(ROTA_STATUS_LABELS.pendente).toBe(PARADA_STATUS_LABELS.pendente);
    });

    it('status concluida deve ser consistente entre rota e parada', () => {
      expect(ROTA_STATUS_LABELS.concluida).toBe(PARADA_STATUS_LABELS.concluida);
    });

    it('PARADA_STATUS_LABELS e PARADA_STATUS_LABELS_WITH_ICON devem ter mesmas chaves', () => {
      const keysNormal = Object.keys(PARADA_STATUS_LABELS).sort();
      const keysWithIcon = Object.keys(PARADA_STATUS_LABELS_WITH_ICON).sort();
      expect(keysNormal).toEqual(keysWithIcon);
    });

    it('getFiltroStatusLabel deve retornar mesmo valor que getRotaStatusLabel para status de rota', () => {
      const rotaStatuses: RotaStatus[] = [
        'pendente',
        'em_andamento',
        'concluida',
        'cancelada',
        'nao_executada',
      ];

      for (const status of rotaStatuses) {
        expect(getFiltroStatusLabel(status)).toBe(getRotaStatusLabel(status));
      }
    });
  });

  // ============================================
  // TESTES DE TIPOS
  // ============================================

  describe('tipagem', () => {
    it('RotaStatus deve aceitar apenas valores validos', () => {
      const validStatuses: RotaStatus[] = [
        'pendente',
        'em_andamento',
        'concluida',
        'cancelada',
        'nao_executada',
      ];
      expect(validStatuses).toHaveLength(5);
    });

    it('ParadaStatus deve aceitar apenas valores validos', () => {
      const validStatuses: ParadaStatus[] = ['pendente', 'concluida', 'pulada'];
      expect(validStatuses).toHaveLength(3);
    });

    it('FiltroStatus deve aceitar "todas" e todos os RotaStatus', () => {
      const validStatuses: FiltroStatus[] = [
        'todas',
        'pendente',
        'em_andamento',
        'concluida',
        'cancelada',
        'nao_executada',
      ];
      expect(validStatuses).toHaveLength(6);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('edge cases', () => {
    it('getRotaStatusLabel com undefined deve retornar undefined', () => {
      expect(getRotaStatusLabel(undefined as unknown as string)).toBe(undefined);
    });

    it('getParadaStatusLabel com undefined deve retornar undefined', () => {
      expect(getParadaStatusLabel(undefined as unknown as string)).toBe(undefined);
    });

    it('getParadaContextLabel com undefined status deve retornar undefined', () => {
      expect(getParadaContextLabel(undefined as unknown as string, true)).toBe(undefined);
    });

    it('getRotaStatusLabel com null deve retornar null', () => {
      expect(getRotaStatusLabel(null as unknown as string)).toBe(null);
    });

    it('getParadaStatusLabel com null deve retornar null', () => {
      expect(getParadaStatusLabel(null as unknown as string)).toBe(null);
    });

    it('getParadaContextLabel com null status e rota ativa deve retornar null (nao e pendente)', () => {
      // null !== 'pendente', entao vai para getParadaStatusLabel
      expect(getParadaContextLabel(null as unknown as string, true)).toBe(null);
    });

    it('getRotaStatusLabel com numero deve retornar o numero', () => {
      expect(getRotaStatusLabel(123 as unknown as string)).toBe(123);
    });

    it('getParadaStatusLabel com objeto deve retornar o objeto', () => {
      const obj = { foo: 'bar' };
      expect(getParadaStatusLabel(obj as unknown as string)).toBe(obj);
    });
  });
});
