import { logarFalha } from '../logarFalha';
import { logger } from '../logger';

jest.mock('../logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

describe('logarFalha', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['fetch do navegador', new TypeError('Failed to fetch')],
    ['fetch do Node', new TypeError('fetch failed')],
    ['React Native', new TypeError('Network request failed')],
    ['Safari', new TypeError('Load failed')],
    ['erro do app sem rede', new Error('Sem conexão com a internet')],
    [
      'erro do Supabase embrulhando o fetch',
      { message: 'TypeError: Failed to fetch', code: '' },
    ],
  ])('falha de rede esperada (%s) vira warn, não error', (_nome, erro) => {
    logarFalha('[X] falhou', erro);
    expect(logger.warn).toHaveBeenCalledWith('[X] falhou', erro);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('erro de verdade (4xx de schema) continua error', () => {
    const erro = { message: 'column "foo" does not exist', code: '42703' };
    logarFalha('[X] falhou', erro);
    expect(logger.error).toHaveBeenCalledWith('[X] falhou', erro);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
