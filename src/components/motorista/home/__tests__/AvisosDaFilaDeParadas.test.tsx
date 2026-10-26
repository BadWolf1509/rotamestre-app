import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { AvisosDaFilaDeParadas } from '../AvisosDaFilaDeParadas';

let mockContexto: Record<string, unknown> = {};
jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => mockContexto,
}));

const parada = (id: string, ordem: number) => ({
  id,
  ordem,
  endereco: `Rua ${ordem}`,
  status: 'concluida',
});

const descarte = (paradaId: string, motivo: string) => ({
  motivo,
  em: '2026-10-23T12:00:00.000Z',
  acao: {
    id: `a-${paradaId}`,
    tipo: 'concluir',
    paradaId,
    rotaId: 'r1',
    motoristaId: 'm1',
    em: '2026-10-23T11:00:00.000Z',
    tentativas: 0,
  },
});

describe('AvisosDaFilaDeParadas', () => {
  it('sem fila nem descarte: não mostra nada', () => {
    mockContexto = { paradas: [], paradasComEnvioPendente: new Set() };
    const { toJSON } = render(<AvisosDaFilaDeParadas />);
    expect(toJSON()).toBeNull();
  });

  it('conta as paradas que aguardam envio', () => {
    mockContexto = {
      paradas: [parada('p1', 1), parada('p2', 2)],
      paradasComEnvioPendente: new Set(['p1', 'p2']),
    };
    const { getByTestId, getByText } = render(<AvisosDaFilaDeParadas />);
    expect(getByTestId('aviso-envio-pendente')).toBeTruthy();
    expect(getByText(/2 paradas aguardando envio/)).toBeTruthy();
  });

  it('ação descartada: explica o motivo e pode ser dispensada', () => {
    const dispensar = jest.fn();
    mockContexto = {
      paradas: [],
      paradasComEnvioPendente: new Set(),
      avisosDeEnvio: [descarte('p7', 'parada_removida')],
      dispensarAvisosDeEnvio: dispensar,
    };
    const { getByTestId, getByText, getByLabelText } = render(
      <AvisosDaFilaDeParadas />,
    );
    expect(getByTestId('aviso-envio-descartado')).toBeTruthy();
    expect(getByText(/removida ou a rota foi passada/)).toBeTruthy();
    fireEvent.press(getByLabelText('Fechar alerta'));
    expect(dispensar).toHaveBeenCalled();
  });

  it('conclusão descartada: diz o que acontece com a foto do comprovante', () => {
    mockContexto = {
      paradas: [],
      paradasComEnvioPendente: new Set(),
      avisosDeEnvio: [descarte('p7', 'rota_encerrada')],
    };
    const { getByText } = render(<AvisosDaFilaDeParadas />);
    const texto = getByText(/A foto do comprovante, se houver/).props
      .children as string;
    // Não promete o que não existe: entrega garantida ou tela do gestor.
    expect(texto).toMatch(
      /continua guardada e é enviada assim que for possível; se não puder ser ligada à parada, fica registrada para a loja recuperar com o suporte\./,
    );
    expect(texto).not.toMatch(/fica com o gestor|não se perde/);
  });

  it('pulo descartado não fala de foto (pulo não tem comprovante)', () => {
    const pulo = descarte('p8', 'rota_encerrada');
    pulo.acao.tipo = 'pular';
    mockContexto = {
      paradas: [],
      paradasComEnvioPendente: new Set(),
      avisosDeEnvio: [pulo],
    };
    const { queryByText } = render(<AvisosDaFilaDeParadas />);
    expect(queryByText(/foto do comprovante/)).toBeNull();
  });

  it('descarte diz QUAL parada (o rótulo guardado ao enfileirar)', () => {
    const d = descarte('p4', 'rota_encerrada');
    (d.acao as Record<string, unknown>).rotulo =
      'Parada 4 — Rua das Flores, 10';
    mockContexto = {
      paradas: [],
      paradasComEnvioPendente: new Set(),
      avisosDeEnvio: [d],
    };
    const { getByText } = render(<AvisosDaFilaDeParadas />);
    expect(
      getByText(/Parada 4 — Rua das Flores, 10: conclusão não enviada/),
    ).toBeTruthy();
  });

  it('várias conclusões descartadas: o parágrafo da foto aparece uma vez só', () => {
    mockContexto = {
      paradas: [],
      paradasComEnvioPendente: new Set(),
      avisosDeEnvio: [
        descarte('p1', 'rota_encerrada'),
        descarte('p2', 'rota_encerrada'),
      ],
    };
    const { getByText } = render(<AvisosDaFilaDeParadas />);
    const texto = getByText(/A foto do comprovante, se houver/).props
      .children as string;
    expect(texto.match(/A foto do comprovante/g)).toHaveLength(1);
  });

  it('ações de outra conta no aparelho: aviso discreto, só o número, dispensável', () => {
    const dispensar = jest.fn();
    mockContexto = {
      paradas: [],
      paradasComEnvioPendente: new Set(),
      acoesDeOutraConta: 3,
      dispensarAvisoOutraConta: dispensar,
    };
    const { getByTestId, getByText, getByLabelText } = render(
      <AvisosDaFilaDeParadas />,
    );
    expect(getByTestId('aviso-acoes-outra-conta')).toBeTruthy();
    expect(
      getByText(/Há 3 ações de outra conta guardadas neste aparelho/),
    ).toBeTruthy();
    expect(getByText(/sobem quando essa conta entrar/)).toBeTruthy();
    fireEvent.press(getByLabelText('Fechar alerta'));
    expect(dispensar).toHaveBeenCalled();
  });

  it('uma ação de outra conta: singular', () => {
    mockContexto = {
      paradas: [],
      paradasComEnvioPendente: new Set(),
      acoesDeOutraConta: 1,
    };
    const { getByText } = render(<AvisosDaFilaDeParadas />);
    expect(
      getByText(/Há 1 ação de outra conta guardada neste aparelho/),
    ).toBeTruthy();
  });
});
