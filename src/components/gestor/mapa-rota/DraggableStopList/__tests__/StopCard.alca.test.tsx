/**
 * Alça de arrasto do modal Reordenar (mobile).
 *
 * O arrasto começava no primeiro toque da alça (`onTouchStart`). Com a lista
 * rolada, isso disparava a rolagem automática da lib antes de o dedo se mexer
 * (a parada pega na borda puxava a lista para cima) e, quando a rolagem nativa
 * ganhava o gesto, deixava a parada presa como ativa (moto g15, 3055). Como na
 * Nova Entrega, o arrasto só começa com o toque longo.
 */
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { StopCard } from '../StopCard';

const PARADA = {
  id: 'p1',
  ordem: 3,
  endereco: 'Rua A, 1',
  destinatario: 'Cliente A',
  tipo: 'entrega',
  status: 'pendente',
} as unknown as React.ComponentProps<typeof StopCard>['parada'];

function renderizar(onDrag: jest.Mock) {
  return render(
    <StopCard
      parada={PARADA}
      displayIndex={3}
      variant="reorderable"
      onDrag={onDrag}
    />,
  );
}

describe('StopCard: alça de arrasto no mobile', () => {
  it('o primeiro toque na alça não começa o arrasto', () => {
    const onDrag = jest.fn();
    const { getByLabelText } = renderizar(onDrag);

    fireEvent(getByLabelText('Arrastar parada 3'), 'touchStart');
    fireEvent(getByLabelText('Arrastar parada 3'), 'pressIn');

    expect(onDrag).not.toHaveBeenCalled();
  });

  it('o toque longo na alça começa o arrasto', () => {
    const onDrag = jest.fn();
    const { getByLabelText } = renderizar(onDrag);

    fireEvent(getByLabelText('Arrastar parada 3'), 'longPress');

    expect(onDrag).toHaveBeenCalledTimes(1);
  });
});
