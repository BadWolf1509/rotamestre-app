import { useRouter, useSegments } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

import { authService } from '@/lib/auth';
import { logger } from '@/lib/logger';
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
export default function Index() {
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

    // Se já estamos em uma rota autenticada, não fazer nada
    const currentRoute = segments[0];
    if (currentRoute === 'gestor' || currentRoute === 'motorista') {
      logger.debug('📍 Já em rota autenticada, ignorando verificação');
      setLoading(false);
      return;
    }

    try {
      // Add timeout to prevent hanging in CI when Supabase isn't configured
      // See: https://github.com/supabase/supabase/issues/35754
      const SESSION_TIMEOUT = 10000; // 10 seconds (increased for slow emulators)
      const sessionPromise = authService.getSession();
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          logger.warn('⏱️ Session check timeout - assuming not authenticated');
          resolve(null);
        }, SESSION_TIMEOUT);
      });

      const session = await Promise.race([sessionPromise, timeoutPromise]);

      if (session?.user) {
        // Usuário autenticado: buscar dados completos para verificar primeira_senha
        const usuario = await authService.getUsuario(session.user.id);

        if (!usuario) {
          logger.warn('⚠️ Usuário não encontrado no banco, redirecionando para login');
          hasRedirected.current = true;
          router.replace('/auth/login');
          return;
        }

        // IMPORTANTE: Verificar se precisa trocar senha antes de redirecionar
        if (usuario.primeira_senha === true) {
          logger.debug('🔐 Usuário precisa trocar senha → /onboarding/first-password');
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
          logger.warn('⚠️ Tipo de usuário desconhecido, redirecionando para login');
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
