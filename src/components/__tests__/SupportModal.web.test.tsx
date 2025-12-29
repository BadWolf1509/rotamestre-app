import React from 'react';
import { Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { setupWebDialogMocks } from '@/__tests__/helpers/webDialogMocks';

jest.mock('react-dom', () => ({
  createPortal: jest.fn((element) => element),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

const mockUseResponsive = require('@/hooks/useResponsive').useResponsive;
const mockCanOpenURL = jest.spyOn(Linking, 'canOpenURL');
const mockOpenURL = jest.spyOn(Linking, 'openURL');

describe('SupportModal web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanOpenURL.mockResolvedValue(true);
    mockOpenURL.mockResolvedValue(undefined);
  });

  it('abre e fecha o dialog e trata cancel/backdrop', async () => {
    const onClose = jest.fn();
    const { dialogMock, handlers, createNodeMock, restore } = setupWebDialogMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: true });

    const { SupportModal } = require('../SupportModal');

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SupportModal visible={true} onClose={onClose} />,
        { createNodeMock }
      );
    });

    expect(dialogMock.showModal).toHaveBeenCalledTimes(1);
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

    await act(async () => {
      tree.update(<SupportModal visible={false} onClose={onClose} />);
    });

    restore();
  });

  it('renderiza no web com isDesktop false', () => {
    const { createNodeMock, restore } = setupWebDialogMocks();
    mockUseResponsive.mockReturnValue({ isDesktop: false });

    const { SupportModal } = require('../SupportModal');

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <SupportModal visible={true} onClose={jest.fn()} />,
        { createNodeMock }
      );
    });

    const dialog = tree.root.findByType('dialog');
    expect(dialog.props.style.maxWidth).toBe(400);

    restore();
  });
});
