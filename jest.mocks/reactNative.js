function setupReactNativeMocks() {
  // Apenas garante listeners de window em ambiente jsdom
  const originalAddEventListener = global.window?.addEventListener;
  const originalRemoveEventListener = global.window?.removeEventListener;

  if (global.window) {
    global.window.addEventListener = jest.fn((...args) => {
      if (originalAddEventListener) {
        return originalAddEventListener.apply(global.window, args);
      }
    });

    global.window.removeEventListener = jest.fn((...args) => {
      if (originalRemoveEventListener) {
        return originalRemoveEventListener.apply(global.window, args);
      }
    });
  }
}

module.exports = { setupReactNativeMocks };
