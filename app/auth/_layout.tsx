import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="login"
        options={{
          title: 'Login',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: 'Criar Conta',
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          title: 'Recuperar Senha',
        }}
      />
    </Stack>
  );
}
