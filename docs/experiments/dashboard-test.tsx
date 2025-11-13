import { useState, useEffect } from 'react';
import { View, Text, Button } from 'react-native';

import { useUser } from '@/hooks/useUser';

/**
 * Componente de teste para isolar o problema do loop infinito
 */
export default function DashboardTest() {
  console.log('[TEST] DashboardTest renderizado');

  const [counter, setCounter] = useState(0);

  // Teste 1: Hook useUser sozinho
  console.log('[TEST] Chamando useUser...');
  const { userData, loading: userLoading } = useUser();
  console.log('[TEST] useUser retornou:', { userData: userData?.nome, userLoading });

  // Teste 2: useEffect simples
  useEffect(() => {
    console.log('[TEST] useEffect executado - counter:', counter);
  }, [counter]);

  // Teste 3: useEffect com userData
  useEffect(() => {
    console.log('[TEST] useEffect com userData executado:', userData?.nome);
  }, [userData]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white', padding: 20 }}>
      <Text style={{ fontSize: 24, color: 'black', marginBottom: 20 }}>Dashboard Test</Text>

      <View style={{ marginVertical: 10, padding: 10, backgroundColor: '#f0f0f0', width: '100%' }}>
        <Text style={{ fontSize: 16, color: 'black' }}>User Loading: {userLoading ? 'SIM' : 'NÃO'}</Text>
        <Text style={{ fontSize: 16, color: 'black' }}>User Nome: {userData?.nome || 'Sem dados'}</Text>
        <Text style={{ fontSize: 16, color: 'black' }}>Unidade ID: {userData?.unidade_id || 'Sem unidade'}</Text>
      </View>

      <View style={{ marginVertical: 10 }}>
        <Text style={{ fontSize: 16, color: 'black', marginBottom: 10 }}>Counter: {counter}</Text>
        <Button title="Incrementar" onPress={() => setCounter(c => c + 1)} />
      </View>

      <Text style={{ fontSize: 12, color: 'gray', marginTop: 20, textAlign: 'center' }}>
        Abra o console (F12) para ver os logs de depuração
      </Text>
    </View>
  );
}
