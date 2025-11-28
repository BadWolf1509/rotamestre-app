/**
 * Unified Styles Entry Point
 *
 * Este arquivo serve como ponto de entrada para TypeScript.
 * Metro bundler resolve automaticamente para:
 * - styles.native.ts (iOS/Android)
 * - styles.web.ts (Web)
 *
 * Este arquivo é usado apenas para resolução de tipos no TypeScript.
 * Usamos styles.web.ts como fallback porque ele usa o tipo Theme genérico
 * (com strings), enquanto styles.native.ts usa 'as const' do Unistyles
 * que cria tipos literais incompatíveis.
 */

// Re-export do arquivo web como fallback para TypeScript
// Metro bundler vai substituir isso pelo arquivo correto da plataforma em runtime
export * from './styles.web';
