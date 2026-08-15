import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  TouchableOpacity,
  View,
} from 'react-native';

import { Dialog } from '@/components/Dialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  LegalBullet,
  LegalPage,
  LegalParagraph,
  LegalSection,
} from '@/components/legal/LegalPage';
import { Text } from '@/design-system';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

function ExclusaoDeContaContent() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { session, loading: sessionLoading } = useAuth();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
  }>({ visible: false, title: '', message: '', type: 'success' });

  async function handleDelete() {
    setDeleting(true);
    try {
      await authService.deleteAccount();
      setConfirmVisible(false);
      setResult({
        visible: true,
        title: 'Conta excluída',
        message:
          'Sua conta e seus dados pessoais foram excluídos. Registros empresariais ou legais necessários permanecem anonimizados.',
        type: 'success',
      });
    } catch (error) {
      logger.error('[AccountDeletion] Falha ao excluir conta', error);
      setConfirmVisible(false);
      setResult({
        visible: true,
        title: 'Não foi possível excluir',
        message:
          'Tente novamente. Se o problema continuar, solicite a exclusão pelo e-mail contato@rotamestre.tec.br.',
        type: 'error',
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <LegalPage
        title="Exclusão de conta e dados"
        updatedAt="24 de julho de 2026"
      >
        <LegalSection title="Como excluir">
          <LegalParagraph>
            Usuários do Rota Mestre podem excluir a conta diretamente nesta
            página quando estiverem autenticados. A mesma opção está disponível
            no perfil do aplicativo Android.
          </LegalParagraph>
          <LegalParagraph>
            Se você não conseguir entrar, envie a solicitação pelo botão de
            e-mail abaixo usando o endereço cadastrado. Poderemos solicitar
            informações adicionais apenas para confirmar sua identidade.
          </LegalParagraph>
        </LegalSection>

        <LegalSection title="O que será excluído">
          <LegalBullet>Conta de autenticação e perfil pessoal.</LegalBullet>
          <LegalBullet>Vínculos ativos com empresas e unidades.</LegalBullet>
          <LegalBullet>
            Avatar, preferências, tokens de notificação e localização vinculada
            diretamente ao usuário, quando não houver obrigação de retenção.
          </LegalBullet>
        </LegalSection>

        <LegalSection title="O que pode ser preservado">
          <LegalParagraph>
            Rotas, comprovantes, ocorrências, registros fiscais, de segurança ou
            auditoria pertencentes à empresa podem ser mantidos pelo prazo
            contratual ou legal necessário. Nesses casos, a conta é desvinculada
            e os registros são anonimizados ou mantidos com acesso restrito.
          </LegalParagraph>
        </LegalSection>

        <View style={styles(theme).actions}>
          {sessionLoading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : session ? (
            <TouchableOpacity
              style={styles(theme).deleteButton}
              onPress={() => setConfirmVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Excluir minha conta"
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={theme.colors.white}
              />
              <Text style={styles(theme).deleteButtonText}>
                Excluir minha conta
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles(theme).primaryButton}
              onPress={() => router.push('/auth/login')}
              accessibilityRole="button"
            >
              <Text style={styles(theme).primaryButtonText}>
                Entrar para excluir agora
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles(theme).emailButton}
            onPress={() =>
              Linking.openURL(
                'mailto:contato@rotamestre.tec.br?subject=Solicitação%20de%20exclusão%20de%20conta%20Rota%20Mestre',
              )
            }
            accessibilityRole="link"
          >
            <Text style={styles(theme).emailButtonText}>
              Solicitar exclusão por e-mail
            </Text>
          </TouchableOpacity>
        </View>
      </LegalPage>

      <Dialog
        visible={confirmVisible}
        variant="destructive"
        type="danger"
        title="Excluir conta permanentemente?"
        message="Esta ação encerra sua sessão e não pode ser desfeita. Digite EXCLUIR para confirmar."
        destructiveConfirmText="EXCLUIR"
        confirmText="Excluir conta"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmVisible(false)}
      />
      <Dialog
        visible={result.visible}
        variant="alert"
        type={result.type}
        title={result.title}
        message={result.message}
        onConfirm={() => {
          setResult((current) => ({ ...current, visible: false }));
          if (result.type === 'success') router.replace('/auth/login');
        }}
      />
    </>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    actions: {
      gap: theme.spacing.md,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.xl,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: theme.colors.white,
      fontFamily: theme.typography.fontSansSemiBold,
    },
    deleteButton: {
      backgroundColor: theme.colors.error,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    deleteButtonText: {
      color: theme.colors.white,
      fontFamily: theme.typography.fontSansSemiBold,
    },
    emailButton: {
      borderColor: theme.colors.primary,
      borderWidth: 1,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      alignItems: 'center',
    },
    emailButtonText: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontSansSemiBold,
    },
  });

/** Invólucro com ErrorBoundary — ver comentário em app/auth/login.tsx. */
export default function ExclusaoDeConta() {
  return (
    <ErrorBoundary>
      <ExclusaoDeContaContent />
    </ErrorBoundary>
  );
}
