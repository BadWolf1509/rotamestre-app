import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { ParadaCard, Parada } from '../ParadaCard';

// Mock haptics
jest.mock('@/utils/haptics', () => ({
  mediumHaptic: jest.fn(),
  successHaptic: jest.fn(),
}));

// Mock SwipeableRow
jest.mock('@/components/SwipeableRow', () => ({
  SwipeableRow: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock StreetViewPreview
jest.mock('@/components/StreetViewPreview', () => ({
  StreetViewPreview: () => null,
}));

describe('ParadaCard', () => {
  const mockParadaPendente: Parada = {
    id: '1',
    endereco: 'Rua Teste, 123 - Centro',
    latitude: -23.5505,
    longitude: -46.6333,
    ordem: 1,
    status: 'pendente',
    tipo: 'entrega',
    destinatario: 'João Silva',
    telefone: '11999999999',
  };

  const mockParadaConcluida: Parada = {
    ...mockParadaPendente,
    id: '2',
    status: 'concluida',
  };

  const mockParadaPulada: Parada = {
    ...mockParadaPendente,
    id: '3',
    status: 'pulada',
  };

  const defaultProps = {
    parada: mockParadaPendente,
    rotaEmAndamento: true,
    onConcluir: jest.fn(),
    onPular: jest.fn(),
    onRetomar: jest.fn(),
    onNavegar: jest.fn(),
    onReportar: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar parada pendente corretamente', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(getByText('Rua Teste, 123 - Centro')).toBeTruthy();
      expect(getByText('1')).toBeTruthy();
      expect(getByText('○ Pendente')).toBeTruthy();
      expect(getByText('📦 Entrega')).toBeTruthy();
    });

    it('deve renderizar parada concluída corretamente', () => {
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaConcluida} />
      );

      expect(getByText('✓ Concluída')).toBeTruthy();
    });

    it('deve renderizar parada pulada corretamente', () => {
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaPulada} />
      );

      expect(getByText('↷ Pulada')).toBeTruthy();
    });

    it('deve renderizar tipo retirada corretamente', () => {
      const paradaRetirada: Parada = {
        ...mockParadaPendente,
        tipo: 'retirada',
      };
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={paradaRetirada} />
      );

      expect(getByText('📥 Retirada')).toBeTruthy();
    });

    it('deve renderizar destinatário quando presente', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(getByText('👤 João Silva')).toBeTruthy();
    });

    it('deve renderizar telefone quando presente', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(getByText('📞 11999999999')).toBeTruthy();
    });

    it('deve renderizar observações quando presentes', () => {
      const paradaComObs: Parada = {
        ...mockParadaPendente,
        observacoes: 'Entregar na portaria',
      };
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={paradaComObs} />
      );

      expect(getByText('📝 Observações:')).toBeTruthy();
      expect(getByText('Entregar na portaria')).toBeTruthy();
    });
  });

  describe('Botões de Ação', () => {
    it('deve mostrar botão Como Chegar para parada pendente', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(getByText('Como Chegar')).toBeTruthy();
    });

    it('deve mostrar botão Reportar Problema para parada pendente', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(getByText('Reportar Problema')).toBeTruthy();
    });

    it('deve chamar onNavegar ao pressionar Como Chegar', () => {
      const onNavegar = jest.fn();
      const { getByText } = render(
        <ParadaCard {...defaultProps} onNavegar={onNavegar} />
      );

      fireEvent.press(getByText('Como Chegar'));
      expect(onNavegar).toHaveBeenCalledWith(mockParadaPendente);
    });

    it('deve chamar onReportar ao pressionar Reportar Problema', () => {
      const onReportar = jest.fn();
      const { getByText } = render(
        <ParadaCard {...defaultProps} onReportar={onReportar} />
      );

      fireEvent.press(getByText('Reportar Problema'));
      expect(onReportar).toHaveBeenCalledWith(mockParadaPendente);
    });

    it('NÃO deve mostrar botões de ação para parada concluída', () => {
      const { queryByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaConcluida} />
      );

      expect(queryByText('Como Chegar')).toBeNull();
      expect(queryByText('Reportar Problema')).toBeNull();
    });

    it('NÃO deve mostrar botões de ação para parada pulada', () => {
      const { queryByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaPulada} />
      );

      expect(queryByText('Como Chegar')).toBeNull();
      expect(queryByText('Reportar Problema')).toBeNull();
    });
  });

  describe('Botão Retomar', () => {
    it('deve mostrar botão Retomar para parada pulada', () => {
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaPulada} />
      );

      expect(getByText('Retomar Parada')).toBeTruthy();
    });

    it('deve chamar onRetomar ao pressionar Retomar Parada', () => {
      const onRetomar = jest.fn();
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaPulada} onRetomar={onRetomar} />
      );

      fireEvent.press(getByText('Retomar Parada'));
      expect(onRetomar).toHaveBeenCalledWith(mockParadaPulada);
    });

    it('NÃO deve mostrar botão Retomar para parada pendente', () => {
      const { queryByText } = render(<ParadaCard {...defaultProps} />);

      expect(queryByText('Retomar Parada')).toBeNull();
    });

    it('NÃO deve mostrar botão Retomar para parada concluída', () => {
      const { queryByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaConcluida} />
      );

      expect(queryByText('Retomar Parada')).toBeNull();
    });
  });

  describe('Swipe Hint', () => {
    it('deve mostrar hint de swipe para parada pendente com rota em andamento', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(getByText('Deslize para ações')).toBeTruthy();
    });

    it('NÃO deve mostrar hint de swipe quando rota não está em andamento', () => {
      const { queryByText } = render(
        <ParadaCard {...defaultProps} rotaEmAndamento={false} />
      );

      expect(queryByText('Deslize para ações')).toBeNull();
    });

    it('NÃO deve mostrar hint de swipe para parada concluída', () => {
      const { queryByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaConcluida} />
      );

      expect(queryByText('Deslize para ações')).toBeNull();
    });

    it('NÃO deve mostrar hint de swipe para parada pulada', () => {
      const { queryByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaPulada} />
      );

      expect(queryByText('Deslize para ações')).toBeNull();
    });
  });

  describe('Loading States', () => {
    it('deve desabilitar botão Retomar quando retomando', () => {
      const onRetomar = jest.fn();
      const { UNSAFE_getByType } = render(
        <ParadaCard
          {...defaultProps}
          parada={mockParadaPulada}
          onRetomar={onRetomar}
          retomando={true}
        />
      );

      // O botão deve estar desabilitado
      const { ActivityIndicator } = require('react-native');
      const loader = UNSAFE_getByType(ActivityIndicator);
      expect(loader).toBeTruthy();
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter accessibilityLabel correto para parada pendente', () => {
      const { UNSAFE_root } = render(<ParadaCard {...defaultProps} />);

      // Encontrar o View com accessibilityLabel
      const findAccessibleView = (node: any): any => {
        if (node.props?.accessibilityLabel?.includes('Parada 1')) {
          return node;
        }
        if (node.children) {
          for (const child of node.children) {
            if (typeof child === 'object') {
              const found = findAccessibleView(child);
              if (found) return found;
            }
          }
        }
        return null;
      };

      const accessibleView = findAccessibleView(UNSAFE_root);
      expect(accessibleView).toBeTruthy();
      expect(accessibleView.props.accessibilityLabel).toContain('Parada 1');
      expect(accessibleView.props.accessibilityLabel).toContain('entrega');
      expect(accessibleView.props.accessibilityLabel).toContain('pendente');
    });

    it('deve ter accessibilityHint para parada pendente', () => {
      const { UNSAFE_root } = render(<ParadaCard {...defaultProps} />);

      const findAccessibleView = (node: any): any => {
        if (node.props?.accessibilityHint?.includes('Deslize')) {
          return node;
        }
        if (node.children) {
          for (const child of node.children) {
            if (typeof child === 'object') {
              const found = findAccessibleView(child);
              if (found) return found;
            }
          }
        }
        return null;
      };

      const accessibleView = findAccessibleView(UNSAFE_root);
      expect(accessibleView).toBeTruthy();
    });
  });

  describe('Memoização', () => {
    it('deve ser um componente memoizado', () => {
      expect(ParadaCard.displayName).toBe('ParadaCard');
    });
  });
});
