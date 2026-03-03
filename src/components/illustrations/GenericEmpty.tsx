/** GenericEmpty - Universal "nothing here" illustration: document with magnifying glass. */
import { memo } from 'react';
import { View } from 'react-native';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface IllustrationProps { width?: number; height?: number }

export const GenericEmpty = memo(function GenericEmpty({ width = 160, height = 140 }: IllustrationProps) {
  const { theme } = useUnistyles();
  return (
    <View style={[styles.root, { width, height }]} accessibilityLabel="Nenhum dado">
      <View style={[styles.bgCircle, { backgroundColor: withOpacity(theme.colors.primary, 0.06) }]} />
      <View style={[styles.doc, { backgroundColor: theme.colors.white, borderColor: theme.colors.gray300 }]}>
        <View style={[styles.ln, styles.ln1, { backgroundColor: theme.colors.gray200 }]} />
        <View style={[styles.ln, styles.ln2, { backgroundColor: theme.colors.gray200 }]} />
        <View style={[styles.ln, styles.ln3, { backgroundColor: theme.colors.gray200 }]} />
      </View>
      <View style={[styles.fold, { backgroundColor: theme.colors.gray200, borderColor: theme.colors.gray300 }]} />
      <View style={styles.mag}>
        <View style={[styles.magC, { borderColor: theme.colors.gray400 }]} />
        <View style={[styles.magH, { backgroundColor: theme.colors.gray400 }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create((_theme: Theme) => ({
  root: { alignItems: 'center', justifyContent: 'center' },
  bgCircle: { position: 'absolute', width: 80, height: 80, borderRadius: 40 },
  doc: {
    position: 'absolute', width: 50, height: 60, borderRadius: 4, borderWidth: 1.5,
    left: 42, top: 30, paddingTop: 14, paddingHorizontal: 8,
  },
  ln: { height: 3, borderRadius: 1.5, marginBottom: 6 },
  ln1: { width: '80%' as unknown as number },
  ln2: { width: '60%' as unknown as number },
  ln3: { width: '70%' as unknown as number },
  fold: {
    position: 'absolute', width: 14, height: 14, left: 79, top: 30,
    borderBottomLeftRadius: 4, borderLeftWidth: 1.5, borderBottomWidth: 1.5,
  },
  mag: { position: 'absolute', right: 36, bottom: 28 },
  magC: { width: 20, height: 20, borderRadius: 10, borderWidth: 2.5 },
  magH: {
    width: 2.5, height: 12, borderRadius: 1.25,
    position: 'absolute', bottom: -8, right: -4, transform: [{ rotate: '45deg' }],
  },
}));
