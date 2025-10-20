import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Login',
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: 'Criar Conta',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          title: 'Recuperar Senha',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
