/**
 * LinhaDeParadas — um ponto por parada real da rota, na ordem dela.
 *
 * O desenho de cada estado segue a tabela da spec da revisão de design do
 * desktop do gestor (docs/superpowers/specs/2026-11-07-design-desktop-gestor-design.md):
 * - concluída: ponto cheio em `success`;
 * - em andamento: ponto com anel em `info`;
 * - pendente: ponto vazado, só a borda em `gray400` (é desenho, não texto);
 * - pulada: ponto cheio em `warning` — é a atenção.
 *
 * Mostra no máximo `maximo` pontos e, além disso, só os que cabem na largura
 * medida (`onLayout`); o resto vai para o "+N". Nenhum ponto some sem contar
 * no "+N" — com corte silencioso, uma rota de 10 paradas numa coluna estreita
 * parecia uma rota de 4. Antes da primeira medida, vale `maximo`.
 */

import React, { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import { STOP_STATUS_CONFIG } from '@/constants/statusConfig';
import { plural } from '@/lib/plural';
import type { StatusParada } from '@/types/rota';
import { StyleSheet, type Theme } from '@/utils/styles';

interface LinhaDeParadasProps {
  /** Estados das paradas reais, já na ordem da rota. */
  paradas: StatusParada[];
  /** Quantos pontos desenhar antes do "+N" (padrão 24). */
  maximo?: number;
  testID?: string;
}

const MAXIMO_PADRAO = 24;
const TAMANHO_PONTO = 10;
/** Espaço entre os pontos (`theme.spacing.xs`). */
const GAP_PONTOS = 4;
const PASSO = TAMANHO_PONTO + GAP_PONTOS;
/**
 * Reserva para o "+N": até "+99" a 13 px semibold (~26 px) mais o gap da
 * linha (`theme.spacing.sm`, 8 px).
 */
const LARGURA_DO_MAIS = 34;

/** Quantos pontos cabem em `largura` (o último ponto não tem gap depois). */
function pontosQueCabem(largura: number): number {
  return Math.max(0, Math.floor((largura + GAP_PONTOS) / PASSO));
}

/**
 * Quantos pontos desenhar: todos, se couberem (e não passarem do máximo);
 * senão, os que cabem ao lado do "+N".
 */
function pontosVisiveis(
  total: number,
  maximo: number,
  largura: number | null,
): number {
  if (largura === null) return Math.min(total, maximo);
  if (total <= maximo && total <= pontosQueCabem(largura)) return total;
  return Math.min(maximo, total, pontosQueCabem(largura - LARGURA_DO_MAIS));
}

/** "Parada 3, em andamento": o rótulo da config, em minúsculas. */
function rotuloDoPonto(indice: number, status: StatusParada): string {
  const estado = (STOP_STATUS_CONFIG[status]?.label ?? status).toLowerCase();
  return `Parada ${indice + 1}, ${estado}`;
}

function estiloDoPonto(status: StatusParada) {
  switch (status) {
    case 'concluida':
      return styles.pontoConcluida;
    case 'em_andamento':
      return styles.pontoEmAndamento;
    case 'pulada':
      return styles.pontoPulada;
    case 'pendente':
    default:
      return styles.pontoPendente;
  }
}

export function LinhaDeParadas({
  paradas,
  maximo = MAXIMO_PADRAO,
  testID,
}: LinhaDeParadasProps) {
  const [largura, setLargura] = useState<number | null>(null);
  const medir = (evento: LayoutChangeEvent) => {
    setLargura(evento.nativeEvent.layout.width);
  };

  if (paradas.length === 0) {
    return (
      <View testID={testID} style={styles.linha}>
        <Text style={styles.semParadas}>Sem paradas</Text>
      </View>
    );
  }

  const visiveis = paradas.slice(
    0,
    pontosVisiveis(paradas.length, maximo, largura),
  );
  const restantes = paradas.length - visiveis.length;

  return (
    <View testID={testID} style={styles.linha} onLayout={medir}>
      <View style={styles.pontos}>
        {visiveis.map((status, indice) => (
          <View
            key={indice}
            accessible
            accessibilityRole="image"
            accessibilityLabel={rotuloDoPonto(indice, status)}
            style={[styles.ponto, estiloDoPonto(status)]}
          >
            {status === 'em_andamento' ? <View style={styles.miolo} /> : null}
          </View>
        ))}
      </View>
      {restantes > 0 ? (
        <Text
          style={styles.mais}
          accessibilityLabel={`Mais ${plural(restantes, 'parada', 'paradas')}`}
        >
          {`+${restantes}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    // Ocupa a coluna inteira: é essa largura que o onLayout mede.
    alignSelf: 'stretch',
    minWidth: 0,
    flexShrink: 1,
    // Só rede de segurança: quem decide o que cabe é `pontosVisiveis`.
    overflow: 'hidden',
  },
  pontos: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: GAP_PONTOS,
    flexShrink: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  ponto: {
    width: TAMANHO_PONTO,
    height: TAMANHO_PONTO,
    borderRadius: TAMANHO_PONTO / 2,
    borderWidth: 2,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pontoConcluida: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  pontoEmAndamento: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.info,
  },
  pontoPendente: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.gray400,
  },
  pontoPulada: {
    backgroundColor: theme.colors.warning,
    borderColor: theme.colors.warning,
  },
  miolo: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.info,
  },
  mais: {
    fontSize: 13,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray600,
    flexShrink: 0,
  },
  semParadas: {
    fontSize: 13,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray600,
  },
}));
