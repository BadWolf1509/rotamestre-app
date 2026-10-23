/**
 * A idempotência da fila mora no FILTRO do UPDATE: só parada aberta muda.
 * Sem o `.in('status', ...)`, reenviar um "pular" regrediria uma conclusão.
 */
import { supabase } from '@/lib/supabase';

import { portaParadasSupabase } from '../filaAcoesParada';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

it('UPDATE só de parada pendente/em andamento, e diz se alguma linha mudou', async () => {
  const select = jest.fn().mockResolvedValue({ data: [], error: null });
  const inFn = jest.fn(() => ({ select }));
  const eq = jest.fn(() => ({ in: inFn }));
  const update = jest.fn(() => ({ eq }));
  (supabase.from as jest.Mock).mockReturnValue({ update });

  const mudou = await portaParadasSupabase.atualizarSeAberta('p1', {
    status: 'pulada',
  });

  expect(update).toHaveBeenCalledWith({ status: 'pulada' });
  expect(eq).toHaveBeenCalledWith('id', 'p1');
  expect(inFn).toHaveBeenCalledWith('status', ['pendente', 'em_andamento']);
  expect(mudou).toBe(false);
});

it('avançar a próxima não cria uma segunda parada em andamento', async () => {
  const update = jest.fn();
  (supabase.from as jest.Mock).mockReturnValue({
    select: () => ({
      eq: () => ({
        order: async () => ({
          data: [
            { id: 'p0', status: 'concluida', ordem: 0, is_checkpoint: false },
            { id: 'p1', status: 'em_andamento', ordem: 1 },
            { id: 'p2', status: 'pendente', ordem: 2 },
          ],
          error: null,
        }),
      }),
    }),
    update,
  });

  await portaParadasSupabase.avancarProxima('r1');

  expect(update).not.toHaveBeenCalled();
});

it('lerParada achata a rota embutida (objeto ou array)', async () => {
  (supabase.from as jest.Mock).mockReturnValue({
    select: () => ({
      eq: () => ({
        returns: () => ({
          maybeSingle: async () => ({
            data: {
              status: 'pendente',
              rota_id: 'r1',
              rotas: [{ status: 'em_andamento', motorista_id: 'm1' }],
            },
            error: null,
          }),
        }),
      }),
    }),
  });

  expect(await portaParadasSupabase.lerParada('p1')).toEqual({
    status: 'pendente',
    rota_id: 'r1',
    rota: { status: 'em_andamento', motorista_id: 'm1' },
  });
});
