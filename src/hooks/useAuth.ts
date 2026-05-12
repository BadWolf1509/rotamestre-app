import { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState, useRef } from "react";

import { clearAllCache, cleanExpiredCache } from "../lib/cache";
import { logger } from "../lib/logger";
import { registerPushToken, unregisterPushToken } from "../lib/notifications";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

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
      // Capture previous userId before overwriting — needed for SIGNED_OUT unregister
      const previousUserId = lastUserId.current;

      setSession(session);
      setUser(session?.user ?? null);

      // Wire push token registration/unregistration (non-blocking, failures are
      // logged as warnings — push is optional and must not affect the auth flow)
      if (event === "SIGNED_IN" && session?.user) {
        const userId = session.user.id;
        const alreadyRegistered = lastUserId.current === userId;
        lastUserId.current = userId;
        if (!alreadyRegistered) {
          registerPushToken(userId).catch((err) =>
            logger.warn("[Push] Push registration failed", err),
          );
        }
      }
      if (event === "SIGNED_OUT") {
        lastUserId.current = null;
        if (previousUserId) {
          unregisterPushToken(previousUserId).catch((err) =>
            logger.warn("[Push] Push unregister failed", err),
          );
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ✅ Logout com limpeza de cache
  // Push token unregistration is handled by the SIGNED_OUT event in onAuthStateChange
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
