import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function RootLayout() {
  useEffect(() => {
    // Configurar título da página para web apenas
    if (Platform.OS === 'web') {
      try {
        if (typeof document !== 'undefined') {
          document.title = 'Rota Mestre - Gestão Inteligente de Entregas';

          // Adicionar meta description se não existir
          let metaDescription = document.querySelector('meta[name="description"]');
          if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.setAttribute('name', 'description');
            document.head.appendChild(metaDescription);
          }
          metaDescription.setAttribute('content', 'Sistema completo de gestão de rotas de entrega com rastreamento em tempo real.');
        }
      } catch (error) {
        // Ignorar erros de manipulação do DOM
        console.warn('Erro ao configurar meta tags:', error);
      }
    }
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2563eb',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Rota Mestre - Início'
        }}
      />
      <Stack.Screen
        name="auth"
        options={{
          title: 'Rota Mestre - Autenticação'
        }}
      />
      <Stack.Screen
        name="gestor"
        options={{
          title: 'Rota Mestre - Painel do Gestor'
        }}
      />
      <Stack.Screen
        name="motorista"
        options={{
          title: 'Rota Mestre - Motorista'
        }}
      />
    </Stack>
  );
}
