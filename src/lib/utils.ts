/**
 * Utility Functions - Barrel Export
 *
 * Re-exports from specialized modules for backwards compatibility.
 * Prefer importing directly from the specific modules:
 * - @/lib/timeline - Timeline event mapping and formatting
 * - @/lib/common - Generic utilities (groupBy, escapeHtml)
 * - @/lib/dateUtils - Date parsing and formatting
 */

// Common utilities
export { groupBy, escapeHtml } from './common';

// Timeline utilities
export {
  // Constants
  TIMELINE_LOG_EVENTS,
  INCIDENTE_LABELS,
  CRITICAL_INCIDENT_CATEGORIES,
  // Types
  type TimelineLogEvent,
  type TimelinePreviewEventType,
  type TimelinePreviewEvent,
  type TimelineSemanticColor,
  type TimelineEventType,
  type TimelineEventMapped,
  // Functions
  isTimelineLogEvent,
  mapLogToTimelinePreview,
  mapLogToTimelineEvent,
  mapParadaToTimelineEvent,
  mapIncidenteToTimelineEvent,
  formatRelativeTime,
  getDateGroup,
  calculateDurationBetween,
} from './timeline';
