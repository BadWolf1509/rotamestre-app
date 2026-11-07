import { act, renderHook } from '@testing-library/react-native';

import type { ParadaData } from '@/context/route-status/types';

import { useAcoesDaParada } from '../useAcoesDaParada';

const base = {
  tipo: 'entrega',
  status: 'pendente',
  latitude: -23.55,
  longitude: -46.63,
  endereco: 'Rua A',
} as const;
// Entrega e retirada no mesmo local: uma visita com dois serviços.
const entrega = { ...base, id: 'p1', ordem: 1 } as ParadaData;
const retirada = {
  ...base,
  id: 'p2',
  ordem: 2,
  tipo: 'retirada',
} as ParadaData;

// Referência estável, como a lista que vem do contexto da rota.
const PARADAS = [entrega, retirada];

function montar(paradaEmConclusao: ParadaData | null) {
  const ordem: string[] = [];
  const refreshRoute = jest.fn(async () => {
    ordem.push('refresh');
  });
  const abrirConclusao = jest.fn((p: ParadaData) => {
    ordem.push(`abre:${p.id}`);
  });
  const hook = renderHook(() =>
    useAcoesDaParada({
      paradas: PARADAS,
      skipStop: jest.fn().mockResolvedValue('enviada'),
      refreshRoute,
      showSuccess: jest.fn(),
      showError: jest.fn(),
      abrirConclusao,
      paradaEmConclusao,
    }),
  );
  return { hook, ordem, refreshRoute, abrirConclusao };
}

describe('useAcoesDaParada', () => {
  it('ao concluir com sucesso, recarrega a rota e só então abre o próximo serviço', async () => {
    const { hook, ordem } = montar(entrega);

    act(() => hook.result.current.sequencia.iniciar(entrega));
    ordem.length = 0;
    await act(async () => {
      await hook.result.current.aoConcluirComSucesso();
    });

    expect(ordem).toEqual(['refresh', 'abre:p2']);
  });

  it('sem parada em conclusão, só recarrega a rota', async () => {
    const { hook, ordem, abrirConclusao } = montar(null);

    await act(async () => {
      await hook.result.current.aoConcluirComSucesso();
    });

    expect(ordem).toEqual(['refresh']);
    expect(abrirConclusao).not.toHaveBeenCalled();
  });

  it('a sequência tem identidade estável entre renders', () => {
    const { hook } = montar(null);
    const antes = hook.result.current.sequencia;

    hook.rerender({});

    expect(hook.result.current.sequencia).toBe(antes);
  });
});
