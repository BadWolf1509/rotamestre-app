import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  DesktopPageLayout,
  Button,
  Input,
  MobileCard,
  MobileLoading,
  Text,
  Toast,
} from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { StyleSheet, type Theme } from '@/utils/styles';

interface GestorElegivel {
  id: string;
  nome: string;
  email: string;
  created_at: string;
}

export default function TransferirGestaoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userData, loading: userLoading } = useUser();
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });
  const { toast: toastState, showToast, hideToast } = useToast();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
  const { isDesktop } = useResponsive();
  const pageMeta = getGestorPageMeta('transferirUnidade');
  const [gestores, setGestores] = useState<GestorElegivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGestor, setSelectedGestor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [transferring, setTransferring] = useState(false);
  const isDesktopView = isDesktop;
  const isLoading = userLoading || loading;
  const isGestorPrincipal = userData?.is_gestor_principal === true;

  const loadGestoresElegiveis = useCallback(async () => {
    const unidadeId = userData?.unidade_id;
    if (!unidadeId) {
      setGestores([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Buscar apenas gestores ativos, excluindo o gestor principal atual
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email, created_at')
        .eq('unidade_id', unidadeId)
        .eq('papel', 'gestor')
        .eq('ativo', true)
        .eq('is_gestor_principal', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setGestores(data || []);
    } catch (error) {
      logger.error('Erro ao carregar gestores', error);
      showToast('Erro ao carregar gestores', 'error', 4000);
    } finally {
      setLoading(false);
    }
  }, [showToast, userData?.unidade_id]);

  useEffect(() => {
    loadGestoresElegiveis();
  }, [loadGestoresElegiveis]);

  function handleSelectGestor(gestorId: string) {
    setSelectedGestor(gestorId);
    setConfirming(true);
  }

  function handleCancelConfirmation() {
    setConfirming(false);
    setSelectedGestor(null);
    setConfirmationText('');
  }

  async function handleConfirmTransfer() {
    if (confirmationText !== 'TRANSFERIR') {
      showWarning('Erro', 'Digite "TRANSFERIR" para confirmar a operação.');
      return;
    }

    if (!selectedGestor) return;

    const novoGestor = gestores.find((g) => g.id === selectedGestor);
    if (!novoGestor) return;

    try {
      setTransferring(true);

      const { error } = await supabase.rpc('transferir_gestao_principal', {
        p_unidade_id: userData!.unidade_id,
        p_novo_gestor_id: selectedGestor,
      });

      if (error) throw error;

      showSuccess(
        'Transferência Concluída!',
        `A gestão principal foi transferida para ${novoGestor.nome}. Você continuará como gestor, mas sem privilégios de gestor principal.`,
        () => router.replace('/gestor/inicio'),
      );
    } catch (error) {
      logger.error('Erro ao transferir gestão', error);
      showError({
        title: 'Erro',
        message:
          'Não foi possível transferir a gestão. Tente novamente ou entre em contato com o suporte.',
      });
    } finally {
      setTransferring(false);
    }
  }

  // Verificar se é gestor principal
  if (!userData?.is_gestor_principal) {
    return (
      <ErrorBoundary>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View>
                <Text style={styles.headerTitle}>Transferir Gestão</Text>
                <Text style={styles.headerSubtitle}>
                  {userData?.unidades?.nome}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Apenas o gestor principal pode transferir a gestão.
            </Text>
          </View>
        </View>
      </ErrorBoundary>
    );
  }

  const selectedGestorData = gestores.find((g) => g.id === selectedGestor);

  const renderMainContent = () => (
    <>
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>⚠️ Atenção</Text>
        <Text style={styles.warningText}>
          Esta ação é irreversível e transferirá todos os privilégios de gestor
          principal para outro gestor. Você continuará como gestor normal, mas
          perderá acesso às configurações da unidade, gestão de membros e esta
          função de transferência.
        </Text>
      </View>

      {confirming ? (
        <View style={styles.confirmationSection}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>
              Confirmar Transferência
            </Text>
            <Text style={styles.confirmationText}>
              Você está transferindo a gestão principal para:
            </Text>
            <View style={styles.selectedGestorCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {selectedGestorData?.nome.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.selectedGestorNome}>
                  {selectedGestorData?.nome}
                </Text>
                <Text style={styles.selectedGestorEmail}>
                  {selectedGestorData?.email}
                </Text>
              </View>
            </View>
            <Text style={styles.confirmationInstructions}>
              Para confirmar, digite{' '}
              <Text style={styles.confirmationKeyword}>TRANSFERIR</Text> no
              campo abaixo.
            </Text>
            <Input
              value={confirmationText}
              onChangeText={setConfirmationText}
              placeholder="TRANSFERIR"
              autoCapitalize="characters"
              size={isDesktopView ? 'small' : 'medium'}
              style={styles.confirmationInput}
              containerStyle={styles.confirmationInputContainer}
            />
            <View style={styles.confirmationButtons}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={handleCancelConfirmation}
                disabled={transferring}
                style={styles.confirmationButton}
              />
              <Button
                title="Confirmar"
                variant="danger"
                onPress={handleConfirmTransfer}
                loading={transferring}
                disabled={transferring}
                style={styles.confirmationButton}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>
            Selecione o novo gestor principal
          </Text>
          {gestores.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Não há outros gestores ativos disponíveis nesta unidade.
              </Text>
            </View>
          ) : (
            gestores.map((gestor) => (
              <TouchableOpacity
                key={gestor.id}
                style={[
                  styles.gestorItem,
                  selectedGestor === gestor.id && styles.gestorItemSelected,
                ]}
                onPress={() => handleSelectGestor(gestor.id)}
              >
                <View style={styles.avatarGestor}>
                  <Text style={styles.avatarText}>
                    {gestor.nome.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.gestorDetails}>
                  <Text style={styles.gestorNome}>{gestor.nome}</Text>
                  <Text style={styles.gestorEmail}>{gestor.email}</Text>
                  <Text style={styles.gestorData}>
                    Gestor desde{' '}
                    {new Date(gestor.created_at).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </>
  );

  const desktopActions = [
    {
      label: 'Voltar',
      icon: 'arrow-back-outline',
      variant: 'secondary',
      onPress: () => router.back(),
    },
  ];

  if (isDesktopView) {
    if (!isGestorPrincipal) {
      return (
        <ErrorBoundary>
          <DesktopPageLayout
            title={pageMeta.title}
            subtitle={userData?.unidades?.nome}
            breadcrumbs={pageMeta.breadcrumbs}
            userMenuTrigger={userMenuTrigger}
            userMenuItems={userMenuItems}
            loading={isLoading}
            actions={desktopActions}
          >
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                Apenas o gestor principal pode transferir a gestão.
              </Text>
            </View>
          </DesktopPageLayout>
          <Toast {...toastState} onDismiss={hideToast} />
          {AlertDialog}
          {logoutModal}
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary>
        <DesktopPageLayout
          title={pageMeta.title}
          subtitle={userData?.unidades?.nome}
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
          loading={isLoading}
          actions={desktopActions}
        >
          {renderMainContent()}
        </DesktopPageLayout>
        <Toast {...toastState} onDismiss={hideToast} />
        {AlertDialog}
        {logoutModal}
      </ErrorBoundary>
    );
  }

  if (isLoading) {
    return (
      <ErrorBoundary>
        <MobileLoading message="Carregando gestores..." />
        {logoutModal}
      </ErrorBoundary>
    );
  }

  if (!isGestorPrincipal) {
    return (
      <ErrorBoundary>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View>
                <Text style={styles.headerTitle}>Transferir Gestão</Text>
                <Text style={styles.headerSubtitle}>
                  {userData?.unidades?.nome}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Apenas o gestor principal pode transferir a gestão.
            </Text>
          </View>
        </View>
        {logoutModal}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: Math.max(20, insets.bottom + 20),
        }}
      >
        <View style={styles.mobileContent}>
          <MobileCard
            title="Transferir Gestão Principal"
            subtitle={userData?.unidades?.nome}
            variant="bordered"
          >
            {renderMainContent()}
          </MobileCard>
        </View>
      </ScrollView>

      <Toast {...toastState} onDismiss={hideToast} />
      {AlertDialog}
      {logoutModal}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  mobileContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: 'auto',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  header: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: theme.typography['3xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing['3xl'],
  },
  errorText: {
    fontSize: theme.typography.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: theme.colors.errorLight,
    borderWidth: 2,
    borderColor: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing['2xl'],
  },
  warningTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
  },
  warningText: {
    fontSize: theme.typography.sm,
    color: theme.colors.error,
    lineHeight: theme.typography.xl,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  sectionSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  emptyState: {
    padding: theme.spacing['3xl'],
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.xl,
  },
  gestorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  gestorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  avatarText: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.surface,
  },
  gestorDetails: {
    flex: 1,
  },
  gestorNome: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  gestorEmail: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  gestorData: {
    fontSize: theme.typography.xs,
    color: theme.colors.textSecondary,
  },
  gestorArrow: {
    fontSize: theme.typography.xl,
    color: theme.colors.primary,
    marginLeft: theme.spacing.md,
  },
  confirmationSection: {
    flex: 1,
  },
  confirmationCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['2xl'],
    borderWidth: 2,
    borderColor: theme.colors.error,
  },
  confirmationTitle: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  confirmationText: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  selectedGestorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing['2xl'],
  },
  selectedGestorNome: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  selectedGestorEmail: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
  },
  confirmationInstructions: {
    fontSize: theme.typography.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  confirmationKeyword: {
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.error,
  },
  confirmationInput: {
    textAlign: 'center',
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.base,
  },
  confirmationInputContainer: {
    marginBottom: theme.spacing['2xl'],
    borderWidth: 2,
    borderColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  confirmationButton: {
    flex: 1,
  },
  listSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  listTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  gestorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  gestorItemSelected: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: theme.colors.primaryBg,
  },
  avatarGestor: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
}));
