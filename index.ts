/**
 * Custom entry point for Expo Router + Unistyles 3.0
 */

console.log('[RotaMestre] index.ts starting...');

// IMPORTANT: Configure Unistyles FIRST, before expo-router/entry
import './src/unistyles';
console.log('[RotaMestre] unistyles configured');

// Tarefas em segundo plano: o `defineTask` tem de rodar já na partida, porque
// o Android pode acordar o processo sem tela só para entregar uma localização.
// Sem isto o expo-task-manager acha a tarefa indefinida e a DESREGISTRA
// (medido no moto g15, 1.14.1). Import de efeito de propósito: o
// `inlineRequires` do Metro adia import com nome até o primeiro uso.
// Guarda: src/services/__tests__/tarefas-definidas-no-entry.test.ts
import './src/services/unifiedLocationTracking';
import './src/services/locationTracking';

// Now load the Expo Router entry point
import 'expo-router/entry';
console.log('[RotaMestre] expo-router loaded');
