/** NoNotifications - Empty notifications illustration: bell with sleep dots. */
import { memo } from 'react';
import { View } from 'react-native';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface IllustrationProps { width?: number; height?: number }

export const NoNotifications = memo(function NoNotifications({
  width = 160, height = 140,
}: IllustrationProps) {
  const { theme } = useUnistyles();
  return (
    <View style={[styles.root, { width, height }]} accessibilityLabel="Nenhuma notificacao">
      <View style={[styles.bgCircle, { backgroundColor: withOpacity(theme.colors.warning, 0.08) }]} />
      <View style={styles.bell}>
        <View style={[styles.bellTop, { backgroundColor: theme.colors.gray300 }]} />
        <View style={[styles.bellBody, { backgroundColor: theme.colors.gray300 }]} />
        <View style={[styles.bellBase, { backgroundColor: theme.colors.gray300 }]} />
        <View style={[styles.clapper, { backgroundColor: theme.colors.gray400 }]} />
      </View>
      <View style={[styles.z, styles.z1, { backgroundColor: theme.colors.gray300 }]} />
      <View style={[styles.z, styles.z2, { backgroundColor: withOpacity(theme.colors.gray300, 0.7) }]} />
      <View style={[styles.z, styles.z3, { backgroundColor: withOpacity(theme.colors.gray300, 0.4) }]} />
    </View>
  );
});

const styles = StyleSheet.create((_theme: Theme) => ({
  root: { alignItems: 'center', justifyContent: 'center' },
  bgCircle: { position: 'absolute', width: 70, height: 70, borderRadius: 35 },
  bell: { position: 'absolute', alignItems: 'center', top: 35 },
  bellTop: { width: 8, height: 8, borderRadius: 4 },
  bellBody: {
    width: 30, height: 35, marginTop: -2,
    borderTopLeftRadius: 15, borderTopRightRadius: 15,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
  },
  bellBase: { width: 40, height: 6, borderRadius: 3, marginTop: -1 },
  clapper: { width: 10, height: 6, borderRadius: 3, marginTop: 2 },
  z: { position: 'absolute', borderRadius: 3 },
  z1: { width: 6, height: 6, right: 42, top: 42 },
  z2: { width: 5, height: 5, right: 34, top: 34 },
  z3: { width: 4, height: 4, right: 26, top: 28 },
}));
