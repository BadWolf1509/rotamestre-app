import { Session, User } from '@supabase/supabase-js';
import { useEffect, useState, useRef } from 'react';

import { cleanExpiredCache } from '../lib/cache';
import { logger } from '../lib/logger';
import { registerPushToken } from '../lib/notifications';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Mock session storage for E2E/CI environments
let mockSession: Session | null = null;
let mockUser: User | null = null;

// Export function to set mock session (called by authService.signIn)
export function setMockSession(session: Session | null, user: User | null) {
  mockSession = session;
  mockUser = user;
}

// Export function to clear mock session (called by signOut)
export function clearMockSession() {
  mockSession = null;
  mockUser = null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    // For E2E/CI: Check mock session first
    if (!isSupabaseConfigured) {
      if (mockSession && mockUser) {
        setSession(mockSession);
        setUser(mockUser);
        lastUserId.current = mockUser.id;
      }
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      lastUserId.current = session?.user?.id ?? null;
      setLoading(false);

      // ✅ Limpar cache expirado na inicialização
      cleanExpiredCache();
    });

    // Listen for auth changes
    // Nota: O token do Realtime é sincronizado automaticamente em supabase.ts
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Registro do token de push (não bloqueia; push é opcional e não pode
      // afetar o fluxo de auth). A REMOÇÃO não mora aqui: o SIGNED_OUT chega
      // depois de a sessão sumir, e o UPDATE iria anônimo (RLS filtra 0
      // linhas, sem erro). Ela fica em `authService.signOut`, antes do signOut.
      if (event === 'SIGNED_IN' && session?.user) {
        const userId = session.user.id;
        const alreadyRegistered = lastUserId.current === userId;
        lastUserId.current = userId;
        if (!alreadyRegistered) {
          registerPushToken(userId).catch((err) =>
            logger.warn('[Push] Push registration failed', err),
          );
        }
      }
      if (event === 'SIGNED_OUT') {
        // Próximo SIGNED_IN (outra conta, ou a mesma) registra de novo.
        lastUserId.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Logout: `authService.signOut` (src/lib/auth.ts), o único caminho.
  return {
    session,
    user,
    loading,
  };
}
