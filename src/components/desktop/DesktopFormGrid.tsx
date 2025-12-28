/**
 * DesktopFormGrid - Grid responsivo para formulários
 *
 * Automaticamente muda de 2 colunas (desktop) para 1 coluna (mobile/tablet).
 * Campos curtos como Destinatário e Telefone ficam lado a lado em desktop.
 *
 * @example
 * <DesktopFormGrid columns={2}>
 *   <Input label="Destinatário" />
 *   <Input label="Telefone" />
 * </DesktopFormGrid>
 */

import React from 'react';
import { View, Platform } from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface DesktopFormGridProps {
  /** Number of columns (default: 2 on desktop, 1 on mobile) */
  columns?: 1 | 2;
  /** Gap between items (default: uses theme.desktop.section.gap) */
  gap?: number;
  /** Children to render in grid */
  children: React.ReactNode;
  /** Test ID for testing */
  testID?: string;
}

export function DesktopFormGrid({
  columns = 2,
  gap,
  children,
  testID,
}: DesktopFormGridProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();

  // Determine actual columns based on viewport
  const actualColumns = isDesktop ? columns : 1;
  const actualGap = gap ?? (isDesktop ? theme.desktop.section.gap : theme.spacing.md);

  // Filter out null/undefined children
  const validChildren = React.Children.toArray(children).filter(Boolean);

  // Web: Use CSS Grid for proper layout
  if (Platform.OS === 'web') {
    return (
      <div
        data-testid={testID}
        style={{
          display: 'grid',
          gridTemplateColumns: actualColumns === 2 ? '1fr 1fr' : '1fr',
          gap: actualGap,
        }}
      >
        {validChildren}
      </div>
    );
  }

  // Native: Use flexbox with wrap
  if (actualColumns === 1) {
    return (
      <View style={[styles.container, { gap: actualGap }]} testID={testID}>
        {validChildren.map((child, index) => (
          <View key={index} style={styles.fullWidth}>
            {child}
          </View>
        ))}
      </View>
    );
  }

  // 2 columns layout for native
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < validChildren.length; i += 2) {
    rows.push(validChildren.slice(i, i + 2));
  }

  return (
    <View style={styles.container} testID={testID}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { gap: actualGap, marginBottom: actualGap }]}>
          {row.map((child, colIndex) => (
            <View key={colIndex} style={styles.column}>
              {child}
            </View>
          ))}
          {/* Fill empty space if row has only 1 item */}
          {row.length === 1 && <View style={styles.column} />}
        </View>
      ))}
    </View>
  );
}

/**
 * DesktopFormField - Wrapper for a single field with compact desktop spacing
 *
 * Use this around individual fields that should use desktop density.
 *
 * @example
 * <DesktopFormField>
 *   <Input label="Nome" value={nome} />
 * </DesktopFormField>
 */
interface DesktopFormFieldProps {
  children: React.ReactNode;
  /** Full width (span 2 columns in grid) */
  fullWidth?: boolean;
  testID?: string;
}

export function DesktopFormField({
  children,
  fullWidth = false,
  testID,
}: DesktopFormFieldProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();

  const marginBottom = isDesktop ? theme.desktop.field.marginBottom : theme.spacing.md;

  if (Platform.OS === 'web') {
    return (
      <div
        data-testid={testID}
        style={{
          marginBottom,
          ...(fullWidth ? { gridColumn: '1 / -1' } : {}),
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <View style={{ marginBottom }} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create((_theme: Theme) => ({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
  },
  fullWidth: {
    width: '100%',
  },
}));
