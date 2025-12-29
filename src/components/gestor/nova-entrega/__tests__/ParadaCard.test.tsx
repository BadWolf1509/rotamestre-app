import { fireEvent, render } from '@testing-library/react-native';

import { ParadaCard } from '../ParadaCard';

const mockUseResponsive = jest.fn();

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

describe('ParadaCard', () => {
  const baseParada = {
    id: 'parada-1',
    ordem: 1,
    tipo: 'entrega' as const,
    endereco: 'Rua A, 123',
    destinatario: 'Ana',
    telefone: '99999999',
    observacoes: '',
    latitude: -7.1,
    longitude: -34.9,
  };

  beforeEach(() => {
    mockUseResponsive.mockReturnValue({ isDesktop: false });
  });

  it('renderiza os botoes de reordenacao e respeita limites', () => {
    const onMoveUp = jest.fn();
    const onMoveDown = jest.fn();

    const { getByLabelText, rerender } = render(
      <ParadaCard
        parada={baseParada}
        index={0}
        totalParadas={2}
        retiradaVinculada={null}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onRemove={jest.fn()}
      />
    );

    const moveUp = getByLabelText('Mover parada 1 para cima');
    const moveDown = getByLabelText('Mover parada 1 para baixo');

    expect(moveUp.props.accessibilityState.disabled).toBe(true);
    expect(moveDown.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(moveDown);
    expect(onMoveDown).toHaveBeenCalledWith(0);

    rerender(
      <ParadaCard
        parada={{ ...baseParada, ordem: 2 }}
        index={1}
        totalParadas={2}
        retiradaVinculada={null}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onRemove={jest.fn()}
      />
    );

    const moveUpLast = getByLabelText('Mover parada 2 para cima');
    const moveDownLast = getByLabelText('Mover parada 2 para baixo');

    expect(moveUpLast.props.accessibilityState.disabled).toBe(false);
    expect(moveDownLast.props.accessibilityState.disabled).toBe(true);
  });

  it('exibe detalhes e vinculo quando informado', () => {
    const { getByText } = render(
      <ParadaCard
        parada={baseParada}
        index={0}
        totalParadas={1}
        retiradaVinculada={{
          ...baseParada,
          id: 'parada-2',
          tipo: 'retirada',
          destinatario: 'Cliente Retirada',
        }}
        onMoveUp={jest.fn()}
        onMoveDown={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    expect(getByText('Destinatario: Ana')).toBeTruthy();
    expect(getByText(/Depende de: Retirada em/)).toBeTruthy();
  });

  it('chama onRemove ao clicar em Remover', () => {
    const onRemove = jest.fn();

    const { getByText } = render(
      <ParadaCard
        parada={baseParada}
        index={0}
        totalParadas={1}
        retiradaVinculada={null}
        onMoveUp={jest.fn()}
        onMoveDown={jest.fn()}
        onRemove={onRemove}
      />
    );

    fireEvent.press(getByText('Remover'));
    expect(onRemove).toHaveBeenCalledWith(0);
  });
});
