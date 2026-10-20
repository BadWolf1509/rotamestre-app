import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

import { ParadaCallout } from '../ParadaCallout';
import { ParadaMarker } from '../ParadaMarker';

const baseParada = {
  id: 'p1',
  endereco: 'Rua Teste, 100',
  latitude: -23.55,
  longitude: -46.63,
  status: 'pendente',
  ordem: 1,
  is_checkpoint: false,
};

const servicos = [
  { ordem: 3, tipo: 'entrega', status: 'pendente' },
  { ordem: 4, tipo: 'retirada', status: 'pendente' },
];
const principal = { ...baseParada, ordem: 3, tipo: 'entrega' };

describe('ParadaMarker', () => {
  it('mostra o número da parada', () => {
    const { getByText } = render(
      <ParadaMarker parada={baseParada as any} isSelected={false} />,
    );
    expect(getByText('1')).toBeTruthy();
  });

  it('é só o pino: o balão não fica dentro dele, nem selecionado', () => {
    const { queryByText } = render(
      <ParadaMarker parada={baseParada as any} isSelected={true} />,
    );
    expect(queryByText('Parada 1')).toBeNull();
    expect(queryByText('Rua Teste, 100')).toBeNull();
  });

  it('mostra o rótulo do grupo no pino', () => {
    const { getByText } = render(
      <ParadaMarker
        parada={principal as any}
        rotulo="3+4"
        servicos={servicos}
        isSelected={false}
      />,
    );
    expect(getByText('3+4')).toBeTruthy();
  });

  it('descreve as paradas do grupo no accessibilityLabel', () => {
    const { getByLabelText } = render(
      <ParadaMarker
        parada={principal as any}
        rotulo="3+4"
        servicos={servicos}
        isSelected={false}
      />,
    );
    expect(getByLabelText(/^Paradas 3 e 4/)).toBeTruthy();
  });
});

describe('ParadaCallout', () => {
  it('mostra título e endereço', () => {
    const { getByText } = render(<ParadaCallout parada={baseParada as any} />);
    expect(getByText('Parada 1')).toBeTruthy();
    expect(getByText('Rua Teste, 100')).toBeTruthy();
  });

  it('mostra o destinatário', () => {
    const { getByText } = render(
      <ParadaCallout
        parada={{ ...baseParada, destinatario: 'João Silva' } as any}
      />,
    );
    expect(getByText('João Silva')).toBeTruthy();
  });

  it('o telefone é um botão de ligar', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { getByLabelText } = render(
      <ParadaCallout
        parada={{ ...baseParada, telefone: '83999990000' } as any}
      />,
    );
    fireEvent.press(getByLabelText('Ligar para 83999990000'));
    expect(openURL).toHaveBeenCalledWith('tel:83999990000');
  });

  it('com onAbrirAcoes: mostra a dica e o toque no balão abre as ações', () => {
    const onAbrirAcoes = jest.fn();
    const { getByText } = render(
      <ParadaCallout parada={baseParada as any} onAbrirAcoes={onAbrirAcoes} />,
    );
    fireEvent.press(getByText('Rua Teste, 100'));
    expect(onAbrirAcoes).toHaveBeenCalled();
    expect(getByText(/Toque para ver ações/)).toBeTruthy();
  });

  it('sem onAbrirAcoes (gestor): sem a dica', () => {
    const { queryByText } = render(
      <ParadaCallout parada={baseParada as any} />,
    );
    expect(queryByText(/Toque para ver ações/)).toBeNull();
  });

  it('pino agrupado: lista cada serviço', () => {
    const { getByText } = render(
      <ParadaCallout parada={principal as any} servicos={servicos} />,
    );
    expect(getByText('Paradas 3 e 4')).toBeTruthy();
    expect(getByText('3 · Entrega')).toBeTruthy();
    expect(getByText('4 · Retirada')).toBeTruthy();
  });
});
