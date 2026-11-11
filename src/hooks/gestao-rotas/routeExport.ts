/**
 * Route export utilities (CSV)
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { formatDateBR, formatDateTimeBR, getTodayISO } from '@/lib/dateUtils';
import { formatarDecimal } from '@/lib/formatNumber';
import { logger } from '@/lib/logger';
import type { IntervaloDatas } from '@/lib/periodo';
import { ROTA_STATUS_LABELS, type FiltroStatus } from '@/lib/statusLabels';
import { showError, showSuccess, showWarning } from '@/utils/errorHandling';

import { compartilharArquivo, registrarExportacao } from './exportacao';

import type { RotaHistorico } from './types';

interface ExportOptions {
  rotas: RotaHistorico[];
  filtroStatus: FiltroStatus;
  userId?: string;
  /** Período filtrado: entra no nome do arquivo. */
  periodo?: IntervaloDatas;
}

/**
 * Nome do arquivo exportado. Com período (as duas pontas), o intervalo no
 * nome (`gestao-rotas-01-11-2026_a_30-11-2026.csv`); sem período ("Todo o
 * período"), o dia da exportação. `hojeISO` só existe para os testes.
 */
export function nomeArquivoExportacao(
  intervalo: IntervaloDatas,
  extensao: 'csv' | 'xlsx',
  hojeISO: string = getTodayISO(),
): string {
  const dia = (iso: string) => formatDateBR(iso).replace(/\//g, '-');
  const sufixo =
    intervalo.de && intervalo.ate
      ? `${dia(intervalo.de)}_a_${dia(intervalo.ate)}`
      : dia(hojeISO);
  return `gestao-rotas-${sufixo}.${extensao}`;
}

/**
 * Export routes to CSV file
 * Handles both web (download) and mobile (share) platforms
 */
export async function exportRotasToCSV({
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

    const csvContent = buildCSVContent(rotas);
    const nomeArquivo = nomeArquivoExportacao(periodo, 'csv');

    if (Platform.OS === 'web') {
      downloadCSVWeb(csvContent, nomeArquivo);
    } else {
      await shareCSVMobile(csvContent, nomeArquivo);
    }

    // Log the export action
    if (userId) {
      registrarExportacao(userId, rotas.length, filtroStatus, 'csv');
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

/** Começo de célula que o Excel e o LibreOffice leem como fórmula. */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;
/** Não formam fórmula: o marcador "-" (sem valor) e número puro. */
const SEM_RISCO_DE_FORMULA = /^(-|-?\d+(?:[.,]\d+)?)$/;

/**
 * Célula entre aspas, com as aspas internas dobradas (RFC 4180) e fórmula
 * neutralizada por um apóstrofo na frente (OWASP, "CSV injection"): o nome do
 * motorista é texto livre e `=HYPERLINK(...)` viraria link clicável na
 * planilha do gestor. O XLSX não passa por aqui: o SheetJS grava string como
 * célula de texto, que não é avaliada (guarda em `routeExportXLSX.test.ts`).
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

  await compartilharArquivo(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: 'Exportar Relatório de Rotas',
    UTI: 'public.comma-separated-values-text',
  });
}
