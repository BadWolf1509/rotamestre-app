import { fireEvent, render } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';

import { ParadasListAndActions } from '../ParadasListAndActions';

const mockUseResponsive = jest.fn();

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

describe('ParadasListAndActions', () => {
  const baseParadas = [
    {
      id: 'p1',
      ordem: 1,
      tipo: 'retirada' as const,
      endereco: 'Rua A, 123',
      destinatario: 'Cliente A',
      telefone: '99999999',
      observacoes: '',
      latitude: -7.1,
      longitude: -34.9,
    },
    {
      id: 'p2',
      ordem: 2,
      tipo: 'entrega' as const,
      endereco: 'Rua B, 456',
      destinatario: 'Cliente B',
      telefone: '88888888',
      observacoes: '',
      latitude: -7.2,
      longitude: -34.8,
      vinculo_parada_id: 'p1',
    },
  ];

  const baseProps = {
    paradas: baseParadas,
    paradasStatus: { texto: 'ok', cor: 'error' as const, icone: 'warning' as const },
    motoristas: [{ id: 'm1', nome: 'Joao', email: 'joao@teste.com', ativo: true }],
    motoristaSelecionado: '',
    rotaOtimizada: null,
    ordemManual: false,
    distanciaManualReal: null,
    enderecoUnidade: { latitude: -7.1, longitude: -34.9, endereco: 'Rua Base' },
    isOptimizing: false,
    isCalculandoReal: false,
    isLoading: false,
    isDesktop: false,
    onMoveUp: jest.fn(),
    onMoveDown: jest.fn(),
    onRemove: jest.fn(),
    onOptimize: jest.fn(),
    onSelectMotorista: jest.fn(),
    onGenerateRoute: jest.fn(),
  };

  beforeEach(() => {
    mockUseResponsive.mockReturnValue({ isDesktop: false });
  });

  it('renderiza estado vazio quando nao ha paradas', () => {
    const { getByText, queryByText } = render(
      <ParadasListAndActions
        {...baseProps}
        paradas={[]}
        paradasStatus={{ texto: 'vazio', cor: 'default', icone: null }}
      />
    );

    expect(getByText('Nenhuma parada adicionada')).toBeTruthy();
    expect(queryByText('Gerar Rota')).toBeNull();
  });

  it('renderiza lista de paradas e botao de otimizar', () => {
    const { getByText } = render(
      <ParadasListAndActions {...baseProps} />
    );

    expect(getByText(/Paradas Adicionadas/)).toBeTruthy();
    expect(getByText(/limite/i)).toBeTruthy();
    expect(getByText('Otimizar Rota (Melhor Percurso)')).toBeTruthy();
    expect(getByText('Gerar Rota')).toBeTruthy();
  });

  it('desabilita botao de otimizar durante processamento', () => {
    const { getByLabelText, UNSAFE_getAllByType } = render(
      <ParadasListAndActions
        {...baseProps}
        isOptimizing={true}
      />
    );

    const optimize = getByLabelText('Otimizar rota para o melhor percurso');
    expect(optimize.props.accessibilityState.disabled).toBe(true);
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('renderiza banner de rota otimizada quando ordem manual esta desligada', () => {
    const { getByText } = render(
      <ParadasListAndActions
        {...baseProps}
        rotaOtimizada={{
          distancia_total_metros: 8500,
          duracao_total_segundos: 900,
          legs: [],
          polyline: 'xyz',
        }}
        ordemManual={false}
      />
    );

    expect(getByText('Rota Otimizada!')).toBeTruthy();
  });

  it('renderiza ordem manual e dispara gerar rota habilitado', () => {
    const onGenerateRoute = jest.fn();
    const { getByText } = render(
      <ParadasListAndActions
        {...baseProps}
        rotaOtimizada={{
          distancia_total_metros: 10000,
          duracao_total_segundos: 1200,
          legs: [],
          polyline: 'abc',
        }}
        ordemManual={true}
        motoristaSelecionado="m1"
        onGenerateRoute={onGenerateRoute}
      />
    );

    expect(getByText('Ordem alterada manualmente')).toBeTruthy();
    fireEvent.press(getByText('Gerar Rota'));
    expect(onGenerateRoute).toHaveBeenCalled();
  });

  it('mostra carregamento ao gerar rota', () => {
    const { getByText, getByLabelText } = render(
      <ParadasListAndActions
        {...baseProps}
        motoristaSelecionado="m1"
        isLoading={true}
      />
    );

    const generate = getByLabelText(/Gerar rota/i);
    expect(generate.props.accessibilityState.disabled).toBe(true);
    expect(getByText('Criando rota...')).toBeTruthy();
  });
});
