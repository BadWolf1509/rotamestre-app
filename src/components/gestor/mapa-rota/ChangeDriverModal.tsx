/**
 * ChangeDriverModal - Modal para trocar motorista de uma rota
 * Só pode ser usado em rotas com status 'pendente'
 *
 * Desktop:
 * - Densidade compacta
 * - Hover states nos items
 *
 * Mobile:
 * - Bottom sheet
 * - Touch-friendly targets
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
// Note: Platform is still used for web cursor styles in motoristaItem

import { DesktopModal } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useResponsive } from '@/hooks/useResponsive';
import { nomeMotoristaDaRota } from '@/lib/gestor/consultaRotas';
import { logger } from '@/lib/logger';
import {
  confirmarMotoristaNuncaEntrou,
  ROTULO_NUNCA_ENTROU,
} from '@/lib/motorista/confirmarMotoristaNuncaEntrou';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type MotoristaResumo = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  ultimo_login: string | null;
};

type VinculacaoMotorista = {
  usuario_id: string;
  usuarios: MotoristaResumo | null;
};

type ErroMotoristas = { mensagem: string; podeTentarDeNovo: boolean };

const ERRO_AO_CARREGAR: ErroMotoristas = {
  mensagem: 'Não foi possível carregar os motoristas.',
  podeTentarDeNovo: true,
};
// Repetir a busca não muda nada: sem botão de tentar de novo.
const ROTA_SEM_LOJA: ErroMotoristas = {
  mensagem: 'Esta rota não tem loja: não há motoristas para listar.',
  podeTentarDeNovo: false,
};

export interface ChangeDriverModalProps {
  visible: boolean;
  currentMotoristaId?: string;
  currentMotoristaNome?: string;
  unidadeId: string;
  /** Pode ser assíncrono: o botão fica carregando até ele terminar. */
  onConfirm: (
    newMotoristaId: string,
    newMotoristaNome: string,
  ) => void | Promise<void>;
  onCancel: () => void;
  /**
   * Outra ação da rota em andamento (cancelar, remover parada…): a trava do
   * handler recusaria a troca, e o modal fecharia sem trocar nada. Enquanto
   * `true`, "Confirmar" fica carregando e desabilitado.
   */
  ocupado?: boolean;
}

export function ChangeDriverModal({
  visible,
  currentMotoristaId,
  currentMotoristaNome,
  unidadeId,
  onConfirm,
  onCancel,
  ocupado = false,
}: ChangeDriverModalProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const { showConfirm, AlertDialog } = useAlert();
  const [motoristas, setMotoristas] = useState<MotoristaResumo[]>([]);
  const [selectedMotoristaId, setSelectedMotoristaId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMotoristas, setIsLoadingMotoristas] = useState(true);
  // Falha da lista: mostrada com "Tentar de novo". Antes a falha virava
  // "Nenhum motorista cadastrado", e rota sem loja ficava carregando.
  const [erroMotoristas, setErroMotoristas] = useState<ErroMotoristas | null>(
    null,
  );

  // Carregar motoristas da unidade
  const loadMotoristas = useCallback(async () => {
    if (!unidadeId) {
      logger.warn(
        '[ChangeDriverModal] Rota sem loja: não há como listar motoristas',
      );
      setMotoristas([]);
      setErroMotoristas(ROTA_SEM_LOJA);
      setIsLoadingMotoristas(false);
      return;
    }

    try {
      setIsLoadingMotoristas(true);
      setErroMotoristas(null);

      const { data: vinculacoesData, error: vinculacoesError } = await supabase
        .from('usuario_unidades')
        .select(
          `
          usuario_id,
          usuarios (id, nome, email, ativo, ultimo_login)
        `,
        )
        .eq('unidade_id', unidadeId)
        .eq('papel', 'motorista')
        .eq('ativo', true)
        .returns<VinculacaoMotorista[]>();

      if (vinculacoesError) throw vinculacoesError;

      // Extrair usuários ativos e filtrar o motorista atual
      const motoristasData = vinculacoesData
        ?.map((v) => v.usuarios)
        .filter((u): u is MotoristaResumo => u !== null && u.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome));

      setMotoristas(motoristasData || []);
    } catch (error) {
      logger.error('Erro ao carregar motoristas:', error);
      setMotoristas([]);
      setErroMotoristas(ERRO_AO_CARREGAR);
    } finally {
      setIsLoadingMotoristas(false);
    }
  }, [unidadeId]);

  // Carregar motoristas ao abrir modal. O componente segue montado com o
  // modal fechado: a confirmação anterior não pode reabrir carregando.
  useEffect(() => {
    if (visible) {
      loadMotoristas();
      setSelectedMotoristaId(null);
      setIsLoading(false);
    }
  }, [visible, loadMotoristas]);

  const handleConfirm = async () => {
    if (!selectedMotoristaId || ocupado) return;

    const selectedMotorista = motoristas.find(
      (m) => m.id === selectedMotoristaId,
    );
    if (!selectedMotorista) return;

    if (selectedMotorista.ultimo_login === null) {
      const seguir = await confirmarMotoristaNuncaEntrou(
        showConfirm,
        { nome: selectedMotorista.nome, nuncaEntrou: true },
        'trocar',
      );
      if (!seguir) return;
    }

    setIsLoading(true);
    try {
      await onConfirm(selectedMotoristaId, selectedMotorista.nome);
    } catch (error) {
      // Quem chama mostra o erro (toast); aqui o modal só não pode ficar
      // preso carregando, para o gestor tentar de novo ou cancelar.
      logger.error('[ChangeDriverModal] Falha ao trocar motorista', error);
    } finally {
      setIsLoading(false);
    }
  };

  const otherMotoristas = motoristas.filter((m) => m.id !== currentMotoristaId);

  return (
    <>
      <DesktopModal
        visible={visible}
        onClose={onCancel}
        title="Trocar Motorista"
        maxWidth={450}
        primaryButton={{
          text: 'Confirmar',
          onPress: handleConfirm,
          loading: isLoading || ocupado,
          disabled: !selectedMotoristaId || ocupado,
        }}
        secondaryButton={{
          text: 'Cancelar',
          onPress: onCancel,
          disabled: isLoading,
        }}
      >
        {/* Body */}
        <View style={[styles.body, isDesktop && styles.bodyCompact]}>
          {/* Motorista Atual */}
          <View
            style={[
              styles.currentDriverSection,
              isDesktop && styles.currentDriverSectionCompact,
            ]}
          >
            <Text
              style={[
                styles.sectionLabel,
                isDesktop && styles.sectionLabelCompact,
              ]}
            >
              Motorista atual
            </Text>
            <View
              style={[
                styles.currentDriverCard,
                isDesktop && styles.currentDriverCardCompact,
              ]}
            >
              <Ionicons
                name="person-circle"
                size={isDesktop ? 24 : 32}
                color={theme.colors.gray400}
              />
              <Text
                style={[
                  styles.currentDriverName,
                  isDesktop && styles.currentDriverNameCompact,
                ]}
              >
                {nomeMotoristaDaRota(currentMotoristaNome, currentMotoristaId)}
              </Text>
            </View>
          </View>

          {/* Divider com seta */}
          <View
            style={[
              styles.dividerContainer,
              isDesktop && styles.dividerContainerCompact,
            ]}
          >
            <View style={styles.dividerLine} />
            <Ionicons
              name="arrow-down"
              size={isDesktop ? 16 : 20}
              color={theme.colors.gray400}
            />
            <View style={styles.dividerLine} />
          </View>

          {/* Lista de motoristas */}
          <View style={styles.newDriverSection}>
            <Text
              style={[
                styles.sectionLabel,
                isDesktop && styles.sectionLabelCompact,
              ]}
            >
              Selecione o novo motorista
            </Text>

            {isLoadingMotoristas ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Carregando motoristas...</Text>
              </View>
            ) : erroMotoristas ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={32}
                  color={theme.colors.gray400}
                />
                <Text style={styles.emptyText}>{erroMotoristas.mensagem}</Text>
                {erroMotoristas.podeTentarDeNovo && (
                  <TouchableOpacity
                    onPress={loadMotoristas}
                    style={styles.retryButton}
                    accessibilityRole="button"
                    accessibilityLabel="Tentar de novo carregar os motoristas"
                  >
                    <Text style={styles.retryText}>Tentar de novo</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : otherMotoristas.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={32}
                  color={theme.colors.gray400}
                />
                <Text style={styles.emptyText}>
                  {motoristas.length === 0
                    ? 'Nenhum motorista cadastrado na unidade'
                    : 'Não há outros motoristas disponíveis'}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.motoristasList}
                showsVerticalScrollIndicator={false}
              >
                {otherMotoristas.map((motorista) => (
                  <TouchableOpacity
                    key={motorista.id}
                    style={[
                      styles.motoristaItem,
                      isDesktop && styles.motoristaItemCompact,
                      selectedMotoristaId === motorista.id &&
                        styles.motoristaItemSelected,
                    ]}
                    onPress={() => setSelectedMotoristaId(motorista.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={
                        selectedMotoristaId === motorista.id
                          ? 'checkmark-circle'
                          : 'ellipse-outline'
                      }
                      size={isDesktop ? 18 : 22}
                      color={
                        selectedMotoristaId === motorista.id
                          ? theme.colors.primary
                          : theme.colors.gray400
                      }
                    />
                    <View style={styles.motoristaInfo}>
                      <Text
                        style={[
                          styles.motoristaNome,
                          isDesktop && styles.motoristaNomeCompact,
                        ]}
                      >
                        {motorista.nome}
                      </Text>
                      <Text style={styles.motoristaEmail}>
                        {motorista.email}
                      </Text>
                      {motorista.ultimo_login === null && (
                        <View style={styles.nuncaEntrouBadge}>
                          <Text style={styles.nuncaEntrouText}>
                            {ROTULO_NUNCA_ENTROU}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </DesktopModal>
      {AlertDialog}
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  body: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  bodyCompact: {
    paddingHorizontal: theme.desktop.section.padding,
    paddingBottom: theme.desktop.section.padding,
  },
  currentDriverSection: {
    marginBottom: theme.spacing.md,
  },
  currentDriverSectionCompact: {
    marginBottom: theme.desktop.section.gap,
  },
  sectionLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabelCompact: {
    fontSize: theme.desktop.input.fontSize - 2,
    marginBottom: 4,
  },
  currentDriverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  currentDriverCardCompact: {
    gap: theme.spacing.sm,
    padding: theme.desktop.section.padding,
  },
  currentDriverName: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
  },
  currentDriverNameCompact: {
    fontSize: theme.desktop.input.fontSize,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  dividerContainerCompact: {
    marginVertical: theme.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.gray200,
  },
  newDriverSection: {
    marginTop: theme.spacing.sm,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  loadingText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  motoristasList: {
    maxHeight: 200,
  },
  retryButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  retryText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  motoristaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transitionProperty: 'all',
      transitionDuration: '0.15s',
    }),
  },
  motoristaItemCompact: {
    gap: theme.spacing.sm,
    padding: theme.desktop.section.padding,
    marginBottom: theme.desktop.section.gap,
  },
  motoristaItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}08`,
  },
  motoristaInfo: {
    flex: 1,
  },
  motoristaNome: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  motoristaNomeCompact: {
    fontSize: theme.desktop.input.fontSize,
  },
  motoristaEmail: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
  },
  nuncaEntrouBadge: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.warning + '20',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
  },
  nuncaEntrouText: {
    color: theme.colors.warning,
    fontSize: 11,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
