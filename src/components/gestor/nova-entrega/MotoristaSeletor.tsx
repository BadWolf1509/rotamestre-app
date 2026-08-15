/**
 * Componente para seleção de motorista
 * Suporta densidade compacta para desktop
 */

import { useRouter } from 'expo-router';
import React, { memo, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { MotoristaResumo } from './types';

export interface MotoristaSeletorProps {
  motoristas: MotoristaResumo[];
  motoristaSelecionado: string;
  onSelectMotorista: (id: string) => void;
}

export const MotoristaSeletor = memo(function MotoristaSeletor({
  motoristas,
  motoristaSelecionado,
  onSelectMotorista,
}: MotoristaSeletorProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const styles = createStyles(theme, isDesktop);
  const [search, setSearch] = useState('');
  const filteredDrivers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return motoristas;
    return motoristas.filter(
      (motorista) =>
        motorista.nome.toLowerCase().includes(normalized) ||
        motorista.email.toLowerCase().includes(normalized),
    );
  }, [motoristas, search]);

  return (
    <View style={styles.motoristaSection}>
      <Text style={styles.sectionTitle}>Selecionar Motorista</Text>
      {motoristas.length > 5 && (
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar motorista por nome ou e-mail"
          placeholderTextColor={theme.colors.gray400}
          accessibilityLabel="Buscar motorista"
        />
      )}
      {motoristas.length === 0 ? (
        // Beco sem saída do gestor novo: a unidade recém-criada não tem
        // motorista, mas "Nova Rota de Entrega" é a primeira ação do dashboard.
        // Sem esta saída dá para preencher paradas, geocodificar e otimizar, e
        // só descobrir no fim que a rota não pode ser concluída.
        <View style={styles.emptyState}>
          <Text style={styles.noMotoristas}>
            Nenhum motorista disponível nesta unidade
          </Text>
          <TouchableOpacity
            style={styles.emptyAction}
            onPress={() => router.push('/gestor/motoristas')}
            accessibilityLabel="Cadastrar motorista"
            accessibilityRole="button"
          >
            <Text style={styles.emptyActionText}>Cadastrar motorista</Text>
          </TouchableOpacity>
          <Text style={styles.emptyHint}>
            O rascunho desta rota fica salvo enquanto você cadastra.
          </Text>
        </View>
      ) : filteredDrivers.length === 0 ? (
        <Text style={styles.noMotoristas}>
          Nenhum motorista corresponde à busca
        </Text>
      ) : (
        filteredDrivers.map((motorista) => {
          const isSelecionado = motoristaSelecionado === motorista.id;

          return (
            <TouchableOpacity
              key={motorista.id}
              style={[
                styles.motoristaCard,
                isSelecionado && styles.motoristaCardActive,
              ]}
              onPress={() => onSelectMotorista(motorista.id)}
              activeOpacity={0.85}
              accessibilityLabel={`Selecionar motorista ${motorista.nome}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelecionado }}
            >
              <Text
                style={[
                  styles.motoristaNome,
                  isSelecionado && styles.motoristaNomeActive,
                ]}
              >
                {motorista.nome}
              </Text>
              <Text
                style={[
                  styles.motoristaEmail,
                  isSelecionado && styles.motoristaEmailActive,
                ]}
              >
                {motorista.email}
              </Text>
              <View style={styles.workloadRow}>
                {motorista.rotaEmAndamento && (
                  <View style={[styles.workloadBadge, styles.inProgressBadge]}>
                    <Text style={[styles.workloadText, styles.inProgressText]}>
                      Em rota
                    </Text>
                  </View>
                )}
                <View style={styles.workloadBadge}>
                  <Text style={styles.workloadText}>
                    {motorista.rotasPendentes ?? 0} rota(s) pendente(s)
                  </Text>
                </View>
                <View style={styles.workloadBadge}>
                  <Text style={styles.workloadText}>
                    {motorista.paradasPendentes ?? 0} parada(s)
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
});

const createStyles = (theme: Theme, isDesktop: boolean) =>
  StyleSheet.create({
    motoristaSection: {
      marginBottom: isDesktop ? theme.spacing.lg : theme.spacing['2xl'],
    },
    sectionTitle: {
      fontSize: isDesktop ? theme.typography.base : theme.typography.lg,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray900,
      marginBottom: isDesktop ? theme.spacing.md : theme.spacing['2xl'],
    },
    noMotoristas: {
      color: theme.colors.gray500,
      fontStyle: 'italic',
      textAlign: 'center',
      padding: isDesktop ? theme.spacing.lg : theme.spacing['2xl'],
      fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.sm,
    },
    emptyState: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    emptyAction: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
    },
    emptyActionText: {
      color: theme.colors.white,
      fontFamily: theme.typography.fontSansSemiBold,
      fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.sm,
      textAlign: 'center',
    },
    emptyHint: {
      color: theme.colors.gray500,
      fontSize: 12,
      textAlign: 'center',
    },
    searchInput: {
      borderWidth: 1,
      borderColor: theme.colors.gray300,
      borderRadius: theme.borderRadius.lg,
      minHeight: 44,
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      color: theme.colors.gray900,
      backgroundColor: theme.colors.white,
    },
    motoristaCard: {
      backgroundColor: theme.colors.white,
      padding: isDesktop ? theme.desktop.section.padding : theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      marginBottom: isDesktop ? theme.spacing.sm : theme.spacing.md,
      borderWidth: isDesktop ? 1 : 2,
      borderColor: theme.colors.gray200,
      shadowColor: theme.colors.black,
      shadowOffset: { width: 0, height: isDesktop ? 1 : 2 },
      shadowOpacity: isDesktop ? 0.03 : 0.05,
      shadowRadius: isDesktop ? 2 : 4,
      elevation: isDesktop ? 1 : 2,
      // Desktop: limitar largura para não ocupar toda a coluna
      maxWidth: isDesktop ? 320 : undefined,
    },
    motoristaCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryBg,
      shadowColor: theme.colors.primaryDark,
      shadowOpacity: isDesktop ? 0.1 : 0.15,
      elevation: isDesktop ? 2 : 4,
    },
    motoristaNome: {
      fontSize: isDesktop
        ? theme.desktop.input.fontSize
        : theme.typography.base,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray900,
    },
    motoristaNomeActive: {
      color: theme.colors.primaryDark,
    },
    motoristaEmail: {
      fontSize: isDesktop ? 12 : theme.typography.sm,
      color: theme.colors.gray500,
      marginTop: isDesktop ? 4 : theme.spacing.sm,
    },
    motoristaEmailActive: {
      color: theme.colors.primary,
    },
    workloadRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    workloadBadge: {
      backgroundColor: theme.colors.gray100,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 3,
    },
    workloadText: {
      color: theme.colors.gray600,
      fontSize: 11,
      fontFamily: theme.typography.fontSansSemiBold,
    },
    inProgressBadge: {
      backgroundColor: theme.colors.warning + '20',
    },
    inProgressText: {
      color: theme.colors.warning,
    },
  });
