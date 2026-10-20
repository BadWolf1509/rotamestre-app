import { acaoDoToqueNoPino } from '../toqueNoPino';

const membros = [{ id: 'p1' }];
const grupo = [{ id: 'p3' }, { id: 'p4' }];

describe('acaoDoToqueNoPino', () => {
  it('pino ainda não selecionado: seleciona', () => {
    expect(acaoDoToqueNoPino(membros, null, true)).toBe('selecionar');
    expect(acaoDoToqueNoPino(membros, 'outro', true)).toBe('selecionar');
  });

  it('pino já selecionado, com ações: abre as ações', () => {
    expect(acaoDoToqueNoPino(membros, 'p1', true)).toBe('abrir-acoes');
  });

  it('pino agrupado já selecionado por qualquer membro: abre as ações', () => {
    expect(acaoDoToqueNoPino(grupo, 'p4', true)).toBe('abrir-acoes');
  });

  it('sem ações (tela do gestor): toque repetido só seleciona de novo', () => {
    expect(acaoDoToqueNoPino(membros, 'p1', false)).toBe('selecionar');
  });
});
