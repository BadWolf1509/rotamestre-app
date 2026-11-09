import { fireEvent, render, renderHook } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import type { StatusParada } from '@/types/rota';
import { useUnistyles } from '@/utils/styles';

import { LinhaDeParadas } from '../LinhaDeParadas';

describe('LinhaDeParadas', () => {
  it('um ponto por parada, na ordem, com o estado no rótulo', () => {
    const { getAllByLabelText, getByLabelText } = render(
      <LinhaDeParadas
        paradas={[
          'concluida',
          'concluida',
          'em_andamento',
          'pendente',
          'pulada',
        ]}
      />,
    );

    expect(getAllByLabelText(/^Parada \d+, /)).toHaveLength(5);
    expect(getByLabelText('Parada 1, concluída')).toBeTruthy();
    expect(getByLabelText('Parada 2, concluída')).toBeTruthy();
    expect(getByLabelText('Parada 3, em andamento')).toBeTruthy();
    expect(getByLabelText('Parada 4, pendente')).toBeTruthy();
    expect(getByLabelText('Parada 5, pulada')).toBeTruthy();
  });

  it('a borda do ponto pendente usa gray500 (3:1 de componente, WCAG 1.4.11)', () => {
    const { result } = renderHook(() => useUnistyles());
    const { getByLabelText } = render(
      <LinhaDeParadas paradas={['pendente']} />,
    );

    const estilo = StyleSheet.flatten(
      getByLabelText('Parada 1, pendente').props.style,
    );
    expect(estilo.borderColor).toBe(result.current.theme.colors.gray500);
  });

  it('acima do máximo mostra os primeiros pontos e "+N"', () => {
    const paradas: StatusParada[] = Array.from(
      { length: 40 },
      () => 'pendente',
    );
    const { getAllByLabelText, getByText, queryByLabelText } = render(
      <LinhaDeParadas paradas={paradas} maximo={24} />,
    );

    expect(getAllByLabelText(/^Parada \d+, /)).toHaveLength(24);
    expect(getByText('+16')).toBeTruthy();
    expect(queryByLabelText('Parada 25, pendente')).toBeNull();
  });

  it('o máximo padrão é 24', () => {
    const paradas: StatusParada[] = Array.from(
      { length: 30 },
      () => 'concluida',
    );
    const { getAllByLabelText, getByText } = render(
      <LinhaDeParadas paradas={paradas} />,
    );

    expect(getAllByLabelText(/^Parada \d+, /)).toHaveLength(24);
    expect(getByText('+6')).toBeTruthy();
  });

  it('sem paradas reais diz "Sem paradas", sem pontos', () => {
    const { getByText, queryAllByLabelText } = render(
      <LinhaDeParadas paradas={[]} />,
    );

    expect(getByText('Sem paradas')).toBeTruthy();
    expect(queryAllByLabelText(/^Parada \d+, /)).toHaveLength(0);
  });
  describe('largura medida (onLayout)', () => {
    const medir = (largura: number) => ({
      nativeEvent: { layout: { width: largura, height: 10, x: 0, y: 0 } },
    });

    it('não esconde ponto sem contar no "+N" quando a largura é curta', () => {
      const paradas: StatusParada[] = Array.from(
        { length: 10 },
        () => 'pendente',
      );
      const { getByTestId, getAllByLabelText, getByText } = render(
        <LinhaDeParadas paradas={paradas} testID="linha" />,
      );

      // Cabem 4 pontos (4×10 + 3×4 = 52) mais o "+N" ao lado.
      fireEvent(getByTestId('linha'), 'layout', medir(90));

      const pontos = getAllByLabelText(/^Parada \d+, /).length;
      expect(pontos).toBeGreaterThanOrEqual(3);
      expect(pontos).toBeLessThanOrEqual(4);
      expect(getByText(`+${10 - pontos}`)).toBeTruthy();
    });

    it('com largura grande, 40 paradas mostram 24 pontos e "+16"', () => {
      const paradas: StatusParada[] = Array.from(
        { length: 40 },
        () => 'concluida',
      );
      const { getByTestId, getAllByLabelText, getByText } = render(
        <LinhaDeParadas paradas={paradas} testID="linha" />,
      );

      fireEvent(getByTestId('linha'), 'layout', medir(800));

      expect(getAllByLabelText(/^Parada \d+, /)).toHaveLength(24);
      expect(getByText('+16')).toBeTruthy();
    });

    it('a largura medida no "Sem paradas" vale quando as paradas chegam', () => {
      const { getByTestId, getAllByLabelText, rerender } = render(
        <LinhaDeParadas paradas={[]} testID="linha" />,
      );
      fireEvent(getByTestId('linha'), 'layout', medir(90));

      // A largura não muda, então o layout não dispara de novo.
      rerender(
        <LinhaDeParadas
          paradas={Array.from({ length: 10 }, () => 'pendente')}
          testID="linha"
        />,
      );

      expect(getAllByLabelText(/^Parada \d+, /).length).toBeLessThanOrEqual(4);
    });

    it('a reserva do "+N" cresce com os dígitos: "+138" não corta', () => {
      const paradas: StatusParada[] = Array.from(
        { length: 150 },
        () => 'pendente',
      );
      const { getByTestId, getAllByLabelText, getByText } = render(
        <LinhaDeParadas paradas={paradas} maximo={200} testID="linha" />,
      );

      fireEvent(getByTestId('linha'), 'layout', medir(200));

      // 13 px semibold: ~9 px por caractere; "+138" (4) + gap de 8 = 44 px.
      // Com a reserva fixa de "+99" (34 px) cabiam 12 pontos e o "+138"
      // passava da linha; com 44 px, 11 (11×10 + 10×4 = 150 ≤ 156).
      const pontos = getAllByLabelText(/^Parada \d+, /).length;
      expect(pontos).toBe(11);
      expect(getByText(`+${150 - pontos}`)).toBeTruthy();
    });

    it('quando todas cabem, não há "+N"', () => {
      const paradas: StatusParada[] = Array.from(
        { length: 5 },
        () => 'pendente',
      );
      const { getByTestId, getAllByLabelText, queryByText } = render(
        <LinhaDeParadas paradas={paradas} testID="linha" />,
      );

      // 5 pontos = 66 px: cabem sem o "+N".
      fireEvent(getByTestId('linha'), 'layout', medir(70));

      expect(getAllByLabelText(/^Parada \d+, /)).toHaveLength(5);
      expect(queryByText(/^\+/)).toBeNull();
    });
  });
});
