/**
 * Sistema de Cores - RotaMestre
 * Alinhado com identidade visual do Mestre da Obra
 */

export const colors = {
  // ===== CORES PRIMÁRIAS =====
  primary: {
    main: '#1e5aa8',      // Azul RotaMestre (principal)
    dark: '#0D5A9C',      // Azul escuro (header, elementos importantes)
    light: '#4a90e2',     // Azul claro (hover, active states) - Alinhado com Brand Guidelines
  },

  // ===== CORES SECUNDÁRIAS =====
  secondary: {
    main: '#f7a02a',      // Laranja RotaMestre (alinhado com Mestre da Obra)
    dark: '#e68a00',      // Laranja escuro (hover)
    light: '#ffb84d',     // Laranja claro (backgrounds)
  },

  // ===== CORES SEMÂNTICAS (Status) =====
  status: {
    success: '#10b981',   // Verde - Concluído, Sucesso
    warning: '#f59e0b',   // Amarelo - Pendente, Atenção
    error: '#ef4444',     // Vermelho - Erro, Cancelado, Perigo
    info: '#3b82f6',      // Azul - Informação
  },

  // ===== CORES DE STATUS DE ROTA =====
  routeStatus: {
    pending: '#f59e0b',       // Pendente
    inProgress: '#3b82f6',    // Em Andamento
    completed: '#10b981',     // Concluída
    cancelled: '#ef4444',     // Cancelada
  },

  // ===== ESCALA DE CINZAS =====
  gray: {
    50: '#f9fafb',   // Background muito claro
    100: '#f3f4f6',  // Background claro
    200: '#e5e7eb',  // Borders, divisores
    300: '#d1d5db',  // Borders mais escuros
    400: '#9ca3af',  // Texto desabilitado
    500: '#6b7280',  // Texto secundário
    600: '#4b5563',  // Texto normal
    700: '#374151',  // Texto escuro
    800: '#1f2937',  // Texto muito escuro
    900: '#111827',  // Texto preto
  },

  // ===== CORES BASE =====
  white: '#ffffff',
  black: '#000000',

  // ===== BACKGROUNDS =====
  background: {
    primary: '#ffffff',   // Fundo principal
    secondary: '#f9fafb', // Fundo secundário
    tertiary: '#f3f4f6',  // Fundo terciário
  },

  // ===== BORDERS =====
  border: {
    light: '#e5e7eb',
    medium: '#d1d5db',
    dark: '#9ca3af',
  },

  // ===== OVERLAYS =====
  overlay: {
    light: 'rgba(0, 0, 0, 0.1)',
    medium: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.8)',
  },
};

export type Colors = typeof colors;
