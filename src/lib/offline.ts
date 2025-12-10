import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

import { supabase } from './supabase';
import { uploadELinkFotoParada } from './storage';
import { notifySyncComplete, notifyOfflineMode } from './notifications';

import * as FileSystem from 'expo-file-system/legacy';

const OFFLINE_QUEUE_KEY = '@rotamestre:offline_queue';
const OFFLINE_DATA_KEY = '@rotamestre:offline_data';
const OFFLINE_PHOTOS_DIR = `${FileSystem.documentDirectory}offline_photos/`;
const OFFLINE_PHOTOS_INDEX_KEY = '@rotamestre:offline_photos_index';

interface OfflineAction {
  id: string;
  type: 'update_parada' | 'insert_log' | 'finalizar_rota' | 'upload_foto';
  data: any;
  timestamp: string;
}

interface OfflinePhotoData {
  localPath: string;
  unidadeId: string;
  rotaId: string;
  paradaId: string;
  originalUri: string;
  savedAt: string;
}

interface OfflineData {
  rota?: any;
  paradas?: any[];
  lastSync?: string;
}

// ============================================================================
// FOTOS OFFLINE - Funções para salvar e sincronizar fotos quando offline
// ============================================================================

/**
 * Garante que o diretório de fotos offline existe
 */
async function ensureOfflinePhotosDir(): Promise<void> {
  if (Platform.OS === 'web') return; // Web não usa FileSystem

  try {
    const dirInfo = await FileSystem.getInfoAsync(OFFLINE_PHOTOS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(OFFLINE_PHOTOS_DIR, { intermediates: true });
      console.log('📁 [Offline] Diretório de fotos criado:', OFFLINE_PHOTOS_DIR);
    }
  } catch (error) {
    console.error('❌ [Offline] Erro ao criar diretório de fotos:', error);
    throw error;
  }
}

/**
 * Salva uma foto localmente para upload posterior
 *
 * @param photoUri - URI da foto (file:// ou content://)
 * @param unidadeId - ID da unidade
 * @param rotaId - ID da rota
 * @param paradaId - ID da parada
 * @returns Dados da foto salva offline
 */
export async function savePhotoOffline(
  photoUri: string,
  unidadeId: string,
  rotaId: string,
  paradaId: string
): Promise<OfflinePhotoData> {
  if (Platform.OS === 'web') {
    throw new Error('Fotos offline não suportadas na web');
  }

  try {
    await ensureOfflinePhotosDir();

    // Gerar nome único para a foto
    const timestamp = Date.now();
    const fileName = `${paradaId}_${timestamp}.jpg`;
    const localPath = `${OFFLINE_PHOTOS_DIR}${fileName}`;

    // Copiar foto para diretório persistente
    await FileSystem.copyAsync({
      from: photoUri,
      to: localPath,
    });

    console.log('📸 [Offline] Foto salva localmente:', localPath);

    const photoData: OfflinePhotoData = {
      localPath,
      unidadeId,
      rotaId,
      paradaId,
      originalUri: photoUri,
      savedAt: new Date().toISOString(),
    };

    // Salvar índice de fotos offline
    await addToPhotosIndex(photoData);

    return photoData;
  } catch (error) {
    console.error('❌ [Offline] Erro ao salvar foto offline:', error);
    throw error;
  }
}

/**
 * Adiciona foto ao índice de fotos offline
 */
async function addToPhotosIndex(photoData: OfflinePhotoData): Promise<void> {
  try {
    const index = await getOfflinePhotosIndex();
    index.push(photoData);
    await AsyncStorage.setItem(OFFLINE_PHOTOS_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.error('❌ [Offline] Erro ao adicionar ao índice de fotos:', error);
  }
}

/**
 * Obtém índice de fotos offline pendentes
 */
export async function getOfflinePhotosIndex(): Promise<OfflinePhotoData[]> {
  try {
    const indexStr = await AsyncStorage.getItem(OFFLINE_PHOTOS_INDEX_KEY);
    return indexStr ? JSON.parse(indexStr) : [];
  } catch (error) {
    console.error('❌ [Offline] Erro ao obter índice de fotos:', error);
    return [];
  }
}

/**
 * Remove foto do índice após upload bem-sucedido
 */
async function removeFromPhotosIndex(paradaId: string): Promise<void> {
  try {
    const index = await getOfflinePhotosIndex();
    const filtered = index.filter(p => p.paradaId !== paradaId);
    await AsyncStorage.setItem(OFFLINE_PHOTOS_INDEX_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('❌ [Offline] Erro ao remover do índice de fotos:', error);
  }
}

/**
 * Limpa foto local após upload bem-sucedido
 */
async function deleteLocalPhoto(localPath: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
      console.log('🗑️ [Offline] Foto local removida:', localPath);
    }
  } catch (error) {
    console.error('❌ [Offline] Erro ao remover foto local:', error);
  }
}

/**
 * Adiciona upload de foto à fila offline
 *
 * @param unidadeId - ID da unidade
 * @param rotaId - ID da rota
 * @param paradaId - ID da parada
 * @param photoUri - URI da foto
 * @returns Caminho local da foto salva
 */
export async function queuePhotoUpload(
  unidadeId: string,
  rotaId: string,
  paradaId: string,
  photoUri: string
): Promise<string> {
  // Salvar foto localmente
  const photoData = await savePhotoOffline(photoUri, unidadeId, rotaId, paradaId);

  // Adicionar à fila offline
  await addToOfflineQueue({
    type: 'upload_foto',
    data: photoData,
  });

  console.log('📤 [Offline] Upload de foto enfileirado:', paradaId);

  return photoData.localPath;
}

/**
 * Processa uploads de fotos pendentes
 */
export async function processOfflinePhotos(): Promise<{ success: number; failed: number }> {
  const online = await isOnline();
  if (!online) {
    return { success: 0, failed: 0 };
  }

  const index = await getOfflinePhotosIndex();
  let success = 0;
  let failed = 0;

  for (const photo of index) {
    try {
      // Verificar se arquivo ainda existe
      if (Platform.OS !== 'web') {
        const fileInfo = await FileSystem.getInfoAsync(photo.localPath);
        if (!fileInfo.exists) {
          console.warn('⚠️ [Offline] Foto não encontrada:', photo.localPath);
          await removeFromPhotosIndex(photo.paradaId);
          continue;
        }
      }

      // Fazer upload
      const uploaded = await uploadELinkFotoParada(
        photo.unidadeId,
        photo.rotaId,
        photo.paradaId,
        photo.localPath
      );

      if (uploaded) {
        // Limpar arquivo local e índice
        await deleteLocalPhoto(photo.localPath);
        await removeFromPhotosIndex(photo.paradaId);
        success++;
        console.log('✅ [Offline] Foto sincronizada:', photo.paradaId);
      } else {
        failed++;
        console.error('❌ [Offline] Falha no upload:', photo.paradaId);
      }
    } catch (error) {
      failed++;
      console.error('❌ [Offline] Erro ao processar foto:', error);
    }
  }

  return { success, failed };
}

/**
 * Obtém contagem de fotos pendentes de sync
 */
export async function getPendingPhotosCount(): Promise<number> {
  const index = await getOfflinePhotosIndex();
  return index.length;
}

/**
 * Verifica se uma parada tem foto pendente de sync
 */
export async function hasOfflinePhoto(paradaId: string): Promise<boolean> {
  const index = await getOfflinePhotosIndex();
  return index.some(p => p.paradaId === paradaId);
}

/**
 * Obtém caminho local da foto offline de uma parada
 */
export async function getOfflinePhotoPath(paradaId: string): Promise<string | null> {
  const index = await getOfflinePhotosIndex();
  const photo = index.find(p => p.paradaId === paradaId);
  return photo?.localPath || null;
}

// ============================================================================
// FILA OFFLINE - Funções gerais de queue
// ============================================================================

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
  const successfulIds: Set<string> = new Set();

  for (const action of queue) {
    try {
      await executeOfflineAction(action);
      successCount++;
      successfulIds.add(action.id);
    } catch (error) {
      failedCount++;
      errors.push({ action, error });
      console.error(`Erro ao processar ação offline ${action.id}:`, error);
    }
  }

  // Remove apenas ações bem-sucedidas, mantém as que falharam para retry
  if (successCount > 0) {
    const remainingQueue = queue.filter(action => !successfulIds.has(action.id));
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
  }

  return { success: successCount, failed: failedCount, errors };
}

/**
 * Executa uma ação offline específica
 */
async function executeOfflineAction(action: OfflineAction): Promise<void> {
  switch (action.type) {
    case 'update_parada': {
      const { id, ...updateData } = action.data;
      const { error: updateError } = await supabase
        .from('paradas')
        .update(updateData)
        .eq('id', id);
      if (updateError) throw updateError;
      break;
    }

    case 'insert_log': {
      const { error: logError } = await supabase
        .from('logs')
        .insert(action.data);
      if (logError) throw logError;
      break;
    }

    case 'finalizar_rota': {
      const { rotaId, ...rotaData } = action.data;
      const { error: rotaError } = await supabase
        .from('rotas')
        .update(rotaData)
        .eq('id', rotaId);
      if (rotaError) throw rotaError;
      break;
    }

    case 'upload_foto': {
      const photoData = action.data as OfflinePhotoData;

      // Verificar se arquivo ainda existe
      if (Platform.OS !== 'web') {
        const fileInfo = await FileSystem.getInfoAsync(photoData.localPath);
        if (!fileInfo.exists) {
          console.warn('⚠️ [Offline] Foto não encontrada:', photoData.localPath);
          // Remover do índice mesmo assim
          await removeFromPhotosIndex(photoData.paradaId);
          return; // Não é um erro, apenas foto não existe mais
        }
      }

      // Fazer upload
      const uploaded = await uploadELinkFotoParada(
        photoData.unidadeId,
        photoData.rotaId,
        photoData.paradaId,
        photoData.localPath
      );

      if (!uploaded) {
        throw new Error('Falha no upload da foto');
      }

      // Limpar arquivo local e índice
      await deleteLocalPhoto(photoData.localPath);
      await removeFromPhotosIndex(photoData.paradaId);

      console.log('✅ [Offline] Foto sincronizada via queue:', photoData.paradaId);
      break;
    }

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

// Variável para controlar se já notificou offline nesta sessão
let hasNotifiedOffline = false;

/**
 * Hook para monitorar status de conexão e processar fila automaticamente
 */
export function setupOfflineSync(): () => void {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && state.isInternetReachable) {
      // Resetar flag de notificação offline
      hasNotifiedOffline = false;

      // Processar fila geral
      const queueSize = await getOfflineQueueSize();
      let actionsSuccess = 0;

      if (queueSize > 0) {
        console.log(`📤 [Offline] Processando ${queueSize} ações offline...`);
        const result = await processOfflineQueue();
        actionsSuccess = result.success;
        console.log(`✅ [Offline] Processamento: ${result.success} sucesso, ${result.failed} falhas`);
      }

      // Processar fotos pendentes (separadamente para melhor tracking)
      const photosCount = await getPendingPhotosCount();
      let photosSuccess = 0;

      if (photosCount > 0) {
        console.log(`📷 [Offline] Sincronizando ${photosCount} fotos pendentes...`);
        const photoResult = await processOfflinePhotos();
        photosSuccess = photoResult.success;
        console.log(`✅ [Offline] Fotos: ${photoResult.success} sucesso, ${photoResult.failed} falhas`);
      }

      // Notificar se houve sincronização
      if (actionsSuccess > 0 || photosSuccess > 0) {
        await notifySyncComplete(actionsSuccess, photosSuccess);
      }
    } else {
      // Notificar apenas uma vez que está offline
      if (!hasNotifiedOffline) {
        const queueSize = await getOfflineQueueSize();
        const photosCount = await getPendingPhotosCount();

        // Só notifica se tem algo pendente
        if (queueSize > 0 || photosCount > 0) {
          await notifyOfflineMode();
          hasNotifiedOffline = true;
        }
      }
    }
  });

  return unsubscribe;
}
