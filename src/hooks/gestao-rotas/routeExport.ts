/**
 * Route export utilities (CSV)
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { formatDateBR, formatDateTimeBR } from '@/lib/dateUtils';
import { formatarDecimal } from '@/lib/formatNumber';
import { logger } from '@/lib/logger';
import { ROTA_STATUS_LABELS, type FiltroStatus } from '@/lib/statusLabels';
import { supabase } from '@/lib/supabase';
import {
  showError,
  showInfo,
  showSuccess,
  showWarning,
} from '@/utils/errorHandling';

import type { RotaHistorico } from './types';

interface ExportOptions {
  rotas: RotaHistorico[];
  filtroStatus: FiltroStatus;
  userId?: string;
}

/**
 * Export routes to CSV file
 * Handles both web (download) and mobile (share) platforms
 */
export async function exportRotasToCSV({
  rotas,
  filtroStatus,
  userId,
}: ExportOptions): Promise<void> {
  try {
    if (rotas.length === 0) {
      showWarning('Atenção', 'Não há rotas para exportar');
      return;
    }

    const csvContent = buildCSVContent(rotas);
    const dataAtual = new Date()
      .toLocaleDateString('pt-BR')
      .replace(/\//g, '-');
    const nomeArquivo = `gestao-rotas-${dataAtual}.csv`;

    if (Platform.OS === 'web') {
      downloadCSVWeb(csvContent, nomeArquivo);
    } else {
      await shareCSVMobile(csvContent, nomeArquivo);
    }

    // Log the export action
    if (userId) {
      logExportAction(userId, rotas.length, filtroStatus);
    }

    if (Platform.OS === 'web') {
      showSuccess('Sucesso', `${rotas.length} rotas exportadas com sucesso!`);
    }
  } catch (error) {
    logger.error('Erro ao exportar:', error);
    showError('Erro', 'Não foi possível exportar os dados');
  }
}

/**
 * Build CSV content from routes
 */
function buildCSVContent(rotas: RotaHistorico[]): string {
  const headers = [
    'Data',
    'Motorista',
    'Paradas Concluídas',
    'Total Paradas',
    'Distância (km)',
    'Iniciada em',
    'Concluída em',
    'Status',
  ];

  const rows = rotas.map((rota) => [
    formatDateBR(rota.data),
    rota.motorista_nome || 'Sem motorista',
    rota.paradas_concluidas,
    rota.paradas_count,
    rota.distancia_total ? formatarDecimal(rota.distancia_total) : '-',
    formatDateTimeBR(rota.iniciada_em, { showYear: true }),
    formatDateTimeBR(rota.concluida_em, { showYear: true }),
    ROTA_STATUS_LABELS[rota.status] || rota.status,
  ]);

  // Arquivo pt-BR de ponta a ponta: BOM (diz ao Excel que e UTF-8), `;` como
  // separador de campo (o separador de lista do Windows pt-BR) e virgula
  // decimal. Antes era metade e metade — datas em dd/mm/aaaa com numero em
  // ponto e campo em virgula — e a coluna de distancia nao somava no Excel.
  return (
    '\uFEFF' +
    [
      headers.map(celulaCSV).join(';'),
      ...rows.map((row) => row.map(celulaCSV).join(';')),
    ].join('\n')
  );
}

/** Come\u00E7o de c\u00E9lula que o Excel e o LibreOffice leem como f\u00F3rmula. */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;
/** N\u00E3o formam f\u00F3rmula: o marcador "-" (sem valor) e n\u00FAmero puro. */
const SEM_RISCO_DE_FORMULA = /^(-|-?\d+(?:[.,]\d+)?)$/;

/**
 * C\u00E9lula entre aspas, com as aspas internas dobradas (RFC 4180) e f\u00F3rmula
 * neutralizada por um ap\u00F3strofo na frente (OWASP, "CSV injection"): o nome do
 * motorista \u00E9 texto livre e `=HYPERLINK(...)` viraria link clic\u00E1vel na
 * planilha do gestor. O XLSX n\u00E3o passa por aqui: o SheetJS grava string como
 * c\u00E9lula de texto, que n\u00E3o \u00E9 avaliada (guarda em `routeExportXLSX.test.ts`).
 */
function celulaCSV(valor: string | number | null | undefined): string {
  let texto = valor === null || valor === undefined ? '' : String(valor);
  if (
    typeof valor === 'string' &&
    INICIO_DE_FORMULA.test(texto) &&
    !SEM_RISCO_DE_FORMULA.test(texto)
  ) {
    texto = `'${texto}`;
  }
  return `"${texto.replace(/"/g, '""')}"`;
}

/**
 * Download CSV file on web platform
 */
function downloadCSVWeb(csvContent: string, fileName: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Share CSV file on mobile platform
 */
async function shareCSVMobile(
  csvContent: string,
  fileName: string,
): Promise<void> {
  const fileUri = FileSystem.documentDirectory + fileName;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Exportar Relatório de Rotas',
      UTI: 'public.comma-separated-values-text',
    });
  } else {
    showInfo('Arquivo Salvo', `O arquivo foi salvo em: ${fileUri}`);
  }
}

/**
 * Log export action to database
 */
function logExportAction(
  userId: string,
  totalRotas: number,
  filtroStatus: FiltroStatus,
): void {
  supabase
    .from('logs')
    .insert({
      usuario_id: userId,
      evento: 'exportacao_rotas',
      detalhes: {
        total_rotas: totalRotas,
        filtro_status: filtroStatus,
        formato: 'csv',
        plataforma: Platform.OS,
      },
    })
    .then(({ error }) => {
      if (error)
        logger.warn('Falha ao registrar log de exportação:', error.message);
    });
}
