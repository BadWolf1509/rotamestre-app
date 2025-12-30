export function withOpacity(color: string, opacity: number): string {
  if (!color) {
    return color;
  }

  const normalized = color.startsWith('#') ? color.slice(1) : color;
  const hex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : normalized;

  if (hex.length !== 6) {
    return color;
  }

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
  color: string,
  opacity: number
): string {
  const spreadValue = spread ? ` ${spread}px` : '';
  return `${offsetX}px ${offsetY}px ${blur}px${spreadValue} ${withOpacity(color, opacity)}`;
}

export function dropShadow(
  offsetX: number,
  offsetY: number,
  blur: number,
  color: string,
  opacity: number
): string {
  return `drop-shadow(${offsetX}px ${offsetY}px ${blur}px ${withOpacity(color, opacity)})`;
}

export function textShadow(
  offsetX: number,
  offsetY: number,
  blur: number,
  color: string,
  opacity: number
): string {
  return `${offsetX}px ${offsetY}px ${blur}px ${withOpacity(color, opacity)}`;
}
