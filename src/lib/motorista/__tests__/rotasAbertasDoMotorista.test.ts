import {
  SENTINELA_ROTA_ABERTA,
  rotasAbertasDoErro,
} from '../rotasAbertasDoMotorista';

// Formato que o supabase-js entrega: o JSON do PostgREST como objeto cru
// ({ code, message, details, hint }), com DETAIL e HINT do RAISE em string.
const erroDoBanco = (details: string, hint = SENTINELA_ROTA_ABERTA) => ({
  code: 'P0001',
  message:
    'Não dá para desativar: este motorista tem 2 rotas abertas nesta loja.',
  details,
  hint,
});

describe('rotasAbertasDoErro', () => {
  it('devolve as rotas do DETAIL quando o HINT é a sentinela', () => {
    const rotas = [
      { id: 'r1', data: '2026-10-24', status: 'em_andamento' },
      { id: 'r2', data: '2026-10-25', status: 'pendente' },
    ];
    expect(rotasAbertasDoErro(erroDoBanco(JSON.stringify(rotas)))).toEqual(
      rotas,
    );
  });

  it('mantém a data como texto (coluna date não vira Date)', () => {
    const [rota] =
      rotasAbertasDoErro(
        erroDoBanco('[{"id":"r1","data":"2026-10-24","status":"pendente"}]'),
      ) ?? [];
    expect(rota.data).toBe('2026-10-24');
  });

  it('bloqueio com DETAIL ilegível devolve lista vazia (bloqueado, sem lista)', () => {
    expect(rotasAbertasDoErro(erroDoBanco('isto não é json'))).toEqual([]);
    expect(rotasAbertasDoErro(erroDoBanco('{"rotas":1}'))).toEqual([]);
  });

  it('descarta item malformado e fica com os válidos', () => {
    expect(
      rotasAbertasDoErro(
        erroDoBanco(
          '[{"id":"r1","data":"2026-10-24","status":"pendente"},{"id":2},null]',
        ),
      ),
    ).toEqual([{ id: 'r1', data: '2026-10-24', status: 'pendente' }]);
  });

  it.each([
    ['null', null],
    ['Error', new Error('falhou')],
    ['outro P0001', { code: 'P0001', message: 'outra regra', hint: null }],
    [
      'outro código com a sentinela',
      { code: '42501', message: 'x', hint: SENTINELA_ROTA_ABERTA },
    ],
    ['string', 'erro'],
  ])('não é bloqueio por rota aberta: %s', (_nome, erro) => {
    expect(rotasAbertasDoErro(erro)).toBeNull();
  });
});
