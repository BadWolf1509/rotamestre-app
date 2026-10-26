import { ehRecusaPorRotaEncerrada } from '../recusaRotaEncerrada';

describe('ehRecusaPorRotaEncerrada', () => {
  it('P0001 com o marcador de rota encerrada, cru ou classificado', () => {
    expect(
      ehRecusaPorRotaEncerrada({ code: 'P0001', message: 'ROTA_ENCERRADA' }),
    ).toBe(true);
    expect(
      ehRecusaPorRotaEncerrada({
        type: 'unknown',
        message: 'Algo traduzido',
        originalError: {
          code: 'P0001',
          message: 'PARADA_DE_ROTA_ENCERRADA',
        },
      }),
    ).toBe(true);
  });

  it('outro P0001, outro código ou nada: não é essa recusa', () => {
    expect(
      ehRecusaPorRotaEncerrada({ code: 'P0001', message: 'FOTO_PRESERVADA' }),
    ).toBe(false);
    expect(
      ehRecusaPorRotaEncerrada({ code: '42501', message: 'ROTA_ENCERRADA' }),
    ).toBe(false);
    expect(ehRecusaPorRotaEncerrada(null)).toBe(false);
    expect(ehRecusaPorRotaEncerrada('ROTA_ENCERRADA')).toBe(false);
  });
});
