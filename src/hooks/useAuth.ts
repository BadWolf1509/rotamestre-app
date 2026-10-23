import { Session, User } from '@supabase/supabase-js';
import { useCallback, useEffect, useState, useRef } from 'react';

import { lerSessao } from '../lib/auth/sessao';
import { lerUltimoUsuario } from '../lib/auth/ultimoUsuario';
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
  // Sem sessão por falta de rede (token vencido + refresh sem rede): a sessão
  // segue no storage e a pessoa NÃO está deslogada. `usuarioOfflineId` é o
  // último usuário do aparelho (só o dono; o perfil vem do perfil conhecido).
  // Ver src/lib/auth/sessao.ts.
  const [offline, setOffline] = useState(false);
  const [usuarioOfflineId, setUsuarioOfflineId] = useState<string | null>(null);
  const lastUserId = useRef<string | null>(null);

  const aplicarSessao = useCallback(
    async (estado: { session: Session | null; offline: boolean }) => {
      const idOffline = estado.offline ? await lerUltimoUsuario() : null;
      setSession(estado.session);
      setUser(estado.session?.user ?? null);
      setOffline(estado.offline);
      setUsuarioOfflineId(idOffline);
    },
    [],
  );

  /** Relê a sessão (botão "Tentar novamente" sem sessão). */
  const recarregarSessao = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await aplicarSessao(await lerSessao());
  }, [aplicarSessao]);

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
    lerSessao().then(async (estado) => {
      await aplicarSessao(estado);
      lastUserId.current = estado.session?.user?.id ?? null;
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
      // Sessão de volta (TOKEN_REFRESHED/SIGNED_IN quando a rede volta) ou
      // logout de verdade (SIGNED_OUT, inclusive sessão revogada) encerram o
      // modo offline. O INITIAL_SESSION null da MESMA falha de refresh não:
      // quem decide offline é a leitura com o erro, em `lerSessao`.
      if (session || event === 'SIGNED_OUT') {
        setOffline(false);
        setUsuarioOfflineId(null);
      }

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
  }, [aplicarSessao]);

  // Logout: `authService.signOut` (src/lib/auth.ts), o único caminho.
  return {
    session,
    user,
    loading,
    offline,
    usuarioOfflineId,
    recarregarSessao,
  };
}
