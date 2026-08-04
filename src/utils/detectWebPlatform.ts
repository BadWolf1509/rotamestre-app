/**
 * Detecta a plataforma do visitante da web a partir do userAgent.
 *
 * Usado pela página /testar para adaptar o passo a passo de instalação.
 * iPad moderno (iPadOS 13+) reporta como "Macintosh" → cai em 'desktop',
 * o que é aceitável: só precisamos distinguir o fluxo Android dos demais.
 */
export type WebPlatform = 'android' | 'ios' | 'desktop';

export function detectWebPlatform(userAgent?: string): WebPlatform {
  const ua =
    userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '') ??
    '';

  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'desktop';
}
