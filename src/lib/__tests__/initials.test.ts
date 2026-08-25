import { getInitials } from '@/lib/initials';

describe('getInitials', () => {
  it('usa a primeira letra do primeiro e do ultimo nome', () => {
    expect(getInitials('Joao Silva')).toBe('JS');
    expect(getInitials('Maria Aparecida Souza')).toBe('MS');
  });

  it('usa as duas primeiras letras quando ha um nome so', () => {
    expect(getInitials('Madonna')).toBe('MA');
  });

  it('ignora o sufixo entre parenteses', () => {
    // O defeito que motivou este helper: o avatar do Meu Perfil mostrava "G(",
    // porque pegava a primeira letra da ultima palavra — "(Avaliacao)".
    expect(getInitials('Gestor Demo (Avaliacao)')).toBe('GD');
    expect(getInitials('Motorista Demo (Avaliacao)')).toBe('MD');
  });

  it('descarta pontuacao ao redor das palavras', () => {
    expect(getInitials('"Ana" -Beatriz-')).toBe('AB');
    expect(getInitials('Carlos  ,  Dias')).toBe('CD');
  });

  it('preserva acentos', () => {
    expect(getInitials('Ática Órfã')).toBe('ÁÓ');
    expect(getInitials('Ângelo')).toBe('ÂN');
  });

  it('cai para "?" quando nao ha letra alguma', () => {
    expect(getInitials('')).toBe('?');
    expect(getInitials('   ')).toBe('?');
    expect(getInitials('123 456')).toBe('?');
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
  });

  it('usa o conteudo dos parenteses quando nao sobra mais nada', () => {
    // Remover os parenteses nao pode zerar o avatar de quem so tem isso.
    expect(getInitials('(Avaliacao)')).toBe('AV');
  });
});
