import { View, ScrollView, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useResponsive } from '@/hooks/useResponsive';

/**
 * SplitView - Layout de duas colunas responsivo
 *
 * Desktop (≥1024px): Duas colunas lado a lado
 * Mobile/Tablet (<1024px): Empilhamento vertical
 *
 * Padrão usado por: Gmail, Notion, Slack, Linear
 *
 * @example Mapa + Lista de Paradas
 * <SplitView
 *   left={<MapView />}
 *   right={<ParadasList />}
 *   leftFlex={2}
 *   rightFlex={1}
 * />
 *
 * @example Formulário + Preview
 * <SplitView
 *   left={<Form />}
 *   right={<Preview />}
 *   gap={24}
 * />
 */

interface SplitViewProps {
  /** Conteúdo do painel esquerdo (desktop) / superior (mobile) */
  left: React.ReactNode;
  /** Conteúdo do painel direito (desktop) / inferior (mobile) */
  right: React.ReactNode;
  /** Proporção flex do painel esquerdo (default: 1) */
  leftFlex?: number;
  /** Proporção flex do painel direito (default: 1) */
  rightFlex?: number;
  /** Espaçamento entre painéis em pixels (default: 16) */
  gap?: number;
  /** Largura mínima do painel esquerdo em pixels (default: 300) */
  leftMinWidth?: number;
  /** Largura mínima do painel direito em pixels (default: 300) */
  rightMinWidth?: number;
  /** Permitir scroll nos painéis (default: false) */
  scrollable?: boolean;
  /** Reverter ordem no mobile (right primeiro) */
  reverseMobile?: boolean;
  /** Estilo adicional para o container */
  style?: ViewStyle;
}

export function SplitView({
  left,
  right,
  leftFlex = 1,
  rightFlex = 1,
  gap = 16,
  leftMinWidth = 300,
  rightMinWidth = 300,
  scrollable = false,
  reverseMobile = false,
  style,
}: SplitViewProps) {
  const { isDesktop } = useResponsive();

  const containerStyles = [
    styles.container,
    isDesktop ? styles.desktopContainer : styles.mobileContainer,
    isDesktop && { gap },
    style,
  ];

  const leftStyles = [
    styles.panel,
    isDesktop && { flex: leftFlex, minWidth: leftMinWidth },
  ];

  const rightStyles = [
    styles.panel,
    isDesktop && { flex: rightFlex, minWidth: rightMinWidth },
    !isDesktop && { marginTop: gap },
  ];

  // Mobile: ordem normal ou reversa
  const mobileContent = reverseMobile ? (
    <>
      <View style={rightStyles}>{right}</View>
      <View style={leftStyles}>{left}</View>
    </>
  ) : (
    <>
      <View style={leftStyles}>{left}</View>
      <View style={rightStyles}>{right}</View>
    </>
  );

  // Desktop: sempre left → right
  const desktopContent = (
    <>
      <View style={leftStyles}>{left}</View>
      <View style={rightStyles}>{right}</View>
    </>
  );

  if (scrollable) {
    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={containerStyles}>
        {isDesktop ? desktopContent : mobileContent}
      </ScrollView>
    );
  }

  return <View style={containerStyles}>{isDesktop ? desktopContent : mobileContent}</View>;
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  desktopContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  mobileContainer: {
    flexDirection: 'column',
  },
  panel: {
    // Flex aplicado condicionalmente via props
  },
}));
