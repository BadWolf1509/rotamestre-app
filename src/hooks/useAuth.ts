import { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

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

      // ✅ Sincronizar token com Realtime imediatamente
      if (session?.access_token) {
        console.log('[Auth] Sincronizando token com Realtime');
        supabase.realtime.setAuth(session.access_token);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // ✅ Atualizar token do Realtime quando sessão mudar
      if (session?.access_token) {
        console.log('[Auth] Sessão mudou, atualizando Realtime auth');
        supabase.realtime.setAuth(session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    session,
    user,
    loading,
    signOut: () => supabase.auth.signOut(),
  };
}
