import { fireEvent, render } from '@testing-library/react-native';

import { MotoristaSeletor } from '../MotoristaSeletor';

const mockUseResponsive = jest.fn();

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

describe('MotoristaSeletor', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue({ isDesktop: false });
  });

  it('exibe mensagem quando nao ha motoristas', () => {
    const { getByText } = render(
      <MotoristaSeletor
        motoristas={[]}
        motoristaSelecionado=""
        onSelectMotorista={jest.fn()}
      />
    );

    expect(getByText(/Nenhum motorista/i)).toBeTruthy();
  });

  it('renderiza lista e seleciona motorista', () => {
    const onSelectMotorista = jest.fn();
    const motoristas = [
      { id: 'm1', nome: 'Joao', email: 'joao@teste.com', ativo: true },
      { id: 'm2', nome: 'Maria', email: 'maria@teste.com', ativo: true },
    ];

    const { getByLabelText } = render(
      <MotoristaSeletor
        motoristas={motoristas}
        motoristaSelecionado="m2"
        onSelectMotorista={onSelectMotorista}
      />
    );

    const itemJoao = getByLabelText('Selecionar motorista Joao');
    const itemMaria = getByLabelText('Selecionar motorista Maria');

    expect(itemJoao.props.accessibilityState.checked).toBe(false);
    expect(itemMaria.props.accessibilityState.checked).toBe(true);

    fireEvent.press(itemJoao);
    expect(onSelectMotorista).toHaveBeenCalledWith('m1');
  });
});
