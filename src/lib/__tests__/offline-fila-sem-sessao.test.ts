import { PostgrestClient } from '@supabase/postgrest-js';

import { classificarFalhaPerfil } from '../auth/falhaPerfil';
import { ehErroDeSessao } from '../motorista/filaAcoesParada';
import { criarFetchSemConsultaAnonima } from '../porteiroSessao';

const CHAVE = 'sb_publishable_teste';

describe('consulta REST sem sessão (postgrest-js real + porteiro)', () => {
  function montar() {
    const base = jest.fn(
      async (_input: unknown, _init?: unknown) =>
        new Response('[]', { status: 200 }),
    );
    const cliente = new PostgrestClient('https://x.supabase.co/rest/v1', {
      fetch: criarFetchSemConsultaAnonima(
        CHAVE,
        base as unknown as typeof fetch,
      ),
      headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` },
    });
    return { base, cliente };
  }

  it('consulta anônima vira erro de sessão, sem retry', async () => {
    const { base, cliente } = montar();
    const { data, error } = await cliente
      .from('paradas')
      .select('status')
      .eq('id', 'p1')
      .maybeSingle();

    expect(data).toBeNull();
    expect(error?.code).toBe('PGRST301');
    expect(base).not.toHaveBeenCalled();
    expect(ehErroDeSessao(error)).toBe(true);
  });

  it('o erro é transitório para o carregamento de perfil', async () => {
    const { cliente } = montar();
    const { error, status } = await cliente
      .from('usuarios')
      .select('*')
      .eq('id', 'u1')
      .maybeSingle();

    expect(classificarFalhaPerfil(error, status).transitoria).toBe(true);
  });
});
