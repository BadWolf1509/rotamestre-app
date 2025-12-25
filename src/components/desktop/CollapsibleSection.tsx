/**
 * CollapsibleSection - Seção expansível para progressive disclosure
 *
 * Permite esconder campos opcionais por padrão, reduzindo a densidade visual
 * em formulários. Se campos têm dados, a seção expande automaticamente.
 *
 * @example
 * <CollapsibleSection title="Detalhes adicionais" defaultExpanded={false}>
 *   <Input label="Destinatário" />
 *   <Input label="Telefone" />
 * </CollapsibleSection>
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleSectionProps {
  /** Section title */
  title: string;
  /** Icon name from Ionicons (optional) */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Whether expanded by default (default: false) */
  defaultExpanded?: boolean;
  /** Badge to show next to title (optional) */
  badge?: string | number;
  /** Force expanded state (useful when fields have data) */
  forceExpanded?: boolean;
  /** Content to render inside the section */
  children: React.ReactNode;
  /** Test ID for testing */
  testID?: string;
}

export function CollapsibleSection({
  title,
  icon,
  defaultExpanded = false,
  badge,
  forceExpanded,
  children,
  testID,
}: CollapsibleSectionProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto');

  // Force expand when forceExpanded is true
  useEffect(() => {
    if (forceExpanded && !expanded) {
      setExpanded(true);
    }
  }, [forceExpanded, expanded]);

  // Measure content height for smooth animation on web
  useEffect(() => {
    if (Platform.OS === 'web' && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  const handleToggle = () => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded((prev) => !prev);
  };

  // Compact styling for desktop
  const headerPadding = isDesktop ? theme.spacing.sm : theme.spacing.md;
  const fontSize = isDesktop ? theme.typography.fontSize.sm : theme.typography.fontSize.base;

  // Web-specific styles for smooth animation
  if (Platform.OS === 'web') {
    return (
      <div
        data-testid={testID}
        style={{
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: theme.colors.gray200,
          borderRadius: theme.borderRadius.md,
          marginBottom: isDesktop ? theme.desktop.field.marginBottom : theme.spacing.md,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <button
          onClick={handleToggle}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            padding: headerPadding,
            backgroundColor: expanded ? theme.colors.gray50 : 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.gray50;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = expanded ? theme.colors.gray50 : 'transparent';
          }}
        >
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={isDesktop ? 16 : 20}
            color={theme.colors.gray500}
            style={{ marginRight: theme.spacing.sm }}
          />
          {icon && (
            <Ionicons
              name={icon}
              size={isDesktop ? 16 : 20}
              color={theme.colors.gray600}
              style={{ marginRight: theme.spacing.sm }}
            />
          )}
          <span
            style={{
              flex: 1,
              fontSize,
              fontWeight: 600,
              color: theme.colors.gray700,
              textAlign: 'left',
            }}
          >
            {title}
          </span>
          {badge !== undefined && (
            <span
              style={{
                backgroundColor: theme.colors.primaryBg,
                color: theme.colors.primary,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: 600,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: theme.borderRadius.sm,
                marginLeft: theme.spacing.sm,
              }}
            >
              {badge}
            </span>
          )}
        </button>

        {/* Content with smooth animation */}
        <div
          ref={contentRef}
          style={{
            maxHeight: expanded ? (contentHeight === 'auto' ? 'none' : contentHeight) : 0,
            overflow: 'hidden',
            transition: 'max-height 0.25s ease-in-out',
          }}
        >
          <div
            style={{
              padding: isDesktop ? theme.desktop.section.padding : theme.spacing.md,
              paddingTop: 0,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Native (React Native) implementation
  return (
    <View style={styles.container} testID={testID}>
      {/* Header */}
      <TouchableOpacity
        onPress={handleToggle}
        style={[styles.header, expanded && styles.headerExpanded]}
        activeOpacity={0.7}
      >
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={isDesktop ? 16 : 20}
          color={theme.colors.gray500}
          style={styles.chevron}
        />
        {icon && (
          <Ionicons
            name={icon}
            size={isDesktop ? 16 : 20}
            color={theme.colors.gray600}
            style={styles.icon}
          />
        )}
        <Text style={[styles.title, { fontSize }]}>{title}</Text>
        {badge !== undefined && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Content */}
      {expanded && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: 'transparent',
  },
  headerExpanded: {
    backgroundColor: theme.colors.gray50,
  },
  chevron: {
    marginRight: theme.spacing.sm,
  },
  icon: {
    marginRight: theme.spacing.sm,
  },
  title: {
    flex: 1,
    fontWeight: '600',
    color: theme.colors.gray700,
  },
  badge: {
    backgroundColor: theme.colors.primaryBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.sm,
  },
  badgeText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
  },
  content: {
    padding: theme.spacing.md,
    paddingTop: 0,
  },
}));
