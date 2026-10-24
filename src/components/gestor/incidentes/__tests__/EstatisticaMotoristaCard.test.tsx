// Card do top 5 "Incidentes por Motorista". O grupo "Motorista removido"
// (contas excluídas, Migration 56) junta pessoas diferentes e não tem id: abrir
// o "histórico" dele consultaria `.in('motorista_id', ['removido'])` (22P02) —
// então o card não é clicável. Os incidentes dele seguem na lista abaixo.
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { EstatisticaMotoristaCard } from '../EstatisticaMotoristaCard';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/styles/gestor/incidentes.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
}));
jest.mock('@/components/Text', () => ({
  Text: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));
jest.mock('@/utils/styles', () => ({
  useUnistyles: () => ({ theme: { colors: { gray400: '#999' } } }),
}));

const stat = (over = {}) => ({
  id: 'mot-1',
  nome: 'João',
  total: 3,
  abertos: 1,
  resolvidos: 2,
  ...over,
});

describe('EstatisticaMotoristaCard', () => {
  it('motorista com conta: é um botão e abre o histórico dele', () => {
    const onVerHistorico = jest.fn();
    const { getByRole } = render(
      <EstatisticaMotoristaCard
        stat={stat()}
        index={0}
        onVerHistorico={onVerHistorico}
      />,
    );

    fireEvent.press(getByRole('button'));

    expect(onVerHistorico).toHaveBeenCalledWith('mot-1', 'João');
  });

  it('motorista removido (id nulo): mostra os números, mas não é botão e não consulta nada', () => {
    const onVerHistorico = jest.fn();
    const { getByText, queryByRole } = render(
      <EstatisticaMotoristaCard
        stat={stat({ id: null, nome: 'Motorista removido' })}
        index={1}
        onVerHistorico={onVerHistorico}
      />,
    );

    expect(getByText('Motorista removido')).toBeTruthy();
    expect(getByText(/3 incidentes/)).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
    expect(onVerHistorico).not.toHaveBeenCalled();
  });
});
