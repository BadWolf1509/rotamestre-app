import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';

import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StyleSheet } from '@/utils/styles';

interface GestorElegivel {
  id: string;
  nome: string;
  email: string;
  created_at: string;
}

export default function TransferirGestaoScreen() {
  const router = useRouter();
  const { userData, loading: userLoading } = useUser();
  const { toast: toastState, showToast, hideToast } = useToast();
  const [gestores, setGestores] = useState<GestorElegivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGestor, setSelectedGestor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [transferring, setTransferring] = useState(false);

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
      console.error('Erro ao carregar gestores:', error);
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
      Alert.alert('Erro', 'Digite "TRANSFERIR" para confirmar a operação.');
      return;
    }

    if (!selectedGestor) return;

    const novoGestor = gestores.find((g) => g.id === selectedGestor);
    if (!novoGestor) return;

    try {
      setTransferring(true);

      // Iniciar transação: remover do atual, adicionar ao novo
      // 1. Remover is_gestor_principal do atual
      const { error: removeError } = await supabase
        .from('usuarios')
        .update({ is_gestor_principal: false })
        .eq('id', userData!.id);

      if (removeError) throw removeError;

      // 2. Adicionar is_gestor_principal ao novo
      const { error: addError } = await supabase
        .from('usuarios')
        .update({ is_gestor_principal: true })
        .eq('id', selectedGestor);

      if (addError) {
        // Reverter mudança anterior
        await supabase
          .from('usuarios')
          .update({ is_gestor_principal: true })
          .eq('id', userData!.id);
        throw addError;
      }

      // 3. Registrar log da transferência (opcional, se você tiver tabela de logs)
      // await supabase.from('logs').insert({
      //   tipo: 'transferencia_gestao',
      //   usuario_id: userData!.id,
      //   novo_gestor_id: selectedGestor,
      //   unidade_id: userData!.unidade_id,
      // });

      Alert.alert(
        'Transferência Concluída!',
        `A gestão principal foi transferida para ${novoGestor.nome}. Você continuará como gestor, mas sem privilégios de gestor principal.`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/gestor/dashboard');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Erro ao transferir gestão:', error);
      Alert.alert(
        'Erro',
        'Não foi possível transferir a gestão. Tente novamente ou entre em contato com o suporte.'
      );
    } finally {
      setTransferring(false);
    }
  }

  if (userLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D5A9C" />
        <Text style={styles.loadingText}>Carregando gestores...</Text>
      </View>
    );
  }

  // Verificar se é gestor principal
  if (!userData?.is_gestor_principal) {
    return (
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
    );
  }

  const selectedGestorData = gestores.find((g) => g.id === selectedGestor);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Transferir Gestão Principal</Text>
            <Text style={styles.headerSubtitle}>
              {userData?.unidades?.nome}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Aviso Importante */}
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️ Atenção</Text>
          <Text style={styles.warningText}>
            Esta ação é irreversível e transferirá todos os privilégios de gestor
            principal para outro gestor. Você continuará como gestor normal, mas
            perderá acesso às configurações da unidade, gestão de membros e esta
            função de transferência.
          </Text>
        </View>

        {/* Modo de Confirmação */}
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
                <Text style={styles.confirmationKeyword}>TRANSFERIR</Text> abaixo:
              </Text>

              <TextInput
                style={styles.confirmationInput}
                value={confirmationText}
                onChangeText={setConfirmationText}
                placeholder="Digite TRANSFERIR"
                autoCapitalize="characters"
                autoFocus
              />

              <View style={styles.confirmationButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={handleCancelConfirmation}
                  disabled={transferring}
                >
                  <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.buttonDanger,
                    confirmationText !== 'TRANSFERIR' && styles.buttonDisabled,
                  ]}
                  onPress={handleConfirmTransfer}
                  disabled={confirmationText !== 'TRANSFERIR' || transferring}
                >
                  {transferring ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Confirmar Transferência</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <>
            {/* Lista de Gestores Elegíveis */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Selecione o Novo Gestor Principal
              </Text>
              <Text style={styles.sectionSubtitle}>
                Apenas gestores ativos podem receber a gestão principal.
              </Text>

              {gestores.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    Nenhum gestor elegível encontrado
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    Você precisa ter pelo menos outro gestor ativo na unidade para
                    transferir a gestão.
                  </Text>
                </View>
              ) : (
                gestores.map((gestor) => (
                  <TouchableOpacity
                    key={gestor.id}
                    style={styles.gestorCard}
                    onPress={() => handleSelectGestor(gestor.id)}
                  >
                    <View style={styles.gestorInfo}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {gestor.nome.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.gestorDetails}>
                        <Text style={styles.gestorNome}>{gestor.nome}</Text>
                        <Text style={styles.gestorEmail}>{gestor.email}</Text>
                        <Text style={styles.gestorData}>
                          Membro desde{' '}
                          {new Date(gestor.created_at).toLocaleDateString('pt-BR')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.gestorArrow}>→</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Toast de Feedback */}
      <Toast {...toastState} onDismiss={hideToast} />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
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
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: theme.colors.errorLight,
    borderWidth: 2,
    borderColor: theme.colors.error,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.error,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
    color: theme.colors.error,
    lineHeight: 20,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  gestorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    marginBottom: 12,
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
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.surface,
  },
  gestorDetails: {
    flex: 1,
  },
  gestorNome: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  gestorEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  gestorData: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  gestorArrow: {
    fontSize: 20,
    color: theme.colors.primary,
    marginLeft: 12,
  },
  confirmationSection: {
    flex: 1,
  },
  confirmationCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 24,
    borderWidth: 2,
    borderColor: theme.colors.error,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.error,
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmationText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  selectedGestorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 12,
    marginBottom: 24,
  },
  selectedGestorNome: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  selectedGestorEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  confirmationInstructions: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationKeyword: {
    fontWeight: 'bold',
    color: theme.colors.error,
  },
  confirmationInput: {
    borderWidth: 2,
    borderColor: theme.colors.error,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 24,
    backgroundColor: theme.colors.surface,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  buttonDanger: {
    backgroundColor: theme.colors.error,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  buttonTextSecondary: {
    color: theme.colors.text,
  },
}));
