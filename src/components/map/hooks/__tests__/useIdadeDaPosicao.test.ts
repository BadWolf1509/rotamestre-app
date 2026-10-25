import { act, renderHook } from '@testing-library/react-native';

import { useIdadeDaPosicao } from '../useIdadeDaPosicao';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-24T10:30:00Z'));
});
afterEach(() => {
  jest.useRealTimers();
});

it('a idade anda sozinha, sem nova posição', () => {
  const { result } = renderHook(() =>
    useIdadeDaPosicao('2026-10-24T10:28:00Z'),
  );
  expect(result.current).toBe('há 2 min');

  act(() => {
    jest.advanceTimersByTime(3 * 60_000);
  });
  expect(result.current).toBe('há 5 min');
});

it('tick que não muda o texto não re-renderiza', () => {
  let renders = 0;
  renderHook(() => {
    renders += 1;
    return useIdadeDaPosicao('2026-10-24T10:28:00Z');
  });
  const depoisDoPrimeiro = renders;

  // Um act por tick: no mesmo act o React agruparia os dois num render só.
  act(() => {
    jest.advanceTimersByTime(30_000); // 10:30:30 — segue "há 2 min"
  });
  expect(renders - depoisDoPrimeiro).toBe(0);

  act(() => {
    jest.advanceTimersByTime(30_000); // 10:31:00 — "há 3 min"
  });
  expect(renders - depoisDoPrimeiro).toBe(1);
});

it('posição nova recalcula na hora', () => {
  const { result, rerender } = renderHook(
    ({ ts }: { ts: string }) => useIdadeDaPosicao(ts),
    { initialProps: { ts: '2026-10-24T10:00:00Z' } },
  );
  expect(result.current).toBe('há 30 min');

  rerender({ ts: '2026-10-24T10:30:00Z' });
  expect(result.current).toBe('agora');
});

it('desmontar limpa o timer; sem posição não há timer', () => {
  const { unmount } = renderHook(() =>
    useIdadeDaPosicao('2026-10-24T10:28:00Z'),
  );
  expect(jest.getTimerCount()).toBe(1);
  unmount();
  expect(jest.getTimerCount()).toBe(0);

  const { result } = renderHook(() => useIdadeDaPosicao(null));
  expect(result.current).toBe('');
  expect(jest.getTimerCount()).toBe(0);
});
