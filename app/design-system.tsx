/**
 * ============================================
 * Design System Showcase
 * ============================================
 *
 * Documentação interativa do Design System RotaMestre.
 * Segue padrões de Storybook, Material UI e Chakra UI.
 *
 * Recursos:
 * - Navegação por seções
 * - Todos os tokens visuais
 * - Todos os componentes do DS
 * - Informações de acessibilidade WCAG
 * - Toggle de tema (light/dark)
 * - Código copiável
 * - Totalmente em PT-BR
 */

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Pressable,
  LayoutChangeEvent,
  TextInput,
} from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import {
  AlertDialog,
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DesktopCard,
  DesktopCardGrid,
  DesktopLayout,
  DesktopModal,
  EmptyState,
  FilterChip,
  GridItem,
  Icon,
  Input,
  MetricCard,
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileHeader,
  MobileLoading,
  Modal,
  Progress,
  ResponsiveGrid,
  Skeleton,
  SkeletonCard,
  SkeletonList,
  SplitView,
  StatusBadge,
  StepIndicator,
  SupportModal,
  SwipeableRow,
  Text as DSText,
  Toast,
  type Step,
  AddressAutocomplete,
  ConfirmModal,
  // Tokens (via @/design-system)
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  opacity,
  zIndex,
  motion,
} from '@/design-system';
import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// ============================================
// TIPOS
// ============================================

type SectionId =
  | 'navegacao'
  | 'cores'
  | 'tipografia'
  | 'espacamento'
  | 'bordas'
  | 'sombras'
  | 'opacidade'
  | 'zindex'
  | 'animacao'
  | 'tema'
  | 'botoes'
  | 'inputs'
  | 'cards'
  | 'badges'
  | 'modais'
  | 'feedback'
  | 'navegacao-comp'
  | 'dados'
  | 'desktop'
  | 'mobile'
  | 'especializados'
  | 'acessibilidade';

interface Section {
  id: SectionId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

type TableRow = {
  id: string;
  motorista: string;
  status: 'em_andamento' | 'pendente' | 'concluida';
  rotas: number;
};

// ============================================
// CONSTANTES
// ============================================

const SECTIONS: Section[] = [
  { id: 'cores', label: 'Cores', icon: 'color-palette-outline' },
  { id: 'tipografia', label: 'Tipografia', icon: 'text-outline' },
  { id: 'espacamento', label: 'Espaçamento', icon: 'resize-outline' },
  { id: 'bordas', label: 'Bordas', icon: 'square-outline' },
  { id: 'sombras', label: 'Sombras', icon: 'layers-outline' },
  { id: 'opacidade', label: 'Opacidade', icon: 'eye-outline' },
  { id: 'zindex', label: 'Z-Index', icon: 'albums-outline' },
  { id: 'animacao', label: 'Animação', icon: 'timer-outline' },
  { id: 'tema', label: 'Tema', icon: 'moon-outline' },
  { id: 'botoes', label: 'Botões', icon: 'radio-button-on-outline' },
  { id: 'inputs', label: 'Inputs', icon: 'create-outline' },
  { id: 'cards', label: 'Cards', icon: 'card-outline' },
  { id: 'badges', label: 'Badges', icon: 'pricetag-outline' },
  { id: 'modais', label: 'Modais', icon: 'browsers-outline' },
  { id: 'feedback', label: 'Feedback', icon: 'notifications-outline' },
  { id: 'navegacao-comp', label: 'Navegação', icon: 'navigate-outline' },
  { id: 'dados', label: 'Dados', icon: 'grid-outline' },
  { id: 'desktop', label: 'Desktop', icon: 'desktop-outline' },
  { id: 'mobile', label: 'Mobile', icon: 'phone-portrait-outline' },
  { id: 'especializados', label: 'Especializados', icon: 'extension-puzzle-outline' },
  { id: 'acessibilidade', label: 'Acessibilidade', icon: 'accessibility-outline' },
];

const WCAG_REQUIREMENTS = {
  normal: { AA: 4.5, AAA: 7 },
  large: { AA: 3, AAA: 4.5 },
};

// ============================================
// UTILITÁRIOS
// ============================================

function getLuminance(hex: string): number {
  const rgb = hex
    .replace('#', '')
    .match(/.{2}/g)
    ?.map((x) => {
      const c = parseInt(x, 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
  if (!rgb) return 0;
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getWCAGLevel(ratio: number): { level: string; color: string } {
  if (ratio >= WCAG_REQUIREMENTS.normal.AAA) {
    return { level: 'AAA', color: '#16a34a' };
  }
  if (ratio >= WCAG_REQUIREMENTS.normal.AA) {
    return { level: 'AA', color: '#2563eb' };
  }
  if (ratio >= WCAG_REQUIREMENTS.large.AA) {
    return { level: 'AA (grande)', color: '#ca8a04' };
  }
  return { level: 'Falha', color: '#dc2626' };
}

// ============================================
// COMPONENTES AUXILIARES
// ============================================

function CopyButton({ value, label }: { value: string; label?: string }) {
  const { theme } = useUnistyles();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <TouchableOpacity
      onPress={handleCopy}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: theme.borderRadius.sm,
        backgroundColor: copied ? theme.colors.successBg : theme.colors.gray100,
      }}
      accessibilityLabel={`Copiar ${label || value}`}
      accessibilityHint="Toque para copiar para a área de transferência"
    >
      <Ionicons
        name={copied ? 'checkmark' : 'copy-outline'}
        size={14}
        color={copied ? theme.colors.success : theme.colors.gray600}
      />
      <Text
        style={{
          fontSize: 12,
          fontFamily: theme.typography.fontSans,
          color: copied ? theme.colors.success : theme.colors.gray600,
        }}
      >
        {copied ? 'Copiado!' : value}
      </Text>
    </TouchableOpacity>
  );
}

function CodeBlock({ code, language = 'tsx' }: { code: string; language?: string }) {
  const { theme } = useUnistyles();

  return (
    <View
      style={{
        backgroundColor: theme.colors.gray900,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        marginTop: theme.spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.sm,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            fontFamily: theme.typography.fontSans,
            color: theme.colors.gray400,
            textTransform: 'uppercase',
          }}
        >
          {language}
        </Text>
        <CopyButton value={code} label="código" />
      </View>
      <Text
        style={{
          fontSize: 12,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          color: theme.colors.gray100,
          lineHeight: 18,
        }}
      >
        {code}
      </Text>
    </View>
  );
}

function SectionHeader({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description?: string;
}) {
  const { theme } = useUnistyles();

  return (
    <View
      nativeID={id}
      style={{ marginBottom: theme.spacing.md }}
      accessibilityRole="header"
    >
      <Text
        style={{
          fontSize: theme.typography.fontSize.xl,
          fontFamily: theme.typography.fontSansBold,
          color: theme.colors.gray900,
          marginBottom: description ? theme.spacing.xs : 0,
        }}
      >
        {title}
      </Text>
      {description && (
        <Text
          style={{
            fontSize: theme.typography.fontSize.sm,
            fontFamily: theme.typography.fontSans,
            color: theme.colors.gray600,
          }}
        >
          {description}
        </Text>
      )}
    </View>
  );
}

function TokenRow({
  label,
  value,
  preview,
}: {
  label: string;
  value: string | number;
  preview?: React.ReactNode;
}) {
  const { theme } = useUnistyles();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.gray100,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: theme.typography.fontSize.sm,
            fontFamily: theme.typography.fontSans,
            color: theme.colors.gray700,
          }}
        >
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        {preview}
        <CopyButton value={String(value)} />
      </View>
    </View>
  );
}

function ColorSwatch({
  label,
  color,
  showContrast = false,
}: {
  label: string;
  color: string;
  showContrast?: boolean;
}) {
  const { theme } = useUnistyles();
  const contrastWhite = getContrastRatio(color, '#FFFFFF');
  const contrastBlack = getContrastRatio(color, '#000000');
  const wcagWhite = getWCAGLevel(contrastWhite);
  const wcagBlack = getWCAGLevel(contrastBlack);
  const textColor = contrastWhite > contrastBlack ? '#FFFFFF' : '#000000';

  return (
    <View style={{ width: 140, marginBottom: theme.spacing.md }}>
      <View
        style={{
          height: 64,
          backgroundColor: color,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: theme.colors.gray200,
          justifyContent: 'flex-end',
          padding: theme.spacing.sm,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            fontFamily: theme.typography.fontSans,
            color: textColor,
          }}
        >
          {color}
        </Text>
      </View>
      <Text
        style={{
          fontSize: theme.typography.fontSize.xs,
          fontFamily: theme.typography.fontSansSemiBold,
          color: theme.colors.gray700,
          marginTop: theme.spacing.xs,
        }}
      >
        {label}
      </Text>
      {showContrast && (
        <View style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 10, color: theme.colors.gray500 }}>
            vs Branco:{' '}
            <Text style={{ color: wcagWhite.color, fontWeight: '600' }}>
              {contrastWhite.toFixed(1)} ({wcagWhite.level})
            </Text>
          </Text>
          <Text style={{ fontSize: 10, color: theme.colors.gray500 }}>
            vs Preto:{' '}
            <Text style={{ color: wcagBlack.color, fontWeight: '600' }}>
              {contrastBlack.toFixed(1)} ({wcagBlack.level})
            </Text>
          </Text>
        </View>
      )}
    </View>
  );
}

function SpacingPreview({ size, value }: { size: string; value: number }) {
  const { theme } = useUnistyles();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View
        style={{
          width: value,
          height: 24,
          backgroundColor: theme.colors.primary,
          borderRadius: 2,
        }}
      />
      <Text style={{ fontSize: 12, color: theme.colors.gray600, minWidth: 40 }}>
        {size}: {value}px
      </Text>
    </View>
  );
}

function RadiusPreview({ value }: { value: number }) {
  const { theme } = useUnistyles();

  return (
    <View
      style={{
        width: 48,
        height: 48,
        backgroundColor: theme.colors.primary,
        borderRadius: value,
      }}
    />
  );
}

function ShadowPreview({ shadow }: { shadow: typeof shadows.sm }) {
  const { theme } = useUnistyles();

  return (
    <View
      style={{
        width: 64,
        height: 64,
        backgroundColor: theme.colors.white,
        borderRadius: theme.borderRadius.md,
        ...shadow,
      }}
    />
  );
}

function OpacityPreview({ value }: { value: number }) {
  const { theme } = useUnistyles();

  return (
    <View
      style={{
        width: 48,
        height: 24,
        backgroundColor: theme.colors.primary,
        opacity: value,
        borderRadius: 4,
      }}
    />
  );
}

interface PropDefinition {
  name: string;
  type: string;
  default?: string;
  description: string;
  required?: boolean;
}

function PropsTable({ props }: { props: PropDefinition[] }) {
  const { theme } = useUnistyles();

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.colors.gray200,
        borderRadius: theme.borderRadius.md,
        overflow: 'hidden',
        marginTop: theme.spacing.sm,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme.colors.gray50,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.gray200,
        }}
      >
        <Text
          style={{
            flex: 1,
            padding: theme.spacing.sm,
            fontSize: 11,
            fontFamily: theme.typography.fontSansSemiBold,
            color: theme.colors.gray700,
          }}
        >
          Prop
        </Text>
        <Text
          style={{
            flex: 1.5,
            padding: theme.spacing.sm,
            fontSize: 11,
            fontFamily: theme.typography.fontSansSemiBold,
            color: theme.colors.gray700,
          }}
        >
          Tipo
        </Text>
        <Text
          style={{
            flex: 0.7,
            padding: theme.spacing.sm,
            fontSize: 11,
            fontFamily: theme.typography.fontSansSemiBold,
            color: theme.colors.gray700,
          }}
        >
          Default
        </Text>
        <Text
          style={{
            flex: 2,
            padding: theme.spacing.sm,
            fontSize: 11,
            fontFamily: theme.typography.fontSansSemiBold,
            color: theme.colors.gray700,
          }}
        >
          Descrição
        </Text>
      </View>

      {/* Rows */}
      {props.map((prop, index) => (
        <View
          key={prop.name}
          style={{
            flexDirection: 'row',
            borderBottomWidth: index < props.length - 1 ? 1 : 0,
            borderBottomColor: theme.colors.gray100,
          }}
        >
          <View style={{ flex: 1, padding: theme.spacing.sm }}>
            <Text
              style={{
                fontSize: 12,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                color: theme.colors.primary,
              }}
            >
              {prop.name}
              {prop.required && <Text style={{ color: theme.colors.error }}>*</Text>}
            </Text>
          </View>
          <View style={{ flex: 1.5, padding: theme.spacing.sm }}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                color: theme.colors.gray600,
              }}
            >
              {prop.type}
            </Text>
          </View>
          <View style={{ flex: 0.7, padding: theme.spacing.sm }}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: theme.typography.fontSans,
                color: theme.colors.gray500,
              }}
            >
              {prop.default || '-'}
            </Text>
          </View>
          <View style={{ flex: 2, padding: theme.spacing.sm }}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: theme.typography.fontSans,
                color: theme.colors.gray600,
              }}
            >
              {prop.description}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ============================================
// COMPONENTE DO'S AND DON'TS
// ============================================

interface DosDontsProps {
  dos: string[];
  donts: string[];
}

function DosDonts({ dos, donts }: DosDontsProps) {
  const { theme } = useUnistyles();

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing.md,
        marginTop: theme.spacing.md,
      }}
    >
      {/* Dos Column */}
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.successBg,
          borderRadius: theme.borderRadius.md,
          padding: theme.spacing.md,
          borderLeftWidth: 3,
          borderLeftColor: theme.colors.success,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            marginBottom: theme.spacing.sm,
          }}
        >
          <Icon name="checkmark-circle" size={20} color={theme.colors.success} />
          <Text
            style={{
              fontSize: 14,
              fontFamily: theme.typography.fontSansSemiBold,
              color: theme.colors.success,
            }}
          >
            Faça
          </Text>
        </View>
        {dos.map((item, index) => (
          <Text
            key={index}
            style={{
              fontSize: 12,
              fontFamily: theme.typography.fontSans,
              color: theme.colors.text,
              marginBottom: index < dos.length - 1 ? theme.spacing.xs : 0,
            }}
          >
            • {item}
          </Text>
        ))}
      </View>

      {/* Don'ts Column */}
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.errorBg,
          borderRadius: theme.borderRadius.md,
          padding: theme.spacing.md,
          borderLeftWidth: 3,
          borderLeftColor: theme.colors.error,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            marginBottom: theme.spacing.sm,
          }}
        >
          <Icon name="close-circle" size={20} color={theme.colors.error} />
          <Text
            style={{
              fontSize: 14,
              fontFamily: theme.typography.fontSansSemiBold,
              color: theme.colors.error,
            }}
          >
            Não Faça
          </Text>
        </View>
        {donts.map((item, index) => (
          <Text
            key={index}
            style={{
              fontSize: 12,
              fontFamily: theme.typography.fontSans,
              color: theme.colors.text,
              marginBottom: index < donts.length - 1 ? theme.spacing.xs : 0,
            }}
          >
            • {item}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ============================================
// COMPONENTE PLAYGROUND INTERATIVO
// ============================================

interface PlaygroundControlConfig {
  type: 'text' | 'select' | 'boolean';
  options?: string[];
}

interface PlaygroundProps {
  title: string;
  defaultProps: Record<string, unknown>;
  propsConfig: Record<string, PlaygroundControlConfig>;
  renderPreview: (props: Record<string, unknown>) => React.ReactNode;
}

function Playground({ title, defaultProps, propsConfig, renderPreview }: PlaygroundProps) {
  const { theme } = useUnistyles();
  const [props, setProps] = useState(defaultProps);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.colors.gray200,
        borderRadius: theme.borderRadius.md,
        overflow: 'hidden',
        marginTop: theme.spacing.md,
      }}
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: theme.colors.gray50,
          padding: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.gray200,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
        }}
      >
        <Icon name="construct-outline" size={16} color={theme.colors.gray500} />
        <Text
          style={{
            fontSize: 12,
            fontFamily: theme.typography.fontSansSemiBold,
            color: theme.colors.gray700,
          }}
        >
          Playground: {title}
        </Text>
      </View>

      {/* Preview Area */}
      <View
        style={{
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 100,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.gray200,
        }}
      >
        {renderPreview(props)}
      </View>

      {/* Controls */}
      <View
        style={{
          backgroundColor: theme.colors.gray50,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
      >
        {Object.entries(propsConfig).map(([key, config]) => (
          <View
            key={key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: theme.typography.fontSansMedium,
                color: theme.colors.gray600,
                width: 80,
              }}
            >
              {key}:
            </Text>
            {config.type === 'text' && (
              <View
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: theme.colors.gray300,
                  borderRadius: theme.borderRadius.sm,
                  backgroundColor: theme.colors.surface,
                }}
              >
                <TextInput
                  value={String(props[key] || '')}
                  onChangeText={(value) => setProps({ ...props, [key]: value })}
                  style={{
                    padding: theme.spacing.xs,
                    fontSize: 12,
                    fontFamily: theme.typography.fontSans,
                    color: theme.colors.text,
                  }}
                  placeholderTextColor={theme.colors.gray400}
                />
              </View>
            )}
            {config.type === 'select' && config.options && (
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: theme.spacing.xs,
                }}
              >
                {config.options.map((option) => (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setProps({ ...props, [key]: option })}
                    style={{
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: theme.borderRadius.sm,
                      backgroundColor:
                        props[key] === option ? theme.colors.primary : theme.colors.gray200,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: theme.typography.fontSansMedium,
                        color: props[key] === option ? theme.colors.white : theme.colors.gray700,
                      }}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {config.type === 'boolean' && (
              <TouchableOpacity
                onPress={() => setProps({ ...props, [key]: !props[key] })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: props[key] ? theme.colors.primary : theme.colors.gray300,
                    justifyContent: 'center',
                    paddingHorizontal: 2,
                  }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: theme.colors.white,
                      alignSelf: props[key] ? 'flex-end' : 'flex-start',
                    }}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: theme.typography.fontSans,
                    color: theme.colors.gray600,
                  }}
                >
                  {props[key] ? 'true' : 'false'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function DesignSystemScreen() {
  const { theme } = useUnistyles();
  const { isDesktop, isMobile } = useResponsive();
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});

  // Estados
  const [activeSection, setActiveSection] = useState<SectionId>('cores');
  const [inputValue, setInputValue] = useState('');
  const [errorValue, setErrorValue] = useState('Texto inválido');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'loading'>('success');
  const [modalVisible, setModalVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalDestructiveVisible, setConfirmModalDestructiveVisible] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [desktopModalVisible, setDesktopModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['Todas']);
  const [showContrast, setShowContrast] = useState(true);
  const [addressValue, setAddressValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Tema
  const themeName = UnistylesRuntime.themeName ?? 'adaptive';
  const normalizedThemeName = themeName.toLowerCase();
  const isDark = normalizedThemeName.includes('dark');
  const densityLabel = normalizedThemeName.includes('compact') ? 'Compacto' : 'Regular';
  const contrastLabel = normalizedThemeName.includes('highcontrast') ? 'Alto' : 'Normal';

  // Dados de exemplo
  const tableData = useMemo<TableRow[]>(
    () => [
      { id: '1', motorista: 'Maria Silva', status: 'em_andamento', rotas: 8 },
      { id: '2', motorista: 'João Santos', status: 'pendente', rotas: 4 },
      { id: '3', motorista: 'Ana Pereira', status: 'concluida', rotas: 12 },
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

  const wizardSteps: Step[] = useMemo(
    () => [
      { id: '1', title: 'Dados' },
      { id: '2', title: 'Endereço' },
      { id: '3', title: 'Revisão' },
      { id: '4', title: 'Concluído' },
    ],
    []
  );

  // Cores organizadas
  const colorGroups = useMemo(
    () => ({
      primarias: [
        { label: 'Primary', color: theme.colors.primary },
        { label: 'Primary Dark', color: theme.colors.primaryDark },
        { label: 'Primary Light', color: theme.colors.primaryLight },
        { label: 'Secondary', color: theme.colors.secondary },
        { label: 'Accent', color: theme.colors.accent },
      ],
      semanticas: [
        { label: 'Success', color: theme.colors.success },
        { label: 'Warning', color: theme.colors.warning },
        { label: 'Error', color: theme.colors.error },
        { label: 'Info', color: theme.colors.info },
      ],
      neutras: [
        { label: 'Gray 50', color: theme.colors.gray50 },
        { label: 'Gray 100', color: theme.colors.gray100 },
        { label: 'Gray 200', color: theme.colors.gray200 },
        { label: 'Gray 300', color: theme.colors.gray300 },
        { label: 'Gray 400', color: theme.colors.gray400 },
        { label: 'Gray 500', color: theme.colors.gray500 },
        { label: 'Gray 600', color: theme.colors.gray600 },
        { label: 'Gray 700', color: theme.colors.gray700 },
        { label: 'Gray 800', color: theme.colors.gray800 },
        { label: 'Gray 900', color: theme.colors.gray900 },
      ],
      superficie: [
        { label: 'Background', color: theme.colors.background },
        { label: 'Surface', color: theme.colors.surface },
        { label: 'Border', color: theme.colors.border },
        { label: 'Overlay', color: theme.colors.overlay },
      ],
    }),
    [theme]
  );

  // Navegação para seção
  const scrollToSection = useCallback((sectionId: SectionId) => {
    setActiveSection(sectionId);
    const offset = sectionOffsets.current[sectionId];
    if (offset !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ y: offset - 100, animated: true });
    }
  }, []);

  const handleSectionLayout = useCallback(
    (sectionId: string) => (event: LayoutChangeEvent) => {
      sectionOffsets.current[sectionId] = event.nativeEvent.layout.y;
    },
    []
  );

  // Derive current theme properties
  const isCompact = normalizedThemeName.includes('compact');
  const isHighContrast = normalizedThemeName.includes('highcontrast');

  // Toggle de tema (claro/escuro)
  const toggleTheme = useCallback(() => {
    // Desativar adaptiveThemes para permitir setTheme manual
    UnistylesRuntime.setAdaptiveThemes(false);
    const base = isDark ? 'light' : 'dark';
    const compact = isCompact ? 'Compact' : '';
    const hc = isHighContrast ? 'HighContrast' : '';
    const newTheme = `${base}${compact}${hc}` as any;
    UnistylesRuntime.setTheme(newTheme);
  }, [isDark, isCompact, isHighContrast]);

  // Toggle de densidade (compacto/regular)
  const toggleDensity = useCallback(() => {
    // Desativar adaptiveThemes para permitir setTheme manual
    UnistylesRuntime.setAdaptiveThemes(false);
    const base = isDark ? 'dark' : 'light';
    const compact = isCompact ? '' : 'Compact';
    const hc = isHighContrast ? 'HighContrast' : '';
    const newTheme = `${base}${compact}${hc}` as any;
    UnistylesRuntime.setTheme(newTheme);
  }, [isDark, isCompact, isHighContrast]);

  // Toggle de alto contraste
  const toggleHighContrast = useCallback(() => {
    // Desativar adaptiveThemes para permitir setTheme manual
    UnistylesRuntime.setAdaptiveThemes(false);
    const base = isDark ? 'dark' : 'light';
    const compact = isCompact ? 'Compact' : '';
    const hc = isHighContrast ? '' : 'HighContrast';
    const newTheme = `${base}${compact}${hc}` as any;
    UnistylesRuntime.setTheme(newTheme);
  }, [isDark, isCompact, isHighContrast]);

  const showToast = useCallback((type: typeof toastType) => {
    setToastType(type);
    setToastVisible(true);
  }, []);

  // Filtra seções baseado na busca
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return SECTIONS;
    const query = searchQuery.toLowerCase();
    return SECTIONS.filter(
      (s) =>
        s.label.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Estilos
  const styles = useMemo(() => createStyles(theme, isDesktop), [theme, isDesktop]);

  return (
    <View style={styles.wrapper}>
      {/* Sidebar de navegação (desktop) */}
      {isDesktop && (
        <View style={styles.sidebar}>
          <Text style={styles.sidebarTitle}>Design System</Text>
          <Text style={styles.sidebarSubtitle}>RotaMestre v2.0</Text>

          <View style={styles.sidebarNav}>
            <Text style={styles.sidebarCategory}>Tokens</Text>
            {SECTIONS.slice(0, 9).map((section) => (
              <Pressable
                key={section.id}
                onPress={() => scrollToSection(section.id)}
                style={[
                  styles.sidebarItem,
                  activeSection === section.id && styles.sidebarItemActive,
                ]}
              >
                <Ionicons
                  name={section.icon}
                  size={16}
                  color={
                    activeSection === section.id
                      ? theme.colors.primary
                      : theme.colors.gray500
                  }
                />
                <Text
                  style={[
                    styles.sidebarItemText,
                    activeSection === section.id && styles.sidebarItemTextActive,
                  ]}
                >
                  {section.label}
                </Text>
              </Pressable>
            ))}

            <Text style={[styles.sidebarCategory, { marginTop: theme.spacing.lg }]}>
              Componentes
            </Text>
            {SECTIONS.slice(9).map((section) => (
              <Pressable
                key={section.id}
                onPress={() => scrollToSection(section.id)}
                style={[
                  styles.sidebarItem,
                  activeSection === section.id && styles.sidebarItemActive,
                ]}
              >
                <Ionicons
                  name={section.icon}
                  size={16}
                  color={
                    activeSection === section.id
                      ? theme.colors.primary
                      : theme.colors.gray500
                  }
                />
                <Text
                  style={[
                    styles.sidebarItemText,
                    activeSection === section.id && styles.sidebarItemTextActive,
                  ]}
                >
                  {section.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Conteúdo principal */}
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Sistema de Design</Text>
          <Text style={styles.subtitle}>
            Documentação interativa de tokens e componentes do RotaMestre
          </Text>

          {/* Toggles de tema */}
          <View style={styles.themeToggleRow}>
            <TouchableOpacity
              onPress={toggleTheme}
              style={styles.themeButton}
              accessibilityLabel={`Alternar para tema ${isDark ? 'claro' : 'escuro'}`}
            >
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={theme.colors.gray700}
              />
              <Text style={styles.themeButtonText}>
                {isDark ? 'Claro' : 'Escuro'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleDensity}
              style={[styles.themeButton, isCompact && styles.themeButtonActive]}
              accessibilityLabel={`Alternar para densidade ${isCompact ? 'regular' : 'compacta'}`}
            >
              <Ionicons
                name={isCompact ? 'expand-outline' : 'contract-outline'}
                size={18}
                color={isCompact ? theme.colors.primary : theme.colors.gray700}
              />
              <Text style={[styles.themeButtonText, isCompact && styles.themeButtonTextActive]}>
                {isCompact ? 'Compacto' : 'Regular'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleHighContrast}
              style={[styles.themeButton, isHighContrast && styles.themeButtonActive]}
              accessibilityLabel={`Alternar para contraste ${isHighContrast ? 'normal' : 'alto'}`}
            >
              <Ionicons
                name="contrast-outline"
                size={18}
                color={isHighContrast ? theme.colors.primary : theme.colors.gray700}
              />
              <Text style={[styles.themeButtonText, isHighContrast && styles.themeButtonTextActive]}>
                {isHighContrast ? 'Alto Contraste' : 'Normal'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Campo de busca */}
          <View style={styles.searchContainer}>
            <Input
              placeholder="Buscar tokens ou componentes..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              leftIcon="search"
              size="small"
            />
            {searchQuery.length > 0 && (
              <Text style={styles.searchResults}>
                {filteredSections.length} {filteredSections.length === 1 ? 'resultado' : 'resultados'}
              </Text>
            )}
          </View>
        </View>

        {/* Mobile nav */}
        {isMobile && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mobileNav}
            contentContainerStyle={styles.mobileNavContent}
          >
            {filteredSections.map((section) => (
              <TouchableOpacity
                key={section.id}
                onPress={() => scrollToSection(section.id)}
                style={[
                  styles.mobileNavItem,
                  activeSection === section.id && styles.mobileNavItemActive,
                ]}
              >
                <Ionicons
                  name={section.icon}
                  size={16}
                  color={
                    activeSection === section.id
                      ? theme.colors.white
                      : theme.colors.gray600
                  }
                />
                <Text
                  style={[
                    styles.mobileNavText,
                    activeSection === section.id && styles.mobileNavTextActive,
                  ]}
                >
                  {section.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ========================================
            SEÇÃO: CORES
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('cores')}>
          <SectionHeader
            id="cores"
            title="Cores"
            description="Paleta de cores do sistema com informações de contraste WCAG"
          />

          <View style={styles.controlRow}>
            <TouchableOpacity
              onPress={() => setShowContrast(!showContrast)}
              style={styles.toggleButton}
            >
              <Ionicons
                name={showContrast ? 'eye' : 'eye-off'}
                size={16}
                color={theme.colors.gray600}
              />
              <Text style={styles.toggleText}>
                {showContrast ? 'Ocultar contraste' : 'Mostrar contraste'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.groupTitle}>Cores Primárias</Text>
          <View style={styles.swatchGrid}>
            {colorGroups.primarias.map((swatch) => (
              <ColorSwatch
                key={swatch.label}
                label={swatch.label}
                color={swatch.color}
                showContrast={showContrast}
              />
            ))}
          </View>

          <Text style={styles.groupTitle}>Cores Semânticas</Text>
          <View style={styles.swatchGrid}>
            {colorGroups.semanticas.map((swatch) => (
              <ColorSwatch
                key={swatch.label}
                label={swatch.label}
                color={swatch.color}
                showContrast={showContrast}
              />
            ))}
          </View>

          <Text style={styles.groupTitle}>Escala de Cinza</Text>
          <View style={styles.swatchGrid}>
            {colorGroups.neutras.map((swatch) => (
              <ColorSwatch
                key={swatch.label}
                label={swatch.label}
                color={swatch.color}
                showContrast={showContrast}
              />
            ))}
          </View>

          <Text style={styles.groupTitle}>Superfícies</Text>
          <View style={styles.swatchGrid}>
            {colorGroups.superficie.map((swatch) => (
              <ColorSwatch
                key={swatch.label}
                label={swatch.label}
                color={swatch.color}
                showContrast={showContrast}
              />
            ))}
          </View>

          <CodeBlock
            code={`import { colors } from '@/design-system';

// Uso direto
backgroundColor: colors.primary.main

// Via tema
const { theme } = useUnistyles();
backgroundColor: theme.colors.primary`}
          />

          <Text style={styles.groupTitle}>Boas Práticas</Text>
          <DosDonts
            dos={[
              'Use cores semânticas (success, error, warning)',
              'Mantenha contraste WCAG AA (4.5:1 texto)',
              'Use theme.colors para adaptação a temas',
              'Prefira cores do palette oficial',
            ]}
            donts={[
              'Não use cores hardcoded (#FF0000)',
              'Não ignore níveis de contraste',
              'Não misture cores semânticas (erro em verde)',
              'Não crie variações de cor fora do sistema',
            ]}
          />
        </View>

        {/* ========================================
            SEÇÃO: TIPOGRAFIA
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('tipografia')}>
          <SectionHeader
            id="tipografia"
            title="Tipografia"
            description="Famílias de fontes e escala tipográfica"
          />

          <Text style={styles.groupTitle}>Famílias</Text>
          <View style={styles.typeSamples}>
            <View style={styles.typeSample}>
              <Text
                style={{
                  fontFamily: theme.typography.fontDisplay,
                  fontSize: 24,
                  color: theme.colors.gray900,
                }}
              >
                Viga (Display)
              </Text>
              <CopyButton value="fontDisplay" />
            </View>
            <View style={styles.typeSample}>
              <Text
                style={{
                  fontFamily: theme.typography.fontSans,
                  fontSize: 18,
                  color: theme.colors.gray900,
                }}
              >
                Nunito Sans (Body)
              </Text>
              <CopyButton value="fontSans" />
            </View>
            <View style={styles.typeSample}>
              <Text
                style={{
                  fontFamily: theme.typography.fontSansBold,
                  fontSize: 18,
                  color: theme.colors.gray900,
                }}
              >
                Nunito Sans Bold
              </Text>
              <CopyButton value="fontSansBold" />
            </View>
          </View>

          <Text style={styles.groupTitle}>Escala de Tamanhos</Text>
          {Object.entries(typography.fontSize).map(([key, value]) => (
            <TokenRow
              key={key}
              label={key}
              value={`${value}px`}
              preview={
                <Text
                  style={{
                    fontSize: value,
                    fontFamily: theme.typography.fontSans,
                    color: theme.colors.gray900,
                  }}
                >
                  Aa
                </Text>
              }
            />
          ))}

          <Text style={styles.groupTitle}>Estilos Predefinidos</Text>
          <DSText variant="title">Título do Sistema (title)</DSText>
          <DSText variant="subtitle" tone="muted">
            Subtítulo com tom neutro (subtitle)
          </DSText>
          <DSText variant="body">
            Texto base para descrições e instruções. (body)
          </DSText>
          <DSText variant="caption" tone="muted">
            Texto pequeno para legendas (caption)
          </DSText>

          <CodeBlock
            code={`import { Text } from '@/design-system';

<Text variant="title">Título</Text>
<Text variant="body" tone="muted">Descrição</Text>`}
          />
        </View>

        {/* ========================================
            SEÇÃO: ESPAÇAMENTO
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('espacamento')}>
          <SectionHeader
            id="espacamento"
            title="Espaçamento"
            description="Sistema de espaçamento baseado em grid de 4px"
          />

          {Object.entries(spacing).map(([key, value]) => (
            <TokenRow
              key={key}
              label={`spacing.${key}`}
              value={`${value}px`}
              preview={<SpacingPreview size={key} value={value} />}
            />
          ))}

          <CodeBlock
            code={`import { spacing } from '@/design-system';

padding: spacing.md  // 16px
gap: spacing.lg      // 24px`}
          />
        </View>

        {/* ========================================
            SEÇÃO: BORDAS
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('bordas')}>
          <SectionHeader
            id="bordas"
            title="Bordas (Border Radius)"
            description="Escala de arredondamento de cantos"
          />

          {Object.entries(borderRadius).map(([key, value]) => (
            <TokenRow
              key={key}
              label={`borderRadius.${key}`}
              value={value === 9999 ? 'full (9999px)' : `${value}px`}
              preview={<RadiusPreview value={value} />}
            />
          ))}

          <CodeBlock
            code={`import { borderRadius } from '@/design-system';

borderRadius: borderRadius.md  // 8px
borderRadius: borderRadius.full // pill shape`}
          />
        </View>

        {/* ========================================
            SEÇÃO: SOMBRAS
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('sombras')}>
          <SectionHeader
            id="sombras"
            title="Sombras (Elevation)"
            description="Sistema de elevação e profundidade"
          />

          <View style={styles.shadowGrid}>
            {(['sm', 'md', 'lg', 'card'] as const).map((key) => (
              <View key={key} style={styles.shadowItem}>
                <ShadowPreview shadow={shadows[key]} />
                <Text style={styles.shadowLabel}>{key}</Text>
                <Text style={styles.shadowValue}>
                  elevation: {shadows[key].elevation}
                </Text>
              </View>
            ))}
          </View>

          <CodeBlock
            code={`import { shadows } from '@/design-system';

style={[styles.card, shadows.md]}

// Ou via tema
...theme.shadows.card`}
          />
        </View>

        {/* ========================================
            SEÇÃO: OPACIDADE
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('opacidade')}>
          <SectionHeader
            id="opacidade"
            title="Opacidade"
            description="Níveis de transparência padronizados"
          />

          {Object.entries(opacity).map(([key, value]) => (
            <TokenRow
              key={key}
              label={`opacity.${key}`}
              value={`${value * 100}%`}
              preview={<OpacityPreview value={value} />}
            />
          ))}

          <CodeBlock
            code={`import { opacity } from '@/design-system';

opacity: opacity[50]  // 0.5`}
          />
        </View>

        {/* ========================================
            SEÇÃO: Z-INDEX
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('zindex')}>
          <SectionHeader
            id="zindex"
            title="Z-Index"
            description="Camadas de empilhamento para controle de sobreposição"
          />

          {Object.entries(zIndex).map(([key, value]) => (
            <TokenRow key={key} label={`zIndex.${key}`} value={value} />
          ))}

          <CodeBlock
            code={`import { zIndex } from '@/design-system';

zIndex: zIndex.modal   // 30
zIndex: zIndex.toast   // 40`}
          />
        </View>

        {/* ========================================
            SEÇÃO: ANIMAÇÃO
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('animacao')}>
          <SectionHeader
            id="animacao"
            title="Animação (Motion)"
            description="Durações e curvas de animação"
          />

          <Text style={styles.groupTitle}>Durações</Text>
          {Object.entries(motion.duration).map(([key, value]) => (
            <TokenRow key={key} label={`motion.duration.${key}`} value={`${value}ms`} />
          ))}

          <Text style={styles.groupTitle}>Curvas (Easing)</Text>
          {Object.entries(motion.easing).map(([key, value]) => (
            <TokenRow key={key} label={`motion.easing.${key}`} value={value} />
          ))}

          <CodeBlock
            code={`import { motion } from '@/design-system';

Animated.timing(value, {
  duration: motion.duration.normal,
  easing: Easing.bezier(...motion.easing.easeOut.split(',').map(Number)),
})`}
          />
        </View>

        {/* ========================================
            SEÇÃO: TEMA
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('tema')}>
          <SectionHeader
            id="tema"
            title="Configuração de Tema"
            description="Variantes e configurações do tema atual"
          />

          <TokenRow label="Nome do tema" value={themeName} />
          <TokenRow label="Modo" value={isDark ? 'Escuro' : 'Claro'} />
          <TokenRow label="Densidade" value={densityLabel} />
          <TokenRow label="Contraste" value={contrastLabel} />
          <TokenRow label="Altura do input (desktop)" value={`${theme.desktop.input.height}px`} />
          <TokenRow label="Altura do botão (desktop)" value={`${theme.desktop.button.height}px`} />

          <Text style={styles.groupTitle}>Exportar Tokens</Text>
          <Text style={styles.description}>
            Baixe os design tokens em diferentes formatos para usar em outros projetos.
          </Text>
          <View style={styles.componentRow}>
            <Button
              title="JSON"
              size="small"
              variant="outline"
              icon="code-download-outline"
              onPress={() => {
                const tokens = { colors, typography, spacing, borderRadius, shadows, opacity, zIndex, motion };
                const content = JSON.stringify(tokens, null, 2);
                if (Platform.OS === 'web') {
                  const blob = new Blob([content], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'design-tokens.json';
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('success');
                } else {
                  Clipboard.setStringAsync(content);
                  showToast('info');
                }
              }}
            />
            <Button
              title="CSS"
              size="small"
              variant="outline"
              icon="logo-css3"
              onPress={() => {
                const cssVars = `/* Design Tokens - RotaMestre */
:root {
  /* Colors */
  --color-primary: ${colors.primary.main};
  --color-primary-dark: ${colors.primary.dark};
  --color-primary-light: ${colors.primary.light};
  --color-secondary: ${colors.secondary.main};
  --color-success: ${colors.success};
  --color-warning: ${colors.warning};
  --color-error: ${colors.error};
  --color-info: ${colors.info};

  /* Spacing */
  --spacing-xs: ${spacing.xs}px;
  --spacing-sm: ${spacing.sm}px;
  --spacing-md: ${spacing.md}px;
  --spacing-lg: ${spacing.lg}px;
  --spacing-xl: ${spacing.xl}px;

  /* Border Radius */
  --radius-sm: ${borderRadius.sm}px;
  --radius-md: ${borderRadius.md}px;
  --radius-lg: ${borderRadius.lg}px;
  --radius-full: ${borderRadius.full}px;

  /* Typography */
  --font-display: '${typography.fontFamily.display}';
  --font-sans: '${typography.fontFamily.body}';
  --font-size-xs: ${typography.fontSize.xs}px;
  --font-size-sm: ${typography.fontSize.sm}px;
  --font-size-md: ${typography.fontSize.md}px;
  --font-size-lg: ${typography.fontSize.lg}px;
  --font-size-xl: ${typography.fontSize.xl}px;
}`;
                if (Platform.OS === 'web') {
                  const blob = new Blob([cssVars], { type: 'text/css' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'design-tokens.css';
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('success');
                } else {
                  Clipboard.setStringAsync(cssVars);
                  showToast('info');
                }
              }}
            />
            <Button
              title="TypeScript"
              size="small"
              variant="outline"
              icon="logo-javascript"
              onPress={() => {
                const tokens = { colors, typography, spacing, borderRadius, shadows, opacity, zIndex, motion };
                const tsContent = `// Design Tokens - RotaMestre
// Gerado automaticamente

export const designTokens = ${JSON.stringify(tokens, null, 2)} as const;

export type DesignTokens = typeof designTokens;
`;
                if (Platform.OS === 'web') {
                  const blob = new Blob([tsContent], { type: 'text/typescript' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'design-tokens.ts';
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('success');
                } else {
                  Clipboard.setStringAsync(tsContent);
                  showToast('info');
                }
              }}
            />
          </View>
          <Text style={{ fontSize: 11, color: theme.colors.gray500, marginTop: theme.spacing.xs }}>
            {Platform.OS === 'web' ? 'Clique para baixar o arquivo' : 'Clique para copiar para a área de transferência'}
          </Text>

          <CodeBlock
            code={`import { UnistylesRuntime } from 'react-native-unistyles';

// Trocar tema
UnistylesRuntime.setTheme('dark');

// Acessar tema atual
const themeName = UnistylesRuntime.themeName;`}
          />
        </View>

        {/* ========================================
            SEÇÃO: BOTÕES
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('botoes')}>
          <SectionHeader
            id="botoes"
            title="Botões"
            description="Variantes, tamanhos e estados do componente Button"
          />

          <Text style={styles.groupTitle}>Tamanhos</Text>
          <View style={styles.componentRow}>
            <Button title="Small" size="small" onPress={() => showToast('info')} />
            <Button title="Medium" onPress={() => showToast('info')} />
            <Button title="Large" size="large" onPress={() => showToast('info')} />
          </View>

          <Text style={styles.groupTitle}>Variantes</Text>
          <View style={styles.componentRow}>
            <Button title="Primary" onPress={() => showToast('success')} />
            <Button title="Outline" variant="outline" onPress={() => showToast('info')} />
            <Button title="Ghost" variant="ghost" onPress={() => showToast('info')} />
            <Button title="Danger" variant="danger" onPress={() => showToast('error')} />
          </View>

          <Text style={styles.groupTitle}>Estados Visuais</Text>
          <View style={styles.componentRow}>
            <Button title="Normal" onPress={() => {}} />
            <Button title="Loading" loading onPress={() => {}} />
            <Button title="Disabled" disabled onPress={() => {}} />
          </View>

          <Text style={styles.groupTitle}>Estados Interativos</Text>
          <Text style={styles.description}>
            Interaja com os botões abaixo para visualizar os estados hover (web), pressed e focus.
          </Text>
          <View style={styles.statesGrid}>
            <View style={styles.stateItem}>
              <Text style={styles.stateLabel}>Default</Text>
              <Button title="Clique" onPress={() => showToast('info')} />
            </View>
            <View style={styles.stateItem}>
              <Text style={styles.stateLabel}>Hover (Web)</Text>
              <Text style={styles.stateHint}>Passe o mouse</Text>
              <Button title="Hover" variant="outline" onPress={() => showToast('info')} />
            </View>
            <View style={styles.stateItem}>
              <Text style={styles.stateLabel}>Pressed</Text>
              <Text style={styles.stateHint}>Segure o clique</Text>
              <Button title="Pressione" onPress={() => showToast('info')} />
            </View>
            <View style={styles.stateItem}>
              <Text style={styles.stateLabel}>Focus (Tab)</Text>
              <Text style={styles.stateHint}>Use Tab no teclado</Text>
              <Button title="Foco" variant="outline" onPress={() => showToast('info')} />
            </View>
          </View>

          <Text style={styles.groupTitle}>Com Ícones</Text>
          <View style={styles.componentRow}>
            <Button title="Adicionar" icon="add" onPress={() => {}} />
            <Button
              title="Próximo"
              icon="arrow-forward"
              iconPosition="right"
              variant="outline"
              onPress={() => {}}
            />
            <Button title="" icon="refresh" onPress={() => {}} />
          </View>

          <CodeBlock
            code={`import { Button } from '@/design-system';

<Button
  title="Salvar"
  variant="primary"
  size="medium"
  icon="checkmark"
  loading={isLoading}
  onPress={handleSave}
/>`}
          />

          <Text style={styles.groupTitle}>Props</Text>
          <PropsTable
            props={[
              { name: 'title', type: 'string', required: true, description: 'Texto exibido no botão' },
              { name: 'onPress', type: '() => void', required: true, description: 'Callback ao pressionar' },
              { name: 'variant', type: "'primary' | 'outline' | 'ghost' | 'danger'", default: "'primary'", description: 'Estilo visual do botão' },
              { name: 'size', type: "'small' | 'medium' | 'large'", default: "'medium'", description: 'Tamanho do botão' },
              { name: 'icon', type: 'string', description: 'Nome do ícone Ionicons' },
              { name: 'iconPosition', type: "'left' | 'right'", default: "'left'", description: 'Posição do ícone' },
              { name: 'loading', type: 'boolean', default: 'false', description: 'Exibe spinner e desabilita' },
              { name: 'disabled', type: 'boolean', default: 'false', description: 'Desabilita interação' },
            ]}
          />

          <Text style={styles.groupTitle}>Playground Interativo</Text>
          <Playground
            title="Button"
            defaultProps={{
              title: 'Clique aqui',
              variant: 'primary',
              size: 'medium',
              loading: false,
              disabled: false,
            }}
            propsConfig={{
              title: { type: 'text' },
              variant: { type: 'select', options: ['primary', 'outline', 'ghost', 'danger'] },
              size: { type: 'select', options: ['small', 'medium', 'large'] },
              loading: { type: 'boolean' },
              disabled: { type: 'boolean' },
            }}
            renderPreview={(props) => (
              <Button
                title={String(props.title)}
                variant={props.variant as 'primary' | 'outline' | 'ghost' | 'danger'}
                size={props.size as 'small' | 'medium' | 'large'}
                loading={Boolean(props.loading)}
                disabled={Boolean(props.disabled)}
                onPress={() => showToast('success')}
              />
            )}
          />

          <Text style={styles.groupTitle}>Boas Práticas</Text>
          <DosDonts
            dos={[
              'Use apenas 1 botão Primary por tela (ação principal)',
              'Mantenha textos curtos e objetivos (máx 3 palavras)',
              'Use ícones para reforçar a ação',
              'Mostre loading durante operações assíncronas',
            ]}
            donts={[
              'Não use múltiplos botões Primary juntos',
              'Não use textos longos ou genéricos ("Clique aqui")',
              'Não desabilite sem mostrar motivo ao usuário',
              'Não use cores fora do Design System',
            ]}
          />
        </View>

        {/* ========================================
            SEÇÃO: INPUTS
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('inputs')}>
          <SectionHeader
            id="inputs"
            title="Campos de Entrada"
            description="Inputs de texto com validação e estados"
          />

          <View style={styles.inputGrid}>
            <Input
              label="Campo padrão"
              placeholder="Digite aqui..."
              value={inputValue}
              onChangeText={setInputValue}
            />
            <Input
              label="Com erro"
              error="Campo obrigatório"
              placeholder="Exemplo com erro"
              value={errorValue}
              onChangeText={setErrorValue}
            />
            <Input label="Desabilitado" value="Somente leitura" editable={false} />
            <Input label="Tamanho pequeno" size="small" placeholder="Small" />
            <Input label="Tamanho grande" size="large" placeholder="Large" />
            <Input
              label="Com ícone"
              placeholder="Buscar..."
              leftIcon="search"
            />
          </View>

          <CodeBlock
            code={`import { Input } from '@/design-system';

<Input
  label="Email"
  placeholder="seu@email.com"
  value={email}
  onChangeText={setEmail}
  error={errors.email}
  leftIcon="mail"
/>`}
          />
        </View>

        {/* ========================================
            SEÇÃO: CARDS
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('cards')}>
          <SectionHeader
            id="cards"
            title="Cards"
            description="Containers para agrupamento de conteúdo"
          />

          <Text style={styles.groupTitle}>Card Básico</Text>
          <Card style={styles.demoCard}>
            <Text style={styles.cardTitle}>Título do Card</Text>
            <Text style={styles.cardBody}>
              Este é um exemplo de conteúdo dentro de um card básico.
            </Text>
          </Card>

          <Text style={styles.groupTitle}>MetricCard (KPIs)</Text>
          <ResponsiveGrid>
            <GridItem span={{ desktop: 1, tablet: 1, mobile: 1 }}>
              <MetricCard
                title="Rotas Hoje"
                value="24"
                subtitle="Meta diária"
                trend="up"
                icon={<Icon name="map" tone="primary" />}
                color={theme.colors.primary}
              />
            </GridItem>
            <GridItem span={{ desktop: 1, tablet: 1, mobile: 1 }}>
              <MetricCard
                title="Incidentes"
                value="2"
                subtitle="Últimas 24h"
                trend="down"
                icon={<Icon name="alert-circle" tone="warning" />}
                color={theme.colors.warning}
              />
            </GridItem>
            <GridItem span={{ desktop: 1, tablet: 1, mobile: 1 }}>
              <MetricCard
                title="Distância"
                value="145 km"
                subtitle="Total do dia"
                trend="neutral"
                icon={<Icon name="speedometer" tone="muted" />}
                color={theme.colors.gray400}
              />
            </GridItem>
          </ResponsiveGrid>

          <Text style={styles.groupTitle}>Avatar</Text>
          <View style={styles.componentRow}>
            <Avatar name="Maria Silva" size="sm" />
            <Avatar name="João Santos" size="md" />
            <Avatar name="Ana Pereira" size="lg" />
            <Avatar name="Carlos" size="xl" />
          </View>

          <CodeBlock
            code={`import { Card, MetricCard, Avatar } from '@/design-system';

<Card>
  <Text>Conteúdo do card</Text>
</Card>

<MetricCard
  title="Rotas"
  value="24"
  trend="up"
/>

<Avatar name="Maria Silva" size="md" />`}
          />
        </View>

        {/* ========================================
            SEÇÃO: BADGES
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('badges')}>
          <SectionHeader
            id="badges"
            title="Badges e Status"
            description="Indicadores visuais de status e categorias"
          />

          <Text style={styles.groupTitle}>Badge (Status de Rota)</Text>
          <View style={styles.componentRow}>
            <Badge status="pendente" />
            <Badge status="em_andamento" />
            <Badge status="concluida" />
            <Badge status="cancelada" />
          </View>

          <Text style={styles.groupTitle}>StatusBadge (Customizável)</Text>
          <View style={styles.componentRow}>
            <StatusBadge label="Ativo" color={theme.colors.success} variant="soft" />
            <StatusBadge label="Pausado" color={theme.colors.warning} variant="soft" />
            <StatusBadge label="Inativo" color={theme.colors.error} variant="solid" />
            <StatusBadge label="Info" color={theme.colors.info} size="sm" />
          </View>

          <Text style={styles.groupTitle}>FilterChip</Text>
          <View style={styles.componentRow}>
            {['Todas', 'Pendentes', 'Em andamento', 'Concluídas'].map((filter) => (
              <FilterChip
                key={filter}
                label={filter}
                selected={selectedFilters.includes(filter)}
                onPress={() => {
                  setSelectedFilters((prev) =>
                    prev.includes(filter)
                      ? prev.filter((f) => f !== filter)
                      : [...prev, filter]
                  );
                }}
              />
            ))}
          </View>

          <Text style={styles.groupTitle}>Icon</Text>
          <View style={styles.componentRow}>
            <Icon name="checkmark-circle" tone="success" size={24} />
            <Icon name="alert-circle" tone="warning" size={24} />
            <Icon name="close-circle" tone="error" size={24} />
            <Icon name="information-circle" tone="primary" size={24} />
            <Icon name="time-outline" tone="muted" size={24} />
          </View>

          <CodeBlock
            code={`import { Badge, StatusBadge, FilterChip, Icon } from '@/design-system';

<Badge status="em_andamento" />

<StatusBadge label="Ativo" color={colors.success} />

<FilterChip
  label="Filtro"
  selected={isSelected}
  onPress={toggle}
/>

<Icon name="checkmark-circle" tone="success" />`}
          />
        </View>

        {/* ========================================
            SEÇÃO: MODAIS
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('modais')}>
          <SectionHeader
            id="modais"
            title="Modais e Diálogos"
            description="Overlays para ações e confirmações"
          />

          <Text style={styles.groupTitle}>Modal Básico</Text>
          <View style={styles.componentRow}>
            <Button title="Abrir Modal" onPress={() => setModalVisible(true)} />
            <Button
              title="Desktop Modal"
              variant="outline"
              onPress={() => setDesktopModalVisible(true)}
            />
          </View>

          <Text style={styles.groupTitle}>Diálogos de Alerta</Text>
          <View style={styles.componentRow}>
            <Button
              title="Alert Dialog"
              variant="outline"
              onPress={() => setAlertVisible(true)}
            />
            <Button
              title="Confirm Dialog"
              variant="outline"
              onPress={() => setConfirmVisible(true)}
            />
          </View>

          <Text style={styles.groupTitle}>ConfirmModal</Text>
          <Text style={{ fontSize: 13, color: theme.colors.gray600, marginBottom: theme.spacing.sm }}>
            Modal de confirmação avançado com tipos (danger, warning, success, info) e suporte a confirmação destrutiva.
          </Text>
          <View style={styles.componentRow}>
            <Button
              title="Confirm Modal"
              variant="outline"
              onPress={() => setConfirmModalVisible(true)}
            />
            <Button
              title="Destrutivo"
              variant="danger"
              onPress={() => setConfirmModalDestructiveVisible(true)}
            />
          </View>

          <PropsTable
            props={[
              { name: 'visible', type: 'boolean', required: true, description: 'Controla visibilidade' },
              { name: 'title', type: 'string', required: true, description: 'Título do modal' },
              { name: 'message', type: 'string', required: true, description: 'Mensagem de confirmação' },
              { name: 'type', type: "'danger' | 'warning' | 'success' | 'info'", default: "'danger'", description: 'Tipo visual com ícone' },
              { name: 'destructiveConfirmText', type: 'string', description: 'Texto obrigatório para confirmar ação destrutiva' },
              { name: 'loading', type: 'boolean', default: 'false', description: 'Exibe spinner no botão' },
              { name: 'onConfirm', type: '() => void', required: true, description: 'Callback de confirmação' },
              { name: 'onCancel', type: '() => void', required: true, description: 'Callback de cancelamento' },
            ]}
          />

          <Text style={styles.groupTitle}>SupportModal</Text>
          <Text style={{ fontSize: 13, color: theme.colors.gray600, marginBottom: theme.spacing.sm }}>
            Modal de suporte com opções de contato (WhatsApp, Telefone, Email).
          </Text>
          <View style={styles.componentRow}>
            <Button
              title="Abrir Suporte"
              icon="help-circle"
              variant="outline"
              onPress={() => setSupportModalVisible(true)}
            />
          </View>

          <PropsTable
            props={[
              { name: 'visible', type: 'boolean', required: true, description: 'Controla visibilidade' },
              { name: 'onClose', type: '() => void', required: true, description: 'Callback ao fechar' },
            ]}
          />

          <CodeBlock
            code={`import { Modal, AlertDialog, ConfirmDialog, DesktopModal } from '@/design-system';
import { ConfirmModal } from '@/components/ConfirmModal';
import { SupportModal } from '@/components/SupportModal';

// Modal básico
<Modal visible={visible} onClose={handleClose} title="Título">
  <Text>Conteúdo do modal</Text>
</Modal>

// Modal responsivo (dialog web / bottom sheet mobile)
<DesktopModal
  visible={visible}
  onClose={handleClose}
  title="Título"
  primaryButton={{ text: 'Confirmar', onPress: handleConfirm }}
  secondaryButton={{ text: 'Cancelar', onPress: handleCancel }}
>
  <Input label="Campo" placeholder="Digite..." />
</DesktopModal>

// Modal de confirmação com tipo
<ConfirmModal
  visible={visible}
  title="Excluir Rota"
  message="Esta ação não pode ser desfeita."
  type="danger"
  onConfirm={handleDelete}
  onCancel={handleClose}
/>

// Modal de confirmação destrutiva
<ConfirmModal
  visible={visible}
  title="Excluir Conta"
  message="Todos os dados serão perdidos permanentemente."
  type="danger"
  destructiveConfirmText="EXCLUIR"
  onConfirm={handleDeleteAccount}
  onCancel={handleClose}
/>

// Modal de suporte
<SupportModal visible={showSupport} onClose={() => setShowSupport(false)} />`}
          />
        </View>

        {/* ========================================
            SEÇÃO: FEEDBACK
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('feedback')}>
          <SectionHeader
            id="feedback"
            title="Feedback"
            description="Toast, Progress, Skeleton e estados de carregamento"
          />

          <Text style={styles.groupTitle}>Toast</Text>
          <View style={styles.componentRow}>
            <Button
              title="Success"
              size="small"
              onPress={() => showToast('success')}
            />
            <Button
              title="Error"
              size="small"
              variant="danger"
              onPress={() => showToast('error')}
            />
            <Button
              title="Loading"
              size="small"
              variant="outline"
              onPress={() => showToast('loading')}
            />
            <Button
              title="Info"
              size="small"
              variant="ghost"
              onPress={() => showToast('info')}
            />
          </View>

          <Text style={styles.groupTitle}>Progress</Text>
          <View style={{ gap: theme.spacing.md }}>
            <Progress progress={0.25} label="Carregando..." color="primary" />
            <Progress progress={0.5} label="Metade" color="warning" />
            <Progress progress={0.75} label="Quase lá" color="primary" />
            <Progress progress={1} label="Concluído" color="success" />
          </View>

          <Text style={styles.groupTitle}>Skeleton Loader</Text>
          <Text style={{ fontSize: 13, color: theme.colors.gray600, marginBottom: theme.spacing.sm }}>
            Componentes de carregamento com animação shimmer para indicar conteúdo sendo carregado.
          </Text>

          <Text style={{ fontSize: 12, fontFamily: theme.typography.fontSansSemiBold, color: theme.colors.gray700, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            Skeleton (Base)
          </Text>
          <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <Skeleton width="100%" height={16} />
            <Skeleton width="80%" height={16} />
            <Skeleton width="60%" height={16} />
          </View>

          <Text style={{ fontSize: 12, fontFamily: theme.typography.fontSansSemiBold, color: theme.colors.gray700, marginBottom: theme.spacing.sm }}>
            SkeletonCard
          </Text>
          <SkeletonCard />

          <Text style={{ fontSize: 12, fontFamily: theme.typography.fontSansSemiBold, color: theme.colors.gray700, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            SkeletonList
          </Text>
          <SkeletonList count={3} />

          <PropsTable
            props={[
              { name: 'width', type: 'number | string', default: "'100%'", description: 'Largura do skeleton' },
              { name: 'height', type: 'number', default: '20', description: 'Altura do skeleton' },
              { name: 'borderRadius', type: 'number', default: '4', description: 'Raio da borda' },
              { name: 'count', type: 'number', default: '3', description: 'Quantidade de itens (SkeletonList)' },
            ]}
          />

          <Text style={styles.groupTitle}>Empty State</Text>
          <EmptyState
            title="Nenhum dado encontrado"
            description="Não há registros para exibir no momento."
            actionLabel="Adicionar"
            onActionPress={() => showToast('info')}
          />

          <CodeBlock
            code={`import { Toast, Progress, Skeleton, SkeletonCard, SkeletonList, EmptyState } from '@/design-system';

<Toast
  visible={visible}
  type="success"
  message="Salvo com sucesso!"
  onHide={() => setVisible(false)}
/>

<Progress progress={0.5} label="50%" />

// Skeleton base - customizável
<Skeleton width="100%" height={16} />
<Skeleton width={200} height={40} borderRadius={8} />

// Skeleton pré-definido para cards
<SkeletonCard />

// Skeleton pré-definido para listas
<SkeletonList count={5} />

<EmptyState
  title="Sem dados"
  description="Nenhum item encontrado"
  actionLabel="Criar"
  onActionPress={handleCreate}
/>`}
          />
        </View>

        {/* ========================================
            SEÇÃO: NAVEGAÇÃO
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('navegacao-comp')}>
          <SectionHeader
            id="navegacao-comp"
            title="Navegação"
            description="Componentes para fluxos e wizards"
          />

          <Text style={styles.groupTitle}>StepIndicator</Text>
          <StepIndicator
            steps={wizardSteps}
            currentStep={currentStep}
            showTitles
          />
          <View style={[styles.componentRow, { marginTop: theme.spacing.md }]}>
            <Button
              title="Anterior"
              variant="outline"
              size="small"
              disabled={currentStep === 0}
              onPress={() => setCurrentStep((s) => Math.max(0, s - 1))}
            />
            <Button
              title="Próximo"
              size="small"
              disabled={currentStep === wizardSteps.length - 1}
              onPress={() => setCurrentStep((s) => Math.min(wizardSteps.length - 1, s + 1))}
            />
          </View>

          <CodeBlock
            code={`import { StepIndicator, type Step } from '@/design-system';

const steps: Step[] = [
  { id: '1', title: 'Dados' },
  { id: '2', title: 'Endereço' },
  { id: '3', title: 'Revisão' },
];

<StepIndicator
  steps={steps}
  currentStep={currentStep}
  showTitles
/>`}
          />
        </View>

        {/* ========================================
            SEÇÃO: DADOS
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('dados')}>
          <SectionHeader
            id="dados"
            title="Exibição de Dados"
            description="Tabelas e listas responsivas"
          />

          <Text style={styles.groupTitle}>DataTable</Text>
          <DataTable
            data={tableData}
            columns={tableColumns}
            actions={[
              {
                label: 'Ver',
                icon: 'eye-outline',
                onPress: () => showToast('info'),
                type: 'secondary',
              },
              {
                label: 'Editar',
                icon: 'create-outline',
                onPress: () => showToast('info'),
                type: 'secondary',
              },
            ]}
            keyExtractor={(item) => item.id}
            pagination={false}
          />

          <CodeBlock
            code={`import { DataTable, type DataTableColumn } from '@/design-system';

const columns: DataTableColumn[] = [
  { key: 'nome', label: 'Nome' },
  { key: 'status', label: 'Status', render: (item) => <Badge status={item.status} /> },
];

<DataTable
  data={data}
  columns={columns}
  actions={[{ label: 'Ver', icon: 'eye', onPress: handleView }]}
  keyExtractor={(item) => item.id}
/>`}
          />
        </View>

        {/* ========================================
            SEÇÃO: COMPONENTES DESKTOP
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('desktop')}>
          <SectionHeader
            id="desktop"
            title="Componentes Desktop"
            description="Layouts e containers otimizados para experiência desktop"
          />

          <Text style={styles.groupTitle}>DesktopCard</Text>
          <Text style={styles.description}>
            Cards com variantes para diferentes contextos (default, outlined, elevated).
          </Text>
          <DesktopCardGrid columns={3}>
            <DesktopCard title="Card Default" variant="default">
              <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>
                Variante padrão com fundo e sombra sutil.
              </Text>
            </DesktopCard>
            <DesktopCard title="Card Outlined" variant="outlined">
              <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>
                Variante com borda, sem sombra.
              </Text>
            </DesktopCard>
            <DesktopCard title="Card Elevated" variant="elevated">
              <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>
                Variante com sombra pronunciada.
              </Text>
            </DesktopCard>
          </DesktopCardGrid>

          <Text style={styles.groupTitle}>SplitView</Text>
          <Text style={styles.description}>
            Layout de duas colunas para telas tipo mapa + lista ou detalhes + formulário.
          </Text>
          <View style={{ height: 200, borderRadius: theme.borderRadius.md, overflow: 'hidden' }}>
            <SplitView
              left={
                <View style={{ flex: 1, backgroundColor: theme.colors.primaryBg, justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="map" size={32} tone="primary" />
                  <Text style={{ color: theme.colors.primary, marginTop: 8 }}>Área do Mapa</Text>
                </View>
              }
              right={
                <View style={{ flex: 1, backgroundColor: theme.colors.gray50, padding: 16 }}>
                  <Text style={{ fontWeight: '600', color: theme.colors.gray800 }}>Lista de Itens</Text>
                  <Text style={{ color: theme.colors.gray600, marginTop: 4, fontSize: 13 }}>
                    Conteúdo da coluna direita
                  </Text>
                </View>
              }
              leftFlex={1.2}
              rightFlex={1}
            />
          </View>

          <Text style={styles.groupTitle}>DesktopModal</Text>
          <Text style={styles.description}>
            Modal responsivo que adapta entre dialog (web) e bottom sheet (mobile).
          </Text>
          <View style={styles.componentRow}>
            <Button
              title="Abrir DesktopModal"
              variant="outline"
              onPress={() => setDesktopModalVisible(true)}
            />
          </View>

          <Text style={styles.groupTitle}>DesktopLayout</Text>
          <Text style={styles.description}>
            Wrapper com padding responsivo e max-width para conteúdo centralizado.
          </Text>
          <View style={{ borderWidth: 1, borderColor: theme.colors.gray200, borderRadius: theme.borderRadius.md, overflow: 'hidden' }}>
            <DesktopLayout style={{ backgroundColor: theme.colors.gray50, minHeight: 80 }}>
              <Text style={{ color: theme.colors.gray700 }}>
                Conteúdo dentro do DesktopLayout (padding automático)
              </Text>
            </DesktopLayout>
          </View>

          <CodeBlock
            code={`import {
  DesktopCard,
  DesktopCardGrid,
  DesktopLayout,
  DesktopModal,
  SplitView,
} from '@/design-system';

<DesktopCardGrid columns={3}>
  <DesktopCard title="Título" variant="elevated">
    Conteúdo
  </DesktopCard>
</DesktopCardGrid>

<SplitView
  left={<MapView />}
  right={<ListView />}
  leftFlex={1.5}
  rightFlex={1}
/>`}
          />
        </View>

        {/* ========================================
            SEÇÃO: COMPONENTES MOBILE
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('mobile')}>
          <SectionHeader
            id="mobile"
            title="Componentes Mobile"
            description="Componentes otimizados para experiência mobile-first"
          />

          <Text style={styles.groupTitle}>MobileHeader</Text>
          <Text style={styles.description}>
            Header padronizado com título, subtítulo e botão de voltar.
          </Text>
          <View style={{ borderWidth: 1, borderColor: theme.colors.gray200, borderRadius: theme.borderRadius.md, overflow: 'hidden' }}>
            <MobileHeader
              title="Título da Tela"
              subtitle="Subtítulo opcional"
              showBack={false}
            />
          </View>

          <Text style={styles.groupTitle}>MobileButton</Text>
          <Text style={styles.description}>
            Botões com variantes semânticas otimizadas para mobile.
          </Text>
          <View style={styles.componentRow}>
            <MobileButton title="Primary" variant="primary" onPress={() => showToast('info')} />
            <MobileButton title="Secondary" variant="secondary" onPress={() => showToast('info')} />
            <MobileButton title="Danger" variant="danger" onPress={() => showToast('error')} />
            <MobileButton title="Success" variant="success" onPress={() => showToast('success')} />
          </View>

          <Text style={styles.groupTitle}>MobileCard</Text>
          <Text style={styles.description}>
            Cards com variantes para diferentes estados (default, highlight, bordered).
          </Text>
          <View style={{ gap: theme.spacing.sm }}>
            <MobileCard title="Card Default" variant="default">
              <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>
                Variante padrão sem destaque.
              </Text>
            </MobileCard>
            <MobileCard title="Card Highlight" variant="highlight">
              <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>
                Com borda lateral colorida para destaque.
              </Text>
            </MobileCard>
          </View>

          <Text style={styles.groupTitle}>SwipeableRow</Text>
          <Text style={styles.description}>
            Row com ações de swipe para esquerda/direita (requer react-native-gesture-handler).
          </Text>
          <View style={{ borderRadius: theme.borderRadius.md, overflow: 'hidden' }}>
            <SwipeableRow
              leftActions={[
                {
                  icon: 'checkmark',
                  label: 'Concluir',
                  color: theme.colors.success,
                  onPress: () => showToast('success'),
                },
              ]}
              rightActions={[
                {
                  icon: 'close',
                  label: 'Pular',
                  color: theme.colors.warning,
                  onPress: () => showToast('info'),
                },
              ]}
            >
              <View style={{
                padding: theme.spacing.md,
                backgroundColor: theme.colors.surface,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}>
                <Icon name="swap-horizontal" tone="muted" />
                <Text style={{ color: theme.colors.gray700 }}>← Deslize para ações →</Text>
              </View>
            </SwipeableRow>
          </View>

          <Text style={styles.groupTitle}>MobileEmptyState e MobileLoading</Text>
          <View style={{ gap: theme.spacing.md }}>
            <MobileEmptyState
              icon="folder-open-outline"
              title="Nenhuma rota encontrada"
              subtitle="Crie uma nova rota para começar"
              actionLabel="Nova Rota"
              onAction={() => showToast('info')}
            />
            <View style={{ alignItems: 'center', padding: theme.spacing.md }}>
              <MobileLoading message="Carregando dados..." />
            </View>
          </View>

          <CodeBlock
            code={`import {
  MobileHeader,
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileLoading,
} from '@/design-system';
import { SwipeableRow } from '@/components/SwipeableRow';

<MobileHeader title="Rotas" subtitle="5 rotas ativas" />

<MobileButton title="Iniciar" variant="success" />

<SwipeableRow
  leftActions={[{ icon: 'checkmark', label: 'OK', color: 'green', onPress: fn }]}
  rightActions={[{ icon: 'close', label: 'Pular', color: 'orange', onPress: fn }]}
>
  <RowContent />
</SwipeableRow>`}
          />
        </View>

        {/* ========================================
            SEÇÃO: COMPONENTES ESPECIALIZADOS
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('especializados')}>
          <SectionHeader
            id="especializados"
            title="Componentes Especializados"
            description="Componentes com integração externa (Google Maps, Camera)"
          />

          <Text style={styles.groupTitle}>AddressAutocomplete</Text>
          <Text style={styles.description}>
            Input com autocomplete via Google Places API. Requer EXPO_PUBLIC_GOOGLE_MAPS_API_KEY configurada.
          </Text>
          <AddressAutocomplete
            value={addressValue}
            onChangeText={setAddressValue}
            onSelectAddress={(address, placeId) => {
              showToast('info');
              console.log('Endereço selecionado:', address, 'PlaceID:', placeId);
            }}
            placeholder="Digite um endereço..."
          />
          <View style={{ marginTop: theme.spacing.sm }}>
            <Text style={{ fontSize: 12, color: theme.colors.gray500 }}>
              • Busca a partir de 3 caracteres{'\n'}
              • Debounce de 1s para otimização{'\n'}
              • Session tokens para redução de custos{'\n'}
              • Coordenadas obtidas automaticamente
            </Text>
          </View>

          <Text style={styles.groupTitle}>CameraUpload</Text>
          <Text style={styles.description}>
            Componente para captura e upload de fotos com compressão automática.
            Requer permissões de câmera e galeria.
          </Text>
          <View style={styles.cameraUploadDemo}>
            <Icon name="camera" size={48} tone="muted" />
            <Text style={styles.demoText}>Preview do CameraUpload</Text>
            <Text style={styles.demoSubtext}>
              • Compressão automática (max 1200px, 70% quality){'\n'}
              • Suporte offline (iOS/Android){'\n'}
              • Upload para Supabase Storage{'\n'}
              • Preview antes do envio
            </Text>
          </View>

          <CodeBlock
            code={`import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import CameraUpload from '@/components/CameraUpload';

<AddressAutocomplete
  value={endereco}
  onChangeText={setEndereco}
  onSelectAddress={(address, placeId) => {
    // Obter coordenadas via googleMapsService.getPlaceDetails(placeId)
  }}
  placeholder="Digite o endereço..."
/>

<CameraUpload
  unidadeId={unidadeId}
  rotaId={rotaId}
  paradaId={paradaId}
  onUploadSuccess={(fotoUrl) => console.log('Foto:', fotoUrl)}
  onUploadError={(error) => console.error(error)}
/>`}
          />
        </View>

        {/* ========================================
            SEÇÃO: ACESSIBILIDADE
        ======================================== */}
        <View style={styles.section} onLayout={handleSectionLayout('acessibilidade')}>
          <SectionHeader
            id="acessibilidade"
            title="Acessibilidade"
            description="Diretrizes WCAG e boas práticas"
          />

          <Card style={styles.a11yCard}>
            <View style={styles.a11yItem}>
              <Icon name="checkmark-circle" tone="success" size={20} />
              <View style={{ flex: 1 }}>
                <Text style={styles.a11yTitle}>Contraste de Cores</Text>
                <Text style={styles.a11yDesc}>
                  Todas as cores primárias atendem WCAG AA (mínimo 4.5:1 para texto normal)
                </Text>
              </View>
            </View>

            <View style={styles.a11yItem}>
              <Icon name="checkmark-circle" tone="success" size={20} />
              <View style={{ flex: 1 }}>
                <Text style={styles.a11yTitle}>Alvos de Toque</Text>
                <Text style={styles.a11yDesc}>
                  Botões e elementos interativos têm mínimo de 44x44px (iOS) / 48x48dp
                  (Android)
                </Text>
              </View>
            </View>

            <View style={styles.a11yItem}>
              <Icon name="checkmark-circle" tone="success" size={20} />
              <View style={{ flex: 1 }}>
                <Text style={styles.a11yTitle}>Labels e Roles</Text>
                <Text style={styles.a11yDesc}>
                  Componentes incluem accessibilityLabel e accessibilityRole apropriados
                </Text>
              </View>
            </View>

            <View style={styles.a11yItem}>
              <Icon name="checkmark-circle" tone="success" size={20} />
              <View style={{ flex: 1 }}>
                <Text style={styles.a11yTitle}>Navegação por Teclado</Text>
                <Text style={styles.a11yDesc}>
                  Suporte a Tab/Enter/Escape na web com focus visible
                </Text>
              </View>
            </View>

            <View style={styles.a11yItem}>
              <Icon name="checkmark-circle" tone="success" size={20} />
              <View style={{ flex: 1 }}>
                <Text style={styles.a11yTitle}>Tema de Alto Contraste</Text>
                <Text style={styles.a11yDesc}>
                  Variante highContrast disponível para usuários com baixa visão
                </Text>
              </View>
            </View>
          </Card>

          <Text style={styles.groupTitle}>Requisitos WCAG</Text>
          <View style={styles.wcagTable}>
            <View style={styles.wcagRow}>
              <Text style={styles.wcagHeader}>Nível</Text>
              <Text style={styles.wcagHeader}>Texto Normal</Text>
              <Text style={styles.wcagHeader}>Texto Grande</Text>
            </View>
            <View style={styles.wcagRow}>
              <Text style={styles.wcagCell}>AA</Text>
              <Text style={styles.wcagCell}>4.5:1</Text>
              <Text style={styles.wcagCell}>3:1</Text>
            </View>
            <View style={styles.wcagRow}>
              <Text style={styles.wcagCell}>AAA</Text>
              <Text style={styles.wcagCell}>7:1</Text>
              <Text style={styles.wcagCell}>4.5:1</Text>
            </View>
          </View>

          <CodeBlock
            code={`// Sempre incluir labels de acessibilidade
<Button
  title="Salvar"
  accessibilityLabel="Salvar alterações"
  accessibilityHint="Toque duas vezes para salvar"
/>

// Usar roles semânticos
<View accessibilityRole="alert">
  <Text>Erro: Campo obrigatório</Text>
</View>`}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Design System RotaMestre v2.0.0
          </Text>
          <Text style={styles.footerSubtext}>
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </Text>
                  </View>
      </ScrollView>

      {/* Modais */}
      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Exemplo de Modal"
        size="medium"
      >
        <View style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.gray700 }}>
            Este é um exemplo de modal com conteúdo customizado.
          </Text>
          <Input label="Nome" placeholder="Digite seu nome" />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => setModalVisible(false)}
            />
            <Button title="Confirmar" onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>

      <AlertDialog
        visible={alertVisible}
        title="Operação Concluída"
        message="Os dados foram salvos com sucesso no sistema."
        type="success"
        onConfirm={() => setAlertVisible(false)}
      />

      <ConfirmDialog
        visible={confirmVisible}
        title="Confirmar Ação"
        message="Tem certeza que deseja continuar? Esta ação não pode ser desfeita."
        confirmText="Sim, continuar"
        cancelText="Cancelar"
        onConfirm={() => {
          setConfirmVisible(false);
          showToast('success');
        }}
        onCancel={() => setConfirmVisible(false)}
      />

      <DesktopModal
        visible={desktopModalVisible}
        onClose={() => setDesktopModalVisible(false)}
        title="Exemplo de DesktopModal"
        secondaryButton={{
          text: 'Cancelar',
          onPress: () => setDesktopModalVisible(false),
        }}
        primaryButton={{
          text: 'Confirmar',
          onPress: () => {
            setDesktopModalVisible(false);
            showToast('success');
          },
        }}
      >
        <View style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.gray700, marginBottom: theme.spacing.sm }}>
            Modal responsivo que se adapta automaticamente entre dialog (web/desktop) e bottom sheet (mobile).
          </Text>
          <Input label="Campo de exemplo" placeholder="Digite algo..." />
        </View>
      </DesktopModal>

      <ConfirmModal
        visible={confirmModalVisible}
        title="Confirmar Ação"
        message="Tem certeza que deseja realizar esta operação? Esta é uma demonstração do ConfirmModal com tipo warning."
        type="warning"
        confirmText="Sim, confirmar"
        cancelText="Cancelar"
        onConfirm={() => {
          setConfirmModalVisible(false);
          showToast('success');
        }}
        onCancel={() => setConfirmModalVisible(false)}
      />

      <ConfirmModal
        visible={confirmModalDestructiveVisible}
        title="Excluir Permanentemente"
        message="Esta ação não pode ser desfeita. Todos os dados relacionados serão removidos permanentemente do sistema."
        type="danger"
        confirmText="Excluir"
        cancelText="Cancelar"
        destructiveConfirmText="EXCLUIR"
        onConfirm={() => {
          setConfirmModalDestructiveVisible(false);
          showToast('success');
        }}
        onCancel={() => setConfirmModalDestructiveVisible(false)}
      />

      <SupportModal
        visible={supportModalVisible}
        onClose={() => setSupportModalVisible(false)}
      />

      <Toast
        visible={toastVisible}
        type={toastType}
        message={
          toastType === 'success'
            ? 'Operação realizada com sucesso!'
            : toastType === 'error'
              ? 'Ocorreu um erro. Tente novamente.'
              : toastType === 'loading'
                ? 'Processando, aguarde...'
                : 'Informação importante.'
        }
        onHide={() => setToastVisible(false)}
        testID="design-system-toast"
      />
    </View>
  );
}

// ============================================
// ESTILOS
// ============================================

const createStyles = (theme: Theme, isDesktop: boolean) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.colors.background,
    },
    sidebar: {
      width: 240,
      backgroundColor: theme.colors.surface,
      borderRightWidth: 1,
      borderRightColor: theme.colors.border,
      padding: theme.spacing.lg,
    },
    sidebarTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontFamily: theme.typography.fontDisplay,
      color: theme.colors.primary,
    },
    sidebarSubtitle: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSans,
      color: theme.colors.gray500,
      marginBottom: theme.spacing.xl,
    },
    sidebarNav: {
      gap: 2,
    },
    sidebarCategory: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray400,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    sidebarItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
    },
    sidebarItemActive: {
      backgroundColor: theme.colors.primaryLight + '20',
    },
    sidebarItemText: {
      fontSize: theme.typography.fontSize.sm,
      fontFamily: theme.typography.fontSans,
      color: theme.colors.gray600,
    },
    sidebarItemTextActive: {
      color: theme.colors.primary,
      fontFamily: theme.typography.fontSansSemiBold,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: isDesktop ? theme.spacing['2xl'] : theme.spacing.lg,
      paddingBottom: theme.spacing['4xl'],
      maxWidth: 900,
    },
    header: {
      marginBottom: theme.spacing.xl,
    },
    title: {
      fontSize: isDesktop ? theme.typography.fontSize['3xl'] : theme.typography.fontSize['2xl'],
      fontFamily: theme.typography.fontDisplay,
      color: theme.colors.gray900,
    },
    subtitle: {
      fontSize: theme.typography.fontSize.base,
      fontFamily: theme.typography.fontSans,
      color: theme.colors.gray600,
      marginTop: theme.spacing.xs,
    },
    themeToggleRow: {
      marginTop: theme.spacing.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    themeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.gray100,
      borderRadius: theme.borderRadius.md,
    },
    themeButtonActive: {
      backgroundColor: theme.colors.primaryBg,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    themeButtonText: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray700,
    },
    themeButtonTextActive: {
      color: theme.colors.primary,
    },
    searchContainer: {
      marginTop: theme.spacing.md,
    },
    searchResults: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSans,
      color: theme.colors.gray500,
      marginTop: theme.spacing.xs,
    },
    mobileNav: {
      marginBottom: theme.spacing.lg,
      marginHorizontal: -theme.spacing.lg,
    },
    mobileNavContent: {
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    mobileNavItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.gray100,
      borderRadius: theme.borderRadius.full,
    },
    mobileNavItemActive: {
      backgroundColor: theme.colors.primary,
    },
    mobileNavText: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray600,
    },
    mobileNavTextActive: {
      color: theme.colors.white,
    },
    section: {
      marginBottom: theme.spacing['2xl'],
      paddingBottom: theme.spacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray100,
    },
    controlRow: {
      flexDirection: 'row',
      marginBottom: theme.spacing.md,
    },
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.gray100,
      borderRadius: theme.borderRadius.sm,
    },
    toggleText: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSans,
      color: theme.colors.gray600,
    },
    groupTitle: {
      fontSize: theme.typography.fontSize.sm,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray700,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    swatchGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    typeSamples: {
      gap: theme.spacing.md,
    },
    typeSample: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray100,
    },
    shadowGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xl,
    },
    shadowItem: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    shadowLabel: {
      fontSize: theme.typography.fontSize.sm,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray700,
    },
    shadowValue: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSans,
      color: theme.colors.gray500,
    },
    componentRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      alignItems: 'center',
    },
    inputGrid: {
      gap: theme.spacing.md,
    },
    demoCard: {
      padding: theme.spacing.lg,
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
    a11yCard: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    a11yItem: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      alignItems: 'flex-start',
    },
    a11yTitle: {
      fontSize: theme.typography.fontSize.sm,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray900,
    },
    a11yDesc: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSans,
      color: theme.colors.gray600,
      marginTop: 2,
    },
    wcagTable: {
      borderWidth: 1,
      borderColor: theme.colors.gray200,
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
    },
    wcagRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray200,
    },
    wcagHeader: {
      flex: 1,
      padding: theme.spacing.sm,
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray700,
      backgroundColor: theme.colors.gray50,
      textAlign: 'center',
    },
    wcagCell: {
      flex: 1,
      padding: theme.spacing.sm,
      fontSize: theme.typography.fontSize.sm,
      fontFamily: theme.typography.fontSans,
      color: theme.colors.gray600,
      textAlign: 'center',
    },
    description: {
      fontSize: theme.typography.fontSize.sm,
      fontFamily: theme.typography.fontSans,
      color: theme.colors.gray600,
      marginBottom: theme.spacing.md,
    },
    cameraUploadDemo: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
      backgroundColor: theme.colors.gray50,
      borderRadius: theme.borderRadius.md,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: theme.colors.gray300,
      gap: theme.spacing.sm,
    },
    demoText: {
      fontSize: theme.typography.fontSize.base,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray700,
    },
    demoSubtext: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSans,
      color: theme.colors.gray500,
      textAlign: 'center',
      lineHeight: 18,
    },
    statesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.lg,
    },
    stateItem: {
      alignItems: 'center',
      gap: theme.spacing.xs,
      minWidth: 100,
    },
    stateLabel: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray700,
    },
    stateHint: {
      fontSize: 10,
      fontFamily: theme.typography.fontSans,
      color: theme.colors.gray500,
    },
    footer: {
      alignItems: 'center',
      paddingTop: theme.spacing.xl,
      marginTop: theme.spacing.xl,
      borderTopWidth: 1,
      borderTopColor: theme.colors.gray100,
    },
    footerText: {
      fontSize: theme.typography.fontSize.sm,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray700,
    },
    footerSubtext: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSans,
      color: theme.colors.gray500,
      marginTop: theme.spacing.xs,
    },
  });
