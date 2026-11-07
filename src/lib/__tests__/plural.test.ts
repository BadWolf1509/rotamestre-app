import { plural } from '@/lib/plural';

describe('plural', () => {
  it('usa o singular só quando n é 1', () => {
    expect(plural(1, 'rota', 'rotas')).toBe('1 rota');
  });

  it('usa o plural com zero', () => {
    expect(plural(0, 'rota', 'rotas')).toBe('0 rotas');
  });

  it('usa o plural com mais de um', () => {
    expect(plural(2, 'parada', 'paradas')).toBe('2 paradas');
  });

  it('aceita forma composta', () => {
    expect(plural(3, 'parada importada', 'paradas importadas')).toBe(
      '3 paradas importadas',
    );
  });

  it('formata n não inteiro em pt-BR', () => {
    expect(plural(1.5, 'hora', 'horas')).toBe('1,5 horas');
  });
});
