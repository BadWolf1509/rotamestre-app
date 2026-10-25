import { act, renderHook } from '@testing-library/react-native';

import { SENTINELA_ROTA_ABERTA } from '@/lib/motorista/rotasAbertasDoMotorista';

import { useBloqueioDesativacao } from '../useBloqueioDesativacao';

const erroRotaAberta = {
  code: 'P0001',
  message:
    'Não dá para desativar: este motorista tem 1 rota aberta nesta loja.',
  details: '[{"id":"r1","data":"2026-10-24","status":"pendente"}]',
  hint: SENTINELA_ROTA_ABERTA,
};

describe('useBloqueioDesativacao', () => {
  it('erro de rota aberta abre o bloqueio com o nome e as rotas', () => {
    const { result } = renderHook(() => useBloqueioDesativacao());

    let tratado = false;
    act(() => {
      tratado = result.current.mostrarSeBloqueado(erroRotaAberta, 'João');
    });

    expect(tratado).toBe(true);
    expect(result.current.bloqueio).toEqual({
      nomeMotorista: 'João',
      rotas: [{ id: 'r1', data: '2026-10-24', status: 'pendente' }],
    });

    act(() => result.current.fecharBloqueio());
    expect(result.current.bloqueio).toBeNull();
  });

  it('outro erro não abre o bloqueio', () => {
    const { result } = renderHook(() => useBloqueioDesativacao());

    let tratado = true;
    act(() => {
      tratado = result.current.mostrarSeBloqueado(
        { code: 'P0001', message: 'outra regra' },
        'João',
      );
    });

    expect(tratado).toBe(false);
    expect(result.current.bloqueio).toBeNull();
  });
});
