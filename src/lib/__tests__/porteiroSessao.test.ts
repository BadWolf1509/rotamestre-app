import {
  CODIGO_SEM_SESSAO,
  criarFetchSemConsultaAnonima,
  MENSAGEM_SEM_SESSAO,
} from '../porteiroSessao';

const CHAVE = 'sb_publishable_teste';
const BASE_URL = 'https://x.supabase.co';

function montar() {
  const base = jest.fn(
    async (_input: unknown, _init?: unknown) =>
      new Response('[]', { status: 200 }),
  );
  const porteiro = criarFetchSemConsultaAnonima(
    CHAVE,
    base as unknown as typeof fetch,
  );
  return { base, porteiro };
}

describe('criarFetchSemConsultaAnonima', () => {
  it('bloqueia REST com a chave como Bearer', async () => {
    const { base, porteiro } = montar();
    const res = await porteiro(`${BASE_URL}/rest/v1/rotas?select=*`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CHAVE}`, apikey: CHAVE },
    });
    expect(base).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
    const corpo = await res.json();
    expect(corpo.code).toBe(CODIGO_SEM_SESSAO);
    expect(corpo.code).toBe('PGRST301');
    expect(corpo.message).toBe(MENSAGEM_SEM_SESSAO);
  });

  it('bloqueia REST sem Authorization (RPC)', async () => {
    const { base, porteiro } = montar();
    const res = await porteiro(`${BASE_URL}/rest/v1/rpc/get_gestor_contato`, {
      method: 'POST',
      headers: { apikey: CHAVE },
      body: '{}',
    });
    expect(base).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('PGRST301');
  });

  it('deixa passar REST com token de usuário', async () => {
    const { base, porteiro } = montar();
    const url = `${BASE_URL}/rest/v1/rotas?select=*`;
    const init = {
      method: 'GET',
      headers: { Authorization: 'Bearer eyJhbGciOi.usuario.assinatura' },
    };
    const res = await porteiro(url, init);
    expect(res.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(1);
    expect(base).toHaveBeenCalledWith(url, init);
  });

  it('não toca auth, functions nem storage', async () => {
    const { base, porteiro } = montar();
    const init = { headers: { Authorization: `Bearer ${CHAVE}` } };
    await porteiro(`${BASE_URL}/auth/v1/token?grant_type=refresh_token`, init);
    await porteiro(`${BASE_URL}/functions/v1/delete-account`, init);
    await porteiro(`${BASE_URL}/storage/v1/object/fotos-entrega/a.jpg`, init);
    expect(base).toHaveBeenCalledTimes(3);
  });

  it('aceita headers como objeto simples e como Headers', async () => {
    const { base, porteiro } = montar();
    const url = `${BASE_URL}/rest/v1/paradas`;

    const r1 = await porteiro(url, {
      headers: { Authorization: `Bearer ${CHAVE}` },
    });
    const r2 = await porteiro(url, {
      headers: new Headers({ Authorization: `Bearer ${CHAVE}` }),
    });
    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(base).not.toHaveBeenCalled();

    await porteiro(url, {
      headers: new Headers({ Authorization: 'Bearer eyJ.usuario.x' }),
    });
    await porteiro(url, { headers: { Authorization: 'Bearer eyJ.usuario.x' } });
    expect(base).toHaveBeenCalledTimes(2);
  });
});
