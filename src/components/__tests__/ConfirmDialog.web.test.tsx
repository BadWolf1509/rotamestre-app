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
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray500: '#6b7280',
      gray900: '#111827',
      white: '#ffffff',
    },
    spacing: { sm: 8, md: 12, lg: 16, xl: 20 },
    typography: {
      fontSans: 'sans',
      fontSansBold: 'sans-bold',
      fontSansSemiBold: 'sans-semibold',
      fontSize: { base: 16, sm: 14, xl: 20 },
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

describe('ConfirmDialog web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('abre e fecha no web e trata cancel/backdrop', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { dialogMock, handlers, createNodeMock, restore } = setupWebDialogMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: true });

    const { ConfirmDialog } = require('../ConfirmDialog');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ConfirmDialog
          visible={true}
          title="Confirmar"
          message="Mensagem"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
        { createNodeMock }
      );
    });

    expect(dialogMock.showModal).toHaveBeenCalledTimes(1);

    act(() => {
      handlers.cancel?.({ preventDefault: jest.fn() });
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    act(() => {
      handlers.click?.({ target: dialogMock });
    });
    expect(onCancel).toHaveBeenCalledTimes(2);

    act(() => {
      handlers.click?.({ target: {} });
    });
    expect(onCancel).toHaveBeenCalledTimes(2);

    act(() => {
      tree.update(
        <ConfirmDialog
          visible={false}
          title="Confirmar"
          message="Mensagem"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );
    });

    restore();
  });

  it('renderiza com isDesktop false e tipo success', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { createNodeMock, restore } = setupWebDialogMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: false });

    const { ConfirmDialog } = require('../ConfirmDialog');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ConfirmDialog
          visible={true}
          title="Sucesso"
          message="Mensagem"
          type="success"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
        { createNodeMock }
      );
    });

    expect(tree.toJSON()).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();

    restore();
  });
});
