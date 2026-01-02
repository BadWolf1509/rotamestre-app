import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { setupWebDialogMocks } from '@/__tests__/helpers/webDialogMocks';

jest.mock('react-dom', () => ({
  createPortal: jest.fn((element) => element),
}));

jest.mock('@/utils/styles', () => {
  const mockTheme = {
    colors: {
      primary: '#1f2937',
      error: '#dc2626',
      success: '#16a34a',
      warning: '#d97706',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray900: '#111827',
      white: '#ffffff',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
    typography: {
      fontSans: 'sans',
      fontSansBold: 'sans-bold',
      fontSansSemiBold: 'sans-semibold',
      fontSize: { base: 16, sm: 14, lg: 18, xl: 20 },
    },
    borderRadius: { md: 8, xl: 12, full: 9999 },
    shadows: { lg: {} },
    desktop: {
      button: { fontSize: 13 },
      dialog: {
        maxWidth: 320,
        containerPadding: 16,
        iconCircleSize: 44,
        iconSize: 22,
        titleFontSize: 16,
        messageFontSize: 13,
        buttonHeight: 36,
        buttonPaddingV: 8,
        buttonPaddingH: 14,
        buttonGap: 10,
      },
    },
    components: {
      dialog: {
        buttonPaddingV: 10,
        buttonPaddingH: 16,
        buttonGap: 12,
      },
    },
  };

  return {
    StyleSheet: {
      create: (styles: any) =>
        typeof styles === 'function' ? styles(mockTheme) : styles,
    },
    useUnistyles: () => ({ theme: mockTheme }),
  };
});

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

const mockUseResponsive = require('@/hooks/useResponsive').useResponsive;

describe('AlertDialog web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('abre e fecha no web e trata cancel/backdrop', () => {
    const onConfirm = jest.fn();
    const { dialogMock, handlers, createNodeMock, restore } = setupWebDialogMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: true });

    const { AlertDialog } = require('../AlertDialog');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AlertDialog
          visible={true}
          title="Titulo"
          message="Mensagem"
          onConfirm={onConfirm}
        />,
        { createNodeMock }
      );
    });

    expect(dialogMock.showModal).toHaveBeenCalledTimes(1);

    act(() => {
      handlers.cancel?.({ preventDefault: jest.fn() });
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    act(() => {
      handlers.click?.({ target: dialogMock });
    });
    expect(onConfirm).toHaveBeenCalledTimes(2);

    act(() => {
      handlers.click?.({ target: {} });
    });
    expect(onConfirm).toHaveBeenCalledTimes(2);

    act(() => {
      tree.update(
        <AlertDialog
          visible={false}
          title="Titulo"
          message="Mensagem"
          onConfirm={onConfirm}
        />
      );
    });

    restore();
  });

  it('renderiza com isDesktop false e tipo warning', () => {
    const onConfirm = jest.fn();
    const { createNodeMock, restore } = setupWebDialogMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: false });

    const { AlertDialog } = require('../AlertDialog');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AlertDialog
          visible={true}
          title="Aviso"
          message="Mensagem"
          confirmText="OK"
          type="warning"
          onConfirm={onConfirm}
        />,
        { createNodeMock }
      );
    });

    expect(tree.toJSON()).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();

    restore();
  });
});
