import { fireEvent, render } from '@testing-library/react-native';
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

  it('mostra comparativo com distancia real e oculta calcular real', () => {
    const { getByText, queryByText } = render(
      <OrdemManualBanner
        rotaOtimizada={rotaOtimizada}
        distanciaManualReal={{ metros: 12000, segundos: 1500 }}
        distanciaManualAproximada={null}
        isOptimizing={false}
        isCalculandoReal={false}
        onReoptimize={jest.fn()}
        onCalculateReal={jest.fn()}
      />
    );

    expect(getByText('Ordem alterada manualmente')).toBeTruthy();
    expect(getByText(/\+2\.0 km/)).toBeTruthy();
    expect(queryByText(/Calcular/i)).toBeNull();
  });

  it('mostra comparativo aproximado e aciona calculo real', () => {
    const onCalculateReal = jest.fn();
    const { getByText } = render(
      <OrdemManualBanner
        rotaOtimizada={rotaOtimizada}
        distanciaManualReal={null}
        distanciaManualAproximada={{ metros: 11000, diferenca: 1000, percentual: 10 }}
        isOptimizing={false}
        isCalculandoReal={false}
        onReoptimize={jest.fn()}
        onCalculateReal={onCalculateReal}
      />
    );

    expect(getByText('*aproximado')).toBeTruthy();
    fireEvent.press(getByText(/Calcular/i));
    expect(onCalculateReal).toHaveBeenCalled();
  });

  it('mostra placeholders quando nao ha distancia', () => {
    const { getAllByText } = render(
      <OrdemManualBanner
        rotaOtimizada={rotaOtimizada}
        distanciaManualReal={null}
        distanciaManualAproximada={null}
        isOptimizing={false}
        isCalculandoReal={false}
        onReoptimize={jest.fn()}
        onCalculateReal={jest.fn()}
      />
    );

    expect(getAllByText('--').length).toBeGreaterThan(0);
  });

  it('desabilita botoes durante processamento', () => {
    const { getByLabelText, UNSAFE_getAllByType } = render(
      <OrdemManualBanner
        rotaOtimizada={rotaOtimizada}
        distanciaManualReal={null}
        distanciaManualAproximada={null}
        isOptimizing={true}
        isCalculandoReal={true}
        onReoptimize={jest.fn()}
        onCalculateReal={jest.fn()}
      />
    );

    const reoptimize = getByLabelText('Re-otimizar rota para o melhor percurso');
    const calculate = getByLabelText(/Calcular/i);

    expect(reoptimize.props.accessibilityState.disabled).toBe(true);
    expect(calculate.props.accessibilityState.disabled).toBe(true);
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });
});
