import { render } from '@testing-library/react-native';
import React from 'react';

import { Badge } from '../Badge';

describe('Badge', () => {
  it('deve renderizar label padrão para status', () => {
    const { getByText } = render(<Badge status="pendente" />);
    expect(getByText('Pendente')).toBeTruthy();
  });

  it('deve renderizar label customizado', () => {
    const { getByText } = render(<Badge status="pendente" label="Custom Label" />);
    expect(getByText('Custom Label')).toBeTruthy();
  });

  it('deve renderizar diferentes status sem erro', () => {
    const { getByText } = render(
      <>
        <Badge status="em_andamento" />
        <Badge status="concluida" />
        <Badge status="cancelada" />
      </>
    );
    expect(getByText('Em Andamento')).toBeTruthy();
    expect(getByText('Concluída')).toBeTruthy();
    expect(getByText('Cancelada')).toBeTruthy();
  });

  it('deve aplicar variante outlined', () => {
    const { toJSON } = render(<Badge status="pendente" variant="outlined" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('deve aplicar tamanho small', () => {
    const { toJSON } = render(<Badge status="pendente" size="small" />);
    expect(toJSON()).toMatchSnapshot();
  });
});
