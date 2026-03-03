/**
 * Barrel exports for all reusable components.
 *
 * Usage:
 * ```ts
 * import { Button, Input, Card, Toast } from '@/components';
 * ```
 */

// --- Core UI ---
export { Button } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';

export { Input } from './Input';

export { default as Text } from './Text';

export { Card } from './Card';

export { Badge } from './Badge';

export { StatusBadge } from './StatusBadge';

export { Avatar } from './Avatar';

export { AvatarEditable } from './AvatarEditable';

export { Icon } from './Icon';

export { Progress } from './Progress';

export { default as Slider } from './Slider';

export { FilterChip } from './FilterChip';

export { StepIndicator } from './StepIndicator';

// --- Feedback ---
export { Toast } from './Toast';
export type { ToastProps, ToastType } from './Toast';

export { EmptyState } from './EmptyState';

export { Skeleton as SkeletonLoader, SkeletonCard, SkeletonList } from './SkeletonLoader';

export { ConnectivityBanner } from './ConnectivityBanner';

// --- Data Display ---
export { DataTable } from './DataTable';

export { RouteTimeline } from './RouteTimeline';

export { RouteFilters } from './RouteFilters';

// --- Layout ---
export { ResponsiveContainer } from './ResponsiveContainer';

// --- Overlays ---
export { Modal } from './Modal';

export { Dialog } from './Dialog';

export { SupportModal } from './SupportModal';

export { IncidentReportWizard } from './IncidentReportWizard';

// --- Form ---
export { AddressAutocomplete } from './AddressAutocomplete';

export { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

export { Radio, RadioGroup } from './Radio';
export type { RadioProps, RadioGroupProps, RadioOption } from './Radio';

export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';

// --- Inline Alerts ---
export { Alert } from './Alert';
export type { AlertProps } from './Alert';

// --- Media ---
export { default as CameraUpload } from './CameraUpload';

// --- Navigation ---
export { DrawerMenu } from './DrawerMenu';

export { NotificationBell } from './NotificationBell';

export { NotificationList } from './NotificationList';

export { UserMenuTrigger } from './UserMenuTrigger';

export { SeletorUnidade } from './SeletorUnidade';

export { ThemeSettings } from './ThemeSettings';

// --- Maps ---
export { MapaAdapter } from './MapaAdapter';

// --- Errors ---
export { ErrorBoundary } from './ErrorBoundary';

// --- Animation ---
export { AnimatedListItem } from './AnimatedListItem';

// --- Gesture ---
export { SwipeableRow } from './SwipeableRow';

// --- Tooltip ---
export { Tooltip } from './Tooltip';
export type { TooltipProps } from './Tooltip';

// --- Navigation UI ---
export { Breadcrumbs } from './Breadcrumbs';
export type { BreadcrumbsProps, BreadcrumbItem } from './Breadcrumbs';

export { Tabs } from './Tabs';
export type { TabsProps, TabItem } from './Tabs';

// --- Onboarding ---
export { SwipeOnboarding } from './SwipeOnboarding';

// --- Auth ---
export { AuthLoadingScreen } from './AuthLoadingScreen';
