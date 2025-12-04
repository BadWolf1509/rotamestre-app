/**
 * ============================================
 * SeletorUnidade - Componente para trocar de unidade
 * ============================================
 *
 * Permite que usuários com múltiplas unidades alternem entre elas.
 * Mobile-first: Header com nome da unidade + modal de seleção.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';
import { Modal } from './Modal';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { UsuarioUnidade } from '@/types/usuario';

interface SeletorUnidadeProps {
  /** Mostrar apenas o trigger (para uso em headers) */
  compact?: boolean;
  /** Callback quando unidade é trocada */
  onUnidadeChange?: (unidadeId: string) => void;
}

/**
 * Componente trigger que mostra a unidade ativa no header
 */
export function SeletorUnidadeTrigger({ onPress }: { onPress: () => void }) {
  const { theme } = useUnistyles();
  const { unidadeAtivaData, temMultiplasUnidades, loading } = useUnidadeAtiva();

  if (loading) {
    return (
      <View style={styles.trigger}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.trigger}
      onPress={temMultiplasUnidades ? onPress : undefined}
      activeOpacity={temMultiplasUnidades ? 0.7 : 1}
      disabled={!temMultiplasUnidades}
    >
      <Ionicons
        name="business-outline"
        size={18}
        color={theme.colors.primary}
        style={styles.triggerIcon}
      />
      <Text style={styles.triggerText} numberOfLines={1}>
        {unidadeAtivaData?.nome || 'Selecione uma unidade'}
      </Text>
      {temMultiplasUnidades && (
        <Ionicons
          name="chevron-down"
          size={16}
          color={theme.colors.gray500}
          style={styles.triggerChevron}
        />
      )}
    </TouchableOpacity>
  );
}

/**
 * Item da lista de unidades
 */
function UnidadeItem({
  vinculacao,
  isSelected,
  onSelect,
}: {
  vinculacao: UsuarioUnidade;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { theme } = useUnistyles();
  const unidade = vinculacao.unidades;

  return (
    <TouchableOpacity
      style={[
        styles.unidadeItem,
        isSelected && styles.unidadeItemSelected,
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.unidadeInfo}>
        <View style={styles.unidadeHeader}>
          <Ionicons
            name="business"
            size={20}
            color={isSelected ? theme.colors.primary : theme.colors.gray600}
          />
          <Text
            style={[
              styles.unidadeNome,
              isSelected && styles.unidadeNomeSelected,
            ]}
            numberOfLines={1}
          >
            {unidade?.nome || 'Unidade sem nome'}
          </Text>
        </View>
        {unidade?.cidade && (
          <Text style={styles.unidadeCidade}>{unidade.cidade}</Text>
        )}
        <View style={styles.unidadeMeta}>
          <Text style={styles.unidadePapel}>
            {vinculacao.papel === 'gestor' ? 'Gestor' : 'Motorista'}
          </Text>
          {vinculacao.is_principal && (
            <View style={styles.principalBadge}>
              <Text style={styles.principalText}>Principal</Text>
            </View>
          )}
        </View>
      </View>
      {isSelected && (
        <Ionicons
          name="checkmark-circle"
          size={24}
          color={theme.colors.primary}
        />
      )}
    </TouchableOpacity>
  );
}

/**
 * Componente principal: Header trigger + Modal de seleção
 */
export function SeletorUnidade({ compact, onUnidadeChange }: SeletorUnidadeProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const {
    unidadeAtiva,
    vinculacoes,
    temMultiplasUnidades,
    trocarUnidade,
    loading,
  } = useUnidadeAtiva();

  const handleOpenModal = useCallback(() => {
    if (temMultiplasUnidades) {
      setModalVisible(true);
    }
  }, [temMultiplasUnidades]);

  const handleSelectUnidade = useCallback(async (unidadeId: string) => {
    if (unidadeId !== unidadeAtiva) {
      await trocarUnidade(unidadeId);
      onUnidadeChange?.(unidadeId);
    }
    setModalVisible(false);
  }, [unidadeAtiva, trocarUnidade, onUnidadeChange]);

  const renderUnidade = useCallback(({ item }: { item: UsuarioUnidade }) => (
    <UnidadeItem
      vinculacao={item}
      isSelected={item.unidade_id === unidadeAtiva}
      onSelect={() => handleSelectUnidade(item.unidade_id)}
    />
  ), [unidadeAtiva, handleSelectUnidade]);

  // Se não tem múltiplas unidades, não mostra o seletor
  if (!temMultiplasUnidades && compact) {
    return null;
  }

  return (
    <>
      <SeletorUnidadeTrigger onPress={handleOpenModal} />

      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Selecione a Unidade"
        size="medium"
        animationType="slide"
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Carregando unidades...</Text>
          </View>
        ) : (
          <FlatList
            data={vinculacoes}
            keyExtractor={(item) => item.id}
            renderItem={renderUnidade}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  // Trigger styles
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    maxWidth: 200,
  },
  triggerIcon: {
    marginRight: theme.spacing.xs,
  },
  triggerText: {
    fontFamily: theme.typography.fontSansMedium,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray800,
    flex: 1,
  },
  triggerChevron: {
    marginLeft: theme.spacing.xs,
  },

  // Modal styles
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray600,
  },

  listContent: {
    paddingBottom: theme.spacing.md,
  },

  separator: {
    height: 1,
    backgroundColor: theme.colors.gray200,
    marginVertical: theme.spacing.xs,
  },

  // Unidade item styles
  unidadeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
  },
  unidadeItemSelected: {
    backgroundColor: theme.colors.primaryLight,
  },

  unidadeInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  unidadeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xxs,
  },
  unidadeNome: {
    fontFamily: theme.typography.fontSansMedium,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray800,
    marginLeft: theme.spacing.xs,
    flex: 1,
  },
  unidadeNomeSelected: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansBold,
  },
  unidadeCidade: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    marginLeft: 28, // Alinha com o nome (ícone 20 + spacing.xs 8)
  },

  unidadeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xxs,
    marginLeft: 28,
  },
  unidadePapel: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray600,
    textTransform: 'capitalize',
  },
  principalBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.xs,
  },
  principalText: {
    fontFamily: theme.typography.fontSansMedium,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.white,
  },
}));

export default SeletorUnidade;
