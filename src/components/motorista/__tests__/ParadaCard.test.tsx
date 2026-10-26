import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

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
      expect(getByText('Entrega')).toBeTruthy();
    });

    it('deve renderizar parada em andamento corretamente', () => {
      const paradaEmAndamento: Parada = {
        ...mockParadaPendente,
        status: 'em_andamento',
      };

      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={paradaEmAndamento} />,
      );

      expect(getByText('Em rota')).toBeTruthy();
    });

    it('deve renderizar parada concluída corretamente', () => {
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaConcluida} />,
      );

      expect(getByText('✓ Concluída')).toBeTruthy();
    });

    it('deve renderizar parada pulada corretamente', () => {
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaPulada} />,
      );

      expect(getByText('↷ Pulada')).toBeTruthy();
    });

    describe('Texto do pulo (Migration 73)', () => {
      const puladaComTexto: Parada = {
        ...mockParadaPulada,
        observacoes: 'Portão azul',
        observacao_pulo: 'Ficou para amanhã',
      };

      it('parada pulada mostra "Seu motivo" sem expandir e mantém a instrução do gestor separada', () => {
        const { getByText, queryByText } = render(
          <ParadaCard {...defaultProps} parada={puladaComTexto} />,
        );

        expect(getByText('Seu motivo:')).toBeTruthy();
        expect(getByText('Ficou para amanhã')).toBeTruthy();
        // A instrução do gestor não se mistura com o texto do motorista
        expect(queryByText('Portão azul')).toBeNull();
      });

      it('parada pulada sem texto não mostra "Seu motivo"', () => {
        const { queryByText } = render(
          <ParadaCard
            {...defaultProps}
            parada={{ ...puladaComTexto, observacao_pulo: null }}
          />,
        );

        expect(queryByText('Seu motivo:')).toBeNull();
      });

      it('parada pendente não mostra "Seu motivo", mesmo com texto antigo', () => {
        const { queryByText } = render(
          <ParadaCard
            {...defaultProps}
            parada={{ ...puladaComTexto, status: 'pendente' }}
          />,
        );

        expect(queryByText('Seu motivo:')).toBeNull();
      });

      it('re-renderiza quando só o observacao_pulo muda', () => {
        const { getByText, rerender } = render(
          <ParadaCard
            {...defaultProps}
            parada={{ ...puladaComTexto, observacao_pulo: 'Primeiro' }}
          />,
        );
        expect(getByText('Primeiro')).toBeTruthy();

        rerender(
          <ParadaCard
            {...defaultProps}
            parada={{ ...puladaComTexto, observacao_pulo: 'Segundo' }}
          />,
        );
        expect(getByText('Segundo')).toBeTruthy();
      });
    });

    it('deve renderizar tipo retirada corretamente', () => {
      const paradaRetirada: Parada = {
        ...mockParadaPendente,
        tipo: 'retirada',
      };
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={paradaRetirada} />,
      );

      expect(getByText('Retirada')).toBeTruthy();
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
        <ParadaCard {...defaultProps} parada={paradaComObs} />,
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
        <ParadaCard {...defaultProps} onNavegar={onNavegar} />,
      );

      fireEvent.press(getByText('Como Chegar'));
      expect(onNavegar).toHaveBeenCalledWith(mockParadaPendente);
    });

    it('deve chamar onReportar ao pressionar Reportar Problema', () => {
      const onReportar = jest.fn();
      const { getByText } = render(
        <ParadaCard {...defaultProps} onReportar={onReportar} />,
      );

      fireEvent.press(getByText('Reportar Problema'));
      expect(onReportar).toHaveBeenCalledWith(mockParadaPendente);
    });

    it('NÃO deve mostrar botões de ação para parada concluída', () => {
      const { queryByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaConcluida} />,
      );

      expect(queryByText('Como Chegar')).toBeNull();
      expect(queryByText('Reportar Problema')).toBeNull();
    });

    it('NÃO deve mostrar botões de ação para parada pulada', () => {
      const { queryByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaPulada} />,
      );

      expect(queryByText('Como Chegar')).toBeNull();
      expect(queryByText('Reportar Problema')).toBeNull();
    });
  });

  // Concluir e Pular só existiam no gesto de deslizar: quem não sabia do
  // gesto (ou com a dica escondida) não achava como concluir a entrega.
  describe('Concluir e Pular sempre visíveis', () => {
    it('parada aberta com rota em andamento mostra os dois botões, sem gesto', () => {
      const onConcluir = jest.fn();
      const onPular = jest.fn();
      const { getByLabelText } = render(
        <ParadaCard
          {...defaultProps}
          onConcluir={onConcluir}
          onPular={onPular}
        />,
      );

      fireEvent.press(getByLabelText('Concluir parada 1'));
      expect(onConcluir).toHaveBeenCalledWith(mockParadaPendente);
      fireEvent.press(getByLabelText('Pular parada 1'));
      expect(onPular).toHaveBeenCalledWith(mockParadaPendente);
    });

    it('rota não iniciada ou parada resolvida: sem Concluir/Pular', () => {
      const { queryByLabelText, rerender } = render(
        <ParadaCard {...defaultProps} rotaEmAndamento={false} />,
      );
      expect(queryByLabelText('Concluir parada 1')).toBeNull();

      rerender(<ParadaCard {...defaultProps} parada={mockParadaConcluida} />);
      expect(queryByLabelText('Concluir parada 2')).toBeNull();
      expect(queryByLabelText('Pular parada 2')).toBeNull();
    });

    it('com fonte 2.0 os rótulos têm teto de escala e a linha quebra em vez de cortar', () => {
      const { getByText, getByTestId } = render(
        <ParadaCard {...defaultProps} />,
      );
      for (const rotulo of ['Concluir', 'Pular']) {
        const texto = getByText(rotulo);
        expect(texto.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3);
        expect(texto.props.numberOfLines).toBeUndefined();
      }
      expect(
        StyleSheet.flatten(getByTestId('acoes-concluir-pular').props.style)
          .flexWrap,
      ).toBe('wrap');
    });

    it('enquanto conclui ou pula, os botões ficam desabilitados', () => {
      const { getByLabelText } = render(
        <ParadaCard {...defaultProps} concluindo />,
      );
      expect(
        getByLabelText('Concluir parada 1').props.accessibilityState,
      ).toMatchObject({ disabled: true });
    });
  });

  describe('Envio pendente (registrada sem internet)', () => {
    it('mostra o selo e esconde o Retomar, que desfaria a ação ainda na fila', () => {
      const { getByText, queryByText } = render(
        <ParadaCard
          {...defaultProps}
          parada={mockParadaPulada}
          envioPendente
        />,
      );
      expect(getByText('Aguardando envio')).toBeTruthy();
      expect(queryByText('Retomar Parada')).toBeNull();
    });
  });

  describe('Botão Retomar', () => {
    it('deve mostrar botão Retomar para parada pulada', () => {
      const { getByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaPulada} />,
      );

      expect(getByText('Retomar Parada')).toBeTruthy();
    });

    it('deve chamar onRetomar ao pressionar Retomar Parada', () => {
      const onRetomar = jest.fn();
      const { getByText } = render(
        <ParadaCard
          {...defaultProps}
          parada={mockParadaPulada}
          onRetomar={onRetomar}
        />,
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
        <ParadaCard {...defaultProps} parada={mockParadaConcluida} />,
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
        <ParadaCard {...defaultProps} rotaEmAndamento={false} />,
      );

      expect(queryByText('Deslize para ações')).toBeNull();
    });

    it('NÃO deve mostrar hint de swipe para parada concluída', () => {
      const { queryByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaConcluida} />,
      );

      expect(queryByText('Deslize para ações')).toBeNull();
    });

    it('NÃO deve mostrar hint de swipe para parada pulada', () => {
      const { queryByText } = render(
        <ParadaCard {...defaultProps} parada={mockParadaPulada} />,
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
        />,
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
      // Concluir está nas leftActions (aparecem deslizando para a DIREITA),
      // como ensina o SwipeOnboarding; Pular, nas rightActions.
      expect(accessibleView.props.accessibilityHint).toBe(
        'Deslize para a direita para concluir ou para a esquerda para pular',
      );
    });
  });

  describe('Memoização', () => {
    it('deve ser um componente memoizado', () => {
      expect(ParadaCard.displayName).toBe('ParadaCard');
    });
  });

  describe('com a fonte do sistema em 2.0', () => {
    // Moto g15, 1.14.2: o selo absoluto "PRÓXIMA" crescia para baixo e
    // cobria o pill do tipo; o ícone do "Como Chegar" vazava pela esquerda.
    it('o selo PRÓXIMA tem teto de escala', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} isProxima />);

      expect(
        getByText('PRÓXIMA').props.maxFontSizeMultiplier,
      ).toBeLessThanOrEqual(1.3);
    });

    // O círculo da ordem tem tamanho fixo e o número já o ocupa em 1.0:
    // em 2.0 o algarismo saía cortado. `maxFontSizeMultiplier={1}` o deixava
    // inteiro mas fora do centro no aparelho; `allowFontScaling={false}` não.
    it('o número da ordem não cresce além do círculo', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(getByText('1').props.allowFontScaling).toBe(false);
    });

    it('o ícone e o texto do Como Chegar têm teto de escala', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(
        getByText('\u{1F9ED}').props.maxFontSizeMultiplier,
      ).toBeLessThanOrEqual(1.3);
      expect(
        getByText('Como Chegar').props.maxFontSizeMultiplier,
      ).toBeLessThanOrEqual(1.3);
    });

    it('o texto do Como Chegar encolhe e quebra dentro do botão', () => {
      const { getByText } = render(<ParadaCard {...defaultProps} />);

      expect(
        StyleSheet.flatten(getByText('Como Chegar').props.style).flexShrink,
      ).toBe(1);
    });
  });
});
