import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { setupWebDialogMocks } from '@/__tests__/helpers/webDialogMocks';

jest.mock('react-dom', () => ({
  createPortal: jest.fn((element) => element),
}));

jest.mock('@/utils/styles', () => {
  const mockTheme = {
    colors: {
      primary: '#1f2937',
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray900: '#111827',
      white: '#ffffff',
    },
    spacing: { sm: 8, md: 12, lg: 16 },
    typography: {
      fontSansSemiBold: 'sans-semibold',
      fontSansBold: 'sans-bold',
      fontSize: { base: 16, lg: 18 },
      sm: 14,
    },
    borderRadius: { sm: 6, lg: 12 },
    shadows: { lg: {} },
    desktop: {
      button: { height: 32, paddingHorizontal: 12, fontSize: 13 },
      section: { padding: 12, gap: 8 },
      modal: { footerGap: 8, footerPadding: 12 },
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
    defaultTheme: mockTheme,
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

const getButtonText = (children: any): string => {
  if (typeof children === 'string') {
    return children;
  }
  if (Array.isArray(children)) {
    return children
      .map((child) => (typeof child === 'string' ? child : ''))
      .join('');
  }
  return '';
};

describe('DesktopModal web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('abre no web e renderiza botoes declarativos', () => {
    const onClose = jest.fn();
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    const { dialogMock, handlers, createNodeMock, restore } = setupWebDialogMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: true });

    const { DesktopModal } = require('../DesktopModal');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DesktopModal
          visible={true}
          onClose={onClose}
          title="Titulo"
          primaryButton={{ text: 'Salvar', onPress: onPrimary }}
          secondaryButton={{ text: 'Cancelar', onPress: onSecondary }}
          toast={{ message: 'Processando', visible: true, type: 'loading' }}
        >
          <Text>Conteudo</Text>
        </DesktopModal>,
        { createNodeMock }
      );
    });

    expect(dialogMock.showModal).toHaveBeenCalledTimes(1);

    const buttons = tree.root.findAllByType('button');
    const primaryButton = buttons.find((button) =>
      getButtonText(button.props.children).includes('Salvar')
    );
    const secondaryButton = buttons.find((button) =>
      getButtonText(button.props.children).includes('Cancelar')
    );

    act(() => {
      primaryButton?.props.onMouseEnter({ currentTarget: { style: {} } });
      primaryButton?.props.onMouseLeave({ currentTarget: { style: {} } });
      secondaryButton?.props.onMouseEnter({ currentTarget: { style: {} } });
      secondaryButton?.props.onMouseLeave({ currentTarget: { style: {} } });
    });

    act(() => {
      handlers.cancel?.({ preventDefault: jest.fn() });
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      handlers.click?.({ target: dialogMock });
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    act(() => {
      tree.update(
        <DesktopModal
          visible={false}
          onClose={onClose}
          title="Titulo"
          primaryButton={{ text: 'Salvar', onPress: onPrimary }}
        >
          <Text>Conteudo</Text>
        </DesktopModal>
      );
    });
    restore();
  });

  it('nao fecha ao clicar no backdrop quando closeOnOverlayPress=false', () => {
    const onClose = jest.fn();
    const { handlers, createNodeMock, restore } = setupWebDialogMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: true });

    const { DesktopModal } = require('../DesktopModal');

    act(() => {
      renderer.create(
        <DesktopModal visible={true} onClose={onClose} closeOnOverlayPress={false}>
          <Text>Conteudo</Text>
        </DesktopModal>,
        { createNodeMock }
      );
    });

    act(() => {
      handlers.click?.({ target: {} });
    });
    expect(onClose).not.toHaveBeenCalled();

    restore();
  });

  it('renderiza no web com botoes desabilitados', () => {
    const { createNodeMock, restore } = setupWebDialogMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: true });

    const { DesktopModal } = require('../DesktopModal');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          primaryButton={{ text: 'Salvar', onPress: jest.fn(), loading: true }}
          secondaryButton={{ text: 'Cancelar', onPress: jest.fn(), disabled: true }}
        >
          <Text>Conteudo</Text>
        </DesktopModal>,
        { createNodeMock }
      );
    });

    const buttons = tree.root.findAllByType('button');
    const actionButtons = buttons.filter((button) => {
      const text = getButtonText(button.props.children);
      return text.includes('Salvar') || text.includes('Cancelar');
    });

    actionButtons.forEach((button) => {
      expect(button.props.disabled).toBe(true);
    });

    restore();
  });

  it('renderiza no web com footer customizado', () => {
    const { createNodeMock, restore } = setupWebDialogMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: false });

    const { DesktopModal } = require('../DesktopModal');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DesktopModal
          visible={true}
          onClose={jest.fn()}
          footer={<Text>Footer</Text>}
        >
          <Text>Conteudo</Text>
        </DesktopModal>,
        { createNodeMock }
      );
    });

    const footerNodes = tree.root
      .findAllByType(Text)
      .filter((node) => node.props.children === 'Footer');
    expect(footerNodes).toHaveLength(1);

    restore();
  });
});
