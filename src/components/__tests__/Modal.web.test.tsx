import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { setupWebDialogMocks } from '@/__tests__/helpers/webDialogMocks';

jest.mock('react-dom', () => ({
  createPortal: jest.fn((element) => element),
}));

jest.mock('@/utils/styles', () => {
  const mockTheme = {
    colors: {
      white: '#ffffff',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray500: '#6b7280',
      gray900: '#111827',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
    typography: {
      fontSans: 'sans',
      fontSansBold: 'sans-bold',
      fontSize: { base: 16, lg: 18 },
    },
    borderRadius: { sm: 6, xl: 12 },
    shadows: { lg: {} },
    desktop: {
      modal: {
        headerPadding: 12,
        bodyPadding: 12,
        titleFontSize: 15,
        closeButtonSize: 20,
      },
    },
  };

  return {
    StyleSheet: {
      create: (styles: any) =>
        typeof styles === 'function' ? styles(mockTheme) : styles,
      absoluteFillObject: {},
      absoluteFill: {},
      hairlineWidth: 1,
      flatten: (style: any) => style,
    },
    useUnistyles: () => ({ theme: mockTheme }),
  };
});

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

const mockUseResponsive = require('@/hooks/useResponsive').useResponsive;

describe('Modal web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('abre e fecha no web com size full', () => {
    const onClose = jest.fn();
    const { dialogMock, handlers, createNodeMock, restore } = setupWebDialogMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: true });

    const { Modal } = require('../Modal');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <Modal visible={true} onClose={onClose} title="Titulo" size="full">
          Conteudo
        </Modal>,
        { createNodeMock }
      );
    });

    expect(dialogMock.showModal).toHaveBeenCalledTimes(1);

    act(() => {
      handlers.cancel?.({ preventDefault: jest.fn() });
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      handlers.click?.({ target: dialogMock });
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    act(() => {
      handlers.click?.({ target: {} });
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    const closeButton = tree.root.findByType('button');
    act(() => {
      closeButton.props.onClick();
    });
    expect(onClose).toHaveBeenCalledTimes(3);

    act(() => {
      tree.update(
        <Modal visible={false} onClose={onClose} title="Titulo" size="full">
          Conteudo
        </Modal>
      );
    });
    restore();
  });

  it('renderiza no web sem header quando title e close button estao ocultos', () => {
    const { createNodeMock, restore } = setupWebDialogMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: false });

    const { Modal } = require('../Modal');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <Modal visible={true} onClose={jest.fn()} showCloseButton={false} size="small">
          Conteudo
        </Modal>,
        { createNodeMock }
      );
    });

    const dialogs = tree.root.findAllByType('dialog');
    expect(dialogs.length).toBe(1);

    restore();
  });
});
