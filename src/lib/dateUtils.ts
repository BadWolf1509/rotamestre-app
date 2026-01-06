/**
 * Utilitários de manipulação de datas
 * Funções compartilhadas para parsing e formatação de datas em formato brasileiro
 */

/**
 * Parse de data no formato YYYY-MM-DD para Date local
 * Evita problemas de timezone criando a data com componentes locais
 *
 * @param dateStr - String no formato YYYY-MM-DD
 * @returns Date local ou null se inválido
 */
export function parseLocalDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/**
 * Formata data para exibição no formato brasileiro (DD/MM/YYYY)
 *
 * @param dateStr - String no formato YYYY-MM-DD
 * @returns Data formatada ou '-' se inválido
 */
export function formatDateBR(dateStr: string | undefined | null): string {
  const date = parseLocalDate(dateStr);
  return date ? date.toLocaleDateString('pt-BR') : '-';
}

/**
 * Formata data e hora para exibição no formato brasileiro
 *
 * @param dateStr - String ISO ou timestamp
 * @param options - Opções de formatação
 * @returns Data/hora formatada ou '-' se inválido
 */
export function formatDateTimeBR(
  dateStr: string | undefined | null,
  options: {
    showYear?: boolean;
    showSeconds?: boolean;
  } = {}
): string {
  if (!dateStr) return '-';

  const { showYear = false, showSeconds = false } = options;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';

    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      ...(showYear && { year: 'numeric' }),
      hour: '2-digit',
      minute: '2-digit',
      ...(showSeconds && { second: '2-digit' }),
    });
  } catch {
    return '-';
  }
}

/**
 * Retorna a data atual no formato YYYY-MM-DD (para queries)
 * Usa data local para evitar problemas de timezone
 */
export function getTodayISO(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Verifica se uma data é hoje
 */
export function isToday(dateStr: string | undefined | null): boolean {
  const date = parseLocalDate(dateStr);
  if (!date) return false;

  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Verifica se uma data é no passado (antes de hoje)
 */
export function isPast(dateStr: string | undefined | null): boolean {
  const date = parseLocalDate(dateStr);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return date < today;
}

/**
 * Retorna diferença em dias entre duas datas
 */
export function daysDifference(
  dateStr1: string | undefined | null,
  dateStr2: string | undefined | null
): number | null {
  const date1 = parseLocalDate(dateStr1);
  const date2 = parseLocalDate(dateStr2);

  if (!date1 || !date2) return null;

  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
