// CORS e resposta JSON das Edge Functions chamadas pelo app. Antes, cada função
// repetia o objeto de cabeçalhos e o `new Response(JSON.stringify(...), {...})`
// (mais de 30 vezes), com dois helpers locais diferentes. O contrato de CORS e
// de erro fica num lugar só. Sem import remoto: roda também no Jest.

export const CORS_PADRAO: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

/** Resposta JSON com os cabeçalhos CORS (os padrão, ou os da função). */
export function jsonResponse(
  status: number,
  corpo: unknown,
  cors: Record<string, string> = CORS_PADRAO,
): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** Responde ao preflight (OPTIONS); `null` para qualquer outro método. */
export function preflight(
  req: Request,
  cors: Record<string, string> = CORS_PADRAO,
): Response | null {
  return req.method === 'OPTIONS'
    ? new Response('ok', { headers: cors })
    : null;
}
