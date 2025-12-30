/**
 * Componente ErrorBoundary para capturar erros em componentes filhos
 * e exibir uma UI de fallback amigável
 */

import { Ionicons } from '@expo/vector-icons';
import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { defaultTheme } from '@/utils/styles';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
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
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

          return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle-outline" size={64} color={defaultTheme.colors.error} />
            </View>
            <Text style={styles.title}>Algo deu errado</Text>
            <Text style={styles.message}>
              Ocorreu um erro inesperado. Por favor, tente novamente.
            </Text>
            {__DEV__ && this.state.error && (
              <Text style={styles.errorDetail}>
                {this.state.error.message}
              </Text>
            )}
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleReset}
              accessibilityLabel="Tentar novamente"
              accessibilityRole="button"
            >
              <Ionicons name="refresh-outline" size={20} color={defaultTheme.colors.white} />
              <Text style={styles.buttonText}>Tentar Novamente</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultTheme.colors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: defaultTheme.colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: defaultTheme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: defaultTheme.colors.gray900,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: defaultTheme.colors.gray500,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  errorDetail: {
    fontSize: 12,
    color: defaultTheme.colors.error,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
    backgroundColor: defaultTheme.colors.red50,
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: defaultTheme.colors.info,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: defaultTheme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
