import { Session, User } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

import { clearAllCache, cleanExpiredCache } from '../lib/cache';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // ✅ Limpar cache expirado na inicialização
      cleanExpiredCache();
    });

    // Listen for auth changes
    // Nota: O token do Realtime é sincronizado automaticamente em supabase.ts
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ✅ Logout com limpeza de cache
  const signOut = useCallback(async () => {
    await clearAllCache(); // Limpar todo o cache ao fazer logout
    return supabase.auth.signOut();
  }, []);

  return {
    session,
    user,
    loading,
    signOut,
  };
}
