/**
 * Tests for src/lib/osrm/config.ts
 *
 * A URL é resolvida no momento do import, então cada cenário precisa recarregar
 * o módulo com `jest.isolateModules` depois de ajustar `__DEV__`, `Platform.OS`
 * e a variável de ambiente.
 */

const SELF_HOSTED = 'https://osrm.rotamestre.tec.br';
const DEMO_PUBLICO = 'https://router.project-osrm.org';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function carregarUrl({
  dev,
  os,
  env,
}: {
  dev: boolean;
  os: string;
  env?: string;
}): string {
  if (env === undefined) {
    delete process.env.EXPO_PUBLIC_OSRM_URL;
  } else {
    process.env.EXPO_PUBLIC_OSRM_URL = env;
  }

  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = dev;

  let url = '';
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: os } }));
    url = require('../osrm/config').OSRM_BASE_URL;
  });
  return url;
}

describe('OSRM_BASE_URL', () => {
  const devOriginal = (globalThis as unknown as { __DEV__: boolean }).__DEV__;
  const envOriginal = process.env.EXPO_PUBLIC_OSRM_URL;

  afterEach(() => {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = devOriginal;
    if (envOriginal === undefined) {
      delete process.env.EXPO_PUBLIC_OSRM_URL;
    } else {
      process.env.EXPO_PUBLIC_OSRM_URL = envOriginal;
    }
  });

  it('mantém o self-hosted em produção, em qualquer plataforma', () => {
    expect(carregarUrl({ dev: false, os: 'web' })).toBe(SELF_HOSTED);
    expect(carregarUrl({ dev: false, os: 'android' })).toBe(SELF_HOSTED);
    expect(carregarUrl({ dev: false, os: 'ios' })).toBe(SELF_HOSTED);
  });

  it('mantém o self-hosted em dev nativo — CORS não existe lá', () => {
    expect(carregarUrl({ dev: true, os: 'android' })).toBe(SELF_HOSTED);
    expect(carregarUrl({ dev: true, os: 'ios' })).toBe(SELF_HOSTED);
  });

  it('usa o demo público só em dev web, onde o CORS bloqueia', () => {
    // O openresty do self-hosted responde com uma origem fixa
    // (https://app.rotamestre.tec.br), então o navegador recusa a resposta em
    // localhost e o otimizador cai no Haversine sem erro visível.
    expect(carregarUrl({ dev: true, os: 'web' })).toBe(DEMO_PUBLICO);
  });

  it('a variável de ambiente vence em qualquer cenário', () => {
    const proprio = 'https://osrm.local:5000';
    expect(carregarUrl({ dev: true, os: 'web', env: proprio })).toBe(proprio);
    expect(carregarUrl({ dev: false, os: 'web', env: proprio })).toBe(proprio);
    expect(carregarUrl({ dev: true, os: 'android', env: proprio })).toBe(
      proprio,
    );
    expect(carregarUrl({ dev: false, os: 'ios', env: proprio })).toBe(proprio);
  });

  it('ignora variável de ambiente vazia em vez de montar URL inválida', () => {
    expect(carregarUrl({ dev: false, os: 'ios', env: '' })).toBe(SELF_HOSTED);
  });
});
