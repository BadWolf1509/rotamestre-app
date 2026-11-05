import { CORS_PADRAO, jsonResponse, preflight } from '../http';

describe('_shared/http', () => {
  it('jsonResponse devolve status, corpo JSON e os cabeçalhos CORS padrão', async () => {
    const r = jsonResponse(409, { error: 'x', codigo: 'Y' });
    expect(r.status).toBe(409);
    expect(r.headers.get('Content-Type')).toBe('application/json');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(r.headers.get('Access-Control-Allow-Headers')).toBe(
      'authorization, x-client-info, apikey, content-type',
    );
    await expect(r.json()).resolves.toEqual({ error: 'x', codigo: 'Y' });
  });

  it('jsonResponse aceita CORS próprio (variante com Allow-Methods)', () => {
    const cors = { ...CORS_PADRAO, 'Access-Control-Allow-Methods': 'POST' };
    const r = jsonResponse(200, {}, cors);
    expect(r.headers.get('Access-Control-Allow-Methods')).toBe('POST');
  });

  it('preflight responde "ok" ao OPTIONS e null aos demais métodos', async () => {
    const r = preflight(new Request('http://x', { method: 'OPTIONS' }));
    expect(r).not.toBeNull();
    expect(r!.status).toBe(200);
    await expect(r!.text()).resolves.toBe('ok');
    expect(r!.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(preflight(new Request('http://x', { method: 'POST' }))).toBeNull();
  });
});
