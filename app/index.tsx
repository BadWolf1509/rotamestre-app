import { useRouter, useSegments } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { authService } from '@/lib/auth';
import { obterSessaoComTimeout } from '@/lib/auth/sessaoComTimeout';
import { logger } from '@/lib/logger';
import { isRecoveryRedirect } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

/**
 * Index - Redirect Inteligente
 *
 * Esta página NÃO é uma landing page.
 * Ela detecta se o usuário está logado e redireciona automaticamente:
 *
 * - Logado como gestor → /gestor/inicio
 * - Logado como motorista → /motorista/inicio
 * - Não logado → /auth/login
 *
 * Landing page institucional: www.rotamestre.tec.br
 */
function IndexContent() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const segments = useSegments();
  const [loading, setLoading] = useState(true);
  const hasRedirected = useRef(false);

  useEffect(() => {
    checkSessionAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkSessionAndRedirect() {
    // Evitar redirecionamentos duplicados
    if (hasRedirected.current) {
      setLoading(false);
      return;
    }

    // Password recovery redirect: token is in the URL hash/query → go to reset form.
    // On web we MUST preserve the hash/query (they carry the recovery token). A bare
    // router.replace() drops the fragment, so the reset screen wouldn't find the token
    // and would bounce the user to /auth/login. window.location.replace keeps it.
    if (isRecoveryRedirect) {
      logger.debug('🔐 Recovery token detected in URL → /auth/reset-password');
      hasRedirected.current = true;
      if (typeof window !== 'undefined') {
        const tokenPart = window.location.hash || window.location.search || '';
        window.location.replace('/auth/reset-password' + tokenPart);
      } else {
        router.replace('/auth/reset-password');
      }
      setLoading(false);
      return;
    }

    // Se já estamos em uma rota autenticada, não fazer nada
    const currentRoute = segments[0];
    if (currentRoute === 'gestor' || currentRoute === 'motorista') {
      logger.debug('📍 Já em rota autenticada, ignorando verificação');
      setLoading(false);
      return;
    }

    try {
      // Timeout para o app não travar quando o Supabase não responde.
      // See: https://github.com/supabase/supabase/issues/35754
      const SESSION_TIMEOUT = 10000; // 10 seconds (increased for slow emulators)
      const session = await obterSessaoComTimeout(
        () => authService.getSession(),
        SESSION_TIMEOUT,
        () =>
          logger.warn('⏱️ Session check timeout - assuming not authenticated'),
      );

      if (session?.user) {
        // Usuário autenticado: buscar dados completos para verificar primeira_senha
        const usuario = await authService.getUsuario(session.user.id);

        if (!usuario) {
          // Sessão válida sem perfil = cadastro incompleto. Mandar para o login
          // aqui foi o que travou 5 pessoas reais: o login funciona, então elas
          // voltavam para a mesma tela sem mensagem e desistiam.
          // O portão reage a ESTADO, então serve tanto para cadastro novo
          // quanto para as contas órfãs antigas.
          logger.warn(
            '[index] Sessão sem perfil → onboarding de criação de unidade',
          );
          hasRedirected.current = true;
          router.replace('/onboarding/criar-unidade');
          return;
        }

        // IMPORTANTE: Verificar se precisa trocar senha antes de redirecionar
        if (usuario.primeira_senha === true) {
          logger.debug(
            '🔐 Usuário precisa trocar senha → /onboarding/first-password',
          );
          hasRedirected.current = true;
          router.replace('/onboarding/first-password');
          return;
        }

        hasRedirected.current = true;
        if (usuario.papel === 'gestor') {
          logger.debug('✅ Usuário autenticado como gestor → /gestor/inicio');
          router.replace('/gestor/inicio');
        } else if (usuario.papel === 'motorista') {
          logger.debug('✅ Usuário autenticado como motorista → /motorista');
          router.replace('/motorista');
        } else {
          // Tipo desconhecido, vai para login
          logger.warn(
            '⚠️ Tipo de usuário desconhecido, redirecionando para login',
          );
          router.replace('/auth/login');
        }
      } else {
        // Não autenticado: redireciona para login
        hasRedirected.current = true;
        logger.debug('👤 Usuário não autenticado → /auth/login');
        router.replace('/auth/login');
      }
    } catch (error) {
      // Erro ao verificar sessão: vai para login como fallback
      logger.error('❌ Erro ao verificar sessão:', error);
      router.replace('/auth/login');
    } finally {
      setLoading(false);
    }
  }

  // Loading state enquanto verifica sessão
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Verificando sessão...</Text>
      </View>
    );
  }

  // Nunca deve chegar aqui (sempre redireciona)
  // Mas retorna null como fallback
  return null;
}

const styles = StyleSheet.create((theme: Theme) => ({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
  },
  loadingText: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.base,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
}));

/** Invólucro com ErrorBoundary — ver comentário em app/auth/login.tsx. */
export default function Index() {
  return (
    <ErrorBoundary>
      <IndexContent />
    </ErrorBoundary>
  );
}
