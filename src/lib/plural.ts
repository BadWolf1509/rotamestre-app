import { formatarDecimal } from '@/lib/formatNumber';

/**
 * Devolve "<n> <forma>" com a concordância certa, no lugar do "(s)".
 * Só o 1 usa o singular (0 e 2+ usam o plural). `n` inteiro sai como está;
 * não inteiro sai com vírgula, por `formatarDecimal`.
 *
 * @example plural(1, 'rota', 'rotas') // '1 rota'
 * @example plural(0, 'rota', 'rotas') // '0 rotas'
 */
export function plural(
  n: number,
  singular: string,
  pluralForma: string,
): string {
  const numero = Number.isInteger(n) ? String(n) : formatarDecimal(n);
  return `${numero} ${n === 1 ? singular : pluralForma}`;
}
