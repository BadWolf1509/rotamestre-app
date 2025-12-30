import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  GridItem,
  Icon,
  Input,
  MetricCard,
  ResponsiveGrid,
  Text as DSText,
  Toast,
} from '@/design-system';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type TableRow = {
  id: string;
  motorista: string;
  status: 'em_andamento' | 'pendente' | 'concluida';
  rotas: number;
};

export default function DesignSystemScreen() {
  const { theme } = useUnistyles();
  const [inputValue, setInputValue] = useState('');
  const [errorValue, setErrorValue] = useState('Invalido');
  const [toastVisible, setToastVisible] = useState(false);
  const themeName = UnistylesRuntime.themeName ?? 'adaptive';
  const normalizedThemeName = themeName.toLowerCase();
  const densityLabel = normalizedThemeName.includes('compact') ? 'Compact' : 'Regular';
  const contrastLabel = normalizedThemeName.includes('highcontrast') ? 'High' : 'Normal';

  const swatches = useMemo(
    () => [
      { label: 'Primary', color: theme.colors.primary },
      { label: 'Secondary', color: theme.colors.secondary },
      { label: 'Success', color: theme.colors.success },
      { label: 'Warning', color: theme.colors.warning },
      { label: 'Error', color: theme.colors.error },
      { label: 'Info', color: theme.colors.info },
      { label: 'Gray 200', color: theme.colors.gray200 },
      { label: 'Gray 500', color: theme.colors.gray500 },
      { label: 'Gray 900', color: theme.colors.gray900 },
    ],
    [theme]
  );

  const tableData = useMemo<TableRow[]>(
    () => [
      { id: '1', motorista: 'Maria Silva', status: 'em_andamento' as const, rotas: 8 },
      { id: '2', motorista: 'Joao Santos', status: 'pendente' as const, rotas: 4 },
      { id: '3', motorista: 'Ana Pereira', status: 'concluida' as const, rotas: 12 },
    ],
    []
  );

  const tableColumns = useMemo(
    () => [
      { key: 'motorista', label: 'Motorista' },
      {
        key: 'status',
        label: 'Status',
        render: (item: TableRow) => <Badge status={item.status} />,
      },
      { key: 'rotas', label: 'Rotas' },
    ],
    []
  );

  const tableActions = useMemo(
    () => [
      {
        label: 'Ver',
        icon: 'eye-outline',
        onPress: () => setToastVisible(true),
        type: 'secondary' as const,
      },
    ],
    [setToastVisible]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Design System</Text>
      <Text style={styles.subtitle}>Tokens and components preview</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Colors</Text>
        <View style={styles.swatchGrid}>
          {swatches.map((swatch) => (
            <View key={swatch.label} style={styles.swatchItem}>
              <View style={[styles.swatchColor, { backgroundColor: swatch.color }]} />
              <Text style={styles.swatchLabel}>{swatch.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Typography</Text>
        <Text style={styles.typeDisplay}>Display text</Text>
        <Text style={styles.typeHeading}>Heading text</Text>
        <Text style={styles.typeBody}>Body text sample with normal line height.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Theme Variants</Text>
        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Theme name</Text>
          <Text style={styles.tokenValue}>{themeName}</Text>
        </View>
        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Density</Text>
          <Text style={styles.tokenValue}>{densityLabel}</Text>
        </View>
        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Contrast</Text>
          <Text style={styles.tokenValue}>{contrastLabel}</Text>
        </View>
        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Desktop input height</Text>
          <Text style={styles.tokenValue}>{theme.desktop.input.height}px</Text>
        </View>
        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Desktop button height</Text>
          <Text style={styles.tokenValue}>{theme.desktop.button.height}px</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Motion</Text>
        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Duration / fast</Text>
          <Text style={styles.tokenValue}>{theme.motion.duration.fast}ms</Text>
        </View>
        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Duration / normal</Text>
          <Text style={styles.tokenValue}>{theme.motion.duration.normal}ms</Text>
        </View>
        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Duration / slow</Text>
          <Text style={styles.tokenValue}>{theme.motion.duration.slow}ms</Text>
        </View>
        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Easing / easeOut</Text>
          <Text style={styles.tokenValue}>{theme.motion.easing.easeOut}</Text>
        </View>
        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Easing / easeInOut</Text>
          <Text style={styles.tokenValue}>{theme.motion.easing.easeInOut}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Components</Text>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Card</Text>
          <Text style={styles.cardBody}>This is a base card component.</Text>
          <View style={styles.badgeRow}>
            <Badge status="pendente" />
            <Badge status="em_andamento" />
            <Badge status="concluida" />
          </View>
        </Card>

        <View style={styles.componentGroup}>
          <Text style={styles.groupTitle}>Buttons</Text>
          <View style={styles.buttonRow}>
            <Button title="Small" size="small" onPress={() => setToastVisible(true)} />
            <Button title="Medium" onPress={() => setToastVisible(true)} />
            <Button title="Large" size="large" onPress={() => setToastVisible(true)} />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Ghost" variant="ghost" onPress={() => setToastVisible(true)} />
            <Button title="Danger" variant="danger" onPress={() => setToastVisible(true)} />
            <Button title="Loading" loading onPress={() => setToastVisible(true)} />
            <Button title="Disabled" disabled onPress={() => setToastVisible(true)} />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Icon left" icon="add" onPress={() => setToastVisible(true)} />
            <Button
              title="Icon right"
              icon="arrow-forward"
              iconPosition="right"
              variant="outline"
              onPress={() => setToastVisible(true)}
            />
          </View>
        </View>

        <View style={styles.componentGroup}>
          <Text style={styles.groupTitle}>Inputs</Text>
          <Input
            label="Default"
            placeholder="Type here..."
            value={inputValue}
            onChangeText={setInputValue}
          />
          <Input
            label="Error state"
            error="Campo obrigatorio"
            placeholder="Exemplo com erro"
            value={errorValue}
            onChangeText={setErrorValue}
          />
          <Input label="Disabled" value="Somente leitura" editable={false} />
          <Input label="Small" size="small" placeholder="Small input" />
          <Input label="Large" size="large" placeholder="Large input" />
        </View>

        <View style={styles.componentGroup}>
          <Text style={styles.groupTitle}>Text & Icon</Text>
          <View style={styles.iconRow}>
            <Icon name="checkmark-circle" tone="success" />
            <Icon name="alert-circle" tone="warning" />
            <Icon name="information-circle" tone="primary" />
          </View>
          <DSText variant="title">Titulo do sistema</DSText>
          <DSText variant="subtitle" tone="muted">
            Subtitulo com tom neutro
          </DSText>
          <DSText variant="body">Texto base para descricoes e instrucoes.</DSText>
        </View>

        <View style={styles.componentGroup}>
          <Text style={styles.groupTitle}>Feature Cards</Text>
          <ResponsiveGrid>
            <GridItem span={{ desktop: 1, tablet: 1, mobile: 1 }}>
              <MetricCard
                title="Rotas Hoje"
                value="24"
                subtitle="Meta diaria"
                trend="up"
                icon={<Icon name="map" tone="primary" />}
                color={theme.colors.primary}
              />
            </GridItem>
            <GridItem span={{ desktop: 1, tablet: 1, mobile: 1 }}>
              <MetricCard
                title="Incidentes"
                value="2"
                subtitle="Ultimas 24h"
                trend="down"
                icon={<Icon name="alert-circle" tone="warning" />}
                color={theme.colors.warning}
              />
            </GridItem>
            <GridItem span={{ desktop: 1, tablet: 1, mobile: 1 }}>
              <MetricCard
                title="Distancia"
                value="145 km"
                subtitle="Total do dia"
                trend="neutral"
                icon={<Icon name="speedometer" tone="muted" />}
                color={theme.colors.gray300}
              />
            </GridItem>
          </ResponsiveGrid>
        </View>

        <View style={styles.componentGroup}>
          <Text style={styles.groupTitle}>DataTable</Text>
          <DataTable
            data={tableData}
            columns={tableColumns}
            actions={tableActions}
            keyExtractor={(item) => item.id}
            pagination={false}
          />
        </View>

        <EmptyState
          title="No data"
          description="This is an example of the EmptyState component."
          actionLabel="Action"
          onActionPress={() => setToastVisible(true)}
        />
      </View>

      <Toast
        visible={toastVisible}
        type="success"
        message="Toast example"
        onHide={() => setToastVisible(false)}
        testID="design-system-toast"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray600,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  swatchItem: {
    width: 110,
    gap: theme.spacing.xs,
  },
  swatchColor: {
    height: 32,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  swatchLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray600,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  tokenLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
  },
  tokenValue: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  typeDisplay: {
    fontSize: theme.typography.fontSize['3xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
  },
  typeHeading: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  typeBody: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
  },
  card: {
    gap: theme.spacing.sm,
  },
  cardTitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  cardBody: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray600,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  componentGroup: {
    gap: theme.spacing.sm,
  },
  groupTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  iconRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
}));
