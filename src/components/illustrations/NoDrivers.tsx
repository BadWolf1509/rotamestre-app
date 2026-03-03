/** NoDrivers - Empty drivers illustration: person silhouette, car, and "+" accent. */
import { memo } from 'react';
import { View } from 'react-native';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface IllustrationProps { width?: number; height?: number }

export const NoDrivers = memo(function NoDrivers({ width = 160, height = 140 }: IllustrationProps) {
  const { theme } = useUnistyles();
  const plusColor = withOpacity(theme.colors.primary, 0.4);
  return (
    <View style={[styles.root, { width, height }]} accessibilityLabel="Nenhum motorista">
      <View style={[styles.bgCircle, { backgroundColor: withOpacity(theme.colors.gray400, 0.08) }]} />
      <View style={styles.person}>
        <View style={[styles.head, { backgroundColor: theme.colors.gray300 }]} />
        <View style={[styles.body, { backgroundColor: theme.colors.gray300 }]} />
      </View>
      <View style={styles.car}>
        <View style={[styles.carBody, { backgroundColor: theme.colors.gray200 }]} />
        <View style={[styles.wheelL, { backgroundColor: theme.colors.gray400 }]} />
        <View style={[styles.wheelR, { backgroundColor: theme.colors.gray400 }]} />
      </View>
      <View style={styles.plus}>
        <View style={[styles.plusH, { backgroundColor: plusColor }]} />
        <View style={[styles.plusV, { backgroundColor: plusColor }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create((_theme: Theme) => ({
  root: { alignItems: 'center', justifyContent: 'center' },
  bgCircle: { position: 'absolute', width: 80, height: 80, borderRadius: 40 },
  person: { position: 'absolute', left: 40, top: 40, alignItems: 'center' },
  head: { width: 16, height: 16, borderRadius: 8 },
  body: { width: 24, height: 30, borderRadius: 6, marginTop: 4 },
  car: { position: 'absolute', right: 28, top: 55 },
  carBody: { width: 50, height: 25, borderRadius: 8 },
  wheelL: { position: 'absolute', bottom: -4, left: 6, width: 10, height: 10, borderRadius: 5 },
  wheelR: { position: 'absolute', bottom: -4, right: 6, width: 10, height: 10, borderRadius: 5 },
  plus: { position: 'absolute', right: 30, top: 32 },
  plusH: { width: 16, height: 3, borderRadius: 1.5, position: 'absolute', top: 6.5 },
  plusV: { width: 3, height: 16, borderRadius: 1.5, position: 'absolute', left: 6.5 },
}));
