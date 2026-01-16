/**
 * Mock for @/utils/color in Jest tests
 * This module is automatically used when tests import @/utils/color
 */

export function withOpacity(color: string, opacity: number): string {
  if (!color) return color;
  const normalized = color.startsWith('#') ? color.slice(1) : color;
  const hex = normalized.length === 3
    ? normalized.split('').map(v => `${v}${v}`).join('')
    : normalized;
  if (hex.length !== 6) return color;
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function boxShadow(
  offsetX: number,
  offsetY: number,
  blur: number,
  spread: number,
  _color: string,
  opacity: number
): string {
  const spreadValue = spread ? ` ${spread}px` : '';
  return `${offsetX}px ${offsetY}px ${blur}px${spreadValue} rgba(0, 0, 0, ${opacity})`;
}

export function dropShadow(
  offsetX: number,
  offsetY: number,
  blur: number,
  _color: string,
  opacity: number
): string {
  // eslint-disable-next-line no-restricted-syntax -- This IS the helper implementation
  return `drop-shadow(${offsetX}px ${offsetY}px ${blur}px rgba(0, 0, 0, ${opacity}))`;
}

export function textShadow(
  offsetX: number,
  offsetY: number,
  blur: number,
  _color: string,
  opacity: number
): string {
  return `${offsetX}px ${offsetY}px ${blur}px rgba(0, 0, 0, ${opacity})`;
}
