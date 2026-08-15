import { formatarDecimal } from '../formatNumber';

describe('formatarDecimal', () => {
  it('usa vírgula como separador decimal', () => {
    // O app é pt-BR: "18.1 km" está errado em toda tela do produto.
    expect(formatarDecimal(18.13)).toBe('18,1');
  });

  it('arredonda para uma casa por padrão', () => {
    expect(formatarDecimal(27.129)).toBe('27,1');
    expect(formatarDecimal(27.16)).toBe('27,2');
  });

  it('mantém o arredondamento do toFixed, inclusive nos casos de meio', () => {
    // 27.15 não é exatamente representável em binário (fica um fio abaixo),
    // então toFixed desce para 27,1 em vez de subir. Registrado de propósito:
    // a troca de ponto por vírgula não deve alterar nenhum número exibido, e
    // trocar o arredondamento mudaria telas em produção sem ninguém pedir.
    expect(formatarDecimal(27.15)).toBe('27,1');
  });

  it('mantém a casa decimal em valores inteiros', () => {
    // Sem isso a coluna de distância fica desalinhada entre "18" e "18,1".
    expect(formatarDecimal(18)).toBe('18,0');
  });

  it('aceita número de casas diferente', () => {
    expect(formatarDecimal(18.135, 2)).toBe('18,14');
    expect(formatarDecimal(18.6, 0)).toBe('19');
  });

  it('preserva o sinal negativo', () => {
    // OrdemManualBanner mostra a diferença entre a rota manual e a otimizada,
    // que pode ser negativa.
    expect(formatarDecimal(-0.61)).toBe('-0,6');
  });

  it('não usa Intl, que no Hermes pode cair em en-US silenciosamente', () => {
    // Se algum dia trocarem a implementação por Intl.NumberFormat sem os dados
    // de locale do ICU, o resultado volta a ter ponto — e só no aparelho.
    expect(formatarDecimal(1234.5)).toBe('1234,5');
  });
});
