// Mock genérico de Supabase usado em hooks/serviços/tests
function setupSupabaseMocks() {
  const createMockQueryBuilder = () => {
    const builder = {
      select: jest.fn().mockReturnValue(builder),
      insert: jest.fn().mockReturnValue(builder),
      update: jest.fn().mockReturnValue(builder),
      delete: jest.fn().mockReturnValue(builder),
      eq: jest.fn().mockReturnValue(builder),
      neq: jest.fn().mockReturnValue(builder),
      gt: jest.fn().mockReturnValue(builder),
      gte: jest.fn().mockReturnValue(builder),
      lt: jest.fn().mockReturnValue(builder),
      lte: jest.fn().mockReturnValue(builder),
      like: jest.fn().mockReturnValue(builder),
      ilike: jest.fn().mockReturnValue(builder),
      is: jest.fn().mockReturnValue(builder),
      in: jest.fn().mockReturnValue(builder),
      contains: jest.fn().mockReturnValue(builder),
      containedBy: jest.fn().mockReturnValue(builder),
      rangeGt: jest.fn().mockReturnValue(builder),
      rangeGte: jest.fn().mockReturnValue(builder),
      rangeLt: jest.fn().mockReturnValue(builder),
      rangeLte: jest.fn().mockReturnValue(builder),
      rangeAdjacent: jest.fn().mockReturnValue(builder),
      overlaps: jest.fn().mockReturnValue(builder),
      textSearch: jest.fn().mockReturnValue(builder),
      match: jest.fn().mockReturnValue(builder),
      not: jest.fn().mockReturnValue(builder),
      or: jest.fn().mockReturnValue(builder),
      filter: jest.fn().mockReturnValue(builder),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      limit: jest.fn().mockReturnValue(builder),
      order: jest.fn().mockReturnValue(builder),
      range: jest.fn().mockReturnValue(builder),
    };
    return builder;
  };

  const mockSupabaseClient = {
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signUp: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
      updateUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
      resend: jest.fn().mockResolvedValue({ data: {}, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn((_table) => createMockQueryBuilder()),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({
        unsubscribe: jest.fn(),
      }),
    })),
  };

  jest.mock('@/lib/supabase', () => ({
    supabase: mockSupabaseClient,
    isSupabaseConfigured: true, // Força o uso do path do Supabase mockado ao invés do mock E2E
    supabaseUrl: 'https://project.supabase.co', // Host usado na validação anti open-redirect
  }));

  return mockSupabaseClient;
}

module.exports = { setupSupabaseMocks };
