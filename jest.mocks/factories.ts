/**
 * Test Factories and Mock Helpers
 *
 * This file provides centralized mock data and helper functions for tests.
 * Import this instead of defining mock objects in each test file.
 */

import type { Theme } from '@/utils/styles.types';

// Re-export the default theme for test assertions
export { defaultTheme as mockTheme } from '@/utils/styles.base';

/**
 * Common test data factories
 */

// User factory
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  nome: 'Test User',
  papel: 'gestor' as const,
  unidade_id: 'unit-123',
  ativo: true,
  created_at: new Date().toISOString(),
  ...overrides,
});

// Motorista factory
export const createMockMotorista = (overrides = {}) => ({
  id: 'motorista-123',
  email: 'motorista@example.com',
  nome: 'Test Motorista',
  papel: 'motorista' as const,
  unidade_id: 'unit-123',
  ativo: true,
  telefone: '11999999999',
  created_at: new Date().toISOString(),
  ...overrides,
});

// Unidade factory
export const createMockUnidade = (overrides = {}) => ({
  id: 'unit-123',
  nome: 'Unidade Teste',
  cnpj: '12.345.678/0001-90',
  cidade: 'São Paulo',
  ativa: true,
  created_at: new Date().toISOString(),
  ...overrides,
});

// Rota factory
export const createMockRota = (overrides = {}) => ({
  id: 'rota-123',
  unidade_id: 'unit-123',
  motorista_id: 'motorista-123',
  status: 'pendente' as const,
  data: new Date().toISOString().split('T')[0],
  created_at: new Date().toISOString(),
  ...overrides,
});

// Parada factory
export const createMockParada = (overrides = {}) => ({
  id: 'parada-123',
  rota_id: 'rota-123',
  endereco: 'Rua Teste, 123',
  tipo: 'entrega' as const,
  status: 'pendente' as const,
  ordem: 1,
  latitude: -23.5505,
  longitude: -46.6333,
  ...overrides,
});

// Rota with paradas factory
export const createMockRotaCompleta = (overrides = {}, paradasCount = 3) => {
  const rota = createMockRota(overrides);
  const paradas = Array.from({ length: paradasCount }, (_, i) =>
    createMockParada({
      id: `parada-${i + 1}`,
      rota_id: rota.id,
      ordem: i + 1,
      endereco: `Rua ${i + 1}, ${(i + 1) * 100}`,
    })
  );
  return { ...rota, paradas };
};

// Session factory
export const createMockSession = (overrides = {}) => ({
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: createMockUser(),
  ...overrides,
});

/**
 * Supabase mock query builder factory
 */
export const createMockQueryBuilder = (data: unknown = null, error: unknown = null) => {
  const builder: Record<string, jest.Mock> = {};

  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'contains',
    'containedBy', 'match', 'not', 'or', 'filter',
    'order', 'limit', 'range', 'offset',
  ];

  chainMethods.forEach((method) => {
    builder[method] = jest.fn().mockReturnValue(builder);
  });

  // Terminal methods return promise
  builder.single = jest.fn().mockResolvedValue({ data, error });
  builder.maybeSingle = jest.fn().mockResolvedValue({ data, error });
  builder.then = jest.fn((resolve) => resolve({ data, error }));

  // Make it thenable for await
  Object.defineProperty(builder, Symbol.toStringTag, { value: 'Promise' });

  return builder;
};

/**
 * Router mock factory
 */
export const createMockRouter = () => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  setParams: jest.fn(),
  navigate: jest.fn(),
  dismiss: jest.fn(),
  dismissAll: jest.fn(),
});

/**
 * Location mock factory
 */
export const createMockLocation = (overrides = {}) => ({
  coords: {
    latitude: -23.5505,
    longitude: -46.6333,
    accuracy: 10,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    ...overrides,
  },
  timestamp: Date.now(),
});

/**
 * Theme utilities for tests
 */
export const getThemeColor = (theme: Theme, colorPath: string): string => {
  const parts = colorPath.split('.');
  let result: unknown = theme.colors;
  for (const part of parts) {
    result = (result as Record<string, unknown>)?.[part];
  }
  return result as string;
};

/**
 * Common style assertions helpers
 */
export const expectStyleToContain = (
  style: unknown,
  expected: Record<string, unknown>
) => {
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
  expect(flatStyle).toEqual(expect.objectContaining(expected));
};

/**
 * Wait for next tick (useful for testing async state updates)
 */
export const waitForNextTick = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Flush all promises (useful for testing multiple async operations)
 */
export const flushPromises = () =>
  new Promise((resolve) => setImmediate(resolve));
