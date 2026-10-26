/**
 * AcoesRotaMobile - ações de gestão da rota abaixo de 1024 px (celular e
 * tablet). Abre os MESMOS modais do cabeçalho do desktop e mostra cada botão
 * pela mesma regra (`permissoesRota`).
 *
 * Barra própria em vez de reaproveitar o `RouteInfoHeaderCompact` (layout em
 * uma linha, não cabe em 360 px) ou de um menu "⋯" (esconderia trocar
 * motorista, a ação mais usada, atrás de dois toques). Os botões quebram em
 * linhas e têm alvo de toque de 44 px.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { permissoesRota, type PermissoesRota } from './permissoesRota';

import type { Rota } from './types';

interface AcoesRotaMobileProps {
  rota: Rota;
  onCancelPress: () => void;
  onReactivatePress: () => void;
  onChangeDriverPress: () => void;
  onAddStopPress: () => void;
  onReorderPress: () => void;
}

type CorAcao = 'primary' | 'secondary' | 'error' | 'success';

interface AcaoRota {
  permissao: keyof PermissoesRota;
  rotulo: string;
  icone: React.ComponentProps<typeof Ionicons>['name'];
  cor: CorAcao;
  onPress: () => void;
}

export function AcoesRotaMobile({
  rota,
  onCancelPress,
  onReactivatePress,
  onChangeDriverPress,
  onAddStopPress,
  onReorderPress,
}: AcoesRotaMobileProps) {
  const { theme } = useUnistyles();
  const permissoes = permissoesRota(rota.status);

  // Ordem de uso: trocar motorista primeiro; as destrutivas por último.
  const acoes: AcaoRota[] = [
    {
      permissao: 'trocarMotorista',
      rotulo: 'Trocar motorista',
      icone: 'swap-horizontal',
      cor: 'primary',
      onPress: onChangeDriverPress,
    },
    {
      permissao: 'adicionarParada',
      rotulo: 'Adicionar parada',
      icone: 'add-circle-outline',
      cor: 'primary',
      onPress: onAddStopPress,
    },
    {
      permissao: 'reordenar',
      rotulo: 'Reordenar',
      icone: 'swap-vertical-outline',
      cor: 'secondary',
      onPress: onReorderPress,
    },
    {
      permissao: 'cancelar',
      rotulo: 'Cancelar rota',
      icone: 'close-circle-outline',
      cor: 'error',
      onPress: onCancelPress,
    },
    {
      permissao: 'reativar',
      rotulo: 'Reativar rota',
      icone: 'refresh-circle-outline',
      cor: 'success',
      onPress: onReactivatePress,
    },
  ];
  const visiveis = acoes.filter((acao) => permissoes[acao.permissao]);

  if (visiveis.length === 0) return null;

  return (
    <View style={styles.container}>
      {visiveis.map((acao) => {
        const cor = theme.colors[acao.cor];
        return (
          <TouchableOpacity
            key={acao.permissao}
            style={[
              styles.botao,
              { borderColor: `${cor}40`, backgroundColor: `${cor}08` },
            ]}
            onPress={acao.onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={acao.rotulo}
          >
            <Ionicons name={acao.icone} size={18} color={cor} />
            <Text style={[styles.texto, { color: cor }]}>{acao.rotulo}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  texto: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
}));
