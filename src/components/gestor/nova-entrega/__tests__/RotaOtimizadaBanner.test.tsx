import { render } from '@testing-library/react-native';

import { RotaOtimizadaBanner } from '../RotaOtimizadaBanner';

describe('RotaOtimizadaBanner', () => {
  it('renderiza os dados da rota otimizada', () => {
    const { getByText } = render(
      <RotaOtimizadaBanner
        rotaOtimizada={{
          distancia_total_metros: 8500,
          duracao_total_segundos: 900,
          legs: [],
          polyline: 'xyz',
        }}
        enderecoUnidade={{
          latitude: -7.1,
          longitude: -34.9,
          endereco: 'Rua Base',
        }}
      />,
    );

    expect(getByText('Rota otimizada!')).toBeTruthy();
    expect(getByText('8.5 km')).toBeTruthy();
    expect(getByText('15 min')).toBeTruthy();
  });
});
