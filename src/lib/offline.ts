import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import NetInfo from '@react-native-community/netinfo';

const OFFLINE_QUEUE_KEY = '@rotamestre:offline_queue';
const OFFLINE_DATA_KEY = '@rotamestre:offline_data';

interface OfflineAction {
  id: string;
  type: 'update_parada' | 'insert_log' | 'finalizar_rota' | 'upload_foto';
  data: any;
  timestamp: string;
}

interface OfflineData {
  rota?: any;
  paradas?: any[];
  lastSync?: string;
}

/**
 * Verifica se o dispositivo está online
 */
export async function isOnline(): Promise<boolean> {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected === true && netInfo.isInternetReachable === true;
}

/**
 * Adiciona uma ação à fila offline para ser executada quando voltar a conexão
 */
export async function addToOfflineQueue(action: Omit<OfflineAction, 'id' | 'timestamp'>): Promise<void> {
  try {
    const queue = await getOfflineQueue();
    const newAction: OfflineAction = {
      ...action,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    queue.push(newAction);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Erro ao adicionar ação à fila offline:', error);
    throw error;
  }
}

/**
 * Obtém a fila de ações offline
 */
export async function getOfflineQueue(): Promise<OfflineAction[]> {
  try {
    const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (error) {
    console.error('Erro ao obter fila offline:', error);
    return [];
  }
}

/**
 * Limpa a fila de ações offline
 */
export async function clearOfflineQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (error) {
    console.error('Erro ao limpar fila offline:', error);
  }
}

/**
 * Processa a fila offline quando a conexão é restaurada
 */
export async function processOfflineQueue(): Promise<{ success: number; failed: number; errors: any[] }> {
  const online = await isOnline();
  if (!online) {
    return { success: 0, failed: 0, errors: [] };
  }

  const queue = await getOfflineQueue();
  let successCount = 0;
  let failedCount = 0;
  const errors: any[] = [];

  for (const action of queue) {
    try {
      await executeOfflineAction(action);
      successCount++;
    } catch (error) {
      failedCount++;
      errors.push({ action, error });
      console.error(`Erro ao processar ação offline ${action.id}:`, error);
    }
  }

  // Limpa apenas as ações que foram processadas com sucesso
  if (successCount > 0) {
    const remainingQueue = queue.slice(successCount + failedCount);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
  }

  return { success: successCount, failed: failedCount, errors };
}

/**
 * Executa uma ação offline específica
 */
async function executeOfflineAction(action: OfflineAction): Promise<void> {
  switch (action.type) {
    case 'update_parada':
      const { id, ...updateData } = action.data;
      const { error: updateError } = await supabase
        .from('paradas')
        .update(updateData)
        .eq('id', id);
      if (updateError) throw updateError;
      break;

    case 'insert_log':
      const { error: logError } = await supabase
        .from('logs')
        .insert(action.data);
      if (logError) throw logError;
      break;

    case 'finalizar_rota':
      const { rotaId, ...rotaData } = action.data;
      const { error: rotaError } = await supabase
        .from('rotas')
        .update(rotaData)
        .eq('id', rotaId);
      if (rotaError) throw rotaError;
      break;

    case 'upload_foto':
      // Fotos não podem ser sincronizadas offline facilmente
      // Requer implementação mais complexa com base64
      console.warn('Upload de foto offline não implementado completamente');
      break;

    default:
      throw new Error(`Tipo de ação desconhecido: ${action.type}`);
  }
}

/**
 * Salva dados offline para acesso posterior
 */
export async function saveOfflineData(data: OfflineData): Promise<void> {
  try {
    const currentData = await getOfflineData();
    const updatedData = {
      ...currentData,
      ...data,
      lastSync: new Date().toISOString(),
    };
    await AsyncStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(updatedData));
  } catch (error) {
    console.error('Erro ao salvar dados offline:', error);
    throw error;
  }
}

/**
 * Obtém dados salvos offline
 */
export async function getOfflineData(): Promise<OfflineData> {
  try {
    const dataStr = await AsyncStorage.getItem(OFFLINE_DATA_KEY);
    return dataStr ? JSON.parse(dataStr) : {};
  } catch (error) {
    console.error('Erro ao obter dados offline:', error);
    return {};
  }
}

/**
 * Limpa dados offline
 */
export async function clearOfflineData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OFFLINE_DATA_KEY);
  } catch (error) {
    console.error('Erro ao limpar dados offline:', error);
  }
}

/**
 * Verifica se há dados offline disponíveis
 */
export async function hasOfflineData(): Promise<boolean> {
  try {
    const data = await getOfflineData();
    return Boolean(data.rota || (data.paradas && data.paradas.length > 0));
  } catch (error) {
    console.error('Erro ao verificar dados offline:', error);
    return false;
  }
}

/**
 * Obtém o tamanho da fila offline
 */
export async function getOfflineQueueSize(): Promise<number> {
  try {
    const queue = await getOfflineQueue();
    return queue.length;
  } catch (error) {
    console.error('Erro ao obter tamanho da fila offline:', error);
    return 0;
  }
}

/**
 * Hook para monitorar status de conexão e processar fila automaticamente
 */
export function setupOfflineSync(): () => void {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && state.isInternetReachable) {
      const queueSize = await getOfflineQueueSize();
      if (queueSize > 0) {
        console.log(`Processando ${queueSize} ações offline...`);
        const result = await processOfflineQueue();
        console.log(`Processamento concluído: ${result.success} sucesso, ${result.failed} falhas`);
      }
    }
  });

  return unsubscribe;
}
