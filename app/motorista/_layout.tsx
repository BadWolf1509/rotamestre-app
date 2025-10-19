import { Tabs } from 'expo-router';

export default function MotoristaLayout() {
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
        name="rota"
        options={{
          title: 'Rota Atual',
          tabBarLabel: 'Rota',
        }}
      />
      <Tabs.Screen
        name="checkpoints"
        options={{
          title: 'Paradas',
          tabBarLabel: 'Paradas',
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
        name="resumo"
        options={{
          title: 'Resumo',
          tabBarLabel: 'Resumo',
        }}
      />
    </Tabs>
  );
}
