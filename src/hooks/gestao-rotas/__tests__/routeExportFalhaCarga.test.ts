/**
 * Falha ao carregar o chunk da biblioteca (aba aberta antes de um deploy):
 * o import() rejeita e o usuário deve receber uma mensagem acionável.
 */

import { exportRotasToXLSX } from '../routeExportXLSX';

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/utils/errorHandling', () => ({
  showError: jest.fn(),
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-sharing', () => ({}));

// Fábrica que lança = import() rejeitando, como um chunk com 404.
jest.mock('xlsx', () => {
  throw new Error('Loading chunk xlsx failed');
});

const MENSAGEM = 'Atualize a página e tente exportar de novo.';

describe('falha de carga do chunk de exportação', () => {
  it('XLSX: mostra a mensagem de atualizar a página', async () => {
    const { showError } = require('@/utils/errorHandling');

    await exportRotasToXLSX({
      rotas: [
        {
          id: 'r1',
          data: '2026-01-15',
          status: 'concluida',
          distancia_total: 1,
          iniciada_em: null,
          concluida_em: null,
          motorista_id: 'm1',
          motorista_nome: 'João',
          paradas_count: 1,
          paradas_concluidas: 1,
        },
      ],
      filtroStatus: 'todas',
    });

    expect(showError).toHaveBeenCalledWith('Erro', MENSAGEM);
  });
});
