/**
 * Tooltip - Hover/press tooltip
 *
 * Shows additional context on hover (web) or long-press (mobile).
 *
 * @example
 * ```tsx
 * <Tooltip content="Distância total percorrida hoje">
 *   <Text>12.5 km</Text>
 * </Tooltip>
 * ```
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  LayoutChangeEvent,
} from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type TooltipPosition = 'top' | 'bottom';

export interface TooltipProps {
  /** Tooltip text content */
  content: string;
  /** Position relative to children */
  position?: TooltipPosition;
  /** Wrapped element */
  children: React.ReactNode;
  /** Max width of tooltip */
  maxWidth?: number;
  /** Test ID */
  testID?: string;
}

export function Tooltip({
  content,
  position = 'top',
  children,
  maxWidth = 240,
  testID,
}: TooltipProps) {
  const { theme: _theme } = useUnistyles();
  const [visible, setVisible] = useState(false);
  const [childWidth, setChildWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleLayout = (e: LayoutChangeEvent) => {
    setChildWidth(e.nativeEvent.layout.width);
  };

  const show = () => {
    clearTimeout(timerRef.current);
    setVisible(true);
  };

  const hide = () => {
    timerRef.current = setTimeout(() => setVisible(false), 100);
  };

  const webHoverProps = Platform.OS === 'web'
    ? {
        onHoverIn: show,
        onHoverOut: hide,
      }
    : {};

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      <Pressable
        testID={testID}
        onLongPress={Platform.OS !== 'web' ? show : undefined}
        onPressOut={Platform.OS !== 'web' ? hide : undefined}
        {...webHoverProps}
      >
        {children}
      </Pressable>

      {visible && (
        <View
          style={[
            styles.tooltip,
            { maxWidth, left: childWidth / 2 },
            position === 'top' ? styles.tooltipTop : styles.tooltipBottom,
          ]}
          pointerEvents="none"
        >
          <Text style={styles.text}>{content}</Text>
          <View
            style={[
              styles.arrow,
              position === 'top' ? styles.arrowBottom : styles.arrowTop,
              { left: 0, transform: [{ translateX: -6 }] },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  wrapper: {
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: theme.colors.gray900,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing['1.5'],
    paddingHorizontal: theme.spacing['2.5'],
    zIndex: 9999,
    transform: [{ translateX: '-50%' as any }],
    ...(Platform.OS === 'web' && { pointerEvents: 'none' as any }),
  },
  tooltipTop: {
    bottom: '100%',
    marginBottom: 8,
  },
  tooltipBottom: {
    top: '100%',
    marginTop: 8,
  },
  text: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.white,
    lineHeight: theme.typography.fontSize.xs * 1.4,
    textAlign: 'center',
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    left: '50%' as any,
  },
  arrowBottom: {
    bottom: -5,
    borderTopWidth: 6,
    borderTopColor: theme.colors.gray900,
  },
  arrowTop: {
    top: -5,
    borderBottomWidth: 6,
    borderBottomColor: theme.colors.gray900,
  },
}));

export default Tooltip;
