/**
 * Componente para exibição da lista de paradas e ações relacionadas
 * Extraído de nova-entrega.tsx para melhor manutenibilidade
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import { MAX_WAYPOINTS } from '@/lib/routeOptimization';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { MotoristaSeletor } from './MotoristaSeletor';
import { OrdemManualBanner } from './OrdemManualBanner';
import { ParadaCard } from './ParadaCard';
import { RotaOtimizadaBanner } from './RotaOtimizadaBanner';

import type {
  Parada,
  MotoristaResumo,
  RotaOtimizadaState,
  EnderecoUnidade,
  DistanciaManualReal,
  DistanciaManualAproximada,
  ParadasStatus,
} from './types';

export interface ParadasListAndActionsProps {
  paradas: Parada[];
  paradasStatus: ParadasStatus;
  motoristas: MotoristaResumo[];
  motoristaSelecionado: string;
  rotaOtimizada: RotaOtimizadaState | null;
  ordemManual: boolean;
  distanciaManualReal: DistanciaManualReal | null;
  distanciaManualAproximada: DistanciaManualAproximada | null;
  enderecoUnidade: EnderecoUnidade | null;
  isOptimizing: boolean;
  isCalculandoReal: boolean;
  isLoading: boolean;
  isDesktop: boolean;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
  onOptimize: () => void;
  onCalculateReal: () => void;
  onSelectMotorista: (id: string) => void;
  onGenerateRoute: () => void;
}

export const ParadasListAndActions = memo(function ParadasListAndActions({
  paradas,
  paradasStatus,
  motoristas,
  motoristaSelecionado,
  rotaOtimizada,
  ordemManual,
  distanciaManualReal,
  distanciaManualAproximada,
  enderecoUnidade,
  isOptimizing,
  isCalculandoReal,
  isLoading,
  isDesktop,
  onMoveUp,
  onMoveDown,
  onRemove,
  onOptimize,
  onCalculateReal,
  onSelectMotorista,
  onGenerateRoute,
}: ParadasListAndActionsProps) {
  const { theme } = useUnistyles();
  const styles = createStyles(theme, isDesktop);

  return (
    <View style={styles.paradasColumn}>
      {/* Lista de Paradas */}
      {paradas.length > 0 ? (
        <View style={styles.paradasList}>
          {/* Header: título só em mobile/tablet, badge sempre visível quando aplicável */}
          {(!isDesktop || paradasStatus.cor !== 'default') && (
            <View style={styles.paradasHeaderRow}>
              {/* Título interno só em mobile/tablet - desktop usa título do DesktopCard */}
              {!isDesktop && (
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                  Paradas Adicionadas ({paradas.length})
                </Text>
              )}
              {paradasStatus.cor !== 'default' && (
                <View style={[
                  styles.paradasLimitBadge,
                  paradasStatus.cor === 'error' && styles.paradasLimitBadgeError,
                  paradasStatus.cor === 'warning' && styles.paradasLimitBadgeWarning,
                ]}>
                  <Ionicons
                    name={paradasStatus.icone || 'alert-circle'}
                    size={isDesktop ? 12 : 14}
                    color={paradasStatus.cor === 'error' ? theme.colors.error : theme.colors.warning}
                  />
                  <Text style={[
                    styles.paradasLimitText,
                    paradasStatus.cor === 'error' && styles.paradasLimitTextError,
                    paradasStatus.cor === 'warning' && styles.paradasLimitTextWarning,
                  ]}>
                    {paradas.length > MAX_WAYPOINTS ? 'Limite excedido' : 'Próximo do limite'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {paradas.map((parada, index) => {
            const retiradaVinculada = parada.vinculo_parada_id
              ? paradas.find((p) => p.id === parada.vinculo_parada_id) || null
              : null;

            return (
              <ParadaCard
                key={parada.id || index}
                parada={parada}
                index={index}
                totalParadas={paradas.length}
                retiradaVinculada={retiradaVinculada}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onRemove={onRemove}
              />
            );
          })}

          {/* Botão Otimizar Rota */}
          {paradas.length >= 1 && (
            <TouchableOpacity
              style={styles.otimizarButton}
              onPress={onOptimize}
              disabled={isOptimizing || !enderecoUnidade}
              accessibilityLabel="Otimizar rota para o melhor percurso"
              accessibilityRole="button"
              accessibilityState={{ disabled: isOptimizing || !enderecoUnidade }}
            >
              {isOptimizing ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.otimizarButtonText}>
                  Otimizar Rota (Melhor Percurso)
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Banner de Rota Otimizada */}
          {rotaOtimizada && !ordemManual && (
            <RotaOtimizadaBanner
              rotaOtimizada={rotaOtimizada}
              enderecoUnidade={enderecoUnidade}
            />
          )}

          {/* Banner de Ordem Manual com Comparativo */}
          {ordemManual && rotaOtimizada && (
            <OrdemManualBanner
              rotaOtimizada={rotaOtimizada}
              distanciaManualReal={distanciaManualReal}
              distanciaManualAproximada={distanciaManualAproximada}
              isOptimizing={isOptimizing}
              isCalculandoReal={isCalculandoReal}
              onReoptimize={onOptimize}
              onCalculateReal={onCalculateReal}
            />
          )}
        </View>
      ) : (
        <View style={styles.emptyParadasState}>
          <View style={styles.emptyParadasIconContainer}>
            <Ionicons name="cube-outline" size={48} color={theme.colors.gray400} />
          </View>
          <Text style={styles.emptyParadasTitle}>Nenhuma parada adicionada</Text>
          <Text style={styles.emptyParadasText}>
            {isDesktop
              ? 'Adicione paradas ao formulário ao lado para começar a criar sua rota de entrega'
              : 'Adicione paradas usando o formulário acima para criar sua rota de entrega'}
          </Text>
          {isDesktop && (
            <View style={styles.emptyParadasCta}>
              <Ionicons name="arrow-back" size={16} color={theme.colors.secondary} />
              <Text style={styles.emptyParadasCtaText}>
                Preencha o formulário à esquerda
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Seleção de Motorista */}
      {paradas.length > 0 && (
        <MotoristaSeletor
          motoristas={motoristas}
          motoristaSelecionado={motoristaSelecionado}
          onSelectMotorista={onSelectMotorista}
        />
      )}

      {/* Botão Gerar Rota */}
      {paradas.length > 0 && (
        <TouchableOpacity
          style={[
            styles.gerarButton,
            (!motoristaSelecionado || isLoading) && styles.gerarButtonDisabled,
          ]}
          onPress={onGenerateRoute}
          disabled={!motoristaSelecionado || isLoading}
          accessibilityLabel={
            !motoristaSelecionado
              ? 'Gerar rota - selecione um motorista primeiro'
              : `Gerar rota com ${paradas.length} paradas`
          }
          accessibilityRole="button"
          accessibilityState={{ disabled: !motoristaSelecionado || isLoading }}
        >
          {isLoading ? (
            <View style={styles.gerarButtonLoading}>
              <ActivityIndicator color={theme.colors.white} />
              <Text style={[styles.gerarButtonText, { marginLeft: 10 }]}>Criando rota...</Text>
            </View>
          ) : (
            <Text style={styles.gerarButtonText}>Gerar Rota</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
});

const createStyles = (theme: Theme, isDesktop: boolean) => StyleSheet.create({
  paradasColumn: {
    flex: 1,
  },
  paradasList: {
    marginBottom: isDesktop ? theme.spacing.lg : theme.spacing['2xl'],
  },
  paradasHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: isDesktop ? theme.desktop.field.marginBottom : theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: isDesktop ? theme.typography.base : theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: isDesktop ? theme.spacing.lg : theme.spacing['2xl'],
  },
  paradasLimitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isDesktop ? 3 : 4,
    paddingHorizontal: isDesktop ? 6 : 8,
    paddingVertical: isDesktop ? 2 : 4,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
  },
  paradasLimitBadgeWarning: {
    backgroundColor: theme.colors.warning + '20',
  },
  paradasLimitBadgeError: {
    backgroundColor: theme.colors.error + '20',
  },
  paradasLimitText: {
    fontSize: isDesktop ? 11 : theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray600,
  },
  paradasLimitTextWarning: {
    color: theme.colors.warning,
  },
  paradasLimitTextError: {
    color: theme.colors.error,
  },
  // Botão Otimizar - compacto no desktop, não full-width
  otimizarButton: {
    backgroundColor: theme.colors.info,
    paddingVertical: isDesktop ? 8 : theme.spacing.lg,
    paddingHorizontal: isDesktop ? theme.spacing.xl : theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: isDesktop ? 'center' : 'center',
    alignSelf: isDesktop ? 'flex-start' : 'stretch',
    marginTop: isDesktop ? theme.desktop.field.marginBottom : theme.spacing.lg,
    minHeight: isDesktop ? theme.desktop.input.height : 48,
    justifyContent: 'center',
  },
  otimizarButtonText: {
    color: theme.colors.white,
    fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  emptyParadasState: {
    backgroundColor: theme.colors.white,
    padding: isDesktop ? theme.spacing['2xl'] : theme.spacing['3xl'],
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: isDesktop ? 300 : 400,
  },
  emptyParadasIconContainer: {
    width: isDesktop ? 64 : 80,
    height: isDesktop ? 64 : 80,
    borderRadius: isDesktop ? 32 : 40,
    backgroundColor: theme.colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isDesktop ? theme.spacing.lg : theme.spacing['2xl'],
  },
  emptyParadasTitle: {
    fontSize: isDesktop ? theme.typography.base : theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: isDesktop ? theme.spacing.sm : theme.spacing.md,
    textAlign: 'center',
  },
  emptyParadasText: {
    fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
    maxWidth: isDesktop ? 260 : 300,
    lineHeight: isDesktop ? 18 : 20,
    marginBottom: isDesktop ? theme.spacing.lg : theme.spacing.xl,
  },
  emptyParadasCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isDesktop ? 6 : theme.spacing.sm,
    paddingVertical: isDesktop ? theme.spacing.sm : theme.spacing.md,
    paddingHorizontal: isDesktop ? theme.spacing.lg : theme.spacing.xl,
    backgroundColor: theme.colors.secondary + '15',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.secondary + '30',
  },
  emptyParadasCtaText: {
    fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.secondary,
  },
  // Botão Gerar Rota - compacto no desktop, não full-width
  gerarButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: isDesktop ? 10 : theme.spacing.lg,
    paddingHorizontal: isDesktop ? theme.spacing['2xl'] : theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    alignSelf: isDesktop ? 'flex-start' : 'stretch',
    minHeight: isDesktop ? 38 : 52,
    justifyContent: 'center',
  },
  gerarButtonDisabled: {
    backgroundColor: theme.colors.gray400,
    opacity: 0.5,
  },
  gerarButtonText: {
    color: theme.colors.white,
    fontSize: isDesktop ? theme.typography.base : theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  gerarButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
