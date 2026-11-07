/**
 * Passos comuns às exportações de rotas (CSV e XLSX): compartilhar o arquivo
 * gravado e registrar a exportação em `logs`. Estavam copiados nos dois
 * arquivos.
 */

import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { type FiltroStatus } from '@/lib/statusLabels';
import { supabase } from '@/lib/supabase';
import { showInfo } from '@/utils/errorHandling';

interface OpcoesCompartilhamento {
  mimeType: string;
  dialogTitle: string;
  UTI: string;
}

/** Abre o compartilhamento do sistema; sem ele, avisa onde o arquivo ficou. */
export async function compartilharArquivo(
  fileUri: string,
  opcoes: OpcoesCompartilhamento,
): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(fileUri, opcoes);
  } else {
    showInfo('Arquivo Salvo', `O arquivo foi salvo em: ${fileUri}`);
  }
}

/** Auditoria da exportação; falha vira aviso, nunca interrompe quem exporta. */
export function registrarExportacao(
  userId: string,
  totalRotas: number,
  filtroStatus: FiltroStatus,
  formato: 'csv' | 'xlsx',
): void {
  supabase
    .from('logs')
    .insert({
      usuario_id: userId,
      evento: 'exportacao_rotas',
      detalhes: {
        total_rotas: totalRotas,
        filtro_status: filtroStatus,
        formato,
        plataforma: Platform.OS,
      },
    })
    .then(({ error }) => {
      if (error)
        logger.warn(
          `Falha ao registrar log de exportação${formato === 'xlsx' ? ' XLSX' : ''}:`,
          error.message,
        );
    });
}
