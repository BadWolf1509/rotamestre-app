import { useRouter, useSegments, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from './useAuth';
import { useUser, type PerfilIndisponivel } from './useUser';
import { logger } from '../lib/logger';

type RequiredRole = 'gestor' | 'motorista' | 'any';

interface UseRequireAuthOptions {
  /** Papel obrigatório para acessar a rota. 'any' permite qualquer papel autenticado. */
  role?: RequiredRole;
  /** Redirecionar para esta rota se não autenticado (default: /auth/login) */
  redirectTo?: Href;
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
  const {
    user,
    loading: authLoading,
    offline = false,
    usuarioOfflineId = null,
    recarregarSessao,
  } = useAuth();
  const {
    userData,
    loading: userLoading,
    perfilIndisponivel: motivoDoUseUser = null,
    refresh,
  } = useUser();
  const [isReady, setIsReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [tentando, setTentando] = useState(false);
  // Um aviso por episódio, não um por execução do efeito (M4).
  const avisouIndisponivel = useRef(false);

  // Offline sem nem o último usuário: não há de quem buscar perfil.
  const offlineSemDono = !user && offline && !usuarioOfflineId;
  const perfilIndisponivel: PerfilIndisponivel = userData
    ? null
    : offlineSemDono
      ? 'conexao'
      : motivoDoUseUser;

  /**
   * Sem sessão, relê a sessão: se o refresh der certo, o useAuth ganha `user`
   * e o useUser recarrega sozinho. Com sessão, refaz a busca do perfil — que
   * exige sessão antes e não cai no "0 linhas anônimas = sem perfil".
   */
  const tentarNovamente = useCallback(async () => {
    setTentando(true);
    try {
      if (!user) await recarregarSessao?.();
      else await refresh();
    } finally {
      setTentando(false);
    }
  }, [user, recarregarSessao, refresh]);

  useEffect(() => {
    // Aguardar carregamento do auth
    if (authLoading) {
      return;
    }

    // Verificar se estamos em rota de autenticação (não proteger)
    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'onboarding';
    if (inAuthGroup) {
      setIsReady(true);
      setIsAuthorized(true);
      return;
    }

    // Sem perfil para decidir — busca falhou sem perfil conhecido, ou a
    // sessão está offline sem dono. Não é "sem perfil" nem "deslogado"; o
    // login não resolveria (a sessão segue guardada e o login também precisa
    // de rede). O layout mostra `PerfilIndisponivelScreen`.
    if (perfilIndisponivel && (offlineSemDono || !userLoading)) {
      if (!avisouIndisponivel.current) {
        avisouIndisponivel.current = true;
        logger.warn(
          '[Auth] Perfil indisponível. Sem redirecionar.',
          perfilIndisponivel,
        );
      }
      setIsReady(true);
      setIsAuthorized(false);
      return;
    }
    avisouIndisponivel.current = false;

    // Verificar autenticação. Offline com o último usuário não é "deslogado":
    // segue, e o useUser responde com o perfil conhecido dele.
    if (!user && !usuarioOfflineId) {
      setIsReady(true);
      setIsAuthorized(false);
      router.replace(redirectTo);
      return;
    }

    // Se user existe mas userData ainda está carregando, aguardar
    // Isso evita race condition após login quando useUser ainda não carregou
    if (userLoading) {
      return;
    }

    // userData ausente após carregamento -> tratar como não autorizado
    if (!userData) {
      logger.warn(
        '[Auth] userData ausente após carregar. Redirecionando para login.',
      );
      setIsReady(true);
      setIsAuthorized(false);
      router.replace(redirectTo);
      return;
    }

    // IMPORTANTE: Verificar se usuário precisa trocar senha (primeira_senha)
    // Isso evita tela branca caso o usuário acesse diretamente uma rota protegida
    if (userData.primeira_senha === true) {
      logger.warn(
        '[Auth] Usuário precisa trocar senha. Redirecionando para first-password.',
      );
      setIsReady(true);
      setIsAuthorized(false);
      router.replace('/onboarding/first-password');
      return;
    }

    // Verificar papel se requerido
    if (role !== 'any' && userData.papel !== role) {
      setIsReady(true);
      setIsAuthorized(false);

      // Redirecionar para área correta baseado no papel do usuário
      if (userData.papel === 'gestor') {
        router.replace('/gestor/inicio');
      } else if (userData.papel === 'motorista') {
        router.replace('/motorista');
      } else {
        router.replace(redirectTo);
      }
      return;
    }

    // Tudo ok - usuário autenticado e autorizado
    setIsReady(true);
    setIsAuthorized(true);
  }, [
    authLoading,
    userLoading,
    user,
    usuarioOfflineId,
    offlineSemDono,
    userData,
    perfilIndisponivel,
    role,
    redirectTo,
    router,
    segments,
  ]);

  return {
    /** Indica se a verificação de auth foi concluída */
    isReady,
    /** Indica se o usuário está autorizado a acessar a rota */
    isAuthorized,
    /** Dados do usuário (se autenticado) */
    userData,
    /** Indica se ainda está carregando */
    isLoading: authLoading || userLoading,
    /** Sem perfil para decidir: mostre `PerfilIndisponivelScreen` com o motivo. */
    perfilIndisponivel,
    /** "Tentar novamente" em curso (carregando no botão). */
    tentando,
    tentarNovamente,
  };
}
