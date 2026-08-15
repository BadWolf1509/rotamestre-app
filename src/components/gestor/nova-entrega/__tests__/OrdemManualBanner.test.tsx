import { render } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';

import { OrdemManualBanner } from '../OrdemManualBanner';

const mockUseResponsive = jest.fn();

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

describe('OrdemManualBanner', () => {
  const rotaOtimizada = {
    distancia_total_metros: 10000,
    duracao_total_segundos: 1200,
    legs: [],
    polyline: 'abc',
  };

  beforeEach(() => {
    mockUseResponsive.mockReturnValue({ isDesktop: false });
  });

  it('mostra comparativo com distancia real', () => {
    const { getByText } = render(
      <OrdemManualBanner
        rotaOtimizada={rotaOtimizada}
        distanciaManualReal={{ metros: 12000, segundos: 1500 }}
        isOptimizing={false}
        isCalculandoReal={false}
        onReoptimize={jest.fn()}
      />,
    );

    expect(getByText('Ordem alterada manualmente')).toBeTruthy();
    expect(getByText(/\+2,0 km/)).toBeTruthy();
    expect(getByText('12,0 km')).toBeTruthy();
    expect(getByText(/~25 min/)).toBeTruthy();
  });

  it('mostra loading enquanto calcula distancia', () => {
    const { getByText, UNSAFE_getAllByType } = render(
      <OrdemManualBanner
        rotaOtimizada={rotaOtimizada}
        distanciaManualReal={null}
        isOptimizing={false}
        isCalculandoReal={true}
        onReoptimize={jest.fn()}
      />,
    );

    expect(getByText('Calculando...')).toBeTruthy();
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('mostra placeholders quando nao ha distancia e nao esta calculando', () => {
    const { getAllByText } = render(
      <OrdemManualBanner
        rotaOtimizada={rotaOtimizada}
        distanciaManualReal={null}
        isOptimizing={false}
        isCalculandoReal={false}
        onReoptimize={jest.fn()}
      />,
    );

    expect(getAllByText('--').length).toBeGreaterThan(0);
  });

  it('mostra diferenca positiva em vermelho (pior rota)', () => {
    const { getByText } = render(
      <OrdemManualBanner
        rotaOtimizada={rotaOtimizada}
        distanciaManualReal={{ metros: 15000, segundos: 1800 }}
        isOptimizing={false}
        isCalculandoReal={false}
        onReoptimize={jest.fn()}
      />,
    );

    // 15000 - 10000 = +5000m = +5.0 km
    expect(getByText(/\+5,0 km/)).toBeTruthy();
    expect(getByText(/\+50%/)).toBeTruthy();
  });

  it('mostra diferenca negativa em verde (melhor rota)', () => {
    const { getByText } = render(
      <OrdemManualBanner
        rotaOtimizada={rotaOtimizada}
        distanciaManualReal={{ metros: 8000, segundos: 1000 }}
        isOptimizing={false}
        isCalculandoReal={false}
        onReoptimize={jest.fn()}
      />,
    );

    // 8000 - 10000 = -2000m = -2.0 km
    expect(getByText(/-2,0 km/)).toBeTruthy();
  });

  it('desabilita botao reotimizar durante processamento', () => {
    const { getByLabelText, UNSAFE_getAllByType } = render(
      <OrdemManualBanner
        rotaOtimizada={rotaOtimizada}
        distanciaManualReal={null}
        isOptimizing={true}
        isCalculandoReal={false}
        onReoptimize={jest.fn()}
      />,
    );

    const reoptimize = getByLabelText(
      'Re-otimizar rota para o melhor percurso',
    );
    expect(reoptimize.props.accessibilityState.disabled).toBe(true);
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('funciona corretamente em modo desktop', () => {
    mockUseResponsive.mockReturnValue({ isDesktop: true });

    const { getByText } = render(
      <OrdemManualBanner
        rotaOtimizada={rotaOtimizada}
        distanciaManualReal={{ metros: 12000, segundos: 1500 }}
        isOptimizing={false}
        isCalculandoReal={false}
        onReoptimize={jest.fn()}
      />,
    );

    expect(getByText('Ordem alterada manualmente')).toBeTruthy();
    expect(getByText('12,0 km')).toBeTruthy();
  });
});
