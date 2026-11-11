/**
 * Seletor de período (controlado). Botão com o texto do período; abaixo de
 * 1024 px abre uma folha (Modal), a partir de 1024 px um menu ancorado ao
 * botão. A tela guarda o valor (`usePeriodoLembrado`): este componente não.
 *
 * O menu desktop segue o `MenuDeAcoes` (`src/components/data-table`): Modal
 * transparente, medida do botão por `measureInWindow` (resposta de abertura
 * antiga é descartada), invisível até a medida e o `onLayout` do próprio menu
 * chegarem, abre para cima quando não cabe embaixo, fica dentro da janela na
 * horizontal e fecha se a janela mudar de tamanho.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  /** Topo do menu quando ele abre abaixo do botão. */
  top: number;
  left: number;
  /** Topo do botão: a borda de baixo do menu quando ele abre para cima. */
  topoDoBotao: number;
}

/** Sem `measureInWindow`: canto superior esquerdo. */
const SEM_MEDIDA = 'sem-medida';
const DISTANCIA_DO_BOTAO = 4;
const MARGEM_DA_JANELA = 8;

export function SeletorPeriodo({
  valor,
  aoMudar,
  cortarEmHoje = false,
  testID = 'seletor-periodo',
}: SeletorPeriodoProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const { width: larguraJanela, height: alturaJanela } = useWindowDimensions();
  const botaoRef = useRef<ViewInstance>(null);
  const [aberto, setAberto] = useState(false);
  const [personalizando, setPersonalizando] = useState(false);
  // null = medida da abertura atual ainda não chegou: o menu não aparece.
  const [ancora, setAncora] = useState<Ancora | typeof SEM_MEDIDA | null>(null);
  // Tamanho do menu aberto (onLayout); null = ainda não medido.
  const [tamanhoMenu, setTamanhoMenu] = useState<{
    largura: number;
    altura: number;
  } | null>(null);
  // Conta as aberturas: a resposta da medida só vale para a que a pediu.
  const aberturaRef = useRef(0);

  const intervalo = cortarEmHoje
    ? cortarIntervaloEmHoje(resolverPeriodo(valor))
    : null;
  const texto = textoPeriodo(valor, intervalo ?? undefined);

  const fechar = useCallback(() => {
    aberturaRef.current += 1;
    setAberto(false);
    setPersonalizando(false);
    setAncora(null);
    setTamanhoMenu(null);
  }, []);

  // Janela mudou de tamanho com o menu aberto: fecha (a âncora era da janela
  // de antes). A 1ª execução, na montagem, só guarda o tamanho.
  const janelaRef = useRef({ larguraJanela, alturaJanela });
  useEffect(() => {
    const antes = janelaRef.current;
    janelaRef.current = { larguraJanela, alturaJanela };
    if (
      antes.larguraJanela !== larguraJanela ||
      antes.alturaJanela !== alturaJanela
    ) {
      fechar();
    }
  }, [larguraJanela, alturaJanela, fechar]);

  const abrir = () => {
    aberturaRef.current += 1;
    const abertura = aberturaRef.current;
    setPersonalizando(false);
    setAncora(null);
    setTamanhoMenu(null);
    setAberto(true);
    if (!isDesktop) return;
    const medir = botaoRef.current?.measureInWindow;
    if (!medir) {
      setAncora(SEM_MEDIDA);
      return;
    }
    medir.call(botaoRef.current, (x, y, _largura, altura) => {
      if (aberturaRef.current !== abertura) return;
      setAncora({
        top: y + altura + DISTANCIA_DO_BOTAO,
        left: x,
        topoDoBotao: y,
      });
    });
  };

  const escolher = (item: ItemMenu) => {
    if (item === 'personalizado') {
      setPersonalizando(true);
      return;
    }
    aoMudar({ tipo: item });
    fechar();
  };

  const medirMenu = (evento: LayoutChangeEvent) => {
    const { width, height } = evento.nativeEvent.layout;
    setTamanhoMenu({ largura: width, altura: height });
  };

  /** Abaixo do botão; para cima se não couber embaixo; dentro da janela. */
  const estiloDaPosicao = (posicao: Ancora) => {
    if (tamanhoMenu === null) {
      return { top: posicao.top, left: posicao.left, opacity: 0 };
    }
    const { largura, altura } = tamanhoMenu;
    const acimaDoBotao = posicao.topoDoBotao - DISTANCIA_DO_BOTAO - altura;
    const naoCabeEmbaixo =
      posicao.top + altura > alturaJanela - MARGEM_DA_JANELA;
    const topo =
      naoCabeEmbaixo && acimaDoBotao >= MARGEM_DA_JANELA
        ? acimaDoBotao
        : posicao.top;
    return {
      top: Math.max(
        MARGEM_DA_JANELA,
        Math.min(topo, alturaJanela - altura - MARGEM_DA_JANELA),
      ),
      left: Math.max(
        MARGEM_DA_JANELA,
        Math.min(posicao.left, larguraJanela - largura - MARGEM_DA_JANELA),
      ),
    };
  };

  const renderItem = (item: ItemMenu) => {
    const selecionado = valor.tipo === item;
    return (
      <Pressable
        key={item}
        testID={`${testID}-item-${item}`}
        accessibilityRole={isDesktop ? 'menuitem' : 'button'}
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
      <View
        accessibilityRole={isDesktop ? 'menu' : undefined}
        accessibilityLabel="Período"
      >
        {ITENS.map(renderItem)}
      </View>
    );

  const renderMenu = (posicao: Ancora | typeof SEM_MEDIDA) => (
    <View
      onLayout={medirMenu}
      style={[
        styles.menu,
        personalizando && styles.menuLargo,
        posicao === SEM_MEDIDA
          ? styles.menuSemAncora
          : estiloDaPosicao(posicao),
      ]}
    >
      {renderConteudo()}
    </View>
  );

  const renderFolha = () => (
    <View
      style={[
        styles.folha,
        { paddingBottom: theme.spacing.lg + insets.bottom },
      ]}
    >
      <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
        {renderConteudo()}
      </ScrollView>
    </View>
  );

  return (
    <View ref={botaoRef} collapsable={false}>
      <Pressable
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
            testID={`${testID}-fora`}
            style={styles.fechadorDeFundo}
            onPress={fechar}
            accessible={false}
            // RNW: o Pressable emite tabIndex 0; sem -1 a trava de foco do
            // Modal focaria este fundo invisível.
            tabIndex={-1}
          />
          {isDesktop ? (ancora ? renderMenu(ancora) : null) : renderFolha()}
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
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
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
