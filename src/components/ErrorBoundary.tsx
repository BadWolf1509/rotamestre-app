/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors in child component tree and displays
 * a friendly fallback UI instead of crashing the entire app.
 *
 * Features:
 * - Captures errors from nested components
 * - Shows user-friendly error message
 * - "Try Again" button to attempt recovery
 * - "Go Home" button as escape hatch
 * - Integrates with logger breadcrumbs for debugging
 * - Shows error details in DEV mode
 * - Supports custom fallback UI
 * - Auto-reset via resetKeys prop
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   onError={(error, info) => trackError(error, info)}
 *   resetKeys={[routeId]}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Share, Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { defaultTheme } from '@/utils/styles';

// Component tokens for ErrorBoundary
const tokens = defaultTheme.components.errorBoundary;

interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback UI to show instead of default error screen */
  fallback?: ReactNode;
  /** Callback when error is caught (for analytics/logging) */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Keys that trigger auto-reset when changed (e.g., route params) */
  resetKeys?: unknown[];
  /** Show "Go Home" button as recovery option */
  showGoHome?: boolean;
  /** Show "Report Bug" button for sharing error details */
  showReportBug?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error with breadcrumbs for debugging
    logger.error('ErrorBoundary caught an error', error);

    // Add error to breadcrumb trail
    logger.action('error_boundary', 'Error caught', {
      errorName: error.name,
      errorMessage: error.message,
    });

    // Store errorInfo for potential bug report
    this.setState({ errorInfo });

    // Call external error handler
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state if resetKeys changed
    if (
      this.state.hasError &&
      this.props.resetKeys &&
      prevProps.resetKeys &&
      !this.areKeysEqual(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.handleReset();
    }
  }

  areKeysEqual(prevKeys: unknown[], nextKeys: unknown[]): boolean {
    if (prevKeys.length !== nextKeys.length) return false;
    return prevKeys.every((key, index) => key === nextKeys[index]);
  }

  handleReset = (): void => {
    logger.action('error_boundary', 'User clicked Try Again');
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = (): void => {
    logger.action('error_boundary', 'User clicked Go Home');
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Navigate to home screen
    try {
      router.replace('/');
    } catch {
      // If router fails, at least reset the error state
    }
  };

  handleReportBug = async (): Promise<void> => {
    logger.action('error_boundary', 'User clicked Report Bug');

    const { error, errorInfo } = this.state;
    const breadcrumbs = logger.getBreadcrumbs();

    // Build error report
    const report = [
      '=== Error Report ===',
      `Date: ${new Date().toISOString()}`,
      `Platform: ${Platform.OS}`,
      '',
      '--- Error ---',
      `Name: ${error?.name || 'Unknown'}`,
      `Message: ${error?.message || 'No message'}`,
      '',
      '--- Recent Actions (Breadcrumbs) ---',
      ...breadcrumbs.slice(-10).map(
        (b) => `[${new Date(b.timestamp).toISOString()}] ${b.type}: ${b.message}`
      ),
    ];

    if (__DEV__ && errorInfo?.componentStack) {
      report.push('', '--- Component Stack ---', errorInfo.componentStack);
    }

    try {
      await Share.share({
        message: report.join('\n'),
        title: 'RotaMestre - Bug Report',
      });
    } catch (error: unknown) {
      logger.warn('[ErrorBoundary] Share failed:', error);
    }
  };

  render(): ReactNode {
    const { showGoHome = true, showReportBug = true } = this.props;

    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.container}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle-outline" size={tokens.iconSize} color={defaultTheme.colors.error} />
            </View>
            <Text style={styles.title}>Algo deu errado</Text>
            <Text style={styles.message}>
              Ocorreu um erro inesperado. Por favor, tente novamente.
            </Text>

            {__DEV__ && this.state.error && (
              <View style={styles.errorDetailContainer}>
                <Text style={styles.errorDetailLabel}>Detalhes (DEV):</Text>
                <Text style={styles.errorDetail}>
                  {this.state.error.name}: {this.state.error.message}
                </Text>
              </View>
            )}

            {/* Primary action: Try Again */}
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleReset}
              accessibilityLabel="Tentar novamente"
              accessibilityRole="button"
            >
              <Ionicons name="refresh-outline" size={tokens.buttonIconSize} color={defaultTheme.colors.white} />
              <Text style={styles.buttonText}>Tentar Novamente</Text>
            </TouchableOpacity>

            {/* Secondary actions */}
            <View style={styles.secondaryActions}>
              {showGoHome && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={this.handleGoHome}
                  accessibilityLabel="Voltar ao início"
                  accessibilityRole="button"
                >
                  <Ionicons name="home-outline" size={tokens.buttonIconSize} color={defaultTheme.colors.gray600} />
                  <Text style={styles.secondaryButtonText}>Início</Text>
                </TouchableOpacity>
              )}

              {showReportBug && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={this.handleReportBug}
                  accessibilityLabel="Reportar problema"
                  accessibilityRole="button"
                >
                  <Ionicons name="bug-outline" size={tokens.buttonIconSize} color={defaultTheme.colors.gray600} />
                  <Text style={styles.secondaryButtonText}>Reportar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: defaultTheme.colors.gray50,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.containerPadding,
  },
  content: {
    backgroundColor: defaultTheme.colors.white,
    borderRadius: tokens.cardBorderRadius,
    padding: tokens.cardPadding,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    ...defaultTheme.shadows.md,
  },
  iconContainer: {
    marginBottom: defaultTheme.spacing.lg,
  },
  title: {
    fontSize: tokens.titleFontSize,
    fontFamily: defaultTheme.typography.fontSansSemiBold,
    color: defaultTheme.colors.gray900,
    marginBottom: defaultTheme.spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: tokens.messageFontSize,
    fontFamily: defaultTheme.typography.fontSans,
    color: defaultTheme.colors.gray500,
    textAlign: 'center',
    marginBottom: defaultTheme.spacing.xl,
    lineHeight: 20,
  },
  errorDetailContainer: {
    width: '100%',
    marginBottom: defaultTheme.spacing.lg,
  },
  errorDetailLabel: {
    fontSize: tokens.errorDetailFontSize,
    fontFamily: defaultTheme.typography.fontSansSemiBold,
    color: defaultTheme.colors.gray700,
    marginBottom: defaultTheme.spacing.xs,
  },
  errorDetail: {
    fontSize: tokens.errorDetailFontSize,
    color: defaultTheme.colors.error,
    fontFamily: 'monospace',
    backgroundColor: defaultTheme.colors.red50,
    padding: defaultTheme.spacing.md,
    borderRadius: defaultTheme.borderRadius.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: defaultTheme.colors.info,
    paddingVertical: tokens.buttonPaddingV,
    paddingHorizontal: tokens.buttonPaddingH,
    borderRadius: tokens.buttonBorderRadius,
    gap: defaultTheme.spacing.sm,
    width: '100%',
  },
  buttonText: {
    color: defaultTheme.colors.white,
    fontSize: tokens.buttonFontSize,
    fontFamily: defaultTheme.typography.fontSansSemiBold,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: defaultTheme.spacing.xl,
    marginTop: defaultTheme.spacing.lg,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: defaultTheme.spacing.xs,
    paddingVertical: defaultTheme.spacing.sm,
    paddingHorizontal: defaultTheme.spacing.md,
  },
  secondaryButtonText: {
    color: defaultTheme.colors.gray600,
    fontSize: tokens.messageFontSize,
    fontFamily: defaultTheme.typography.fontSans,
  },
});
