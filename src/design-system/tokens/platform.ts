import { withOpacity } from '@/utils/color';
import { defaultTheme } from '@/utils/styles.base';

export const platformOverrides = {
  ios: {
    touchTarget: {
      minSize: 44,
    },
    shadow: {
      opacity: 0.12,
      radius: 6,
      offsetY: 2,
    },
  },
  android: {
    touchTarget: {
      minSize: 48,
    },
    ripple: {
      color: withOpacity(defaultTheme.colors.black, 0.12),
    },
    shadow: {
      elevation: 4,
    },
  },
  web: {
    touchTarget: {
      minSize: 40,
    },
    focusRing: {
      color: withOpacity(defaultTheme.colors.primary, 0.25),
      width: 2,
    },
    hover: {
      lift: 1,
    },
  },
} as const;
