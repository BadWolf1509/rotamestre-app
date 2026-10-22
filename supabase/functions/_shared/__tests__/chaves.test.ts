// As chaves antigas (`anon`/`service_role` JWT) foram desligadas em 22/10/2026,
// depois que a `service_role` apareceu no histórico do repositório público.
// Desde então as funções leem as chaves novas, que o Supabase injeta como JSON
// por nome (`{"default": "sb_secret_..."}`).
import { chavePublica, chaveSecreta } from '../chaves';

const env: Record<string, string | undefined> = {};

beforeAll(() => {
  (globalThis as { Deno?: unknown }).Deno = {
    env: { get: (nome: string) => env[nome] },
  };
});

beforeEach(() => {
  for (const chave of Object.keys(env)) delete env[chave];
});

describe('chaveSecreta', () => {
  it('lê a chave "default" de SUPABASE_SECRET_KEYS', () => {
    env.SUPABASE_SECRET_KEYS = JSON.stringify({ default: 'sb_secret_novo' });
    env.SUPABASE_SERVICE_ROLE_KEY = 'jwt.antigo.desligado';
    expect(chaveSecreta()).toBe('sb_secret_novo');
  });

  it('falha alto quando a chave nova não existe, em vez de cair na antiga', () => {
    env.SUPABASE_SERVICE_ROLE_KEY = 'jwt.antigo.desligado';
    expect(() => chaveSecreta()).toThrow(/SUPABASE_SECRET_KEYS/);
  });

  it('falha alto com JSON sem a chave "default"', () => {
    env.SUPABASE_SECRET_KEYS = JSON.stringify({ outra: 'sb_secret_x' });
    expect(() => chaveSecreta()).toThrow(/default/);
  });
});

describe('chavePublica', () => {
  it('lê a chave "default" de SUPABASE_PUBLISHABLE_KEYS', () => {
    env.SUPABASE_PUBLISHABLE_KEYS = JSON.stringify({
      default: 'sb_publishable_novo',
    });
    expect(chavePublica()).toBe('sb_publishable_novo');
  });
});
