import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface FormField {
  label: string;
  value: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  showPasswordToggle?: boolean;
  isPasswordVisible?: boolean;
  onTogglePassword?: () => void;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: any;
  autoCapitalize?: any;
  helperText?: string;
  helperTextType?: 'success' | 'warning';
  error?: string;
  onChange: (text: string) => void;
}

interface FormDesktopLayoutProps {
  title: string;
  subtitle?: string;
  fields: FormField[];
  primaryButtonText: string;
  primaryButtonDisabled?: boolean;
  onPrimaryPress: () => void;
  secondaryButtonText?: string;
  onSecondaryPress?: () => void;
  loading?: boolean;
  sidePanel?: React.ReactNode;
  backPath?: string;
}

export function FormDesktopLayout({
  title,
  subtitle,
  fields,
  primaryButtonText,
  primaryButtonDisabled,
  onPrimaryPress,
  secondaryButtonText,
  onSecondaryPress,
  loading,
  sidePanel,
  backPath,
}: FormDesktopLayoutProps) {
  const { theme } = useUnistyles();
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => backPath ? router.push(backPath as any) : router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.gray600} />
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{title}</Text>
            {subtitle && (
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            )}
          </View>
        </View>

        <View style={styles.mainContent}>
          {/* Form Container */}
          <View style={styles.formContainer}>
            <View style={styles.formCard}>
              {fields.map((field, index) => (
                <View key={index} style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <View style={field.showPasswordToggle ? styles.passwordContainer : undefined}>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        field.multiline && styles.fieldTextArea,
                        field.error && styles.fieldInputError,
                        field.showPasswordToggle && styles.fieldInputWithToggle,
                      ]}
                      value={field.value}
                      onChangeText={field.onChange}
                      placeholder={field.placeholder}
                      placeholderTextColor={theme.colors.gray400}
                      secureTextEntry={field.secureTextEntry}
                      editable={field.editable !== false}
                      multiline={field.multiline}
                      numberOfLines={field.numberOfLines}
                      keyboardType={field.keyboardType}
                      autoCapitalize={field.autoCapitalize}
                    />
                    {field.showPasswordToggle && (
                      <TouchableOpacity
                        style={styles.passwordToggle}
                        onPress={field.onTogglePassword}
                      >
                        <Ionicons
                          name={field.isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                          size={22}
                          color={theme.colors.gray500}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  {field.helperText && !field.error && (
                    <Text style={[
                      styles.helperText,
                      field.helperTextType === 'success' && styles.helperTextSuccess,
                      field.helperTextType === 'warning' && styles.helperTextWarning,
                    ]}>
                      {field.helperText}
                    </Text>
                  )}
                  {field.error && (
                    <Text style={styles.errorText}>{field.error}</Text>
                  )}
                </View>
              ))}

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                {secondaryButtonText && (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={onSecondaryPress}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {secondaryButtonText}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    primaryButtonDisabled && styles.primaryButtonDisabled,
                  ]}
                  onPress={onPrimaryPress}
                  disabled={primaryButtonDisabled}
                >
                  <Text style={styles.primaryButtonText}>
                    {primaryButtonText}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Side Panel */}
          {sidePanel && (
            <View style={styles.sidePanel}>
              {sidePanel}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
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
    padding: 32,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 14,
    color: theme.colors.gray600,
  },
  headerContent: {
    maxWidth: 800,
  },
  headerTitle: {
    fontSize: theme.typography['3xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.gray500,
  },
  mainContent: {
    flexDirection: 'row',
    padding: 32,
    gap: 32,
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
  },
  formContainer: {
    flex: 2,
    maxWidth: 600,
  },
  formCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 32,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.gray700,
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.gray900,
    backgroundColor: theme.colors.white,
  },
  fieldInputWithToggle: {
    paddingRight: 48,
  },
  fieldTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  fieldInputError: {
    borderColor: theme.colors.error,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  helperTextSuccess: {
    color: theme.colors.success,
  },
  helperTextWarning: {
    color: theme.colors.warning,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    justifyContent: 'flex-end',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: theme.colors.gray300,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  secondaryButtonText: {
    color: theme.colors.gray700,
    fontSize: 14,
    fontWeight: '600',
  },
  sidePanel: {
    flex: 1,
    maxWidth: 400,
  },
}));
