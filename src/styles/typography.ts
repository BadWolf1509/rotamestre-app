/**
 * Sistema de Tipografia - RotaMestre
 * Fontes: Viga (display) + Nunito Sans (interface)
 */

export const typography = {
  // ===== FAMÍLIAS DE FONTE =====
  fontFamily: {
    primary: 'Nunito Sans',        // Interface principal (90%)
    display: 'Viga',               // Títulos grandes
    system: '-apple-system, BlinkMacSystemFont, sans-serif', // Fallback
  },

  // ===== TAMANHOS =====
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 36,
  },

  // ===== PESOS (Nunito Sans suporta) =====
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },

  // ===== LINE HEIGHTS =====
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // ===== ESTILOS PRÉ-DEFINIDOS =====
  styles: {
    // Título de tela (Dashboard, Nova Rota)
    h1: {
      fontFamily: 'Viga',
      fontSize: 28,
      fontWeight: '400', // Viga já é naturalmente bold
      lineHeight: 36,
    },

    // Subtítulo de seção
    h2: {
      fontFamily: 'Nunito Sans',
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 28,
    },

    // Card headers
    h3: {
      fontFamily: 'Nunito Sans',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 24,
    },

    // Corpo de texto
    body: {
      fontFamily: 'Nunito Sans',
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
    },

    // Textos pequenos
    caption: {
      fontFamily: 'Nunito Sans',
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
    },

    // Botões
    button: {
      fontFamily: 'Nunito Sans',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 24,
    },
  },
};

export type Typography = typeof typography;
