import { Tabs } from 'expo-router';

export default function GestorLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        headerStyle: {
          backgroundColor: '#2563eb',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Início',
        }}
      />
      <Tabs.Screen
        name="nova-entrega"
        options={{
          title: 'Nova Entrega',
          tabBarLabel: 'Nova Rota',
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          tabBarLabel: 'Histórico',
        }}
      />
      <Tabs.Screen
        name="motoristas"
        options={{
          title: 'Motoristas',
          tabBarLabel: 'Motoristas',
        }}
      />
    </Tabs>
  );
}
