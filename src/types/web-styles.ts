/**
 * Tipo do estado do `Pressable` no React Native Web.
 *
 * Os tipos de CSS só da web (`WebViewStyle`, `WebTextStyle`, …) saíram na faxina
 * de 13/11/2026: ninguém os usava; o estilo web segue a exceção de `as any`
 * documentada no CLAUDE.md.
 */

/**
 * PressableState with web-specific hovered property
 * React Native Web extends PressableStateCallbackType with hovered
 */
export interface PressableStateWithHover {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}
