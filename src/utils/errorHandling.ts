/**
 * Error Handling Hierarchy
 *
 * Standardizes how errors are communicated across the app.
 * Use these helpers instead of raw Alert.alert/console calls.
 *
 * Hierarchy:
 * 1. Critical (data loss risk): logger.error() + toast.error()
 * 2. Warning (degraded experience): logger.warn() + toast.warn() (optional)
 * 3. Silent (non-critical/expected): comment explaining why silent
 *
 * Platform notes:
 * - Alert.alert works on iOS/Android but NOT on web
 * - Use toast for web-compatible notifications
 */

import { logger } from '@/lib/logger';
import { toast } from '@/utils/toast';

/**
 * Show an error to the user with logging.
 * Uses toast (works on all platforms including web).
 */
export function showError(title: string, message: string) {
  logger.error(`[${title}] ${message}`);
  toast.error(message, title);
}

/**
 * Show a warning to the user.
 * Uses toast (works on all platforms including web).
 */
export function showWarning(title: string, message: string) {
  logger.warn(`[${title}] ${message}`);
  toast.warning(message, title);
}

/**
 * Show an informational message to the user.
 * Uses toast (works on all platforms including web).
 */
export function showInfo(title: string, message: string) {
  toast.info(message, title);
}

/**
 * Show a success message to the user.
 * Uses toast (works on all platforms including web).
 */
export function showSuccess(title: string, message: string) {
  toast.success(message, title);
}
