import {
  deveSairDoModoNavegacao,
  mensagemFinalizarRota,
} from '../modoNavegacao';

describe('deveSairDoModoNavegacao', () => {
  const parada = { id: 'p1' };

  it('fica quando a rota está em andamento e há parada atual', () => {
    expect(deveSairDoModoNavegacao({ status: 'em_andamento' }, parada)).toBe(
      false,
    );
  });

  it('sai quando a parada atual some (última concluída ou pulada)', () => {
    expect(deveSairDoModoNavegacao({ status: 'em_andamento' }, null)).toBe(
      true,
    );
  });

  it('sai quando a próxima rota chega pendente, mesmo com parada atual', () => {
    expect(deveSairDoModoNavegacao({ status: 'pendente' }, parada)).toBe(true);
  });

  it('sai quando não há rota', () => {
    expect(deveSairDoModoNavegacao(null, parada)).toBe(true);
  });
});

describe('mensagemFinalizarRota', () => {
  it('sem puladas mantém o texto de concluídas', () => {
    expect(mensagemFinalizarRota(0)).toBe(
      'Todas as paradas foram concluídas. Deseja finalizar a rota?',
    );
  });

  it('com puladas diz que foram resolvidas e conta as puladas', () => {
    expect(mensagemFinalizarRota(3)).toBe(
      'Todas as paradas foram resolvidas (3 puladas). Deseja finalizar a rota?',
    );
  });

  it('usa o singular com uma pulada', () => {
    expect(mensagemFinalizarRota(1)).toBe(
      'Todas as paradas foram resolvidas (1 pulada). Deseja finalizar a rota?',
    );
  });
});
