import { Session, User } from '@supabase/supabase-js';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';

import { clearAllCache, cleanExpiredCache } from '../lib/cache';
import { logger } from '../lib/logger';
import { unregisterPushToken } from '../lib/notifications';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      lastUserId.current = session?.user?.id ?? null;
    });

    return () => subscription.unsubscribe();
  }, []);

  // ✅ Logout com limpeza de cache e push token
  const signOut = useCallback(async () => {
    // Remover push token antes do logout (mobile only)
    if (Platform.OS !== 'web' && lastUserId.current) {
      try {
        await unregisterPushToken(lastUserId.current);
      } catch (error) {
        logger.error('[Push] Erro ao remover token:', error);
      }
    }

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
