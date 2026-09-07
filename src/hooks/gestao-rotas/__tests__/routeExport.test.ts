/**
 * routeExport - Tests
 */

import { Platform } from 'react-native';

import { exportRotasToCSV } from '../routeExport';

import type { RotaHistorico } from '../types';

// Mock dependencies
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

jest.mock('@/utils/errorHandling', () => ({
  showError: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/test-docs/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: {
    UTF8: 'utf8',
  },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockRota: RotaHistorico = {
  id: 'route-1',
  data: '2026-01-15',
  status: 'concluida',
  distancia_total: 42.5,
  iniciada_em: '2026-01-15T08:00:00Z',
  concluida_em: '2026-01-15T12:30:00Z',
  motorista_id: 'driver-1',
  motorista_nome: 'João Silva',
  paradas_count: 10,
  paradas_concluidas: 10,
};

describe('routeExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportRotasToCSV', () => {
    it('shows warning when no routes to export', async () => {
      const { showWarning } = require('@/utils/errorHandling');

      await exportRotasToCSV({
        rotas: [],
        filtroStatus: 'todas',
      });

      expect(showWarning).toHaveBeenCalledWith(
        'Atenção',
        'Não há rotas para exportar',
      );
    });

    describe('web platform', () => {
      beforeEach(() => {
        Object.defineProperty(Platform, 'OS', { value: 'web' });
        // Mock document methods for web
        (global as any).document = {
          createElement: jest.fn(() => ({
            setAttribute: jest.fn(),
            click: jest.fn(),
            style: {},
          })),
          body: {
            appendChild: jest.fn(),
            removeChild: jest.fn(),
          },
        };
        (global as any).URL = {
          createObjectURL: jest.fn(() => 'blob:test'),
          revokeObjectURL: jest.fn(),
        };
        (global as any).Blob = jest.fn((content) => ({ content }));
      });

      afterEach(() => {
        delete (global as any).document;
        delete (global as any).URL;
        delete (global as any).Blob;
      });

      it('creates and downloads CSV file on web', async () => {
        const { showSuccess } = require('@/utils/errorHandling');

        await exportRotasToCSV({
          rotas: [mockRota],
          filtroStatus: 'todas',
        });

        expect((global as any).document.createElement).toHaveBeenCalledWith(
          'a',
        );
        expect((global as any).URL.createObjectURL).toHaveBeenCalled();
        expect(showSuccess).toHaveBeenCalledWith(
          'Sucesso',
          '1 rotas exportadas com sucesso!',
        );
      });

      /**
       * O arquivo carrega BOM "for Excel" e datas em dd/mm/aaaa, mas gerava
       * numero com ponto decimal e separava campo por virgula — metade pt-BR,
       * metade en-US. No Excel pt-BR o separador de lista do sistema e `;`, e
       * o decimal e a virgula: do jeito antigo a coluna de distancia nao
       * somava, e o arquivo tendia a cair todo numa coluna so.
       */
      describe('formato pt-BR do conteudo', () => {
        function csvGerado(): string {
          const chamada = ((global as any).Blob as jest.Mock).mock.calls[0];
          return chamada[0][0] as string;
        }

        it('usa ponto e virgula como separador de campo', async () => {
          await exportRotasToCSV({ rotas: [mockRota], filtroStatus: 'todas' });

          const [cabecalho] = csvGerado().split('\n');
          expect(cabecalho).toContain('"Data";"Motorista"');
        });

        it('usa virgula como separador decimal na distancia', async () => {
          await exportRotasToCSV({ rotas: [mockRota], filtroStatus: 'todas' });

          // 42.5 no dado -> "42,5" na celula.
          expect(csvGerado()).toContain('"42,5"');
          expect(csvGerado()).not.toContain('"42.5"');
        });

        it('mantem o BOM, que e o que diz ao Excel que o arquivo e UTF-8', async () => {
          await exportRotasToCSV({ rotas: [mockRota], filtroStatus: 'todas' });

          expect(csvGerado().startsWith('\uFEFF')).toBe(true);
        });

        it('aspas na celula continuam existindo, senao um nome com ; quebraria a linha', async () => {
          await exportRotasToCSV({
            rotas: [{ ...mockRota, motorista_nome: 'Silva; Joao' }],
            filtroStatus: 'todas',
          });

          expect(csvGerado()).toContain('"Silva; Joao"');
        });
      });

      it('logs export action when userId is provided', async () => {
        const { supabase } = require('@/lib/supabase');

        await exportRotasToCSV({
          rotas: [mockRota],
          filtroStatus: 'concluidas',
          userId: 'user-123',
        });

        expect(supabase.from).toHaveBeenCalledWith('logs');
      });
    });

    describe('mobile platform', () => {
      beforeEach(() => {
        Object.defineProperty(Platform, 'OS', { value: 'ios' });
      });

      it('shares CSV file on mobile', async () => {
        const Sharing = require('expo-sharing');
        const FileSystem = require('expo-file-system/legacy');

        await exportRotasToCSV({
          rotas: [mockRota],
          filtroStatus: 'todas',
        });

        expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
        expect(Sharing.shareAsync).toHaveBeenCalled();
      });

      it('shows file path when sharing is not available', async () => {
        const Sharing = require('expo-sharing');
        const { showInfo } = require('@/utils/errorHandling');
        Sharing.isAvailableAsync.mockResolvedValueOnce(false);

        await exportRotasToCSV({
          rotas: [mockRota],
          filtroStatus: 'todas',
        });

        expect(showInfo).toHaveBeenCalledWith(
          'Arquivo Salvo',
          expect.stringContaining('/test-docs/'),
        );
      });
    });

    it('handles export errors gracefully', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web' });
      const { showError } = require('@/utils/errorHandling');
      // Remove document to cause error
      delete (global as any).document;

      await exportRotasToCSV({
        rotas: [mockRota],
        filtroStatus: 'todas',
      });

      const { logger } = require('@/lib/logger');
      expect(logger.error).toHaveBeenCalled();
      expect(showError).toHaveBeenCalledWith(
        'Erro',
        'Não foi possível exportar os dados',
      );
    });
  });
});
