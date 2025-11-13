/**
 * Supabase Storage - Upload de Fotos de Comprovante de Entrega
 * Sprint 1.3 - Upload de Fotos
 */

import { supabase } from './supabase';

/**
 * Bucket names no Supabase Storage
 */
const BUCKET_FOTOS_ENTREGA = 'fotos-entrega';
const BUCKET_INCIDENTES = 'incidentes';

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
  fotoUri: string
): Promise<string | null> {
  try {
    console.log('📸 Iniciando upload de foto...');
    console.log(`   Unidade: ${unidadeId}`);
    console.log(`   Rota: ${rotaId}`);
    console.log(`   Parada: ${paradaId}`);

    // Gerar nome único com timestamp
    const timestamp = Date.now();
    const fileName = `${paradaId}_${timestamp}.jpg`;
    const filePath = `${unidadeId}/${rotaId}/${fileName}`;

    console.log(`   Caminho: ${filePath}`);

    // Converter URI para blob
    const response = await fetch(fotoUri);
    const blob = await response.blob();

    console.log(`   Tamanho: ${(blob.size / 1024).toFixed(2)} KB`);

    // Validar tamanho (máx 5MB)
    if (blob.size > 5 * 1024 * 1024) {
      console.error('❌ Foto muito grande! Máximo: 5MB');
      throw new Error('Foto muito grande. Máximo: 5MB');
    }

    // Upload para Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600', // Cache de 1 hora
        upsert: false // Não sobrescrever se já existir
      });

    if (error) {
      console.error('❌ Erro no upload:', error);
      throw error;
    }

    console.log('✅ Upload concluído:', data.path);

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .getPublicUrl(filePath);

    console.log('🔗 URL pública:', publicUrl);

    return publicUrl;
  } catch (error) {
    console.error('❌ Erro ao fazer upload de foto:', error);
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
  fotoUrl: string
): Promise<boolean> {
  try {
    console.log('💾 Salvando foto_url no banco...');
    console.log(`   Parada: ${paradaId}`);
    console.log(`   URL: ${fotoUrl}`);

    const { error } = await supabase
      .from('paradas')
      .update({ foto_url: fotoUrl })
      .eq('id', paradaId);

    if (error) {
      console.error('❌ Erro ao salvar foto_url:', error);
      throw error;
    }

    console.log('✅ foto_url salva com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar foto na parada:', error);
    return null;
  }
}

/**
 * Upload completo: foto + atualizar banco
 *
 * @param unidadeId - UUID da unidade
 * @param rotaId - UUID da rota
 * @param paradaId - UUID da parada
 * @param fotoUri - URI local da foto
 * @returns true se tudo deu certo, false caso contrário
 */
export async function uploadELinkFotoParada(
  unidadeId: string,
  rotaId: string,
  paradaId: string,
  fotoUri: string
): Promise<boolean> {
  try {
    console.log('🚀 Iniciando processo completo de upload...');

    // 1. Upload da foto
    const fotoUrl = await uploadFotoEntrega(unidadeId, rotaId, paradaId, fotoUri);

    if (!fotoUrl) {
      console.error('❌ Falha no upload da foto');
      return false;
    }

    // 2. Salvar URL no banco
    const salvou = await salvarFotoParada(paradaId, fotoUrl);

    if (!salvou) {
      console.error('❌ Falha ao salvar foto_url no banco');
      // TODO: Implementar rollback (deletar foto do storage)
      return false;
    }

    console.log('✅ Processo completo! Foto enviada e salva no banco.');
    return true;
  } catch (error) {
    console.error('❌ Erro no processo de upload:', error);
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
    // Exemplo: https://xyz.supabase.co/storage/v1/object/public/fotos-entrega/unidade/rota/parada.jpg
    // Queremos: unidade/rota/parada.jpg
    const urlParts = fotoUrl.split('/fotos-entrega/');
    if (urlParts.length !== 2) {
      throw new Error('URL inválida');
    }

    const filePath = urlParts[1];

    console.log('🗑️  Deletando foto:', filePath);

    const { error } = await supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .remove([filePath]);

    if (error) {
      console.error('❌ Erro ao deletar:', error);
      throw error;
    }

    console.log('✅ Foto deletada com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao deletar foto:', error);
    return false;
  }
}

/**
 * Upload de foto de perfil de usuário
 *
 * @param usuarioId - UUID do usuário
 * @param fotoUri - URI local da foto (file:// ou blob:)
 * @returns URL pública da foto ou null se houver erro
 */
export async function uploadFotoUsuario(
  usuarioId: string,
  fotoUri: string
): Promise<string | null> {
  try {
    console.log('📸 Iniciando upload de foto de perfil...');
    console.log(`   Usuário: ${usuarioId}`);

    // Gerar nome único com timestamp
    const timestamp = Date.now();
    const fileName = `perfil_${usuarioId}_${timestamp}.jpg`;
    const filePath = `perfis/${fileName}`;

    console.log(`   Caminho: ${filePath}`);

    // Converter URI para blob
    const response = await fetch(fotoUri);
    const blob = await response.blob();

    console.log(`   Tamanho: ${(blob.size / 1024).toFixed(2)} KB`);

    // Validar tamanho (máx 2MB para perfil)
    if (blob.size > 2 * 1024 * 1024) {
      console.error('❌ Foto muito grande! Máximo: 2MB');
      throw new Error('Foto muito grande. Máximo: 2MB');
    }

    // Upload para Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600', // Cache de 1 hora
        upsert: true, // Sobrescrever se já existir
      });

    if (error) {
      console.error('❌ Erro no upload:', error);
      throw error;
    }

    console.log('✅ Upload concluído:', data.path);

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_FOTOS_ENTREGA)
      .getPublicUrl(filePath);

    console.log('🔗 URL pública:', publicUrl);

    // Atualizar tabela usuarios com a nova foto_url
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({
        foto_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', usuarioId);

    if (updateError) {
      console.error('❌ Erro ao atualizar foto_url no banco:', updateError);
      throw updateError;
    }

    console.log('✅ foto_url atualizada no banco!');

    return publicUrl;
  } catch (error) {
    console.error('❌ Erro ao fazer upload de foto de perfil:', error);
    return null;
  }
}

/**
 * Upload de foto de incidente
 *
 * @param fotoUri - URI local da foto
 * @param fileName - Nome do arquivo
 * @returns URL pública da foto ou string vazia se houver erro
 */
export async function uploadIncidentPhoto(
  fotoUri: string,
  fileName: string
): Promise<string> {
  try {
    console.log('📸 Iniciando upload de foto de incidente...');

    // Converter URI para blob
    const response = await fetch(fotoUri);
    const blob = await response.blob();

    console.log(`   Tamanho: ${(blob.size / 1024).toFixed(2)} KB`);

    // Validar tamanho (máx 5MB)
    if (blob.size > 5 * 1024 * 1024) {
      console.error('❌ Foto muito grande! Máximo: 5MB');
      throw new Error('Foto muito grande. Máximo: 5MB');
    }

    // Criar bucket de incidentes se não existir
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find(b => b.name === BUCKET_INCIDENTES)) {
      await supabase.storage.createBucket(BUCKET_INCIDENTES, {
        public: true,
      });
    }

    // Upload para o bucket
    const { error } = await supabase.storage
      .from(BUCKET_INCIDENTES)
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error('❌ Erro no upload:', error);
      throw error;
    }

    // Gerar URL pública
    const { data: urlData } = supabase.storage
      .from(BUCKET_INCIDENTES)
      .getPublicUrl(fileName);

    console.log('✅ Upload de incidente concluído!');
    console.log(`   URL: ${urlData.publicUrl}`);

    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ Erro ao fazer upload de foto de incidente:', error);
    return '';
  }
}

// Export como objeto para manter compatibilidade
export const storageService = {
  uploadFotoEntrega,
  salvarFotoParada,
  uploadELinkFotoParada,
  deletarFoto,
  uploadFotoUsuario,
  uploadIncidentPhoto,
};
