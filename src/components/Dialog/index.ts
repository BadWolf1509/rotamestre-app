/**
 * Dialog component - unified alert/confirm/destructive dialogs
 * @module components/Dialog
 */

// Main component
export { Dialog, default } from './Dialog';

// Types
export type {
  DialogProps,
  DialogVariant,
  DialogType,
} from './Dialog.types';

// Sub-components (for advanced use cases)
export { DialogIcon, getIconName } from './DialogIcon';
export { DialogButtons } from './DialogButtons';
export { DialogDestructiveInput } from './DialogDestructiveInput';
export { DialogWeb } from './DialogWeb';
