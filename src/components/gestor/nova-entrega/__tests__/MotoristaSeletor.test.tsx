import { fireEvent, render } from '@testing-library/react-native';

import { MotoristaSeletor } from '../MotoristaSeletor';

const mockUseResponsive = jest.fn();
const mockPush = jest.fn();

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

describe('MotoristaSeletor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: false });
  });

  it('exibe mensagem quando nao ha motoristas', () => {
    const { getByText } = render(
      <MotoristaSeletor
        motoristas={[]}
        motoristaSelecionado=""
        onSelectMotorista={jest.fn()}
      />,
    );

    expect(getByText(/Nenhum motorista/i)).toBeTruthy();
  });

  it('oferece caminho para cadastrar motorista quando a unidade não tem nenhum', () => {
    // Unidade recém-criada não tem motorista, e "Nova Rota de Entrega" é a
    // primeira ação do dashboard. Sem esta saída o gestor preenche paradas,
    // geocodifica, otimiza — e só descobre no fim que não dá para concluir.
    const { getByLabelText } = render(
      <MotoristaSeletor
        motoristas={[]}
        motoristaSelecionado=""
        onSelectMotorista={jest.fn()}
      />,
    );

    fireEvent.press(getByLabelText('Cadastrar motorista'));

    expect(mockPush).toHaveBeenCalledWith('/gestor/motoristas');
  });

  it('não oferece o atalho de cadastro quando já existem motoristas', () => {
    // O atalho é a saída de um beco; com lista cheia ele só rouba atenção da
    // escolha que o gestor veio fazer.
    const { queryByLabelText } = render(
      <MotoristaSeletor
        motoristas={[
          { id: 'm1', nome: 'Joao', email: 'joao@teste.com', ativo: true },
        ]}
        motoristaSelecionado=""
        onSelectMotorista={jest.fn()}
      />,
    );

    expect(queryByLabelText('Cadastrar motorista')).toBeNull();
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
      />,
    );

    const itemJoao = getByLabelText('Selecionar motorista Joao');
    const itemMaria = getByLabelText('Selecionar motorista Maria');

    expect(itemJoao.props.accessibilityState.checked).toBe(false);
    expect(itemMaria.props.accessibilityState.checked).toBe(true);

    fireEvent.press(itemJoao);
    expect(onSelectMotorista).toHaveBeenCalledWith('m1');
  });
});
