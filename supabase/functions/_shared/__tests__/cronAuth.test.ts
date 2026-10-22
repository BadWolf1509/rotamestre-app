// A guarda roda em Deno; aqui o `Deno.env` é simulado. O que importa provar:
// sem o segredo configurado ninguém entra (fail-closed), e cada função só
// aceita o SEU cabeçalho — o segredo do cron não abre o push e vice-versa.
import { requireCronSecret, requirePushSecret } from '../cronAuth';

const env: Record<string, string | undefined> = {};

beforeAll(() => {
  (globalThis as { Deno?: unknown }).Deno = {
    env: { get: (nome: string) => env[nome] },
  };
});

beforeEach(() => {
  for (const chave of Object.keys(env)) delete env[chave];
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://exemplo.test/fn', { method: 'POST', headers });
}

describe('requirePushSecret', () => {
  it('recusa com 500 quando PUSH_WEBHOOK_SECRET não está configurado', () => {
    expect(requirePushSecret(req({ 'x-push-secret': 'x' }))?.status).toBe(500);
  });

  it('recusa com 401 sem o cabeçalho', () => {
    env.PUSH_WEBHOOK_SECRET = 's3gr3d0';
    expect(requirePushSecret(req())?.status).toBe(401);
  });

  it('recusa com 401 com o segredo errado', () => {
    env.PUSH_WEBHOOK_SECRET = 's3gr3d0';
    expect(requirePushSecret(req({ 'x-push-secret': 'outro' }))?.status).toBe(
      401,
    );
  });

  it('não aceita o segredo do cron no lugar do segredo do push', () => {
    env.PUSH_WEBHOOK_SECRET = 'push';
    env.CRON_SECRET = 'cron';
    expect(requirePushSecret(req({ 'x-cron-secret': 'cron' }))?.status).toBe(
      401,
    );
  });

  it('autoriza com o segredo certo', () => {
    env.PUSH_WEBHOOK_SECRET = 's3gr3d0';
    expect(requirePushSecret(req({ 'x-push-secret': 's3gr3d0' }))).toBeNull();
  });
});

describe('requireCronSecret (comportamento preservado)', () => {
  it('autoriza com o x-cron-secret certo e recusa sem ele', () => {
    env.CRON_SECRET = 'cron';
    expect(requireCronSecret(req({ 'x-cron-secret': 'cron' }))).toBeNull();
    expect(requireCronSecret(req())?.status).toBe(401);
  });
});
