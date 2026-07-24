import { fireEvent, render } from '@testing-library/react-native';

import { RouteReviewModal } from '../RouteReviewModal';

import type { RouteDraftValidation } from '../types';

const stop = {
  id: 'stop-1',
  ordem: 1,
  tipo: 'entrega' as const,
  endereco: 'Rua A, 123',
  destinatario: 'Maria',
  telefone: '85999990000',
  observacoes: '',
  latitude: -3.74,
  longitude: -38.53,
};

const valid: RouteDraftValidation = {
  valido: true,
  erros: [],
  avisos: [],
  sanidadeGeografica: {
    maiorDistanciaKm: 5,
    paradasDistantes: [],
    requerConfirmacao: false,
  },
};

const baseProps = {
  visible: true,
  paradas: [stop],
  motorista: {
    id: 'driver-1',
    nome: 'Carlos',
    email: 'carlos@example.com',
    ativo: true,
  },
  unidadeNome: 'Unidade Centro',
  enderecoUnidade: {
    endereco: 'Rua Base, 10',
    latitude: -3.73,
    longitude: -38.52,
  },
  dataRota: '2099-07-24',
  rotaOtimizada: {
    distancia_total_metros: 10000,
    duracao_total_segundos: 1200,
    legs: [],
    isEstimated: false,
  },
  ordemManual: false,
  distanciaManualReal: null,
  validation: valid,
  isLoading: false,
  onClose: jest.fn(),
  onConfirm: jest.fn(),
};

describe('RouteReviewModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the operational summary before confirming', () => {
    const { getByText } = render(<RouteReviewModal {...baseProps} />);

    expect(getByText('Unidade Centro')).toBeTruthy();
    expect(getByText('Carlos')).toBeTruthy();
    expect(getByText('10.0 km')).toBeTruthy();
    expect(getByText('20 min')).toBeTruthy();
    expect(getByText('Rua A, 123')).toBeTruthy();
  });

  it('requires explicit confirmation for a geographically suspicious stop', () => {
    const onConfirm = jest.fn();
    const validation: RouteDraftValidation = {
      ...valid,
      avisos: ['1 parada está a mais de 150 km da base.'],
      sanidadeGeografica: {
        maiorDistanciaKm: 450,
        paradasDistantes: [stop],
        requerConfirmacao: true,
      },
    };
    const { getByLabelText } = render(
      <RouteReviewModal
        {...baseProps}
        validation={validation}
        onConfirm={onConfirm}
      />,
    );

    const create = getByLabelText('Criar rota e notificar motorista');
    expect(create.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(
      getByLabelText('Confirmar parada a mais de 300 quilômetros da base'),
    );
    expect(
      getByLabelText('Criar rota e notificar motorista').props
        .accessibilityState.disabled,
    ).toBe(false);
  });

  it('blocks confirmation when the route is only an estimate', () => {
    const { getByLabelText, getByText } = render(
      <RouteReviewModal
        {...baseProps}
        rotaOtimizada={{
          ...baseProps.rotaOtimizada,
          isEstimated: true,
        }}
      />,
    );

    expect(getByText(/apenas uma estimativa/)).toBeTruthy();
    expect(
      getByLabelText('Criar rota e notificar motorista').props
        .accessibilityState.disabled,
    ).toBe(true);
  });
});
