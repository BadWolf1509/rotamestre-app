import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from '@/utils/styles';

interface BreadcrumbItem {
  label: string;
  route?: string;
}

interface ActionButton {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

interface DesktopPageLayoutProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ActionButton[];
  children: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  fullWidth?: boolean;
  noPadding?: boolean;
}

export function DesktopPageLayout({
  title,
  subtitle,
  breadcrumbs,
  actions,
  children,
  loading,
  loadingText = 'Carregando...',
  showBackButton,
  onBack,
  fullWidth = false,
  noPadding = false,
}: DesktopPageLayoutProps) {
  const { theme } = useUnistyles();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{loadingText}</Text>
      </View>
    );
  }

  const getButtonStyle = (variant?: 'primary' | 'secondary' | 'ghost') => {
    switch (variant) {
      case 'secondary':
        return styles.buttonSecondary;
      case 'ghost':
        return styles.buttonGhost;
      default:
        return styles.buttonPrimary;
    }
  };

  const getButtonTextStyle = (variant?: 'primary' | 'secondary' | 'ghost') => {
    switch (variant) {
      case 'secondary':
      case 'ghost':
        return styles.buttonTextSecondary;
      default:
        return styles.buttonTextPrimary;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <View style={styles.breadcrumbs}>
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={index}>
                  {item.route ? (
                    <TouchableOpacity
                      onPress={() => router.push(item.route as any)}
                      style={styles.breadcrumbButton}
                    >
                      <Text style={styles.breadcrumbLink}>{item.label}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.breadcrumbText}>{item.label}</Text>
                  )}
                  {index < breadcrumbs.length - 1 && (
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={theme.colors.gray400}
                      style={styles.breadcrumbSeparator}
                    />
                  )}
                </React.Fragment>
              ))}
            </View>
          )}

          {/* Title Section */}
          <View style={styles.titleSection}>
            {showBackButton && (
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={24} color={theme.colors.gray600} />
              </TouchableOpacity>
            )}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          </View>
        </View>

        {/* Actions */}
        {actions && actions.length > 0 && (
          <View style={styles.actions}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  getButtonStyle(action.variant),
                  action.disabled && styles.buttonDisabled,
                ]}
                onPress={action.onPress}
                disabled={action.disabled}
              >
                {action.icon && (
                  <Ionicons
                    name={action.icon}
                    size={18}
                    color={
                      action.variant === 'primary'
                        ? theme.colors.white
                        : theme.colors.gray700
                    }
                    style={styles.buttonIcon}
                  />
                )}
                <Text style={[styles.buttonText, getButtonTextStyle(action.variant)]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          fullWidth && styles.contentFullWidth,
          noPadding && styles.contentNoPadding,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, fullWidth && styles.contentInnerFullWidth]}>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.gray500,
  },
  header: {
    backgroundColor: theme.colors.white,
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 2,
  },
  headerContent: {
    flex: 1,
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  breadcrumbButton: {
    padding: 2,
  },
  breadcrumbLink: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  breadcrumbText: {
    fontSize: 13,
    color: theme.colors.gray600,
  },
  breadcrumbSeparator: {
    marginHorizontal: 8,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    padding: 4,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.gray900,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: theme.colors.gray500,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonIcon: {
    marginRight: 4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: theme.colors.white,
  },
  buttonTextSecondary: {
    color: theme.colors.gray700,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 32,
  },
  contentFullWidth: {
    padding: 0,
  },
  contentNoPadding: {
    padding: 0,
  },
  content: {
    maxWidth: 1400,
    marginHorizontal: 'auto',
    width: '100%',
  },
  contentInnerFullWidth: {
    maxWidth: '100%',
  },
}));