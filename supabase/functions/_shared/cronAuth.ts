/* eslint-disable no-undef */
// Guarda de autenticação para Edge Functions de agendador.
//
// Por que isto existe: `expire-routes` e `remind-routes` criam um cliente com
// SERVICE_ROLE e agem sobre rotas de TODAS as unidades. O `verify_jwt` padrão
// do Supabase não é proteção suficiente aqui, porque a anon key é um JWT válido
// e é **pública** — ela é embutida no bundle web pelo Expo
// (EXPO_PUBLIC_SUPABASE_ANON_KEY, ver src/lib/supabase.ts). Sem esta guarda,
// qualquer pessoa que abra o app e leia o bundle consegue disparar a expiração
// em massa de todas as rotas pendentes da plataforma.
//
// Comportamento é FAIL-CLOSED: se CRON_SECRET não estiver configurado nos
// secrets da Edge Function, ninguém entra. Isso significa que o segredo precisa
// existir ANTES do deploy — ver docs/GOOGLE_PLAY_DEPLOYMENT.md não se aplica;
// as instruções estão no cabeçalho de cada função.

const CRON_SECRET_HEADER = 'x-cron-secret';

/**
 * Comparação de tempo constante, para não vazar o segredo byte a byte.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bytesA = encoder.encode(a);
  const bytesB = encoder.encode(b);

  if (bytesA.length !== bytesB.length) return false;

  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

/**
 * Valida o header `x-cron-secret` contra o secret `CRON_SECRET`.
 *
 * @returns `null` quando autorizado; uma `Response` 401/500 pronta para
 *          retornar quando não.
 */
export function requireCronSecret(req: Request): Response | null {
  const expected = Deno.env.get('CRON_SECRET');

  if (!expected) {
    // Fail-closed. Preferimos parar a expiração a deixar o endpoint aberto:
    // desde a migration 20260827190000, uma execução perdida é inofensiva
    // (as rotas do dia expiram no próximo run, pelo ramo de dias anteriores).
    console.error('CRON_SECRET não configurado — recusando a chamada.');
    return new Response(
      JSON.stringify({
        error: 'Server misconfigured: CRON_SECRET is not set.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const provided = req.headers.get(CRON_SECRET_HEADER) ?? '';

  if (!timingSafeEqual(expected, provided)) {
    console.warn('Chamada recusada: x-cron-secret ausente ou inválido.');
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}
