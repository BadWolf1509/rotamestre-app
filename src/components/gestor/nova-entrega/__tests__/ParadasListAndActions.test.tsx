import { fireEvent, render } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';

import { ParadasListAndActions } from '../ParadasListAndActions';

const mockUseResponsive = jest.fn();

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: ({ data, renderItem }: any) =>
      React.createElement(
        View,
        null,
        data.map((item: any, index: number) =>
          React.createElement(
            View,
            { key: item.id },
            renderItem({
              item,
              getIndex: () => index,
              drag: jest.fn(),
              isActive: false,
            }),
          ),
        ),
      ),
    ScaleDecorator: ({ children }: any) => children,
  };
});

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
    paradasStatus: {
      texto: 'ok',
      cor: 'error' as const,
      icone: 'warning' as const,
    },
    motoristas: [
      { id: 'm1', nome: 'Joao', email: 'joao@teste.com', ativo: true },
    ],
    motoristaSelecionado: '',
    rotaOtimizada: null,
    ordemManual: false,
    distanciaManualReal: null,
    enderecoUnidade: { latitude: -7.1, longitude: -34.9, endereco: 'Rua Base' },
    isOptimizing: false,
    isCalculandoReal: false,
    isLoading: false,
    isDesktop: false,
    dataRota: '2026-07-24',
    canGenerateRoute: true,
    validationErrors: [],
    onMoveUp: jest.fn(),
    onMoveDown: jest.fn(),
    onRemove: jest.fn(),
    onEdit: jest.fn(),
    onReorder: jest.fn(),
    onImport: jest.fn().mockResolvedValue({
      adicionadas: 0,
      ignoradas: 0,
      erros: [],
    }),
    onOptimize: jest.fn(),
    onSelectMotorista: jest.fn(),
    onChangeDataRota: jest.fn(),
    onGenerateRoute: jest.fn(),
  };

  beforeEach(() => {
    mockUseResponsive.mockReturnValue({ isDesktop: false });
  });

  it('oferece caminho para cadastrar a sede quando a unidade não tem coordenadas', () => {
    // Mesmo beco do seletor de motorista, e pior: o gestor monta a rota inteira
    // e só descobre no submit, num toast de 5 segundos, que a unidade não tem
    // sede. O cartão de partida/chegada apenas sumia, sem dizer por quê nem
    // para onde ir — e o conserto mora em Minha Unidade.
    const { router } = require('expo-router');
    (router.push as jest.Mock).mockClear();

    const { getByLabelText } = render(
      <ParadasListAndActions {...baseProps} enderecoUnidade={null} />,
    );

    fireEvent.press(getByLabelText('Cadastrar sede da unidade'));

    expect(router.push).toHaveBeenCalledWith('/unidade');
  });

  it('não oferece o atalho da sede quando a unidade já tem coordenadas', () => {
    // O atalho é a saída de um beco; com sede cadastrada ele só rouba atenção.
    const { queryByLabelText } = render(
      <ParadasListAndActions {...baseProps} />,
    );

    expect(queryByLabelText('Cadastrar sede da unidade')).toBeNull();
  });

  it('renderiza estado vazio quando nao ha paradas', () => {
    const { getByText, queryByText } = render(
      <ParadasListAndActions
        {...baseProps}
        paradas={[]}
        paradasStatus={{ texto: 'vazio', cor: 'default', icone: null }}
      />,
    );

    expect(getByText('Nenhuma parada adicionada')).toBeTruthy();
    expect(queryByText('Revisar e Criar Rota')).toBeNull();
  });

  it('renderiza lista de paradas e botao de otimizar', () => {
    const { getByText } = render(<ParadasListAndActions {...baseProps} />);

    expect(getByText(/Paradas Adicionadas/)).toBeTruthy();
    expect(getByText(/limite/i)).toBeTruthy();
    expect(getByText('Otimizar melhor percurso')).toBeTruthy();
    expect(getByText('Revisar e Criar Rota')).toBeTruthy();
  });

  it('desabilita botao de otimizar durante processamento', () => {
    const { getByLabelText, UNSAFE_getAllByType } = render(
      <ParadasListAndActions {...baseProps} isOptimizing={true} />,
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
      />,
    );

    expect(getByText('Rota otimizada!')).toBeTruthy();
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
      />,
    );

    expect(getByText('Ordem alterada manualmente')).toBeTruthy();
    fireEvent.press(getByText('Revisar e Criar Rota'));
    expect(onGenerateRoute).toHaveBeenCalled();
  });

  it('mostra carregamento ao gerar rota', () => {
    const { getByText, getByLabelText } = render(
      <ParadasListAndActions
        {...baseProps}
        motoristaSelecionado="m1"
        isLoading={true}
      />,
    );

    const generate = getByLabelText(/Criando rota/i);
    expect(generate.props.accessibilityState.disabled).toBe(true);
    expect(getByText('Criando rota...')).toBeTruthy();
  });
});
