import { render } from '@testing-library/react-native';
import React from 'react';

import { MapaMobile } from '../MapaMobile.web';

describe('MapaMobile.web (Stub)', () => {
  const mockParadas = [
    {
      id: '1',
      ordem: 1,
      endereco: 'Rua Teste',
      latitude: -23.5505,
      longitude: -46.6333,
      status: 'pendente',
    },
  ];

  it('deve renderizar mensagem de aviso', () => {
    const { getByText } = render(<MapaMobile paradas={mockParadas} />);

    expect(getByText(/MapaMobile não deve ser usado na web/i)).toBeTruthy();
  });

  it('deve sugerir uso do MapaWeb', () => {
    const { getByText } = render(<MapaMobile paradas={mockParadas} />);

    expect(getByText(/Use MapaWeb através do MapaAdapter/i)).toBeTruthy();
  });

  it('deve renderizar com array vazio', () => {
    const { getByText } = render(<MapaMobile paradas={[]} />);

    expect(getByText(/MapaMobile não deve ser usado na web/i)).toBeTruthy();
  });

  it('deve renderizar com múltiplas paradas', () => {
    const muitasParadas = [
      { id: '1', ordem: 1, endereco: 'A', latitude: -23.5505, longitude: -46.6333, status: 'pendente' },
      { id: '2', ordem: 2, endereco: 'B', latitude: -23.5489, longitude: -46.6388, status: 'concluida' },
      { id: '3', ordem: 3, endereco: 'C', latitude: -23.5600, longitude: -46.6500, status: 'pendente' },
    ];

    const { getByText } = render(<MapaMobile paradas={muitasParadas} />);

    expect(getByText(/MapaMobile não deve ser usado na web/i)).toBeTruthy();
  });

  it('deve renderizar com paradas sem coordenadas', () => {
    const paradasSemCoordenadas = [
      {
        id: '1',
        ordem: 1,
        endereco: 'Sem coordenadas',
        latitude: null,
        longitude: null,
        status: 'pendente',
      },
    ];

    const { getByText } = render(<MapaMobile paradas={paradasSemCoordenadas} />);

    expect(getByText(/MapaMobile não deve ser usado na web/i)).toBeTruthy();
  });

  it('deve ter estrutura visual consistente', () => {
    const { UNSAFE_getAllByType } = render(<MapaMobile paradas={mockParadas} />);

    const View = require('react-native').View;
    const Text = require('react-native').Text;

    const views = UNSAFE_getAllByType(View);
    const texts = UNSAFE_getAllByType(Text);

    expect(views.length).toBeGreaterThan(0);
    expect(texts.length).toBeGreaterThan(0);
  });
});
