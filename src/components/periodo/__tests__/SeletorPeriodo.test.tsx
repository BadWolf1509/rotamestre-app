import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Modal } from 'react-native';

import type { Periodo } from '@/lib/periodo';

import { SeletorPeriodo } from '../SeletorPeriodo';

let mockDesktop = false;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: mockDesktop, isMobile: !mockDesktop }),
}));

jest.mock('react-native-ui-datepicker', () => ({
  __esModule: true,
  default: jest.fn(() => null),
  useDefaultStyles: jest.fn(() => ({})),
}));
jest.mock('@react-native-community/datetimepicker', () => jest.fn(() => null));

const ROTULOS = [
  'Hoje',
  'Ontem',
  'Esta semana',
  'Semana passada',
  'Este mês',
  'Mês passado',
  'Personalizado',
  'Todo o período',
];

function montar(valor: Periodo, extra: { cortarEmHoje?: boolean } = {}) {
  const aoMudar = jest.fn();
  render(<SeletorPeriodo valor={valor} aoMudar={aoMudar} {...extra} />);
  return aoMudar;
}

beforeEach(() => {
  mockDesktop = false;
  jest.useFakeTimers({ now: new Date(2026, 10, 10, 12, 0, 0) });
});
afterEach(() => jest.useRealTimers());

describe('SeletorPeriodo', () => {
  it('o botão mostra o texto do período', () => {
    montar({ tipo: 'este_mes' });
    const botao = screen.getByTestId('seletor-periodo');
    expect(screen.getByText('Este mês (01/11 a 30/11)')).toBeTruthy();
    expect(botao.props.accessibilityRole).toBe('button');
    expect(botao.props.accessibilityLabel).toBe(
      'Período: Este mês (01/11 a 30/11)',
    );
  });

  it('com cortarEmHoje o botão mostra o intervalo cortado', () => {
    montar({ tipo: 'este_mes' }, { cortarEmHoje: true });
    expect(screen.getByText('Este mês (01/11 a 10/11)')).toBeTruthy();
  });

  it('com cortarEmHoje e período futuro mostra o texto sem corte', () => {
    montar(
      { tipo: 'personalizado', de: '2026-12-01', ate: '2026-12-31' },
      { cortarEmHoje: true },
    );
    expect(screen.getByText('Personalizado (01/12 a 31/12)')).toBeTruthy();
  });

  it('mostra os 8 rótulos na ordem (folha)', () => {
    montar({ tipo: 'este_mes' });
    fireEvent.press(screen.getByTestId('seletor-periodo'));
    const itens = screen.getAllByTestId(/^seletor-periodo-item-/);
    expect(itens.map((i) => i.props.testID)).toEqual([
      'seletor-periodo-item-hoje',
      'seletor-periodo-item-ontem',
      'seletor-periodo-item-esta_semana',
      'seletor-periodo-item-semana_passada',
      'seletor-periodo-item-este_mes',
      'seletor-periodo-item-mes_passado',
      'seletor-periodo-item-personalizado',
      'seletor-periodo-item-todo',
    ]);
    for (const r of ROTULOS)
      expect(screen.getAllByText(r).length).toBeGreaterThan(0);
  });

  it('tocar em "Mês passado" chama aoMudar e fecha', () => {
    const aoMudar = montar({ tipo: 'este_mes' });
    fireEvent.press(screen.getByTestId('seletor-periodo'));
    fireEvent.press(screen.getByTestId('seletor-periodo-item-mes_passado'));
    expect(aoMudar).toHaveBeenCalledWith({ tipo: 'mes_passado' });
    expect(screen.queryByTestId('seletor-periodo-item-hoje')).toBeNull();
  });

  it('Todo o período chama aoMudar', () => {
    const aoMudar = montar({ tipo: 'este_mes' });
    fireEvent.press(screen.getByTestId('seletor-periodo'));
    fireEvent.press(screen.getByTestId('seletor-periodo-item-todo'));
    expect(aoMudar).toHaveBeenCalledWith({ tipo: 'todo' });
  });

  it('toque fora fecha sem mudar', () => {
    const aoMudar = montar({ tipo: 'este_mes' });
    fireEvent.press(screen.getByTestId('seletor-periodo'));
    fireEvent.press(screen.getByTestId('seletor-periodo-fora'));
    expect(screen.queryByTestId('seletor-periodo-item-hoje')).toBeNull();
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('Esc (onRequestClose) fecha sem mudar', () => {
    const aoMudar = montar({ tipo: 'este_mes' });
    fireEvent.press(screen.getByTestId('seletor-periodo'));
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
    expect(screen.queryByTestId('seletor-periodo-item-hoje')).toBeNull();
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('no computador abre o menu com os mesmos itens', () => {
    mockDesktop = true;
    const aoMudar = montar({ tipo: 'este_mes' });
    fireEvent.press(screen.getByTestId('seletor-periodo'));
    expect(screen.getAllByTestId(/^seletor-periodo-item-/)).toHaveLength(8);
    fireEvent.press(screen.getByTestId('seletor-periodo-item-ontem'));
    expect(aoMudar).toHaveBeenCalledWith({ tipo: 'ontem' });
  });

  describe('Personalizado', () => {
    it('sem datas, Aplicar fica desabilitado', () => {
      const aoMudar = montar({ tipo: 'este_mes' });
      fireEvent.press(screen.getByTestId('seletor-periodo'));
      fireEvent.press(screen.getByTestId('seletor-periodo-item-personalizado'));
      const aplicar = screen.getByTestId('seletor-periodo-aplicar');
      expect(aplicar.props.accessibilityState.disabled).toBe(true);
      fireEvent.press(aplicar);
      expect(aoMudar).not.toHaveBeenCalled();
    });

    it('com de > ate, Aplicar fica desabilitado', () => {
      const aoMudar = montar({
        tipo: 'personalizado',
        de: '2026-11-10',
        ate: '2026-11-01',
      });
      fireEvent.press(screen.getByTestId('seletor-periodo'));
      fireEvent.press(screen.getByTestId('seletor-periodo-item-personalizado'));
      const aplicar = screen.getByTestId('seletor-periodo-aplicar');
      expect(aplicar.props.accessibilityState.disabled).toBe(true);
      fireEvent.press(aplicar);
      expect(aoMudar).not.toHaveBeenCalled();
    });

    it('com datas válidas, Aplicar chama aoMudar e fecha', () => {
      const aoMudar = montar({
        tipo: 'personalizado',
        de: '2026-10-01',
        ate: '2026-10-15',
      });
      fireEvent.press(screen.getByTestId('seletor-periodo'));
      fireEvent.press(screen.getByTestId('seletor-periodo-item-personalizado'));
      const aplicar = screen.getByTestId('seletor-periodo-aplicar');
      expect(aplicar.props.accessibilityState.disabled).toBe(false);
      act(() => {
        fireEvent.press(aplicar);
      });
      expect(aoMudar).toHaveBeenCalledWith({
        tipo: 'personalizado',
        de: '2026-10-01',
        ate: '2026-10-15',
      });
      expect(screen.queryByTestId('seletor-periodo-aplicar')).toBeNull();
    });
  });
});
