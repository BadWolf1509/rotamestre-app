/**
 * Data da rota: o gestor digita em dd/mm/aaaa (o formato do resto do app) e
 * a tela entrega AAAA-MM-DD ao rascunho. Antes o campo só aceitava ISO.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React, { useState } from 'react';

import { RouteDateSelector } from '../RouteDateSelector';

function ComEstado({
  inicial = '',
  aoMudar,
}: {
  inicial?: string;
  aoMudar: jest.Mock;
}) {
  const [valor, setValor] = useState(inicial);
  return (
    <RouteDateSelector
      value={valor}
      onChange={(v) => {
        aoMudar(v);
        setValor(v);
      }}
    />
  );
}

const campo = () => screen.getByPlaceholderText('DD/MM/AAAA');

describe('RouteDateSelector', () => {
  it('mostra a data do rascunho em dd/mm/aaaa', () => {
    render(<ComEstado inicial="2026-10-28" aoMudar={jest.fn()} />);
    expect(campo().props.value).toBe('28/10/2026');
  });

  it('digitado em dd/mm/aaaa, entrega AAAA-MM-DD', () => {
    const aoMudar = jest.fn();
    render(<ComEstado aoMudar={aoMudar} />);

    fireEvent.changeText(campo(), '28102026');

    expect(campo().props.value).toBe('28/10/2026');
    expect(aoMudar).toHaveBeenLastCalledWith('2026-10-28');
  });

  it('data incompleta ou inexistente não vira data válida', () => {
    const aoMudar = jest.fn();
    render(<ComEstado aoMudar={aoMudar} />);

    fireEvent.changeText(campo(), '28/10');
    expect(campo().props.value).toBe('28/10');
    expect(aoMudar).toHaveBeenLastCalledWith(
      expect.not.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );

    fireEvent.changeText(campo(), '31/02/2026');
    expect(campo().props.value).toBe('31/02/2026');
    expect(aoMudar).toHaveBeenLastCalledWith(
      expect.not.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('o atalho "Amanhã" preenche o campo em dd/mm/aaaa', () => {
    const aoMudar = jest.fn();
    render(<ComEstado aoMudar={aoMudar} />);

    fireEvent.press(screen.getByText('Amanhã'));

    const iso = aoMudar.mock.calls.at(-1)?.[0] as string;
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const [ano, mes, dia] = iso.split('-');
    expect(campo().props.value).toBe(`${dia}/${mes}/${ano}`);
  });
});
