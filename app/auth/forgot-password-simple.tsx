import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '@/lib/auth';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      console.log('ForgotPassword mounted');
    } catch (err) {
      console.error('Mount error:', err);
      setError(String(err));
    }
  }, []);

  async function handleResetPassword() {
    if (!email) {
      Alert.alert('Erro', 'Digite seu e-mail');
      return;
    }

    setLoading(true);

    try {
      // await authService.resetPassword(email);
      // Simulação temporária para teste
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert(
        'Sucesso',
        'Instruções de recuperação foram enviadas para seu e-mail',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao recuperar senha');
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fee2e2' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#ef4444', marginBottom: 10 }}>
          Erro ao carregar tela
        </Text>
        <Text style={{ fontSize: 14, color: '#991b1b', textAlign: 'center' }}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ padding: 20, paddingTop: 100 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
            Recuperar Senha
          </Text>

          <Text style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
            Digite seu e-mail e enviaremos instruções para redefinir sua senha.
          </Text>

          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 8,
              padding: 15,
              fontSize: 16,
              marginBottom: 20,
            }}
            placeholder="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={{
              backgroundColor: '#1e5aa8',
              padding: 15,
              borderRadius: 8,
              alignItems: 'center',
            }}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                Enviar
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 20, alignItems: 'center' }}
            onPress={() => router.back()}
          >
            <Text style={{ color: '#1e5aa8', fontSize: 14 }}>
              ← Voltar para login
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
