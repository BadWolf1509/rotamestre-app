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

import { DesktopModal } from '@/components/desktop/DesktopModal';
import { useResponsive } from '@/hooks/useResponsive';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type MotoristaResumo = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
};

type VinculacaoMotorista = {
  usuario_id: string;
  usuarios: MotoristaResumo | null;
};

export interface ChangeDriverModalProps {
  visible: boolean;
  currentMotoristaId?: string;
  currentMotoristaNome?: string;
  unidadeId: string;
  onConfirm: (newMotoristaId: string, newMotoristaNome: string) => void;
  onCancel: () => void;
}

export function ChangeDriverModal({
  visible,
  currentMotoristaId,
  currentMotoristaNome,
  unidadeId,
  onConfirm,
  onCancel,
}: ChangeDriverModalProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const [motoristas, setMotoristas] = useState<MotoristaResumo[]>([]);
  const [selectedMotoristaId, setSelectedMotoristaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMotoristas, setIsLoadingMotoristas] = useState(true);

  // Carregar motoristas da unidade
  const loadMotoristas = useCallback(async () => {
    if (!unidadeId) return;

    try {
      setIsLoadingMotoristas(true);

      const { data: vinculacoesData, error: vinculacoesError } = await supabase
        .from('usuario_unidades')
        .select(`
          usuario_id,
          usuarios (id, nome, email, ativo)
        `)
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
      console.error('Erro ao carregar motoristas:', error);
    } finally {
      setIsLoadingMotoristas(false);
    }
  }, [unidadeId]);

  // Carregar motoristas ao abrir modal
  useEffect(() => {
    if (visible) {
      loadMotoristas();
      setSelectedMotoristaId(null);
    }
  }, [visible, loadMotoristas]);

  const handleConfirm = () => {
    if (!selectedMotoristaId) return;

    const selectedMotorista = motoristas.find((m) => m.id === selectedMotoristaId);
    if (!selectedMotorista) return;

    setIsLoading(true);
    onConfirm(selectedMotoristaId, selectedMotorista.nome);
  };

  const otherMotoristas = motoristas.filter((m) => m.id !== currentMotoristaId);

  return (
    <DesktopModal
      visible={visible}
      onClose={onCancel}
      title="Trocar Motorista"
      maxWidth={450}
    >
      {/* Body */}
      <View style={[styles.body, isDesktop && styles.bodyCompact]}>
        {/* Motorista Atual */}
        <View style={[styles.currentDriverSection, isDesktop && styles.currentDriverSectionCompact]}>
          <Text style={[styles.sectionLabel, isDesktop && styles.sectionLabelCompact]}>Motorista atual</Text>
          <View style={[styles.currentDriverCard, isDesktop && styles.currentDriverCardCompact]}>
            <Ionicons name="person-circle" size={isDesktop ? 24 : 32} color={theme.colors.gray400} />
            <Text style={[styles.currentDriverName, isDesktop && styles.currentDriverNameCompact]}>
              {currentMotoristaNome || 'Sem motorista'}
            </Text>
          </View>
        </View>

        {/* Divider com seta */}
        <View style={[styles.dividerContainer, isDesktop && styles.dividerContainerCompact]}>
          <View style={styles.dividerLine} />
          <Ionicons name="arrow-down" size={isDesktop ? 16 : 20} color={theme.colors.gray400} />
          <View style={styles.dividerLine} />
        </View>

        {/* Lista de motoristas */}
        <View style={styles.newDriverSection}>
          <Text style={[styles.sectionLabel, isDesktop && styles.sectionLabelCompact]}>Selecione o novo motorista</Text>

          {isLoadingMotoristas ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Carregando motoristas...</Text>
            </View>
          ) : otherMotoristas.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={32} color={theme.colors.gray400} />
              <Text style={styles.emptyText}>
                {motoristas.length === 0
                  ? 'Nenhum motorista cadastrado na unidade'
                  : 'Não há outros motoristas disponíveis'}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.motoristasList} showsVerticalScrollIndicator={false}>
              {otherMotoristas.map((motorista) => (
                <TouchableOpacity
                  key={motorista.id}
                  style={[
                    styles.motoristaItem,
                    isDesktop && styles.motoristaItemCompact,
                    selectedMotoristaId === motorista.id && styles.motoristaItemSelected,
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
                    <Text style={[styles.motoristaNome, isDesktop && styles.motoristaNomeCompact]}>
                      {motorista.nome}
                    </Text>
                    <Text style={styles.motoristaEmail}>{motorista.email}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, isDesktop && styles.footerCompact]}>
        <TouchableOpacity
          style={[styles.cancelButton, isDesktop && styles.cancelButtonCompact]}
          onPress={onCancel}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Text style={[styles.cancelButtonText, isDesktop && styles.cancelButtonTextCompact]}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.confirmButton,
            isDesktop && styles.confirmButtonCompact,
            (!selectedMotoristaId || isLoading) && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          activeOpacity={0.8}
          disabled={!selectedMotoristaId || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={[styles.confirmButtonText, isDesktop && styles.confirmButtonTextCompact]}>Confirmar</Text>
          )}
        </TouchableOpacity>
      </View>
    </DesktopModal>
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
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.gray50,
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    marginTop: theme.spacing.sm,
  },
  footerCompact: {
    gap: theme.desktop.modal.footerGap,
    padding: theme.desktop.modal.footerPadding,
    marginTop: 0,
  },
  cancelButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    minWidth: 100,
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transitionProperty: 'all',
      transitionDuration: '0.2s',
    }),
  },
  cancelButtonCompact: {
    paddingHorizontal: theme.desktop.button.paddingHorizontal,
    paddingVertical: theme.desktop.dialog.buttonPaddingV,
    minWidth: 80,
  },
  cancelButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  cancelButtonTextCompact: {
    fontSize: theme.desktop.button.fontSize,
  },
  confirmButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    minWidth: 100,
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transitionProperty: 'all',
      transitionDuration: '0.2s',
    }),
  },
  confirmButtonCompact: {
    paddingHorizontal: theme.desktop.button.paddingHorizontal,
    paddingVertical: theme.desktop.dialog.buttonPaddingV,
    minWidth: 80,
  },
  confirmButtonDisabled: {
    backgroundColor: theme.colors.gray300,
  },
  confirmButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  confirmButtonTextCompact: {
    fontSize: theme.desktop.button.fontSize,
  },
}));
