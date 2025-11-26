import { useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from './useAuth';
import { useUser } from './useUser';

type RequiredRole = 'gestor' | 'motorista' | 'any';

interface UseRequireAuthOptions {
  /** Papel obrigatório para acessar a rota. 'any' permite qualquer papel autenticado. */
  role?: RequiredRole;
  /** Redirecionar para esta rota se não autenticado (default: /auth/login) */
  redirectTo?: string;
}

/**
 * Hook para proteger rotas que requerem autenticação.
 *
 * Redireciona automaticamente para login se:
 * - Usuário não está autenticado
 * - Usuário não tem o papel requerido (se especificado)
 *
 * @example
 * // Em um layout protegido:
 * const { isReady, isAuthorized } = useRequireAuth({ role: 'gestor' });
 * if (!isReady) return <LoadingScreen />;
 * if (!isAuthorized) return null; // Redirect já aconteceu
 */
export function useRequireAuth(options: UseRequireAuthOptions = {}) {
  const { role = 'any', redirectTo = '/auth/login' } = options;
  const router = useRouter();
  const segments = useSegments();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userLoading } = useUser();
  const [isReady, setIsReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Aguardar carregamento completo
    if (authLoading || userLoading) {
      return;
    }

    // Verificar se estamos em rota de autenticação (não proteger)
    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'onboarding';
    if (inAuthGroup) {
      setIsReady(true);
      setIsAuthorized(true);
      return;
    }

    // Verificar autenticação
    if (!user) {
      console.log('🔒 [RequireAuth] Usuário não autenticado, redirecionando para login');
      setIsReady(true);
      setIsAuthorized(false);
      router.replace(redirectTo);
      return;
    }

    // Verificar papel se requerido
    if (role !== 'any' && userData?.papel !== role) {
      console.log(`🔒 [RequireAuth] Papel ${userData?.papel} não tem acesso a rota de ${role}`);
      setIsReady(true);
      setIsAuthorized(false);

      // Redirecionar para área correta baseado no papel do usuário
      if (userData?.papel === 'gestor') {
        router.replace('/gestor/inicio');
      } else if (userData?.papel === 'motorista') {
        router.replace('/motorista/inicio');
      } else {
        router.replace(redirectTo);
      }
      return;
    }

    // Tudo ok - usuário autenticado e autorizado
    setIsReady(true);
    setIsAuthorized(true);
  }, [authLoading, userLoading, user, userData, role, redirectTo, router, segments]);

  return {
    /** Indica se a verificação de auth foi concluída */
    isReady,
    /** Indica se o usuário está autorizado a acessar a rota */
    isAuthorized,
    /** Dados do usuário (se autenticado) */
    userData,
    /** Indica se ainda está carregando */
    isLoading: authLoading || userLoading,
  };
}
