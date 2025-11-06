// Mock do Expo Router para testes

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  setParams: jest.fn(),
};

export const useRouter = jest.fn(() => mockRouter);
export const usePathname = jest.fn(() => '/');
export const useSegments = jest.fn(() => []);
export const useSearchParams = jest.fn(() => ({}));
export const useLocalSearchParams = jest.fn(() => ({}));
export const useGlobalSearchParams = jest.fn(() => ({}));

export const Link = 'Link';
export const Redirect = 'Redirect';
export const router = mockRouter;

// Helper para resetar mocks entre testes
export const resetRouterMocks = () => {
  Object.values(mockRouter).forEach((fn: any) => {
    if (typeof fn === 'function' && fn.mockReset) {
      fn.mockReset();
    }
  });
};
