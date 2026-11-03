/**
 * badgeDoStatusDaRota: o badge do cabeçalho mobile do mapa-rota lê a cor do
 * statusConfig (fonte única), com fundo claro por cor.
 */

import type { Theme } from '@/utils/styles';

import { badgeDoStatusDaRota } from '../badgeDoStatusDaRota';

const colors = {
  warning: '#f7a02a',
  warningBg: '#fef3c7',
  info: '#3b82f6',
  infoBg: '#dbeafe',
  success: '#10b981',
  successBg: '#d1fae5',
  error: '#ef4444',
  errorBg: '#fee2e2',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray600: '#4b5563',
  gray700: '#374151',
} as unknown as Theme['colors'];

describe('badgeDoStatusDaRota', () => {
  it('pendente: warning', () => {
    const r = badgeDoStatusDaRota(colors, 'pendente');
    expect(r.container.backgroundColor).toBe(colors.warningBg);
    expect(r.container.borderColor).toBe(colors.warning);
    expect(r.text.color).toBe(colors.warning);
  });

  it('em_andamento: info', () => {
    const r = badgeDoStatusDaRota(colors, 'em_andamento');
    expect(r.container.backgroundColor).toBe(colors.infoBg);
    expect(r.text.color).toBe(colors.info);
  });

  it('concluida: success', () => {
    const r = badgeDoStatusDaRota(colors, 'concluida');
    expect(r.container.backgroundColor).toBe(colors.successBg);
    expect(r.text.color).toBe(colors.success);
  });

  it('cancelada: error', () => {
    const r = badgeDoStatusDaRota(colors, 'cancelada');
    expect(r.container.backgroundColor).toBe(colors.errorBg);
    expect(r.text.color).toBe(colors.error);
  });

  it('nao_executada: error, igual ao desktop (antes era amarelo)', () => {
    const r = badgeDoStatusDaRota(colors, 'nao_executada');
    expect(r.container.backgroundColor).toBe(colors.errorBg);
    expect(r.container.borderColor).toBe(colors.error);
    expect(r.text.color).toBe(colors.error);
  });

  it("normaliza a caixa: 'CONCLUIDA' vira success", () => {
    const r = badgeDoStatusDaRota(colors, 'CONCLUIDA');
    expect(r.container.backgroundColor).toBe(colors.successBg);
  });

  it.each(['xyz', undefined, null])(
    'status %p cai no neutro, sem quebrar',
    (status) => {
      const r = badgeDoStatusDaRota(colors, status);
      expect(r.container.backgroundColor).toBe(colors.gray100);
      expect(r.container.borderColor).toBe(colors.gray200);
      expect(r.text.color).toBe(colors.gray700);
    },
  );
});
