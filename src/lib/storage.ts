/**
 * Supabase Storage - Upload de Fotos de Comprovante de Entrega
 * Sprint 1.3 - Upload de Fotos
 * Updated: Using expo-file-system legacy API for Expo SDK 54
 * Updated: Added upload progress tracking (Phase 3.2)
 */

// Use legacy API for expo-file-system (new API deprecated readAsStringAsync)
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { logger } from './logger';
import { supabase } from './supabase';

/** Optional progress callback: receives percent 0-100 */
export type UploadProgressCallback = (percent: number) => void;

/**
 * Helper to read file and convert to ArrayBuffer for Supabase upload
 * Works on both native (via expo-file-system) and web (via fetch)
 */
async function getFileData(
  uri: string,
): Promise<{ data: ArrayBuffer; size: number }> {
  if (Platform.OS === 'web') {
    // Web: use fetch + blob
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return { data: arrayBuffer, size: blob.size };
  }

  // Native: use expo-file-system legacy API to read as base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Convert base64 to ArrayBuffer
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return { data: bytes.buffer, size: bytes.length };
}

/**
 * Bucket names no Supabase Storage
 * NOTA: Usamos apenas um bucket (fotos-entrega) com subpastas
 * porque criar buckets requer SERVICE_ROLE_KEY (admin)
 */
const BUCKET_FOTOS_ENTREGA = 'fotos-entrega';

/**
 * Normaliza um valor de foto_url para o path dentro do bucket fotos-entrega.
 * Aceita URL pública (.../object/public/fotos-entrega/<path>), URL assinada
 * (.../object/sign/fotos-entrega/<path>?token=...) ou um path puro.
 * Retorna null para vazio, lixo (ex.: "success") ou URL http externa.
 */
export function getStoragePath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const marker = `/${BUCKET_FOTOS_ENTREGA}/`;
  const idx = value.indexOf(marker);
  if (idx >= 0) {
    let path = value.slice(idx + marker.length);
    const q = path.indexOf('?');
    if (q >= 0) path = path.slice(0, q);
    path = path.trim();
    return path || null;
  }
  // Não é URL do bucket: URL http externa não é path
  if (/^https?:\/\//i.test(value)) return null;
  const path = value.trim();
  // Path válido sempre tem prefixo de pasta (contém '/'); descarta lixo
  if (!path || !path.includes('/')) return null;
  return path;
}

/**
 * Upload de foto de comprovante de entrega
 *
 * @param unidadeId - UUID da unidade
 * @param rotaId - UUID da rota
 * @param paradaId - UUID da parada
 * @param fotoUri - URI local da foto (file:// ou blob:)
 * @returns URL pública da foto ou null se houver erro
 */
export async function uploadFotoEntrega(
  unidadeId: string,
  rotaId: string,
  paradaId: string,
  fotoUri: string,
): Promise<string | null> {
  try {
    // Gerar nome único com timestamp
    const timestamp = Date.now();
    const fileName = `${paradaId}_${timestamp}.jpg`;
    const filePath = `${unidadeId}/${rotaId}/${fileName}`;

    // Ler arquivo usando expo-file-system (nativo) ou fetch (web)
    const { data: fileData, size } = await getFileData(fotoUri);

    // Validar tamanho (máx 5MB)
    if (size > 5 * 1024 * 1024) {
      logger.error('[Storage] Foto muito grande! Máximo: 5MB');
      throw new Error('Foto muito grande. Máximo: 5MB');
    }

    // Upload para Supabase Storage
    const { data: _data, error } = await supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .upload(filePath, fileData, {
        contentType: 'image/jpeg',
        cacheControl: '3600', // Cache de 1 hora
        upsert: false, // Não sobrescrever se já existir
      });

    if (error) {
      logger.error('[Storage] Erro no upload', error);
      throw error;
    }

    // Obter URL pública
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_FOTOS_ENTREGA).getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    logger.error('[Storage] Erro ao fazer upload de foto', error);
    return null;
  }
}

/**
 * Upload de foto de comprovante de entrega com progresso
 *
 * On web: Uses XMLHttpRequest for real upload progress events.
 * On native: Uses Supabase .upload() with simulated progress steps
 * (Supabase JS client does not expose onUploadProgress).
 *
 * @param unidadeId - UUID da unidade
 * @param rotaId - UUID da rota
 * @param paradaId - UUID da parada
 * @param fotoUri - URI local da foto (file:// ou blob:)
 * @param onProgress - Optional callback receiving percent 0-100
 * @returns URL pública da foto ou null se houver erro
 */
export async function uploadFotoEntregaWithProgress(
  unidadeId: string,
  rotaId: string,
  paradaId: string,
  fotoUri: string,
  onProgress?: UploadProgressCallback,
): Promise<string | null> {
  try {
    // Gerar nome único com timestamp
    const timestamp = Date.now();
    const fileName = `${paradaId}_${timestamp}.jpg`;
    const filePath = `${unidadeId}/${rotaId}/${fileName}`;

    // Ler arquivo usando expo-file-system (nativo) ou fetch (web)
    const { data: fileData, size } = await getFileData(fotoUri);
    onProgress?.(10);

    // Validar tamanho (máx 5MB)
    if (size > 5 * 1024 * 1024) {
      logger.error('[Storage] Foto muito grande! Máximo: 5MB');
      throw new Error('Foto muito grande. Máximo: 5MB');
    }

    if (Platform.OS === 'web') {
      // Web: XMLHttpRequest for real progress tracking
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Sessão não encontrada. Faça login novamente.');
      }

      const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET_FOTOS_ENTREGA}/${filePath}`;

      onProgress?.(20);

      const publicUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            // Map upload progress to 20-85% range (10-20 was file read, 85-100 is URL fetch)
            const uploadPercent = Math.round(
              (event.loaded / event.total) * 100,
            );
            const mappedPercent = 20 + Math.round(uploadPercent * 0.65);
            onProgress?.(mappedPercent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress?.(90);
            // Get public URL
            const {
              data: { publicUrl: url },
            } = supabase.storage
              .from(BUCKET_FOTOS_ENTREGA)
              .getPublicUrl(filePath);
            onProgress?.(100);
            resolve(url);
          } else {
            let errorMessage = `Upload failed with status ${xhr.status}`;
            try {
              const body = JSON.parse(xhr.responseText);
              if (body.message) errorMessage = body.message;
              if (body.error) errorMessage = body.error;
            } catch {
              // Response is not JSON, use status-based message
            }
            reject(new Error(errorMessage));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Erro de rede durante upload'));
        };

        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.setRequestHeader('Content-Type', 'image/jpeg');
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.send(fileData);
      });

      return publicUrl;
    } else {
      // Native: Supabase .upload() with simulated progress steps
      onProgress?.(30);

      const { data: _data, error } = await supabase.storage
        .from(BUCKET_FOTOS_ENTREGA)
        .upload(filePath, fileData, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        logger.error('[Storage] Erro no upload', error);
        throw error;
      }

      onProgress?.(70);

      // Obter URL pública
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_FOTOS_ENTREGA).getPublicUrl(filePath);

      onProgress?.(90);
      onProgress?.(100);

      return publicUrl;
    }
  } catch (error) {
    logger.error('[Storage] Erro ao fazer upload de foto com progresso', error);
    return null;
  }
}

/**
 * Salvar URL da foto na tabela paradas
 *
 * @param paradaId - UUID da parada
 * @param fotoUrl - URL pública da foto
 * @returns true se salvou com sucesso, false caso contrário
 */
export async function salvarFotoParada(
  paradaId: string,
  fotoUrl: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('paradas')
      .update({ foto_url: fotoUrl })
      .eq('id', paradaId);

    if (error) {
      logger.error('[Storage] Erro ao salvar foto_url', error);
      throw error;
    }

    return true;
  } catch (error) {
    logger.error('[Storage] Erro ao salvar foto na parada', error);
    return false;
  }
}

/**
 * Upload completo: foto + atualizar banco
 *
 * @param unidadeId - UUID da unidade
 * @param rotaId - UUID da rota
 * @param paradaId - UUID da parada
 * @param fotoUri - URI local da foto
 * @param onProgress - Optional callback receiving percent 0-100
 * @returns true se tudo deu certo, false caso contrário
 */
export async function uploadELinkFotoParada(
  unidadeId: string,
  rotaId: string,
  paradaId: string,
  fotoUri: string,
  onProgress?: UploadProgressCallback,
): Promise<boolean> {
  try {
    // 1. Upload da foto (with progress if callback provided)
    const fotoUrl = onProgress
      ? await uploadFotoEntregaWithProgress(
          unidadeId,
          rotaId,
          paradaId,
          fotoUri,
          onProgress,
        )
      : await uploadFotoEntrega(unidadeId, rotaId, paradaId, fotoUri);

    if (!fotoUrl) {
      return false;
    }

    // 2. Salvar URL no banco
    const salvou = await salvarFotoParada(paradaId, fotoUrl);

    if (!salvou) {
      // Rollback: deletar foto do storage se falhou ao atualizar banco
      logger.warn(
        '[Storage] Falha ao salvar no banco, realizando rollback da foto...',
      );
      await deletarFoto(fotoUrl);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[Storage] Erro no processo de upload', error);
    return false;
  }
}

/**
 * Deletar foto do storage
 *
 * @param fotoUrl - URL pública da foto
 * @returns true se deletou com sucesso
 */
export async function deletarFoto(fotoUrl: string): Promise<boolean> {
  try {
    // Extrair caminho da URL
    const urlParts = fotoUrl.split('/fotos-entrega/');
    if (urlParts.length !== 2) {
      throw new Error('URL inválida');
    }

    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .remove([filePath]);

    if (error) {
      logger.error('[Storage] Erro ao deletar', error);
      throw error;
    }

    return true;
  } catch (error) {
    logger.error('[Storage] Erro ao deletar foto', error);
    return false;
  }
}

/**
 * Deletar foto de perfil antiga do storage
 *
 * @param usuarioId - UUID do usuário
 * @returns true se deletou com sucesso ou não havia foto
 */
export async function deletarFotoPerfil(usuarioId: string): Promise<boolean> {
  try {
    // Listar arquivos no diretório de perfis do usuário
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .list('perfis', {
        search: `perfil_${usuarioId}`,
      });

    if (listError) {
      logger.error('[Storage] Erro ao listar fotos', listError);
      return false;
    }

    if (!files || files.length === 0) {
      return true;
    }

    // Deletar todas as fotos antigas do usuário
    const filesToDelete = files
      .filter((f) => f.name.startsWith(`perfil_${usuarioId}`))
      .map((f) => `perfis/${f.name}`);

    if (filesToDelete.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_FOTOS_ENTREGA)
        .remove(filesToDelete);

      if (deleteError) {
        logger.error('[Storage] Erro ao deletar fotos antigas', deleteError);
      }
    }

    return true;
  } catch (error) {
    logger.error('[Storage] Erro ao deletar foto de perfil', error);
    return false;
  }
}

/**
 * Upload de foto de perfil de usuário
 * Deleta foto antiga antes de fazer novo upload
 *
 * @param usuarioId - UUID do usuário
 * @param fotoUri - URI local da foto (file:// ou blob:)
 * @param fotoAntigaUrl - URL da foto antiga para deletar (opcional)
 * @returns URL pública da foto ou null se houver erro
 */
export async function uploadFotoUsuario(
  usuarioId: string,
  fotoUri: string,
  fotoAntigaUrl?: string | null,
): Promise<string | null> {
  try {
    // 1. Deletar foto antiga se existir
    if (fotoAntigaUrl) {
      await deletarFotoPerfil(usuarioId);
    }

    // Gerar nome único com timestamp
    const timestamp = Date.now();
    const fileName = `perfil_${usuarioId}_${timestamp}.jpg`;
    const filePath = `perfis/${fileName}`;

    // Ler arquivo usando expo-file-system (nativo) ou fetch (web)
    const { data: fileData, size } = await getFileData(fotoUri);

    // Validar tamanho (máx 2MB para perfil)
    if (size > 2 * 1024 * 1024) {
      logger.error('[Storage] Foto muito grande! Máximo: 2MB');
      throw new Error('Foto muito grande. Máximo: 2MB');
    }

    // Upload para Supabase Storage
    const { data: _data2, error } = await supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .upload(filePath, fileData, {
        contentType: 'image/jpeg',
        cacheControl: '3600', // Cache de 1 hora
        upsert: false, // Não sobrescrever (nome é único com timestamp)
      });

    if (error) {
      logger.error('[Storage] Erro no upload', error);
      throw error;
    }

    // Obter URL pública
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_FOTOS_ENTREGA).getPublicUrl(filePath);

    // Atualizar tabela usuarios com a nova foto_url
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({
        foto_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', usuarioId);

    if (updateError) {
      logger.error(
        '[Storage] Erro ao atualizar foto_url no banco',
        updateError,
      );
      throw updateError;
    }

    return publicUrl;
  } catch (error) {
    logger.error('[Storage] Erro ao fazer upload de foto de perfil', error);
    return null;
  }
}

/**
 * Upload de foto de incidente
 * Usa o bucket fotos-entrega com subpasta incidentes/
 *
 * @param fotoUri - URI local da foto
 * @param fileName - Nome do arquivo
 * @returns URL pública da foto ou string vazia se houver erro
 */
export async function uploadIncidentPhoto(
  fotoUri: string,
  fileName: string,
): Promise<string> {
  try {
    // Ler arquivo usando expo-file-system (nativo) ou fetch (web)
    const { data: fileData, size } = await getFileData(fotoUri);

    // Validar tamanho (máx 5MB)
    if (size > 5 * 1024 * 1024) {
      logger.error('[Storage] Foto muito grande! Máximo: 5MB');
      throw new Error('Foto muito grande. Máximo: 5MB');
    }

    // Caminho no bucket: incidentes/nome-do-arquivo.jpg
    const filePath = `incidentes/${fileName}`;

    // Upload para o bucket fotos-entrega (subpasta incidentes)
    const { error } = await supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .upload(filePath, fileData, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      logger.error('[Storage] Erro no upload de incidente', error);
      throw error;
    }

    // Gerar URL pública
    const { data: urlData } = supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    logger.error('[Storage] Erro ao fazer upload de foto de incidente', error);
    return '';
  }
}

// Export como objeto para manter compatibilidade
export const storageService = {
  uploadFotoEntrega,
  uploadFotoEntregaWithProgress,
  salvarFotoParada,
  uploadELinkFotoParada,
  deletarFoto,
  deletarFotoPerfil,
  uploadFotoUsuario,
  uploadIncidentPhoto,
};
