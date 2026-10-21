/**
 * O cliente nativo manda a versão do app em toda requisição.
 *
 * Sem isto, os logs HTTP do Supabase não diziam quem estava em qual versão:
 * o `x_client_info` era só `supabase-js/<versão>` e o user-agent é sempre
 * `okhttp/…`. A versão vai DENTRO do `X-Client-Info`, e não num header
 * próprio, porque os edge_logs só guardam uma lista fixa de headers (medido em
 * 21/10/2026) — um `x-app-version` chegaria ao servidor e sumiria dos logs.
 * Consulta: `log_attributes['request.headers.x_client_info']` nos edge_logs.
 */

jest.unmock('@/lib/supabase');

const mockCreateClient = jest.fn(() => ({
  auth: {
    onAuthStateChange: jest.fn(),
    getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
  },
  realtime: { setAuth: jest.fn() },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...(args as [])),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '9.9.9',
      android: { versionCode: 4242 },
      ios: { buildNumber: '4242' },
    },
  },
}));

const packageJson = jest.requireActual<{ version: string }>(
  '../../../package.json',
);

type Opcoes = { global?: { headers?: Record<string, string> } };

function opcoesDoCliente(): Opcoes {
  mockCreateClient.mockClear();
  jest.isolateModules(() => {
    require('../supabase');
  });
  const chamadas = mockCreateClient.mock.calls as unknown as [
    string,
    string,
    Opcoes,
  ][];
  return chamadas[0][2];
}

describe('supabase.ts – versão do app no X-Client-Info', () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it('o cliente real manda versão e build', () => {
    process.env = {
      ...env,
      EXPO_PUBLIC_SUPABASE_URL: 'https://exemplo.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'chave',
    };

    expect(opcoesDoCliente().global?.headers?.['X-Client-Info']).toBe(
      `rotamestre/${packageJson.version}+4242; supabase-js; runtime=react-native`,
    );
  });

  it('o placeholder de E2E/CI também manda', () => {
    process.env = {
      ...env,
      EXPO_PUBLIC_SUPABASE_URL: '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
    };

    expect(opcoesDoCliente().global?.headers?.['X-Client-Info']).toBe(
      `rotamestre/${packageJson.version}+4242; supabase-js; runtime=react-native`,
    );
  });
});
