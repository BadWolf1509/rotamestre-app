import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { ResumoDoDia } from '../ResumoDoDia';

import type { RotaResumo } from '../../../_hooks/useDashboardData';

function rota(parcial: Partial<RotaResumo>): RotaResumo {
  return {
    id: 'r',
    data: '2026-11-07',
    status: 'pendente',
    motorista_nome: 'Ana',
    motorista_id: 'm1',
    total_paradas: 0,
    paradas_concluidas: 0,
    distancia_total: 0,
    paradas_status: [],
    ...parcial,
  };
}

describe('ResumoDoDia', () => {
  it('uma rota em andamento e nenhum incidente: frase única, sem incidente', () => {
    const { getByTestId, queryByText } = render(
      <ResumoDoDia
        rotas={[
          rota({
            status: 'em_andamento',
            total_paradas: 8,
            paradas_concluidas: 3,
            distancia_total: 12.4,
          }),
        ]}
        textoSemRotas="Nenhuma rota no período"
        incidentesAbertos={0}
        onAbrirIncidentes={jest.fn()}
      />,
    );

    expect(getByTestId('gestor-dashboard-resumo')).toHaveTextContent(
      '1 rota em andamento — 3 de 8 paradas feitas, 12,4 km',
    );
    expect(queryByText(/incidente/i)).toBeNull();
    expect(getByTestId('gestor-dashboard-stats')).toBeTruthy();
  });

  it('vários status com plural certo e o status zerado omitido', () => {
    const { getByTestId } = render(
      <ResumoDoDia
        rotas={[
          rota({
            id: 'a',
            status: 'em_andamento',
            total_paradas: 10,
            paradas_concluidas: 4,
            distancia_total: 20,
          }),
          rota({
            id: 'b',
            status: 'em_andamento',
            total_paradas: 10,
            paradas_concluidas: 6,
            distancia_total: 20,
          }),
          rota({
            id: 'c',
            status: 'em_andamento',
            total_paradas: 10,
            paradas_concluidas: 0,
            distancia_total: 5,
          }),
          rota({
            id: 'd',
            status: 'pendente',
            total_paradas: 5,
            paradas_concluidas: 0,
            distancia_total: 3.5,
          }),
          rota({
            id: 'e',
            status: 'pendente',
            total_paradas: 5,
            paradas_concluidas: 2,
            distancia_total: 0,
          }),
        ]}
        textoSemRotas="Nenhuma rota no período"
        incidentesAbertos={0}
        onAbrirIncidentes={jest.fn()}
      />,
    );

    expect(getByTestId('gestor-dashboard-resumo')).toHaveTextContent(
      '3 rotas em andamento, 2 pendentes — 12 de 40 paradas feitas, 48,5 km',
    );
  });

  it('o primeiro status leva o substantivo, e cada um concorda no número', () => {
    const { getByTestId } = render(
      <ResumoDoDia
        rotas={[
          rota({
            id: 'a',
            status: 'pendente',
            total_paradas: 1,
            distancia_total: 2,
          }),
          rota({
            id: 'b',
            status: 'concluida',
            total_paradas: 2,
            paradas_concluidas: 2,
            distancia_total: 3,
          }),
          rota({
            id: 'c',
            status: 'concluida',
            total_paradas: 0,
            distancia_total: 0,
          }),
        ]}
        textoSemRotas="Nenhuma rota no período"
        incidentesAbertos={0}
        onAbrirIncidentes={jest.fn()}
      />,
    );

    expect(getByTestId('gestor-dashboard-resumo')).toHaveTextContent(
      '1 rota pendente, 2 concluídas — 2 de 3 paradas feitas, 5,0 km',
    );
  });

  it('uma parada no total usa o singular', () => {
    const { getByTestId } = render(
      <ResumoDoDia
        rotas={[
          rota({ status: 'pendente', total_paradas: 1, distancia_total: 1 }),
        ]}
        textoSemRotas="Nenhuma rota no período"
        incidentesAbertos={0}
        onAbrirIncidentes={jest.fn()}
      />,
    );

    expect(getByTestId('gestor-dashboard-resumo')).toHaveTextContent(
      '1 rota pendente — 0 de 1 parada feita, 1,0 km',
    );
  });

  // G8-8: a parada de uma rota cancelada ou não executada não vai mais ser
  // feita; contá-la no denominador (e no feito) faria o dia parecer atrasado.
  it('paradas de rota cancelada ou não executada ficam fora do total e do feito', () => {
    const { getByTestId } = render(
      <ResumoDoDia
        rotas={[
          rota({
            id: 'a',
            status: 'concluida',
            total_paradas: 4,
            paradas_concluidas: 4,
          }),
          rota({
            id: 'b',
            status: 'em_andamento',
            total_paradas: 3,
            paradas_concluidas: 1,
          }),
          rota({
            id: 'c',
            status: 'cancelada',
            total_paradas: 5,
            paradas_concluidas: 2,
          }),
          rota({
            id: 'd',
            status: 'nao_executada',
            total_paradas: 2,
            paradas_concluidas: 0,
          }),
        ]}
        textoSemRotas="Nenhuma rota no período"
        incidentesAbertos={0}
        onAbrirIncidentes={jest.fn()}
      />,
    );

    expect(getByTestId('gestor-dashboard-resumo')).toHaveTextContent(
      /— 5 de 7 paradas feitas,/,
    );
  });

  it('a distância usa o mesmo recorte: rota cancelada ou não executada não soma km', () => {
    const { getByTestId } = render(
      <ResumoDoDia
        rotas={[
          rota({ id: 'a', status: 'concluida', distancia_total: 10 }),
          rota({ id: 'b', status: 'cancelada', distancia_total: 30 }),
          rota({ id: 'c', status: 'nao_executada', distancia_total: 5 }),
        ]}
        textoSemRotas="Nenhuma rota"
        incidentesAbertos={0}
        onAbrirIncidentes={jest.fn()}
      />,
    );

    expect(getByTestId('gestor-dashboard-resumo')).toHaveTextContent(
      /, 10,0 km$/,
    );
  });

  it('com incidentes abertos, o trecho é pressionável e leva aos incidentes', () => {
    const onAbrirIncidentes = jest.fn();
    const { getByRole } = render(
      <ResumoDoDia
        rotas={[rota({ status: 'pendente', total_paradas: 2 })]}
        textoSemRotas="Nenhuma rota no período"
        incidentesAbertos={2}
        onAbrirIncidentes={onAbrirIncidentes}
      />,
    );

    fireEvent.press(getByRole('link', { name: '2 incidentes abertos' }));
    expect(onAbrirIncidentes).toHaveBeenCalledTimes(1);
  });

  it('um incidente aberto usa o singular', () => {
    const { getByText } = render(
      <ResumoDoDia
        rotas={[]}
        textoSemRotas="Nenhuma rota no período"
        incidentesAbertos={1}
        onAbrirIncidentes={jest.fn()}
      />,
    );

    expect(getByText('1 incidente aberto')).toBeTruthy();
  });

  it('contagem de incidentes indisponível não vira zero nem link', () => {
    const { getByText, queryByRole } = render(
      <ResumoDoDia
        rotas={[]}
        textoSemRotas="Nenhuma rota no período"
        incidentesAbertos={null}
        onAbrirIncidentes={jest.fn()}
      />,
    );

    expect(getByText('Incidentes indisponíveis')).toBeTruthy();
    expect(queryByRole('link')).toBeNull();
  });

  it('sem rotas, diz que não há rota, sem conta de paradas', () => {
    const { getByTestId } = render(
      <ResumoDoDia
        rotas={[]}
        textoSemRotas="Nenhuma rota no período"
        incidentesAbertos={0}
        onAbrirIncidentes={jest.fn()}
      />,
    );

    expect(getByTestId('gestor-dashboard-resumo')).toHaveTextContent(
      'Nenhuma rota no período',
    );
  });
});
