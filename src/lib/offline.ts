import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { lerSessao } from './auth/sessao';
import { gravarUltimoUsuario, lerUltimoUsuario } from './auth/ultimoUsuario';
import { logger } from './logger';
import {
  lerFilaAcoesParada,
  sincronizarFilaAcoesParada,
} from './motorista/filaAcoesParada';
import { notifySyncComplete, notifyOfflineMode } from './notifications';
import { subirFotoDaFilaOffline } from './storage';
import { supabase } from './supabase';

const OFFLINE_DATA_KEY = '@rotamestre:offline_data';
const OFFLINE_PHOTOS_DIR = `${FileSystem.documentDirectory}offline_photos/`;
const OFFLINE_PHOTOS_INDEX_KEY = '@rotamestre:offline_photos_index';

interface OfflinePhotoData {
  localPath: string;
  unidadeId: string;
  rotaId: string;
  paradaId: string;
  originalUri: string;
  savedAt: string;
  /**
   * Quem tirou a foto. A fila sobrevive ao logout (não pode perder
   * comprovante), então a foto só sobe com a sessão desta pessoa. Ausente em
   * fotos enfileiradas por versões antigas: essas sobem com a sessão atual.
   */
  userId?: string;
  /**
   * Foto nova cujo dono não se soube (nem sessão, nem último usuário). Nunca
   * sobe sozinha: subir com a sessão de quem estiver logado poderia gravar o
   * comprovante em nome de outra pessoa. Distingue-a da foto antiga sem dono.
   */
  semDono?: true;
}

/** Foto que a sessão `usuarioAtual` pode subir/contar. */
function fotoEDe(photo: OfflinePhotoData, usuarioAtual: string): boolean {
  if (photo.userId) return photo.userId === usuarioAtual;
  return !photo.semDono; // antiga, de antes de a fila guardar o dono
}

/**
 * Dá a quem acabou de entrar as fotos `semDono` do aparelho (tiradas sem
 * sessão nem último usuário conhecido). Sem isso elas ficariam presas para
 * sempre, sem aviso — e são comprovante de entrega. Quem as tirou neste
 * aparelho é, na prática, quem entra nele em seguida; a RLS ainda barra o
 * upload em parada de outra loja. Foto com `userId` de outra conta não muda.
 */
async function adotarFotosSemDono(userId: string): Promise<void> {
  const index = await getOfflinePhotosIndex();
  if (!index.some((p) => p.semDono)) return;
  const adotado = index.map((p) => {
    if (!p.semDono) return p;
    const { semDono: _semDono, ...resto } = p;
    return { ...resto, userId };
  });
  await AsyncStorage.setItem(OFFLINE_PHOTOS_INDEX_KEY, JSON.stringify(adotado));
}

/**
 * Dono de uma foto tirada agora: a sessão, ou — offline com o token vencido,
 * quando a sessão não renova — o último usuário logado.
 *
 * Lê por `lerSessao()`, nunca pelo `getSession()` cru: com o token vencido e
 * sem rede, o cru só responde depois do recuo do refresh do auth-js (~25 s), e
 * era isso que deixava "Enviando foto... 0%" parado ~20 s antes de a foto ir
 * para a fila (teste no aparelho, 25/10/2026). `lerSessao` responde na hora
 * sem rede confirmada e nunca passa de `PRAZO_LEITURA_SESSAO_MS`.
 */
async function donoConhecido(): Promise<string | null> {
  const { session } = await lerSessao();
  return session?.user?.id ?? (await lerUltimoUsuario());
}

/** Id de quem está logado neste aparelho, ou null sem sessão. */
async function usuarioDaSessao(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch (error) {
    logger.warn('[Offline] Falha ao ler a sessão', error);
    return null;
  }
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

  const dirInfo = await FileSystem.getInfoAsync(OFFLINE_PHOTOS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(OFFLINE_PHOTOS_DIR, {
      intermediates: true,
    });
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
  paradaId: string,
): Promise<OfflinePhotoData> {
  if (Platform.OS === 'web') {
    throw new Error('Fotos offline não suportadas na web');
  }

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

  const userId = await donoConhecido();
  const photoData: OfflinePhotoData = {
    localPath,
    unidadeId,
    rotaId,
    paradaId,
    originalUri: photoUri,
    savedAt: new Date().toISOString(),
    ...(userId ? { userId } : { semDono: true as const }),
  };

  // Salvar índice de fotos offline
  await addToPhotosIndex(photoData);

  return photoData;
}

/**
 * Adiciona foto ao índice de fotos offline
 */
async function addToPhotosIndex(photoData: OfflinePhotoData): Promise<void> {
  const index = await getOfflinePhotosIndex();
  index.push(photoData);
  await AsyncStorage.setItem(OFFLINE_PHOTOS_INDEX_KEY, JSON.stringify(index));
}

/**
 * Obtém índice de fotos offline pendentes
 */
export async function getOfflinePhotosIndex(): Promise<OfflinePhotoData[]> {
  try {
    const indexStr = await AsyncStorage.getItem(OFFLINE_PHOTOS_INDEX_KEY);
    return indexStr ? JSON.parse(indexStr) : [];
  } catch (error) {
    logger.warn('Falha ao ler índice de fotos offline', error);
    return [];
  }
}

/**
 * Remove foto do índice após upload bem-sucedido.
 * When localPath is provided, removes only the specific entry (precise removal).
 * When localPath is omitted, removes ALL entries for that paradaId (fallback/backward compat).
 */
async function removeFromPhotosIndex(
  paradaId: string,
  localPath?: string,
): Promise<void> {
  const index = await getOfflinePhotosIndex();
  const filtered = localPath
    ? index.filter(
        (p) => !(p.paradaId === paradaId && p.localPath === localPath),
      )
    : index.filter((p) => p.paradaId !== paradaId);
  await AsyncStorage.setItem(
    OFFLINE_PHOTOS_INDEX_KEY,
    JSON.stringify(filtered),
  );
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
    }
  } catch {
    // Silently fail - não crítico
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
  photoUri: string,
): Promise<string> {
  // Save photo locally (adds to photos index via savePhotoOffline -> addToPhotosIndex)
  const photoData = await savePhotoOffline(
    photoUri,
    unidadeId,
    rotaId,
    paradaId,
  );

  // Foto só no índice de fotos (processOfflinePhotos). Até 03/2026 ela ia
  // também para uma fila genérica, e cada foto subia duas vezes; essa fila,
  // sem produtor desde então, foi removida na 1.14.6.
  return photoData.localPath;
}

/**
 * Concurrency guard for processOfflinePhotos.
 * Prevents double uploads when setupOfflineSync fires twice (e.g., rapid connectivity toggles).
 */
let isProcessingPhotos = false;
/** Envio de fotos em curso, para quem precisa esperar por ele (ações). */
let fotosEmCurso: Promise<void> | null = null;

/**
 * Processa uploads de fotos pendentes
 */
export async function processOfflinePhotos(): Promise<{
  success: number;
  failed: number;
}> {
  if (isProcessingPhotos) {
    return { success: 0, failed: 0 };
  }

  isProcessingPhotos = true;
  let terminarFotos: () => void = () => undefined;
  fotosEmCurso = new Promise<void>((r) => {
    terminarFotos = r;
  });
  try {
    const online = await isOnline();
    if (!online) {
      return { success: 0, failed: 0 };
    }

    // Sem sessão o upload cairia na RLS; com a sessão de OUTRA pessoa
    // subiria o comprovante em nome dela. Em ambos os casos a foto espera.
    const usuarioAtual = await usuarioDaSessao();
    if (!usuarioAtual) {
      return { success: 0, failed: 0 };
    }

    const index = await getOfflinePhotosIndex();
    let success = 0;
    let failed = 0;

    for (const photo of index) {
      if (!fotoEDe(photo, usuarioAtual)) continue;
      try {
        // Verificar se arquivo ainda existe
        if (Platform.OS !== 'web') {
          const fileInfo = await FileSystem.getInfoAsync(photo.localPath);
          if (!fileInfo.exists) {
            await removeFromPhotosIndex(photo.paradaId, photo.localPath);
            continue;
          }
        }

        // O indice pode ter sido criado por uma versao antiga que usava o
        // `usuarios.unidade_id` legado. Resolva novamente pela rota no retry:
        // alem de recuperar filas antigas, isto mantem o prefixo do Storage
        // alinhado com a mesma unidade que autoriza a parada via RLS. Rota
        // invisivel (passada a outro motorista) ou sem loja: vale a loja
        // gravada na captura — a foto ainda sobe, para nao se perder.
        const { data: rota, error: rotaError } = await supabase
          .from('rotas')
          .select('unidade_id')
          .eq('id', photo.rotaId)
          .maybeSingle();
        if (rotaError) throw rotaError;
        const unidadeId = rota?.unidade_id ?? photo.unidadeId;

        // Comprovante nunca sai do aparelho sem destino confirmado: ligado na
        // parada, ou registrado em `logs` para o gestor (subirFotoDaFilaOffline).
        // A conclusao descartada na fila nao muda isso.
        const destino = await subirFotoDaFilaOffline({
          unidadeId,
          rotaId: photo.rotaId,
          paradaId: photo.paradaId,
          fotoUri: photo.localPath,
          usuarioId: usuarioAtual,
        });

        if (destino) {
          await deleteLocalPhoto(photo.localPath);
          await removeFromPhotosIndex(photo.paradaId, photo.localPath);
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        logger.warn('Falha ao processar foto offline', error);
        failed++;
      }
    }

    return { success, failed };
  } finally {
    isProcessingPhotos = false;
    fotosEmCurso = null;
    terminarFotos();
  }
}

/**
 * Obtém contagem de fotos pendentes de sync
 */
export async function getPendingPhotosCount(): Promise<number> {
  // Só as de quem está no aparelho: as de outra conta não sobem agora, e
  // contá-las faria o aviso "pendentes" mentir para esta pessoa.
  const dono = await donoConhecido();
  const index = await getOfflinePhotosIndex();
  return index.filter((p) => (dono ? fotoEDe(p, dono) : false)).length;
}

/**
 * Verifica se uma parada tem foto pendente de sync
 */
export async function hasOfflinePhoto(paradaId: string): Promise<boolean> {
  const index = await getOfflinePhotosIndex();
  return index.some((p) => p.paradaId === paradaId);
}

/**
 * Obtém caminho local da foto offline de uma parada
 */
export async function getOfflinePhotoPath(
  paradaId: string,
): Promise<string | null> {
  const index = await getOfflinePhotosIndex();
  const photo = index.find((p) => p.paradaId === paradaId);
  return photo?.localPath || null;
}

// ============================================================================
// CONECTIVIDADE
// ============================================================================

/**
 * Verifica se o dispositivo está online
 */
export async function isOnline(): Promise<boolean> {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected === true && netInfo.isInternetReachable === true;
}

/**
 * Salva dados offline para acesso posterior
 */
export async function saveOfflineData(data: OfflineData): Promise<void> {
  const currentData = await getOfflineData();
  const updatedData = {
    ...currentData,
    ...data,
    lastSync: new Date().toISOString(),
  };
  await AsyncStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(updatedData));
}

/**
 * Obtém dados salvos offline
 */
export async function getOfflineData(): Promise<OfflineData> {
  try {
    const dataStr = await AsyncStorage.getItem(OFFLINE_DATA_KEY);
    return dataStr ? JSON.parse(dataStr) : {};
  } catch (error) {
    logger.warn('Falha ao ler dados offline', error);
    return {};
  }
}

/**
 * Limpa dados offline
 */
export async function clearOfflineData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OFFLINE_DATA_KEY);
  } catch {
    // Silently fail
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
    logger.warn('Falha ao verificar dados offline', error);
    return false;
  }
}

/**
 * Resets concurrency locks for testing purposes only.
 * @internal Exported for tests — do not use in production code.
 */
export function _resetProcessingLocks(): void {
  isProcessingPhotos = false;
  fotosEmCurso = null;
  envioEmCurso = null;
  pedirEnvioDeNovo = false;
  hasNotifiedOffline = false;
}

// ============================================================================
// ENVIO DO QUE FICOU NO APARELHO (fotos + ações de parada)
// ============================================================================

let envioEmCurso: Promise<{ fotos: number; acoes: number }> | null = null;
let pedirEnvioDeNovo = false;

/**
 * Ponto ÚNICO de envio do que ficou guardado no aparelho: fotos de
 * comprovante PRIMEIRO, depois as ações de parada (concluir/pular). A foto
 * não depende do destino da ação: mesmo com a conclusão descartada ela sobe
 * (ligada na parada ou registrada em `logs`, `subirFotoDaFilaOffline`).
 *
 * Chamado na volta da rede, ao abrir o app, ao voltar ao primeiro plano, no
 * puxar para atualizar, depois de cada ação online e antes de finalizar a
 * rota. A ação pode ter ido para a fila com o NetInfo dizendo "conectado"
 * (sinal fraco, timeout) — aí não há mudança de rede para disparar o envio, e
 * por isso os outros gatilhos existem.
 *
 * Coalescência: pedidos durante um envio não rodam em paralelo; marcam uma
 * rodada extra ao final. Se as fotos já estiverem subindo por outro caminho,
 * espera por elas antes das ações.
 */
export function solicitarEnvioFila(): Promise<{
  fotos: number;
  acoes: number;
}> {
  if (envioEmCurso) {
    pedirEnvioDeNovo = true;
    return envioEmCurso;
  }
  envioEmCurso = (async () => {
    let fotos = 0;
    let acoes = 0;
    try {
      do {
        pedirEnvioDeNovo = false;
        if (!(await isOnline())) break;
        if (fotosEmCurso) await fotosEmCurso;
        if ((await getPendingPhotosCount()) > 0) {
          fotos += (await processOfflinePhotos()).success;
        }
        acoes += (await sincronizarFilaAcoesParada()).enviadas;
      } while (pedirEnvioDeNovo);
    } catch (error) {
      logger.warn('[Offline] Falha ao enviar o que ficou no aparelho', error);
    } finally {
      envioEmCurso = null;
    }
    return { fotos, acoes };
  })();
  return envioEmCurso;
}

// Variável para controlar se já notificou offline nesta sessão
let hasNotifiedOffline = false;

/**
 * Concluir/pular guardados sem rede por quem está no aparelho. Mesmo critério
 * das fotos (`getPendingPhotosCount`): a fila só sobe com a sessão do dono,
 * então ação de outra conta não é "pendente" para esta pessoa.
 */
async function contarAcoesParadaPendentes(): Promise<number> {
  try {
    const dono = await donoConhecido();
    if (!dono) return 0;
    return (await lerFilaAcoesParada()).filter((a) => a.motoristaId === dono)
      .length;
  } catch (error) {
    logger.warn('[Offline] Falha ao contar ações de parada pendentes', error);
    return 0;
  }
}

/**
 * Hook para monitorar status de conexão e processar fila automaticamente
 */
export function setupOfflineSync(): () => void {
  // Auth: guarda quem está no aparelho (dono das fotos mesmo com a sessão
  // vencida offline) e, ao entrar, sobe as fotos que esperavam esta pessoa —
  // sem isso elas só subiriam na próxima troca de conectividade.
  const {
    data: { subscription: assinaturaAuth },
  } = supabase.auth.onAuthStateChange((evento, sessao) => {
    const userId = sessao?.user?.id;
    if (!userId) return;
    void (async () => {
      await gravarUltimoUsuario(userId);
      if (evento !== 'SIGNED_IN') return;
      // Adoção ANTES do envio: as fotos adotadas entram na contagem de
      // pendentes e sobem antes das ações de parada (solicitarEnvioFila).
      await adotarFotosSemDono(userId);
      const r = await solicitarEnvioFila();
      if (r.fotos > 0 || r.acoes > 0) {
        await notifySyncComplete(r.acoes, r.fotos);
      }
    })().catch((error) =>
      logger.warn('[Offline] Falha ao sincronizar fotos no login', error),
    );
  });

  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && state.isInternetReachable) {
      // Resetar flag de notificação offline
      hasNotifiedOffline = false;

      // Fotos e depois concluir/pular guardados sem rede: o comprovante sobe
      // antes da ação que o gestor vê (solicitarEnvioFila).
      const envio = await solicitarEnvioFila();

      // Notificar se houve sincronização
      if (envio.acoes > 0 || envio.fotos > 0) {
        await notifySyncComplete(envio.acoes, envio.fotos);
      }
    } else {
      // Notificar apenas uma vez que está offline
      if (!hasNotifiedOffline) {
        const photosCount = await getPendingPhotosCount();
        const acoesParada = await contarAcoesParadaPendentes();

        // Só notifica se tem algo pendente
        if (photosCount > 0 || acoesParada > 0) {
          await notifyOfflineMode();
          hasNotifiedOffline = true;
        }
      }
    }
  });

  return () => {
    unsubscribe();
    assinaturaAuth.unsubscribe();
  };
}
