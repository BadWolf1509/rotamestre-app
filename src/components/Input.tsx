/**
 * ============================================
 * Input - Componente de Input Completo
 * ============================================
 *
 * Input reutilizável com label, error, ícones e estados.
 * Usa design tokens para cores, tipografia e espaçamento.
 */

import { View, Text, TextInput, StyleSheet, ViewStyle, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '@/lib/design-tokens';

type InputSize = 'small' | 'medium' | 'large';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  size?: InputSize;
  required?: boolean;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  size = 'medium',
  required = false,
  containerStyle,
  style,
  ...textInputProps
}: InputProps) {
  const hasError = !!error;
  const isDisabled = textInputProps.editable === false;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Label */}
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        </View>
      )}

      {/* Input Container */}
      <View
        style={[
          styles.inputContainer,
          styles[size],
          hasError && styles.inputContainerError,
          isDisabled && styles.inputContainerDisabled,
        ]}
      >
        {/* Left Icon */}
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
            color={hasError ? colors.error : colors.text.tertiary}
            style={styles.leftIcon}
          />
        )}

        {/* Text Input */}
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            style,
          ]}
          placeholderTextColor={colors.text.tertiary}
          {...textInputProps}
        />

        {/* Right Icon */}
        {rightIcon && (
          <Ionicons
            name={rightIcon}
            size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
            color={hasError ? colors.error : colors.text.tertiary}
            style={styles.rightIcon}
            onPress={onRightIconPress}
          />
        )}
      </View>

      {/* Helper Text or Error */}
      {(error || helperText) && (
        <Text style={[styles.helperText, hasError && styles.errorText]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },

  // Label
  labelContainer: {
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.styles.body,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  required: {
    color: colors.error,
  },

  // Input Container
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.sm,
  },
  inputContainerError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  inputContainerDisabled: {
    backgroundColor: colors.gray[100],
    opacity: 0.6,
  },

  // Tamanhos
  small: {
    height: 36,
  },
  medium: {
    height: 44, // Acessibilidade
  },
  large: {
    height: 52,
  },

  // Input
  input: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    paddingHorizontal: 12,
  },
  inputWithLeftIcon: {
    paddingLeft: 4,
  },
  inputWithRightIcon: {
    paddingRight: 4,
  },

  // Icons
  leftIcon: {
    marginLeft: 12,
  },
  rightIcon: {
    marginRight: 12,
  },

  // Helper Text / Error
  helperText: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.error,
  },
});

// Export default para facilitar import
export default Input;

/**
 * ============================================
 * EXEMPLOS DE USO
 * ============================================
 *
 * import Input from '@/components/Input';
 *
 * // Input básico
 * <Input
 *   label="Email"
 *   placeholder="seu@email.com"
 *   value={email}
 *   onChangeText={setEmail}
 * />
 *
 * // Input com erro
 * <Input
 *   label="Senha"
 *   error="Senha deve ter no mínimo 6 caracteres"
 *   value={password}
 *   onChangeText={setPassword}
 *   secureTextEntry
 * />
 *
 * // Input com ícone esquerdo
 * <Input
 *   label="Buscar"
 *   leftIcon="search-outline"
 *   placeholder="Buscar rotas..."
 *   value={search}
 *   onChangeText={setSearch}
 * />
 *
 * // Input com ícone direito clicável (ex: mostrar/ocultar senha)
 * <Input
 *   label="Senha"
 *   rightIcon={showPassword ? "eye-outline" : "eye-off-outline"}
 *   onRightIconPress={() => setShowPassword(!showPassword)}
 *   secureTextEntry={!showPassword}
 *   value={password}
 *   onChangeText={setPassword}
 * />
 *
 * // Input obrigatório
 * <Input
 *   label="Nome"
 *   required
 *   placeholder="Seu nome completo"
 *   value={name}
 *   onChangeText={setName}
 * />
 *
 * // Input com helper text
 * <Input
 *   label="CPF"
 *   helperText="Apenas números, sem pontos ou traços"
 *   placeholder="000.000.000-00"
 *   value={cpf}
 *   onChangeText={setCpf}
 * />
 *
 * // Input desabilitado
 * <Input
 *   label="Email"
 *   value="usuario@exemplo.com"
 *   editable={false}
 * />
 *
 * // Input pequeno
 * <Input
 *   size="small"
 *   placeholder="Buscar..."
 *   value={search}
 *   onChangeText={setSearch}
 * />
 */
