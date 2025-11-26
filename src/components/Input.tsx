/**
 * ============================================
 * Input - Componente de Input Completo
 * ============================================
 *
 * Input reutilizável com label, error, ícones e estados.
 * Usa design tokens para cores, tipografia e espaçamento.
 */

import { Ionicons } from '@expo/vector-icons';
import { View, Text, TextInput, ViewStyle, TextInputProps } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

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
  const { theme } = useUnistyles();
  const hasError = !!error;
  const isDisabled = textInputProps.editable === false;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.inputContainer,
          styles[size],
          hasError && styles.inputContainerError,
          isDisabled && styles.inputContainerDisabled,
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
            color={hasError ? theme.colors.error : theme.colors.gray400}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            style,
          ]}
          placeholderTextColor={theme.colors.gray400}
          {...textInputProps}
        />

        {rightIcon && (
          <Ionicons
            name={rightIcon}
            size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
            color={hasError ? theme.colors.error : theme.colors.gray400}
            style={styles.rightIcon}
            onPress={onRightIconPress}
          />
        )}
      </View>

      {(error || helperText) && (
        <Text style={[styles.helperText, hasError && styles.errorText]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    marginBottom: theme.spacing.md,
  },

  labelContainer: {
    marginBottom: theme.spacing.xs,
  },
  label: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    color: theme.colors.gray900,
  },
  required: {
    color: theme.colors.error,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.sm,
  },
  inputContainerError: {
    borderColor: theme.colors.error,
    borderWidth: 2,
  },
  inputContainerDisabled: {
    backgroundColor: theme.colors.gray100,
    opacity: 0.6,
  },

  small: {
    height: 36,
  },
  medium: {
    height: 44,
  },
  large: {
    height: 52,
  },

  input: {
    flex: 1,
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray900,
    paddingHorizontal: 12,
  },
  inputWithLeftIcon: {
    paddingLeft: 4,
  },
  inputWithRightIcon: {
    paddingRight: 4,
  },

  leftIcon: {
    marginLeft: 12,
  },
  rightIcon: {
    marginRight: 12,
  },

  helperText: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.xs,
    lineHeight: theme.typography.fontSize.xs * 1.5,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  errorText: {
    color: theme.colors.error,
  },
}));

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
