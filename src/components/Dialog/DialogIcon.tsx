/**
 * DialogIcon - Icon component for Dialog
 * Renders the appropriate icon based on dialog variant and type
 */
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { View } from 'react-native';

import type { IconName } from '@/types/icons';

import { DialogVariant, DialogType, ICON_MAP, ALERT_ICON_MAP } from './Dialog.types';

import type { ViewStyle, StyleProp } from 'react-native';

interface DialogIconProps {
  variant: DialogVariant;
  type: DialogType;
  iconColor: string;
  iconBgColor: string;
  size?: number;
  containerSize?: number;
  style?: StyleProp<ViewStyle>;
}

/** Get icon name based on variant and type */
export function getIconName(variant: DialogVariant, type: DialogType): IconName {
  if (variant === 'alert') {
    return ALERT_ICON_MAP[type] || ALERT_ICON_MAP.default;
  }
  return ICON_MAP[type] || ICON_MAP.default;
}

/**
 * DialogIcon component
 * Memoized to prevent unnecessary re-renders
 */
export const DialogIcon = memo(function DialogIcon({
  variant,
  type,
  iconColor,
  iconBgColor,
  size = 28,
  containerSize = 56,
  style,
}: DialogIconProps) {
  const iconName = getIconName(variant, type);

  return (
    <View
      style={[
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: iconBgColor,
          justifyContent: 'center',
          alignItems: 'center',
          alignSelf: 'center',
        },
        style,
      ]}
    >
      <Ionicons name={iconName} size={size} color={iconColor} />
    </View>
  );
});

export default DialogIcon;
