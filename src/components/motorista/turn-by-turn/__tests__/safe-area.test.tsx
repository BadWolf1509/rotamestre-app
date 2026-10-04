/**
 * Em tela cheia o Turn-by-Turn desenha sob a barra de status e a barra de
 * navegação do sistema: os três componentes seguem os insets, não números fixos.
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { BottomPanel } from '../BottomPanel';
import { InstructionBar } from '../InstructionBar';
import { OffRouteAlerts } from '../OffRouteAlerts';

let mockInsets = { top: 40, bottom: 48, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

const flat = (node: unknown) =>
  StyleSheet.flatten((node as { props: { style: never } }).props.style) as {
    paddingTop?: number;
    paddingBottom?: number;
    top?: number;
  };

describe('Turn-by-Turn sob tela cheia', () => {
  beforeEach(() => {
    mockInsets = { top: 40, bottom: 48, left: 0, right: 0 };
  });

  it('BottomPanel: paddingBottom acompanha insets.bottom', () => {
    const props = {
      progress: 10,
      formattedRemainingDistance: '1 km',
      formattedRemainingTime: '3 min',
      speed: 0,
      voiceEnabled: true,
      onToggleVoice: jest.fn(),
      onExit: jest.fn(),
    };
    const a = flat(render(<BottomPanel {...props} />).toJSON());
    mockInsets = { ...mockInsets, bottom: 80 };
    const b = flat(render(<BottomPanel {...props} />).toJSON());

    expect(a.paddingBottom).toBeGreaterThanOrEqual(48);
    expect((b.paddingBottom ?? 0) - (a.paddingBottom ?? 0)).toBe(32);
  });

  it('InstructionBar: paddingTop acompanha insets.top', () => {
    const props = {
      currentInstruction: null,
      nextInstruction: null,
      formattedDistanceToTurn: '100 m',
      getManeuverIcon: () => 'arrow-up' as const,
    };
    const a = flat(render(<InstructionBar {...props} />).toJSON());
    mockInsets = { ...mockInsets, top: 70 };
    const b = flat(render(<InstructionBar {...props} />).toJSON());

    expect(a.paddingTop).toBeGreaterThanOrEqual(40);
    expect((b.paddingTop ?? 0) - (a.paddingTop ?? 0)).toBe(30);
  });

  it.each([
    ['warning', false],
    ['critical', false],
  ] as const)('OffRouteAlerts (%s): top acompanha insets.top', (status) => {
    const props = {
      offRouteStatus: status,
      distanceFromRoute: 80,
      isRecalculating: false,
      onReroute: jest.fn(),
    };
    const a = flat(render(<OffRouteAlerts {...props} />).toJSON());
    mockInsets = { ...mockInsets, top: 70 };
    const b = flat(render(<OffRouteAlerts {...props} />).toJSON());

    expect(a.top).toBeGreaterThan(40);
    expect((b.top ?? 0) - (a.top ?? 0)).toBe(30);
  });

  it('BottomPanel: o tempo é duração, rótulo "tempo" (não "chegada")', () => {
    const { getByText, queryByText } = render(
      <BottomPanel
        progress={10}
        formattedRemainingDistance="1 km"
        formattedRemainingTime="3 min"
        speed={0}
        voiceEnabled
        onToggleVoice={jest.fn()}
        onExit={jest.fn()}
      />,
    );
    expect(getByText('tempo')).toBeTruthy();
    expect(queryByText('chegada')).toBeNull();
  });
});
