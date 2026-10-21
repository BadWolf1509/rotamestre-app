import { rotuloTipoParada } from '../rotuloTipoParada';

describe('rotuloTipoParada', () => {
  it('retirada', () => {
    expect(rotuloTipoParada('retirada')).toEqual({
      nome: 'retirada',
      titulo: 'Retirada',
    });
  });

  it('entrega', () => {
    expect(rotuloTipoParada('entrega')).toEqual({
      nome: 'entrega',
      titulo: 'Entrega',
    });
  });

  it.each(['origem', ''])('"%s" vira parada genérica', (tipo) => {
    expect(rotuloTipoParada(tipo)).toEqual({
      nome: 'parada',
      titulo: 'Parada',
    });
  });
});
