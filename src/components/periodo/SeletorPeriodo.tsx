/**
 * Seletor de período (controlado). Botão com o texto do período; abaixo de
 * 1024 px abre uma folha (Modal), a partir de 1024 px um menu ancorado ao
 * botão. A tela guarda o valor (`usePeriodoLembrado`): este componente não.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import {
  ATALHOS_PERIODO,
  ROTULO_PERIODO,
  cortarEmHoje as cortarIntervaloEmHoje,
  resolverPeriodo,
  textoPeriodo,
  type AtalhoPeriodo,
  type Periodo,
} from '@/lib/periodo';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { PainelPersonalizado } from './PainelPersonalizado';

export interface SeletorPeriodoProps {
  valor: Periodo;
  aoMudar: (p: Periodo) => void;
  /** O texto mostra o intervalo cortado em hoje (telas de desempenho). */
  cortarEmHoje?: boolean;
  testID?: string;
}

type ItemMenu = AtalhoPeriodo | 'personalizado';

/** Ordem da UI: "Personalizado" antes de "Todo o período". */
const ITENS: readonly ItemMenu[] = [
  ...ATALHOS_PERIODO.filter((a) => a !== 'todo'),
  'personalizado',
  'todo',
];

interface Ancora {
  top: number;
  left: number;
}

export function SeletorPeriodo({
  valor,
  aoMudar,
  cortarEmHoje = false,
  testID = 'seletor-periodo',
}: SeletorPeriodoProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const [aberto, setAberto] = useState(false);
  const [personalizando, setPersonalizando] = useState(false);
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const botaoRef = useRef<React.ComponentRef<typeof Pressable>>(null);

  const intervalo = cortarEmHoje
    ? cortarIntervaloEmHoje(resolverPeriodo(valor))
    : null;
  const texto = textoPeriodo(valor, intervalo ?? undefined);

  const fechar = () => {
    setAberto(false);
    setPersonalizando(false);
  };

  const abrir = () => {
    setPersonalizando(false);
    const ref = botaoRef.current;
    if (isDesktop && ref && typeof ref.measureInWindow === 'function') {
      ref.measureInWindow((x, y, _w, h) =>
        setAncora({ top: y + h + 4, left: x }),
      );
    } else {
      setAncora(null);
    }
    setAberto(true);
  };

  const escolher = (item: ItemMenu) => {
    if (item === 'personalizado') {
      setPersonalizando(true);
      return;
    }
    aoMudar({ tipo: item });
    fechar();
  };

  const renderItem = (item: ItemMenu) => {
    const selecionado = valor.tipo === item;
    return (
      <Pressable
        key={item}
        testID={`${testID}-item-${item}`}
        accessibilityRole="button"
        accessibilityState={{ selected: selecionado }}
        style={[styles.item, selecionado && styles.itemSelecionado]}
        onPress={() => escolher(item)}
      >
        <Text
          style={[styles.itemTexto, selecionado && styles.itemTextoSelecionado]}
        >
          {ROTULO_PERIODO[item]}
        </Text>
        {selecionado && (
          <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
        )}
      </Pressable>
    );
  };

  const renderConteudo = () =>
    personalizando ? (
      <PainelPersonalizado
        testID={testID}
        de={valor.tipo === 'personalizado' ? valor.de : null}
        ate={valor.tipo === 'personalizado' ? valor.ate : null}
        aoCancelar={fechar}
        aoAplicar={(de, ate) => {
          aoMudar({ tipo: 'personalizado', de, ate });
          fechar();
        }}
      />
    ) : (
      <View>{ITENS.map(renderItem)}</View>
    );

  const renderFolhaOuMenu = () =>
    isDesktop ? (
      <View
        style={[
          styles.menu,
          personalizando && styles.menuLargo,
          ancora
            ? { top: ancora.top, left: ancora.left }
            : styles.menuSemAncora,
        ]}
      >
        {renderConteudo()}
      </View>
    ) : (
      <View style={styles.folha}>{renderConteudo()}</View>
    );

  return (
    <View>
      <Pressable
        ref={botaoRef}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`Período: ${texto}`}
        accessibilityState={{ expanded: aberto }}
        style={styles.botao}
        onPress={abrir}
      >
        <Ionicons
          name="calendar-outline"
          size={20}
          color={theme.colors.gray500}
        />
        <Text style={styles.botaoTexto} numberOfLines={1}>
          {texto}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.colors.gray500} />
      </Pressable>

      <Modal
        visible={aberto}
        transparent
        animationType={isDesktop ? 'fade' : 'slide'}
        onRequestClose={fechar}
      >
        <View style={isDesktop ? styles.fundoMenu : styles.fundoFolha}>
          <Pressable
            style={styles.fechadorDeFundo}
            accessibilityLabel="Fechar"
            onPress={fechar}
          />
          {renderFolhaOuMenu()}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  botaoTexto: {
    flexShrink: 1,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  fundoFolha: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  fundoMenu: { flex: 1 },
  fechadorDeFundo: { ...StyleSheet.absoluteFillObject },
  folha: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    maxHeight: '85%',
  },
  menu: {
    position: 'absolute',
    minWidth: 240,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    ...theme.shadows.lg,
  },
  menuLargo: { minWidth: 340, padding: theme.spacing.lg },
  menuSemAncora: { top: theme.spacing.xxl, left: theme.spacing.lg },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  itemSelecionado: { backgroundColor: theme.colors.primaryBg },
  itemTexto: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray800,
  },
  itemTextoSelecionado: {
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
}));
