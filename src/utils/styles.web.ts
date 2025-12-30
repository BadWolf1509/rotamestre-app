/**
 * Web Styles
 *
 * Este arquivo usa Unistyles 3.0 diretamente (suporta web).
 * O babel plugin processa os imports e garante inicialização correta.
 */

// Re-export tudo do react-native-unistyles
// O babel plugin vai injetar o import de unistyles.ts automaticamente
export { StyleSheet, useUnistyles } from 'react-native-unistyles';

// Re-export o Theme type do styles.types para compatibilidade
export type { Theme } from './styles.types';

// Re-export defaultTheme from base file (no platform-specific dependencies)
export { defaultTheme } from './styles.base';
