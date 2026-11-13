/**
 * useIncidentSubmit - Hook para gerenciar submissão de incidentes
 *
 * Encapsula toda a lógica de:
 * - Upload de foto com retry automático
 * - Obtenção de geolocalização
 * - Inserção no banco de dados
 * - Criação de logs
 * - Sem rede (ou sem resposta do INSERT): o reporte vai para a fila do
 *   aparelho (`src/lib/motorista/filaIncidentes.ts`) e sobe sozinho depois
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

import { logger } from '@/lib/logger';
import { ehErroDefinitivo } from '@/lib/motorista/filaAcoesParada';
import {
  enfileirarIncidente,
  type IncidenteNaFila,
} from '@/lib/motorista/filaIncidentes';
import { solicitarEnvioFila } from '@/lib/offline';
import { pedirPermissao } from '@/lib/permissoes';
import { photonService } from '@/lib/photon';
import { createIncidente, logIncidenteAction } from '@/lib/queries';
import type { IncidenteCategoria } from '@/lib/queries';
import { semRedeConfirmada } from '@/lib/semRede';
import { storageService } from '@/lib/storage';
import { gerarUuid } from '@/lib/uuid';

/** Nem a fila do aparelho aceitou: o motorista precisa refazer. */
const MENSAGEM_NAO_GUARDOU =
  'Sem internet, e o reporte não foi salvo no aparelho. Tente de novo quando o sinal voltar.';

const ENDERECO_NAO_INFORMADO = 'Localização não informada';

// Configuração de retry
const UPLOAD_MAX_RETRIES = 3;
const UPLOAD_RETRY_DELAY_MS = 1000;

interface IncidentSubmitData {
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
  /**
   * A foto foi escolhida mas o upload falhou nas tentativas: o incidente foi
   * registrado SEM ela. Quem chama deve avisar o motorista.
   */
  fotoPerdida?: boolean;
  /**
   * Sem rede: o reporte ficou na fila do aparelho e sobe sozinho quando a
   * conexão voltar. Quem chama avisa o motorista.
   */
  enfileirado?: boolean;
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

          const uploadedUrl = await storageService.uploadIncidentPhoto(
            photoUri,
            fileName,
          );

          setUploadProgress(100);
          return uploadedUrl;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          logger.warn(
            `Upload attempt ${attempt}/${UPLOAD_MAX_RETRIES} failed:`,
            lastError.message,
          );

          if (attempt < UPLOAD_MAX_RETRIES) {
            // Aguarda antes de tentar novamente (exponential backoff)
            await delay(UPLOAD_RETRY_DELAY_MS * attempt);
          }
        }
      }

      // Todas as tentativas falharam
      throw lastError || new Error('Falha no upload após múltiplas tentativas');
    },
    [],
  );

  /**
   * Tenta obter o endereço via geolocalização
   */
  const getLocationAddress = useCallback(async (): Promise<string | null> => {
    try {
      const { concedida } = await pedirPermissao(
        () => Location.requestForegroundPermissionsAsync(),
        () => Location.getForegroundPermissionsAsync(),
      );
      if (!concedida) {
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
      logger.warn('Erro ao obter localização:', err);
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

      // Nasce aqui e vai como `incidentes.id`: se o INSERT gravar e a
      // resposta se perder, a fila reenvia com o mesmo id e a chave primária
      // impede a segunda linha.
      const incidenteId = gerarUuid();
      const paraFila = (
        extra: Pick<IncidenteNaFila, 'endereco' | 'fotoLocal' | 'fotoPath'>,
      ): IncidenteNaFila => ({
        id: incidenteId,
        motoristaId: data.motoristaId,
        rotaId: data.rotaId || null,
        paradaId: data.paradaId || null,
        categoria: data.category as IncidenteCategoria,
        descricao: data.description,
        em: new Date().toISOString(),
        tentativas: 0,
        ...extra,
      });
      /** Guarda na fila do aparelho; se nem isso der, o erro diz que não salvou. */
      const enfileirar = async (
        item: IncidenteNaFila,
      ): Promise<IncidentSubmitResult> => {
        try {
          await enfileirarIncidente(item);
        } catch (erroFila) {
          logger.error('Falha ao guardar o incidente no aparelho', erroFila);
          throw new Error(MENSAGEM_NAO_GUARDOU);
        }
        return { success: true, incidentId: incidenteId, enfileirado: true };
      };

      try {
        // Sem rede confirmada (modo avião, ou Wi-Fi sem internet já
        // observado): guarda na fila agora, em vez de esperar posição,
        // Photon, três uploads e o insert desistirem um a um. É pedido do
        // motorista: só o NetInfo desconectado (modo avião) leva direto à
        // fila; a queda observada há segundos, não.
        if (await semRedeConfirmada({ ignorarQuedaObservada: true })) {
          return await enfileirar(
            paraFila({
              endereco: data.endereco || ENDERECO_NAO_INFORMADO,
              fotoLocal: data.photoUri || undefined,
            }),
          );
        }

        let uploadedPhotoUrl = '';
        let fotoPerdida = false;
        let finalEndereco = data.endereco || ENDERECO_NAO_INFORMADO;

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
            logger.warn('Continuando sem foto devido a erro no upload');
            uploadedPhotoUrl = '';
            fotoPerdida = true;
          }
        }

        setUploadProgress(60);

        // 3. Criar registro no banco usando query centralizada
        const result = await createIncidente({
          id: incidenteId,
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
          // Rede, timeout, 5xx, sessão: o INSERT pode ter gravado. Vai para a
          // fila com o MESMO id — o reenvio é idempotente pela chave primária.
          // Só a recusa definitiva do banco chega ao motorista como erro.
          const original = result.error.originalError ?? result.error;
          if (!ehErroDefinitivo(original)) {
            const guardado = await enfileirar(
              paraFila({
                endereco: finalEndereco,
                fotoPath: uploadedPhotoUrl || undefined,
                // Foto que não subiu agora vai junto, para subir com a fila.
                fotoLocal: uploadedPhotoUrl ? undefined : data.photoUri,
              }),
            );
            // Havia rede (a falha foi da resposta): tenta já, pelo envio único
            // da fila, em vez de esperar o próximo gatilho (volta da rede,
            // primeiro plano) — que pode não vir com o NetInfo "conectado".
            solicitarEnvioFila().catch((e) =>
              logger.warn('[Incidente] Falha ao pedir o envio da fila', e),
            );
            return guardado;
          }
          throw new Error(`Erro ao salvar incidente: ${result.error.message}`);
        }

        const insertedData = result.data;

        setUploadProgress(80);

        // 4. Criar log usando query centralizada (fire-and-forget)
        if (data.rotaId && insertedData) {
          void logIncidenteAction(
            data.motoristaId,
            insertedData.id,
            'incidente_reportado',
            {
              categoria: data.category,
              descricao: data.description,
              tem_foto: !!data.photoUri,
              foto_upload_sucesso: !!uploadedPhotoUrl,
              parada_id: data.paradaId || null,
              endereco: finalEndereco,
              rota_id: data.rotaId,
            },
          );
        }

        setUploadProgress(100);

        return {
          success: true,
          incidentId: insertedData?.id,
          fotoPerdida,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Erro desconhecido ao enviar reporte';

        setError(errorMessage);
        logger.error('Erro ao reportar incidente:', err);

        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsSubmitting(false);
      }
    },
    [getLocationAddress, uploadPhotoWithRetry],
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
