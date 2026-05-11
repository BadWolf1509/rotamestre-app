import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  ScrollViewProps,
  Platform,
} from 'react-native';

import { NotificationBell } from '@/components/NotificationBell';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export interface BreadcrumbItem {
  label: string;
  route?: string;
}

export interface ActionButton {
  label: string;
  icon?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | string;
  disabled?: boolean;
}

export interface UserMenuItem {
  label: string;
  icon?: string;
  onPress: () => void;
  destructive?: boolean;
}

interface DesktopPageLayoutProps {
  title: string;
  subtitle?: string;
  icon?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ActionButton[];
  children: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  fullWidth?: boolean;
  noPadding?: boolean;
  headerExtra?: React.ReactNode;
  userMenuTrigger?: React.ReactNode | ((isOpen: boolean) => React.ReactNode);
  userMenuItems?: UserMenuItem[];
  scrollViewProps?: ScrollViewProps;
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
  headerExtra,
  userMenuTrigger,
  userMenuItems,
  scrollViewProps: providedScrollProps,
}: DesktopPageLayoutProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const [userMenuVisible, setUserMenuVisible] = React.useState(false);
  const userMenuRef = React.useRef<View>(null);

  // Detect clicks outside the dropdown to close it
  React.useEffect(() => {
    if (!userMenuVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside the menu
      const target = event.target as HTMLElement;
      const menuElement = userMenuRef.current as unknown as HTMLElement | null;

      if (menuElement && !menuElement.contains?.(target)) {
        setUserMenuVisible(false);
      }
    };

    // Add event listener on mount
    document.addEventListener('mousedown', handleClickOutside);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuVisible]);

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

  const getButtonStyle = (variant?: string) => {
    switch (variant) {
      case 'secondary':
        return styles.buttonSecondary;
      case 'ghost':
        return styles.buttonGhost;
      default:
        return styles.buttonPrimary;
    }
  };

  const getButtonTextStyle = (variant?: string) => {
    switch (variant) {
      case 'secondary':
      case 'ghost':
        return styles.buttonTextSecondary;
      default:
        return styles.buttonTextPrimary;
    }
  };

  const {
    contentContainerStyle,
    style: scrollStyle,
    ...restScrollViewProps
  } = providedScrollProps || {};

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <View style={styles.breadcrumbs}>
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={index}>
                  {item.route ? (
                    <TouchableOpacity
                      onPress={() => router.push(item.route as Href)}
                      style={styles.breadcrumbButton}
                      accessibilityLabel={item.label}
                      accessibilityRole="link"
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
                accessibilityLabel="Voltar"
                accessibilityRole="button"
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={theme.colors.gray600}
                />
              </TouchableOpacity>
            )}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          </View>
        </View>

        {(headerExtra ||
          userMenuTrigger ||
          (actions && actions.length > 0)) && (
          <View style={styles.headerRight}>
            <NotificationBell variant="desktop" />
            {headerExtra && (
              <View style={styles.headerExtra}>{headerExtra}</View>
            )}
            {userMenuTrigger && userMenuItems?.length ? (
              <View style={styles.headerExtra} ref={userMenuRef}>
                <TouchableOpacity
                  onPress={() => setUserMenuVisible((prev) => !prev)}
                  activeOpacity={0.8}
                  accessibilityLabel="Menu de usuário"
                  accessibilityRole="button"
                  accessibilityState={{ expanded: userMenuVisible }}
                >
                  {typeof userMenuTrigger === 'function'
                    ? userMenuTrigger(userMenuVisible)
                    : userMenuTrigger}
                </TouchableOpacity>
                {userMenuVisible && (
                  <View style={styles.userMenu}>
                    {userMenuItems.map((item, index) => (
                      <TouchableOpacity
                        key={`${item.label}-${index}`}
                        style={styles.userMenuItem}
                        onPress={() => {
                          setUserMenuVisible(false);
                          item.onPress();
                        }}
                        accessibilityLabel={item.label}
                        accessibilityRole="menuitem"
                      >
                        {item.icon && (
                          <Ionicons
                            name={item.icon as keyof typeof Ionicons.glyphMap}
                            size={16}
                            color={
                              item.destructive
                                ? theme.colors.error
                                : theme.colors.gray700
                            }
                          />
                        )}
                        <Text
                          style={[
                            styles.userMenuText,
                            item.destructive && styles.userMenuTextLogout,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : null}
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
                    accessibilityLabel={action.label}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !!action.disabled }}
                  >
                    {action.icon && (
                      <Ionicons
                        name={action.icon as keyof typeof Ionicons.glyphMap}
                        size={18}
                        color={
                          action.variant === 'primary'
                            ? theme.colors.white
                            : theme.colors.gray700
                        }
                        style={styles.buttonIcon}
                      />
                    )}
                    <Text
                      style={[
                        styles.buttonText,
                        getButtonTextStyle(action.variant),
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        testID="desktop-page-scroll-view"
        style={[styles.scrollView, scrollStyle]}
        contentContainerStyle={[
          styles.contentContainer,
          fullWidth && styles.contentFullWidth,
          noPadding && styles.contentNoPadding,
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        {...restScrollViewProps}
      >
        <View
          style={[styles.content, fullWidth && styles.contentInnerFullWidth]}
        >
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.components.pageLayout.headerSubtitleFontSize,
    color: theme.colors.gray500,
  },
  header: {
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.md + theme.spacing.xs,
    paddingHorizontal: theme.components.pageLayout.contentPadding,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    ...theme.shadows.sm,
    zIndex: 50,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  breadcrumbButton: {
    padding: theme.spacing['0.5'],
  },
  breadcrumbLink: {
    fontSize: theme.components.pageLayout.breadcrumbFontSize,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  breadcrumbText: {
    fontSize: theme.components.pageLayout.breadcrumbFontSize,
    color: theme.colors.gray600,
  },
  breadcrumbSeparator: {
    marginHorizontal: theme.spacing.xs,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.components.pageLayout.headerTitleFontSize,
    fontWeight: '700',
    color: theme.colors.gray900,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontSize: theme.components.pageLayout.headerSubtitleFontSize,
    color: theme.colors.gray500,
    lineHeight: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginLeft: theme.components.pageLayout.contentPadding,
  },
  headerExtra: {
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  userMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: theme.spacing['2'],
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    zIndex: 60,
  },
  userMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  userMenuText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray700,
  },
  userMenuTextLogout: {
    color: theme.colors.error,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
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
    marginRight: theme.spacing.xs,
  },
  buttonText: {
    fontSize: theme.components.pageLayout.headerSubtitleFontSize,
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
    padding: theme.components.pageLayout.contentPadding,
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
