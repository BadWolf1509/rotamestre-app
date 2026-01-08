/**
 * Common Utility Functions
 *
 * Generic helper functions used across the application.
 */

/**
 * Group array items by a key or key extractor function
 * @param array - Array to group
 * @param keyOrFn - Property key or function to extract group key
 * @returns Object with grouped items
 */
export function groupBy<T>(
  array: T[],
  keyOrFn: keyof T | ((item: T) => string)
): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const group = typeof keyOrFn === 'function' ? keyOrFn(item) : String(item[keyOrFn]);
      if (!result[group]) {
        result[group] = [];
      }
      result[group].push(item);
      return result;
    },
    {} as Record<string, T[]>
  );
}

/**
 * Escape HTML characters to prevent XSS
 * Use whenever inserting user data into HTML strings
 * @param unsafe - Potentially dangerous string
 * @returns Safe string with HTML characters escaped
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
