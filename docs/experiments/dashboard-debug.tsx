import { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';

/**
 * Componente de Debug para identificar loop infinito
 */
export default function DashboardDebug() {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current++;
    console.log(`[DEBUG] Dashboard renderizado ${renderCount.current} vezes`);

    // Se renderizar mais de 50 vezes, há um loop
    if (renderCount.current > 50) {
      console.error('[DEBUG] LOOP INFINITO DETECTADO!');
    }
  });

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
      <Text style={{ fontSize: 24, color: 'black' }}>Dashboard Debug</Text>
      <Text style={{ fontSize: 18, color: 'red', marginTop: 20 }}>
        Renders: {renderCount.current}
      </Text>
      <Text style={{ fontSize: 14, color: 'gray', marginTop: 10 }}>
        Verifique o console para logs
      </Text>
    </View>
  );
}