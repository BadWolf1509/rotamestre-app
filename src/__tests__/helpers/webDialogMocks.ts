import { Platform } from 'react-native';

type DialogHandlers = Record<string, (event: any) => void>;

export function setupWebDialogMocks() {
  const originalPlatform = Platform.OS;
  const originalDocument = global.document;
  const originalWindow = global.window;

  Object.defineProperty(Platform, 'OS', {
    get: () => 'web',
    configurable: true,
  });

  const handlers: DialogHandlers = {};

  const dialogMock: any = {
    open: false,
    showModal: jest.fn(() => {
      dialogMock.open = true;
    }),
    close: jest.fn(() => {
      dialogMock.open = false;
    }),
    addEventListener: jest.fn((event: string, handler: (event: any) => void) => {
      handlers[event] = handler;
    }),
    removeEventListener: jest.fn((event: string) => {
      delete handlers[event];
    }),
  };

  const doc = {
    body: { style: {} as Record<string, string> },
    head: { appendChild: jest.fn() },
    createElement: jest.fn(() => ({ style: {}, set id(_: string) {}, textContent: '' })),
    getElementById: jest.fn(() => null),
  };

  const win = {
    scrollY: 0,
    scrollTo: jest.fn(),
  };

  global.document = doc as any;
  global.window = win as any;

  const createNodeMock = (element: any) => {
    if (element.type === 'dialog') {
      return dialogMock;
    }
    return null;
  };

  const restore = () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => originalPlatform,
      configurable: true,
    });

    if (originalDocument) {
      global.document = originalDocument;
    } else {
      // @ts-expect-error - cleanup test env
      delete global.document;
    }

    if (originalWindow) {
      global.window = originalWindow;
    } else {
      // @ts-expect-error - cleanup test env
      delete global.window;
    }
  };

  return { dialogMock, handlers, createNodeMock, restore };
}
