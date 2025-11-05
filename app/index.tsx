import { View, Text, ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { authService } from '@/lib/auth';

/**
 * Index - Redirect Inteligente
 *
 * Esta página NÃO é uma landing page.
 * Ela detecta se o usuário está logado e redireciona automaticamente:
 *
 * - Logado como gestor → /gestor/dashboard
 * - Logado como motorista → /motorista/rota
 * - Não logado → /auth/login
 *
 * Landing page institucional: www.rotamestre.tec.br
 */
export default function Index() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSessionAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkSessionAndRedirect() {
    try {
      const session = await authService.getSession();

      if (session?.user) {
        // Usuário autenticado: redireciona para área correspondente
        const tipo = await authService.verificarTipoUsuario(session.user.id);

        if (tipo === 'gestor') {
          console.log('✅ Usuário autenticado como gestor → /gestor/dashboard');
          router.replace('/gestor/dashboard');
        } else if (tipo === 'motorista') {
          console.log('✅ Usuário autenticado como motorista → /motorista/rota');
          router.replace('/motorista/rota');
        } else {
          // Tipo desconhecido, vai para login
          console.warn('⚠️ Tipo de usuário desconhecido, redirecionando para login');
          router.replace('/auth/login');
        }
      } else {
        // Não autenticado: redireciona para login
        console.log('👤 Usuário não autenticado → /auth/login');
        router.replace('/auth/login');
      }
    } catch (error) {
      // Erro ao verificar sessão: vai para login como fallback
      console.error('❌ Erro ao verificar sessão:', error);
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

const styles = StyleSheet.create(theme => ({
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
