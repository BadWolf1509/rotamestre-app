// A função `delete-account` recusa com 409/503 e um corpo { error, code }. O
// supabase-js entrega isso como FunctionsHttpError, com a Response em
// `context`: sem ler o corpo, a tela só veria "Edge Function returned a
// non-2xx status code" e mandaria o gestor escrever ao suporte.
import {
  ExclusaoRecusadaError,
  lerRecusaDaExclusao,
} from '../exclusaoRecusada';

const erroHttp = (status: number, corpo: unknown) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    name: 'FunctionsHttpError',
    context: new Response(
      typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
      { status },
    ),
  });

describe('lerRecusaDaExclusao', () => {
  it('lê código e mensagem do corpo da recusa', async () => {
    const recusa = await lerRecusaDaExclusao(
      erroHttp(409, {
        error: 'Você é o único gestor ativo da loja X.',
        code: 'ULTIMO_GESTOR',
      }),
    );

    expect(recusa).toBeInstanceOf(ExclusaoRecusadaError);
    expect(recusa?.codigo).toBe('ULTIMO_GESTOR');
    expect(recusa?.message).toBe('Você é o único gestor ativo da loja X.');
  });

  it.each(['ROTA_EM_ANDAMENTO', 'GUARDA_INDISPONIVEL'])(
    'reconhece %s',
    async (code) => {
      const recusa = await lerRecusaDaExclusao(
        erroHttp(409, { error: 'm', code }),
      );
      expect(recusa?.codigo).toBe(code);
    },
  );

  it('código desconhecido não é recusa: cai no erro genérico da tela', async () => {
    expect(
      await lerRecusaDaExclusao(erroHttp(500, { error: 'x', code: 'OUTRO' })),
    ).toBeNull();
  });

  it('corpo ilegível ou erro sem Response: null, sem lançar', async () => {
    expect(await lerRecusaDaExclusao(erroHttp(502, '<html>'))).toBeNull();
    expect(await lerRecusaDaExclusao(new Error('rede'))).toBeNull();
    expect(await lerRecusaDaExclusao(null)).toBeNull();
  });
});
