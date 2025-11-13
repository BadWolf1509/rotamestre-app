import { useState, useEffect, useRef } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';

import { useDashboardData } from '@/components/gestor/dashboard/_hooks/useDashboardData';
import { useResponsive } from '@/hooks/useResponsive';
import { useUser } from '@/hooks/useUser';

/**
 * Teste progressivo para identificar exatamente onde está o loop
 */
export default function DashboardProgressive() {
  const renderCount = useRef(0);
  const [testLevel, setTestLevel] = useState(1);

  renderCount.current++;
  console.log(`[PROGRESSIVE] Render #${renderCount.current} - Test Level: ${testLevel}`);

  // SEMPRE chamar todos os hooks, independente do nível
  // Isso garante que a ordem dos hooks seja sempre a mesma
  const { userData, loading: userLoading } = useUser();
  const responsiveData = useResponsive();
  const dashboardData = useDashboardData();

  // Usar os dados apenas quando o nível apropriado estiver ativo
  const shouldUseResponsive = testLevel >= 2;
  const shouldUseDashboard = testLevel >= 3;

  // Monitor para detectar loop
  useEffect(() => {
    if (renderCount.current > 50) {
      console.error(`[PROGRESSIVE] LOOP DETECTADO no nível ${testLevel}!`);
    }
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
          Dashboard Progressive Test
        </Text>

        <View style={{ backgroundColor: '#f0f0f0', padding: 15, marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
            Estado Atual:
          </Text>
          <Text>Renders: {renderCount.current}</Text>
          <Text>Test Level: {testLevel}</Text>
          <Text style={{ color: renderCount.current > 50 ? 'red' : 'green' }}>
            Status: {renderCount.current > 50 ? '❌ LOOP DETECTADO!' : '✅ Normal'}
          </Text>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
            Testar Níveis:
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Button title="Nível 1: useUser" onPress={() => setTestLevel(1)} />
            <Button title="Nível 2: +useResponsive" onPress={() => setTestLevel(2)} />
            <Button title="Nível 3: +useDashboardData" onPress={() => setTestLevel(3)} />
          </View>
        </View>

        {/* Nível 1: useUser */}
        <View style={{ backgroundColor: testLevel >= 1 ? '#e8f5e9' : '#f5f5f5', padding: 15, marginBottom: 10 }}>
          <Text style={{ fontWeight: 'bold' }}>Nível 1: useUser</Text>
          <Text>Loading: {userLoading ? 'SIM' : 'NÃO'}</Text>
          <Text>User: {userData?.nome || 'Sem dados'}</Text>
        </View>

        {/* Nível 2: useResponsive */}
        {shouldUseResponsive && (
          <View style={{ backgroundColor: '#fff3e0', padding: 15, marginBottom: 10 }}>
            <Text style={{ fontWeight: 'bold' }}>Nível 2: useResponsive</Text>
            <Text>isDesktop: {responsiveData?.isDesktop ? 'SIM' : 'NÃO'}</Text>
            <Text>isMobile: {responsiveData?.isMobile ? 'SIM' : 'NÃO'}</Text>
            <Text>Width: {responsiveData?.width}</Text>
          </View>
        )}

        {/* Nível 3: useDashboardData */}
        {shouldUseDashboard && (
          <View style={{ backgroundColor: '#e3f2fd', padding: 15, marginBottom: 10 }}>
            <Text style={{ fontWeight: 'bold' }}>Nível 3: useDashboardData</Text>
            <Text>Loading: {dashboardData.loading ? 'SIM' : 'NÃO'}</Text>
            <Text>Total Rotas: {dashboardData.stats.total}</Text>
            <Text>Em Andamento: {dashboardData.stats.emAndamento}</Text>
            <Text>Concluídas: {dashboardData.stats.concluidas}</Text>
          </View>
        )}

        <View style={{ marginTop: 20, padding: 10, backgroundColor: '#fffde7' }}>
          <Text style={{ fontSize: 12 }}>
            💡 Dica: Teste cada nível e veja em qual o contador de renders dispara.
          </Text>
          <Text style={{ fontSize: 12, marginTop: 5 }}>
            Se passar de 50 renders, há um loop naquele nível.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
