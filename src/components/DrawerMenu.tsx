/**
 * DrawerMenu - Re-export for backwards compatibility
 *
 * The component has been refactored into modular subcomponents:
 * - @/components/drawer/DrawerMenu.tsx (main component)
 * - @/components/drawer/DrawerHeader.tsx
 * - @/components/drawer/DrawerMenuItems.tsx
 * - @/components/drawer/DrawerFooter.tsx
 * - @/components/drawer/DrawerContactModal.tsx
 * - @/components/drawer/hooks/useDrawerLogout.ts
 * - @/components/drawer/hooks/useDrawerContact.ts
 */

export { DrawerMenu } from './drawer';
export type { DrawerMenuProps, GestorData, MenuItem } from './drawer';
