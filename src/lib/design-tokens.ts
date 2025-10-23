/**
 * ============================================
 * DESIGN TOKENS - RotaMestre
 * ============================================
 *
 * Tokens centralizados baseados no Brand Guidelines v3.0
 * Estes valores garantem consistência visual em toda a aplicação.
 *
 * Documentação completa: docs/BRAND_GUIDELINES.md
 */

// ============================================
// 1. CORES
// ============================================

export const colors = {
  // Cores Primárias
  primary: {
    main: '#1e5aa8',   // Azul RotaMestre
    dark: '#0D5A9C',   // Azul Escuro (headers)
    light: '#3b82f6',  // Azul Claro
  },

  // Cor Secundária (CTA)
  secondary: {
    main: '#f7a02a',   // Laranja RotaMestre
    dark: '#e68a00',   // Laranja Escuro
    light: '#ffb84d',  // Laranja Claro
  },

  // Cores Semânticas (Status)
  success: '#10b981',  // Verde - Sucesso/Concluído
  warning: '#f59e0b',  // Amarelo - Atenção/Pendente
  error: '#ef4444',    // Vermelho - Erro/Cancelado
  info: '#3b82f6',     // Azul Info - Informação/Em Andamento

  // Escala de Cinzas
  gray: {
    50: '#f9fafb',   // Background muito claro
    100: '#f3f4f6',  // Background secundário
    200: '#e5e7eb',  // Borders, separadores
    300: '#d1d5db',  // Borders escuros
    400: '#9ca3af',  // Texto desabilitado
    500: '#6b7280',  // Texto secundário
    600: '#4b5563',  // Texto normal
    700: '#374151',  // Texto escuro
    800: '#1f2937',  // Texto muito escuro
    900: '#111827',  // Texto preto
  },

  // Backgrounds
  background: {
    primary: '#ffffff',    // Fundo principal (cards, telas)
    secondary: '#f9fafb',  // Fundo de telas secundárias
    tertiary: '#f3f4f6',   // Fundo de áreas específicas
  },

  // Bordas
  border: {
    light: '#e5e7eb',   // Borders sutis
    medium: '#d1d5db',  // Borders padrão
    dark: '#9ca3af',    // Borders em destaque
  },

  // Overlays (Modals, Popups)
  overlay: {
    light: 'rgba(0, 0, 0, 0.1)',   // Overlay sutil
    medium: 'rgba(0, 0, 0, 0.5)',  // Overlay padrão
    dark: 'rgba(0, 0, 0, 0.8)',    // Overlay escuro
  },

  // Cores de Texto (atalhos semânticos)
  text: {
    primary: '#111827',     // Texto principal (gray[900])
    secondary: '#6b7280',   // Texto secundário (gray[500])
    tertiary: '#9ca3af',    // Texto terciário (gray[400])
    disabled: '#d1d5db',    // Texto desabilitado (gray[300])
    inverse: '#ffffff',     // Texto em fundos escuros
    link: '#1e5aa8',        // Links (primary.main)
  },

  // Cores puras (utilitários)
  white: '#ffffff',
  black: '#000000',
} as const;

// ============================================
// 2. TIPOGRAFIA
// ============================================

export const typography = {
  // Famílias de Fonte
  fontFamily: {
    display: 'Viga',           // Títulos grandes (H1)
    body: 'Nunito Sans',       // 90% da interface
    regular: 'Nunito Sans',    // Corpo de texto
    medium: 'Nunito Sans',     // Destaques sutis
    semibold: 'Nunito Sans',   // Botões, labels
    bold: 'Nunito Sans',       // Títulos (H2, H3)
    extrabold: 'Nunito Sans',  // Números, métricas
  },

  // Tamanhos de Fonte
  fontSize: {
    '5xl': 36,  // Landing page
    '4xl': 32,  // Títulos principais de tela
    '3xl': 28,  // Headers de tela (H1)
    '2xl': 24,  // Subtítulos importantes (H2)
    xl: 20,     // Títulos de seção (H3)
    lg: 18,     // Destaques, lead text
    md: 16,     // Corpo padrão, botões
    sm: 14,     // Textos secundários
    xs: 12,     // Labels, captions
  },

  // Pesos de Fonte (Nunito Sans)
  fontWeight: {
    light: '300',      // Raríssimo (evitar)
    regular: '400',    // Corpo de texto
    medium: '500',     // Destaques sutis
    semibold: '600',   // Botões, labels importantes
    bold: '700',       // Títulos (H2, H3)
    extrabold: '800',  // Números, métricas destacadas
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,    // Títulos grandes (H1, H2)
    normal: 1.5,   // Corpo de texto padrão
    relaxed: 1.75, // Parágrafos longos, conteúdo denso
  },

  // Estilos Pré-Definidos
  styles: {
    // H1 - Título Principal de Tela
    h1: {
      fontFamily: 'Viga',
      fontSize: 28,
      fontWeight: '400' as const,
      lineHeight: 36,
      color: colors.gray[900],
    },

    // H2 - Subtítulo/Seção
    h2: {
      fontFamily: 'Nunito Sans',
      fontSize: 20,
      fontWeight: '700' as const,
      lineHeight: 28,
      color: colors.gray[900],
    },

    // H3 - Título de Card
    h3: {
      fontFamily: 'Nunito Sans',
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 24,
      color: colors.gray[900],
    },

    // Body - Corpo de Texto
    body: {
      fontFamily: 'Nunito Sans',
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
      color: colors.gray[700],
    },

    // Caption - Textos Pequenos
    caption: {
      fontFamily: 'Nunito Sans',
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
      color: colors.gray[500],
    },

    // Button Text - Texto de Botão
    button: {
      fontFamily: 'Nunito Sans',
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
  },
} as const;

// ============================================
// 3. ESPAÇAMENTO (4-point grid)
// ============================================

export const spacing = {
  xs: 4,    // Espaçamento muito pequeno
  sm: 8,    // Elementos próximos (ícone + texto)
  md: 16,   // Padrão (padding de cards)
  lg: 24,   // Seções
  xl: 32,   // Grandes espaçamentos
  '2xl': 40, // Espaçamento extra
  '3xl': 48, // Landing pages, layouts especiais
} as const;

// ============================================
// 4. BORDER RADIUS
// ============================================

export const borderRadius = {
  sm: 6,      // Inputs, tags pequenas
  md: 8,      // Botões padrão
  lg: 12,     // Cards, containers
  xl: 16,     // Modals, overlays grandes
  full: 9999, // Pills, badges, avatares circulares
} as const;

// ============================================
// 5. SOMBRAS (Shadows)
// ============================================

export const shadows = {
  // Elevação 1 - Cards
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android
  },

  // Elevação 2 - Modals/Dropdowns
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },

  // Elevação 3 - Floating Actions
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },

  // Sem sombra
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

// ============================================
// 6. OPACIDADES
// ============================================

export const opacity = {
  10: 0.1,   // Overlays muito sutis
  25: 0.25,  // Backgrounds sutis, hover
  50: 0.5,   // Overlays de modal, disabled
  75: 0.75,  // Overlays escuros
  90: 0.9,   // Backgrounds quase opacos
} as const;

// ============================================
// 7. TRANSIÇÕES E ANIMAÇÕES
// ============================================

export const transitions = {
  // Durações
  duration: {
    fast: 150,    // Hover states, pequenas mudanças
    normal: 250,  // Padrão (cor, opacidade)
    slow: 350,    // Modals, slides, animações complexas
  },

  // Easing
  easing: {
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',      // Entrada de elementos
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',       // Saída de elementos
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',  // Movimento bidirecional
  },
} as const;

// ============================================
// 8. Z-INDEX (Camadas)
// ============================================

export const zIndex = {
  base: 0,      // Elementos normais
  header: 10,   // Headers fixos
  dropdown: 20, // Dropdowns
  modal: 30,    // Modals
  toast: 40,    // Toasts/Snackbars
  tooltip: 50,  // Tooltips
  max: 9999,    // Casos excepcionais
} as const;

// ============================================
// 9. ÍCONES (Ionicons)
// ============================================

export const icons = {
  // Tamanhos
  size: {
    sm: 16,  // Labels inline, chips
    md: 20,  // Botões, inputs (padrão)
    lg: 24,  // Botões grandes, tabs
    xl: 32,  // Empty states, ilustrações
  },

  // Espaçamento padrão com texto
  spacing: spacing.sm, // 8px
} as const;

// ============================================
// 10. FUNÇÕES UTILITÁRIAS
// ============================================

/**
 * Retorna as cores corretas para um badge de status
 */
export function getBadgeColor(
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
): { background: string; text: string } {
  switch (status) {
    case 'pendente':
      return {
        background: '#FEF3C7', // Amarelo claro
        text: colors.warning,
      };
    case 'em_andamento':
      return {
        background: '#DBEAFE', // Azul claro
        text: colors.info,
      };
    case 'concluida':
      return {
        background: '#D1FAE5', // Verde claro
        text: colors.success,
      };
    case 'cancelada':
      return {
        background: '#FEE2E2', // Vermelho claro
        text: colors.error,
      };
    default:
      return {
        background: colors.gray[100],
        text: colors.gray[600],
      };
  }
}

/**
 * Retorna a cor correta para um ícone de status
 */
export function getStatusColor(
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
): string {
  switch (status) {
    case 'pendente':
      return colors.warning;
    case 'em_andamento':
      return colors.info;
    case 'concluida':
      return colors.success;
    case 'cancelada':
      return colors.error;
    default:
      return colors.gray[500];
  }
}

/**
 * Retorna o nome do ícone (Ionicons) para cada status
 */
export function getStatusIcon(
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
): string {
  switch (status) {
    case 'pendente':
      return 'time-outline';
    case 'em_andamento':
      return 'play-circle';
    case 'concluida':
      return 'checkmark-circle';
    case 'cancelada':
      return 'close-circle';
    default:
      return 'ellipse-outline';
  }
}

// ============================================
// EXPORT DEFAULT (Todos os tokens)
// ============================================

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  opacity,
  transitions,
  zIndex,
  icons,
  // Funções utilitárias
  getBadgeColor,
  getStatusColor,
  getStatusIcon,
};
