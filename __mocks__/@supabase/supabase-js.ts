// Mock do Supabase Client para testes

export const mockSupabaseClient = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    updateUser: jest.fn(),
    resend: jest.fn(),
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
};

export const createClient = jest.fn(() => mockSupabaseClient);

// Helper para resetar mocks entre testes
export const resetSupabaseMocks = () => {
  Object.values(mockSupabaseClient.auth).forEach((fn: any) => {
    if (typeof fn === 'function' && fn.mockReset) {
      fn.mockReset();
    }
  });
};
