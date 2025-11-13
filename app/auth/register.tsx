import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { StyleSheet } from '@/utils/styles';

import { TipoUsuario } from '../../types/usuario';


export default function Register() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tipo, setTipo] = useState<TipoUsuario>('motorista');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!nome || !email || !password || !confirmPassword) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await authService.signUp(email, password, nome, tipo);
      Alert.alert(
        'Sucesso',
        'Conta criada com sucesso! Verifique seu e-mail para confirmar.',
        [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
      );
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ResponsiveContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          <Text style={styles.title}>Criar Conta</Text>
          <Text style={styles.subtitle}>
            Preencha os dados abaixo para criar sua conta no Rota Mestre
          </Text>

          <View style={styles.form}>
            <View>
              <Text style={styles.label}>Nome Completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite seu nome"
                value={nome}
                onChangeText={setNome}
                autoCapitalize="words"
              />
            </View>

            <View>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite seu e-mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />
            </View>

            <View>
              <Text style={styles.label}>Confirmar Senha</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite a senha novamente"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <View>
              <Text style={styles.label}>Tipo de Conta</Text>
              <View style={styles.tipoContainer}>
                <TouchableOpacity
                  style={[
                    styles.tipoButton,
                    tipo === 'motorista' && styles.tipoButtonActive,
                  ]}
                  onPress={() => setTipo('motorista')}
                >
                  <Text
                    style={[
                      styles.tipoButtonText,
                      tipo === 'motorista' && styles.tipoButtonTextActive,
                    ]}
                  >
                    Motorista
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tipoButton,
                    tipo === 'gestor' && styles.tipoButtonActive,
                  ]}
                  onPress={() => setTipo('gestor')}
                >
                  <Text
                    style={[
                      styles.tipoButtonText,
                      tipo === 'gestor' && styles.tipoButtonTextActive,
                    ]}
                  >
                    Gestor
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Criar Conta</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => router.back()}
            >
              <Text style={styles.backLinkText}>
                Já tem uma conta? Faça login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    ...theme.shadows.md,
  },
  contentDesktop: {
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: 24,
    color: theme.colors.gray900,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: theme.typography.fontSans,
    fontSize: 14,
    color: theme.colors.gray500,
    marginBottom: 24,
    lineHeight: 20,
  },
  form: {
    gap: 20,
  },
  label: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: 14,
    color: theme.colors.gray700,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
  },
  tipoContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  tipoButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.gray300,
    alignItems: 'center',
  },
  tipoButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryBg,
  },
  tipoButtonText: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: 16,
    color: theme.colors.gray500,
  },
  tipoButtonTextActive: {
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    letterSpacing: 0.5,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  backLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  backLinkText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontFamily: theme.typography.fontSansMedium,
  },
}));
