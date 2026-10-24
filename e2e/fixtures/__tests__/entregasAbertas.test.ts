import { contarEntregasAbertas } from '../entregasAbertas';

describe('contarEntregasAbertas (decisão de reabrir as paradas do fixture)', () => {
  it('partida e chegada pendentes não contam como entrega aberta', () => {
    const paradas = [
      { status: 'pendente', is_checkpoint: false }, // partida
      { status: 'concluida', is_checkpoint: true },
      { status: 'concluida', is_checkpoint: true },
      { status: 'pendente', is_checkpoint: false }, // chegada
    ];
    expect(contarEntregasAbertas(paradas)).toBe(0);
  });

  it('conta só as entregas (is_checkpoint=true) pendentes', () => {
    const paradas = [
      { status: 'pendente', is_checkpoint: false },
      { status: 'pendente', is_checkpoint: true },
      { status: 'concluida', is_checkpoint: true },
      { status: 'pendente', is_checkpoint: true },
    ];
    expect(contarEntregasAbertas(paradas)).toBe(2);
  });

  it('lista vazia não tem entrega aberta', () => {
    expect(contarEntregasAbertas([])).toBe(0);
  });
});
