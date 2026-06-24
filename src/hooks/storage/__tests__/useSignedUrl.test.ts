import { renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/storage', () => ({
  getStoragePath: jest.requireActual('@/lib/storage').getStoragePath,
  createSignedUrlForFoto: jest.fn(),
}));

import { createSignedUrlForFoto } from '@/lib/storage';

import { useSignedUrl } from '../useSignedUrl';

const mockSign = createSignedUrlForFoto as jest.Mock;

beforeEach(() => mockSign.mockReset());

it('retorna null para valor null sem assinar', () => {
  const { result } = renderHook(() => useSignedUrl(null));
  expect(result.current.url).toBeNull();
  expect(mockSign).not.toHaveBeenCalled();
});

it('assina um path e expõe a url', async () => {
  mockSign.mockResolvedValue('https://signed/aaa');
  const { result } = renderHook(() => useSignedUrl('u1/r1/task3a_unique.jpg'));
  await waitFor(() => expect(result.current.url).toBe('https://signed/aaa'));
});

it('faz pass-through de URL http externa', () => {
  const { result } = renderHook(() =>
    useSignedUrl('https://gravatar.com/avatar/xyz'),
  );
  expect(result.current.url).toBe('https://gravatar.com/avatar/xyz');
  expect(mockSign).not.toHaveBeenCalled();
});

it('dedupe: dois consumidores do mesmo path → uma assinatura', async () => {
  mockSign.mockResolvedValue('https://signed/bbb');
  const path = 'u1/r1/task3b_unique.jpg';
  renderHook(() => useSignedUrl(path));
  renderHook(() => useSignedUrl(path));
  await waitFor(() => expect(mockSign).toHaveBeenCalledTimes(1));
});
