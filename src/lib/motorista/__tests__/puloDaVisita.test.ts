import type { ParadaData } from '@/context/route-status/types';

import { avisoDeFalhaNoPulo, pularEmSequencia } from '../puloDaVisita';

function parada(id: string, ordem: number, tipo: string): ParadaData {
  return { id, ordem, tipo, status: 'pendente' } as ParadaData;
}

const entrega = parada('e', 3, 'entrega');
const retirada = parada('r', 4, 'retirada');
const outra = parada('o', 5, 'entrega');

describe('pularEmSequencia', () => {
  it('pula todos, em ordem, quando nada falha', async () => {
    const pular = jest.fn().mockResolvedValue(undefined);

    const r = await pularEmSequencia([entrega, retirada], pular);

    expect(pular.mock.calls.map((c) => c[0].id)).toEqual(['e', 'r']);
    expect(r).toEqual({ pulados: [entrega, retirada], falha: null });
  });

  it('sem rede: avisa que algum pulo ficou guardado no aparelho', async () => {
    const pular = jest
      .fn()
      .mockResolvedValueOnce('enviada')
      .mockResolvedValueOnce('na_fila');

    const r = await pularEmSequencia([entrega, retirada], pular);

    expect(r).toEqual({
      pulados: [entrega, retirada],
      falha: null,
      naFila: true,
    });
  });

  it('para na primeira falha e diz o que foi, o que falhou e o que sobrou', async () => {
    const erro = new Error('rede');
    const pular = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(erro);

    const r = await pularEmSequencia([entrega, retirada, outra], pular);

    expect(pular).toHaveBeenCalledTimes(2);
    expect(r).toEqual({
      pulados: [entrega],
      falha: { parada: retirada, erro, naoTentadas: [outra] },
    });
  });
});

describe('avisoDeFalhaNoPulo', () => {
  it('nomeia o serviço pulado e o que falhou, com o motivo', () => {
    const aviso = avisoDeFalhaNoPulo(
      [entrega],
      { parada: retirada, erro: null, naoTentadas: [] },
      'Sem conexão.',
    );

    expect(aviso.title).toBe('Pulo incompleto');
    expect(aviso.message).toBe(
      'Pulada: Entrega (parada 3).\n' +
        'Não foi pulada: Retirada (parada 4). Sem conexão.',
    );
  });

  it('lista o que ficou sem tentar depois da falha', () => {
    const aviso = avisoDeFalhaNoPulo(
      [],
      { parada: entrega, erro: null, naoTentadas: [retirada] },
      'Sem conexão.',
    );

    expect(aviso.title).toBe('Nenhum serviço pulado');
    expect(aviso.message).toBe(
      'Não foi pulada: Entrega (parada 3). Sem conexão.\n' +
        'Continua pendente: Retirada (parada 4).',
    );
  });

  it('junta vários serviços na mesma linha', () => {
    const aviso = avisoDeFalhaNoPulo(
      [entrega, retirada],
      { parada: outra, erro: null, naoTentadas: [] },
      'Erro.',
    );

    expect(aviso.message).toBe(
      'Puladas: Entrega (parada 3) e Retirada (parada 4).\n' +
        'Não foi pulada: Entrega (parada 5). Erro.',
    );
  });
});
