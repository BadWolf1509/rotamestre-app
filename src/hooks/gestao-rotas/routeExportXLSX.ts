/**
 * Route export utilities (XLSX / Excel)
 *
 * xlsx é carregado sob demanda com import() dinâmico na entrada da função, então
 * o peso (~0,16 MB gzip, chunk próprio no web) só é pago quando o usuário exporta.
 * Nos testes, o plugin do `env.test` em babel.config.js troca o import() por
 * require(), e o jest.mock("xlsx", ...) o intercepta.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { formatDateBR, formatDateTimeBR } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import type { IntervaloDatas } from '@/lib/periodo';
import { ROTA_STATUS_LABELS, type FiltroStatus } from '@/lib/statusLabels';
import { showError, showSuccess, showWarning } from '@/utils/errorHandling';

import {
  FalhaCargaBibliotecaError,
  MENSAGEM_FALHA_CARGA,
  carregarBiblioteca,
} from './carregarBiblioteca';
import { compartilharArquivo, registrarExportacao } from './exportacao';
import { nomeArquivoExportacao } from './routeExport';

import type { RotaHistorico } from './types';

// -----------------------------------------------------------------------
// MIME type constant so it is never duplicated across the file
// -----------------------------------------------------------------------
const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

interface ExportOptions {
  rotas: RotaHistorico[];
  filtroStatus: FiltroStatus;
  userId?: string;
  /** Período filtrado: entra no nome do arquivo. */
  periodo?: IntervaloDatas;
}

/**
 * Export routes to XLSX (Excel) file.
 * Handles both web (Blob download) and mobile (base64 + expo-sharing).
 */
export async function exportRotasToXLSX({
  rotas,
  filtroStatus,
  userId,
  periodo = { de: null, ate: null },
}: ExportOptions): Promise<void> {
  try {
    if (rotas.length === 0) {
      showWarning('Atenção', 'Não há rotas para exportar');
      return;
    }

    // Carga sob demanda: import() dinâmico mantém o xlsx fora do bundle de
    // entrada do web. O módulo é CJS; normaliza o default do interop ESM.
    // jest.mock("xlsx", ...) intercepta o import() nos testes.
    const xlsxModulo = await carregarBiblioteca(() => import('xlsx'));
    const XLSX = (xlsxModulo.default ?? xlsxModulo) as typeof xlsxModulo;

    const sheetData = buildSheetData(rotas);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Rotas');

    const nomeArquivo = nomeArquivoExportacao(periodo, 'xlsx');

    if (Platform.OS === 'web') {
      downloadXLSXWeb(XLSX, wb, nomeArquivo);
    } else {
      await shareXLSXMobile(XLSX, wb, nomeArquivo);
    }

    if (userId) {
      registrarExportacao(userId, rotas.length, filtroStatus, 'xlsx');
    }

    if (Platform.OS === 'web') {
      showSuccess('Sucesso', `${rotas.length} rotas exportadas com sucesso!`);
    }
  } catch (error) {
    logger.error('Erro ao exportar XLSX:', error);
    if (error instanceof FalhaCargaBibliotecaError) {
      showError('Erro', MENSAGEM_FALHA_CARGA);
      return;
    }
    showError('Erro', 'Não foi possível exportar os dados');
  }
}

// -----------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------

/**
 * Build the array-of-arrays for the worksheet (header + data rows).
 * Column names are in PT-BR to match the CSV export style.
 */
function buildSheetData(rotas: RotaHistorico[]): unknown[][] {
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
    rota.distancia_total ? Number(rota.distancia_total.toFixed(1)) : null,
    formatDateTimeBR(rota.iniciada_em, { showYear: true }),
    formatDateTimeBR(rota.concluida_em, { showYear: true }),
    ROTA_STATUS_LABELS[rota.status] || rota.status,
  ]);

  return [headers, ...rows];
}

/**
 * Trigger browser download of the workbook as .xlsx.
 */
function downloadXLSXWeb(
  XLSX: typeof import('xlsx'),
  wb: import('xlsx').WorkBook,
  fileName: string,
): void {
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });
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
 * Write the workbook to a temp file and share it via expo-sharing.
 */
async function shareXLSXMobile(
  XLSX: typeof import('xlsx'),
  wb: import('xlsx').WorkBook,
  fileName: string,
): Promise<void> {
  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }) as string;
  const fileUri = FileSystem.documentDirectory + fileName;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await compartilharArquivo(fileUri, {
    mimeType: XLSX_MIME_TYPE,
    dialogTitle: 'Exportar Relatório de Rotas (Excel)',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
}
