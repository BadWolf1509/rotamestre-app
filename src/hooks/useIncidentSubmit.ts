/**
 * useIncidentSubmit - Hook para gerenciar submissão de incidentes
 *
 * Encapsula toda a lógica de:
 * - Upload de foto com retry automático
 * - Obtenção de geolocalização
 * - Inserção no banco de dados
 * - Criação de logs
 *
 * @example
 * ```tsx
 * const { submit, isSubmitting, uploadProgress, error, reset } = useIncidentSubmit();
 *
 * const handleSubmit = async () => {
 *   const result = await submit({
 *     category: 'accident',
 *     description: 'Descrição do problema',
 *     photoUri: 'file://photo.jpg',
 *     motoristaId: 'uuid',
 *     rotaId: 'uuid',
 *   });
 *
 *   if (result.success) {
 *     // Sucesso
 *   }
 * };
 * ```
 */

import * as Location from 'expo-location';
import { useState, useCallback } from 'react';

import { photonService } from '@/lib/photon';
import { createIncidente, logIncidenteAction } from '@/lib/queries';
import type { IncidenteCategoria } from '@/lib/queries';
import { storageService } from '@/lib/storage';

// Configuração de retry
const UPLOAD_MAX_RETRIES = 3;
const UPLOAD_RETRY_DELAY_MS = 1000;

export interface IncidentSubmitData {
  category: string;
  description: string;
  photoUri?: string;
  paradaId?: string;
  rotaId?: string;
  motoristaId: string;
  endereco?: string;
}

export interface IncidentSubmitResult {
  success: boolean;
  error?: string;
  incidentId?: string;
}

export interface UseIncidentSubmitReturn {
  /** Submete o incidente */
  submit: (data: IncidentSubmitData) => Promise<IncidentSubmitResult>;
  /** Estado de submissão */
  isSubmitting: boolean;
  /** Progresso do upload (0-100) */
  uploadProgress: number;
  /** Número de tentativas de upload realizadas */
  uploadRetryCount: number;
  /** Último erro ocorrido */
  error: string | null;
  /** Reseta o estado do hook */
  reset: () => void;
}

/**
 * Aguarda um tempo antes de tentar novamente
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Hook para gerenciar submissão de incidentes com retry no upload
 */
export function useIncidentSubmit(): UseIncidentSubmitReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadRetryCount, setUploadRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setUploadProgress(0);
    setUploadRetryCount(0);
    setError(null);
  }, []);

  /**
   * Tenta fazer upload da foto com retry automático
   */
  const uploadPhotoWithRetry = useCallback(
    async (photoUri: string): Promise<string> => {
      const fileName = `incident_${Date.now()}.jpg`;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
        try {
          setUploadRetryCount(attempt);
          setUploadProgress(Math.min(30 * attempt, 90)); // Progresso visual

          const uploadedUrl = await storageService.uploadIncidentPhoto(photoUri, fileName);

          setUploadProgress(100);
          return uploadedUrl;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`Upload attempt ${attempt}/${UPLOAD_MAX_RETRIES} failed:`, lastError.message);

          if (attempt < UPLOAD_MAX_RETRIES) {
            // Aguarda antes de tentar novamente (exponential backoff)
            await delay(UPLOAD_RETRY_DELAY_MS * attempt);
          }
        }
      }

      // Todas as tentativas falharam
      throw lastError || new Error('Falha no upload após múltiplas tentativas');
    },
    []
  );

  /**
   * Tenta obter o endereço via geolocalização
   */
  const getLocationAddress = useCallback(async (): Promise<string | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Usa Photon (gratuito!) para reverse geocoding
      const address = await photonService.reverseGeocode({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      return address || null;
    } catch (err) {
      console.warn('Erro ao obter localização:', err);
      return null;
    }
  }, []);

  /**
   * Submete o incidente
   */
  const submit = useCallback(
    async (data: IncidentSubmitData): Promise<IncidentSubmitResult> => {
      setIsSubmitting(true);
      setError(null);
      setUploadProgress(0);
      setUploadRetryCount(0);

      try {
        let uploadedPhotoUrl = '';
        let finalEndereco = data.endereco || 'Localização não informada';

        // 1. Tentar obter geolocalização se não tiver endereço
        if (!data.endereco) {
          setUploadProgress(10);
          const locationAddress = await getLocationAddress();
          if (locationAddress) {
            finalEndereco = locationAddress;
          }
        }

        // 2. Upload da foto com retry (se existir)
        if (data.photoUri) {
          setUploadProgress(20);
          try {
            uploadedPhotoUrl = await uploadPhotoWithRetry(data.photoUri);
          } catch (uploadError) {
            // Upload falhou após todas as tentativas
            const errorMessage =
              uploadError instanceof Error
                ? uploadError.message
                : 'Erro desconhecido no upload';

            setError(`Falha no upload da foto: ${errorMessage}`);

            // Continuar sem foto ou abortar? Vamos continuar sem foto
            console.warn('Continuando sem foto devido a erro no upload');
            uploadedPhotoUrl = '';
          }
        }

        setUploadProgress(60);

        // 3. Criar registro no banco usando query centralizada
        const result = await createIncidente({
          rota_id: data.rotaId || null,
          parada_id: data.paradaId || null,
          motorista_id: data.motoristaId,
          categoria: data.category as IncidenteCategoria,
          descricao: data.description,
          foto_url: uploadedPhotoUrl || null,
          endereco: finalEndereco,
          status: 'aberto',
        });

        if (!result.success) {
          throw new Error(`Erro ao salvar incidente: ${result.error.message}`);
        }

        const insertedData = result.data;

        setUploadProgress(80);

        // 4. Criar log usando query centralizada (fire-and-forget)
        if (data.rotaId && insertedData) {
          logIncidenteAction(data.motoristaId, insertedData.id, 'incidente_reportado', {
            categoria: data.category,
            descricao: data.description,
            tem_foto: !!data.photoUri,
            foto_upload_sucesso: !!uploadedPhotoUrl,
            parada_id: data.paradaId || null,
            endereco: finalEndereco,
            rota_id: data.rotaId,
          });
        }

        setUploadProgress(100);

        return {
          success: true,
          incidentId: insertedData?.id,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Erro desconhecido ao enviar reporte';

        setError(errorMessage);
        console.error('Erro ao reportar incidente:', err);

        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsSubmitting(false);
      }
    },
    [getLocationAddress, uploadPhotoWithRetry]
  );

  return {
    submit,
    isSubmitting,
    uploadProgress,
    uploadRetryCount,
    error,
    reset,
  };
}
