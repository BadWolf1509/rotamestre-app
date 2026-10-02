/**
 * Guarda da privacidade do Sentry.
 *
 * No `@sentry/browser` 11 o default de coleta inverteu: sem `dataCollection`
 * explícito, o SDK envia cookies, headers, query string e corpo de
 * request/response — aqui, endereço de cliente, coordenada de motorista e o JWT
 * da sessão. Nada disso quebra build, teste ou tela: o único sintoma seria dado
 * pessoal chegando ao Sentry. Por isso a configuração é travada aqui.
 */
const mockInit = jest.fn();

jest.mock('@sentry/browser', () => ({
  init: (...args: unknown[]) => mockInit(...args),
}));

type InitOptions = Record<string, unknown> & {
  dataCollection?: Record<string, unknown>;
};

function inicializarComoProducaoWeb(): InitOptions {
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  (global as { __DEV__?: boolean }).__DEV__ = false;
  process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://chave@o0.ingest.sentry.io/0';

  try {
    // `isolateModules` carrega um `react-native` NOVO: o Platform a forçar
    // como web é o desse registro, não o de um import no topo do arquivo.
    jest.isolateModules(() => {
      const { Platform } = require('react-native');
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
      require('../sentry').initSentry();
    });
  } finally {
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
    process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
  }

  expect(mockInit).toHaveBeenCalledTimes(1);
  return mockInit.mock.calls[0][0] as InitOptions;
}

describe('Sentry: coleta de dados', () => {
  beforeEach(() => mockInit.mockClear());

  it('desliga toda coleta automática de dados de request e de usuário', () => {
    const { dataCollection } = inicializarComoProducaoWeb();

    expect(dataCollection).toEqual(
      expect.objectContaining({
        userInfo: false,
        cookies: false,
        httpHeaders: { request: { allow: ['User-Agent'] }, response: false },
        httpBodies: [],
        urlQueryParams: false,
        stackFrameVariables: false,
      }),
    );
  });

  it('mantém o agrupamento e as mensagens de erro do v10', () => {
    const opcoes = inicializarComoProducaoWeb();

    expect(opcoes.attachStacktrace).toBe(false);
    expect(opcoes.enhanceFetchErrorMessages).toBe('report-only');
  });
});
