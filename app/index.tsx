import { useRouter, useSegments } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

import { PerfilIndisponivelScreen } from '@/components/auth/PerfilIndisponivelScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { authService } from '@/lib/auth';
import { ContaDesativada } from '@/lib/auth/contaAtiva';
import { classificarFalhaPerfil } from '@/lib/auth/falhaPerfil';
import {
  apagarPerfilConhecido,
  lerPerfilConhecido,
} from '@/lib/auth/perfilConhecido';
import { buscarPerfilNaAbertura } from '@/lib/auth/perfilNaAbertura';
import { PRAZO_LEITURA_SESSAO_MS } from '@/lib/auth/sessao';
import { obterSessaoComTimeout } from '@/lib/auth/sessaoComTimeout';
import { lerUltimoUsuario } from '@/lib/auth/ultimoUsuario';
import { logger } from '@/lib/logger';
import { redeCaidaObservada } from '@/lib/redeObservada';
import { isRecoveryRedirect } from '@/lib/supabase';
import type { Usuario } from '@/types/usuario';
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
  // Sem perfil para decidir: 'conexao' (falha transitória sem perfil
  // conhecido, ou sessão offline sem dono) ou 'erro' (falha de verdade).
  const [indisponivel, setIndisponivel] = useState<'conexao' | 'erro' | null>(
    null,
  );
  const [tentando, setTentando] = useState(false);
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
      // Estourar o prazo NÃO é "deslogado": sem resposta não dá para afirmar
      // nada, e mandar ao login tirava do app quem só estava sem sinal.
      const estado = await obterSessaoComTimeout(
        () => authService.lerSessao(),
        PRAZO_LEITURA_SESSAO_MS,
        () =>
          logger.warn(
            '⏱️ Sessão não respondeu no prazo — tratando como offline',
          ),
      );

      // Offline (token vencido + refresh sem rede, ou sem resposta): a sessão
      // segue guardada. O dono é o último usuário do aparelho, e o perfil, o
      // conhecido dele (com checagem de dono).
      if (!estado || estado.offline) {
        await seguirPeloPerfilConhecido(await lerUltimoUsuario(), 'offline');
        return;
      }

      const session = estado.session;
      if (session?.user) {
        // Usuário autenticado: buscar dados completos para verificar primeira_senha
        let usuario: Usuario | null;
        try {
          // Com perfil conhecido guardado, a busca tem prazo curto (e nem sai
          // com a queda de rede já observada): Wi-Fi sem internet esperava o
          // DNS desistir. Sem perfil guardado, espera como sempre.
          const perfil = await buscarPerfilNaAbertura(session.user.id, {
            buscar: () => authService.getUsuario(session.user.id),
            lerConhecido: lerPerfilConhecido,
            redeCaida: () => redeCaidaObservada(),
          });
          if (perfil.origem === 'conhecido') {
            logger.warn(
              '[index] Perfil sem resposta a tempo — seguindo pelo perfil conhecido',
            );
            // Igual ao ramo offline: perfil guardado não passa pelo portão
            // da conta; o `useUser` do layout busca o fresco em seguida.
            rotearPeloPerfil(perfil.usuario);
            return;
          }
          usuario = perfil.usuario;
        } catch (erroBusca) {
          // Falha NÃO é "sem perfil" (isso é data:null sem erro e autenticado,
          // tratado abaixo). Falha transitória: vale o perfil conhecido da
          // própria conta. Falha de verdade (4xx de schema/permissão): não
          // entra com perfil velho — mostra o erro e deixa tentar de novo.
          const falha = classificarFalhaPerfil(erroBusca);
          if (!falha.transitoria) {
            logger.error(
              '[index] Erro de verdade ao buscar o perfil',
              erroBusca,
            );
            setIndisponivel('erro');
            return;
          }
          await seguirPeloPerfilConhecido(session.user.id, erroBusca);
          return;
        }

        if (!usuario) {
          // Sessão válida sem perfil = cadastro incompleto. Mandar para o login
          // aqui foi o que travou 5 pessoas reais: o login funciona, então elas
          // voltavam para a mesma tela sem mensagem e desistiam.
          // O portão reage a ESTADO, então serve tanto para cadastro novo
          // quanto para as contas órfãs antigas.
          // Resposta autenticada e real: um perfil conhecido desta conta é
          // velho e não pode responder numa próxima falha.
          logger.warn(
            '[index] Sessão sem perfil → onboarding de criação de unidade',
          );
          await apagarPerfilConhecido(session.user.id);
          hasRedirected.current = true;
          router.replace('/onboarding/criar-unidade');
          return;
        }

        // Perfil que o servidor acabou de devolver: só com ele se pode afirmar
        // que a conta foi desativada. O ramo offline (perfil conhecido) não
        // passa por aqui de propósito.
        try {
          await authService.garantirContaAtiva(usuario);
        } catch (erroConta) {
          if (!(erroConta instanceof ContaDesativada)) throw erroConta;
          logger.warn('[index] Conta desativada → login com aviso');
          hasRedirected.current = true;
          router.replace('/auth/login?conta=desativada');
          return;
        }

        rotearPeloPerfil(usuario);
      } else {
        // Não autenticado: redireciona para login
        hasRedirected.current = true;
        logger.debug('👤 Usuário não autenticado → /auth/login');
        router.replace('/auth/login');
      }
    } catch (error) {
      // Erro inesperado: o login não resolveria (a sessão pode ser válida).
      logger.error('❌ Erro ao verificar sessão:', error);
      setIndisponivel('erro');
    } finally {
      setLoading(false);
    }
  }

  /** Último perfil conhecido do dono; sem ele, "Sem conexão". */
  async function seguirPeloPerfilConhecido(
    userId: string | null,
    motivo: unknown,
  ) {
    const usuario = userId ? await lerPerfilConhecido(userId) : null;
    if (!usuario) {
      logger.warn('[index] Perfil indisponível, sem perfil conhecido', motivo);
      setIndisponivel('conexao');
      return;
    }
    logger.warn('[index] Seguindo pelo último perfil conhecido', motivo);
    rotearPeloPerfil(usuario);
  }

  function rotearPeloPerfil(usuario: Usuario) {
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
      logger.warn('⚠️ Tipo de usuário desconhecido, redirecionando para login');
      router.replace('/auth/login');
    }
  }

  /** Mantém a tela com carregando no botão até a nova tentativa decidir. */
  async function tentarNovamente() {
    setTentando(true);
    try {
      await checkSessionAndRedirect();
    } finally {
      setTentando(false);
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

  if (indisponivel) {
    return (
      <PerfilIndisponivelScreen
        motivo={indisponivel}
        tentando={tentando}
        onTentarNovamente={tentarNovamente}
      />
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
