/**
 * useProfileDialogs - Tests
 *
 * Tests cross-platform alert/confirm dialog state management.
 * On web: uses React state for custom dialog components.
 * On mobile: delegates to native Alert.alert.
 */

import { renderHook, act } from "@testing-library/react-native";
import { Platform, Alert } from "react-native";

import { useProfileDialogs } from "../useProfileDialogs";

const originalPlatformOS = Platform.OS;

describe("useProfileDialogs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      value: originalPlatformOS,
      writable: true,
    });
  });

  describe("initial state", () => {
    it("returns confirmDialog as not visible", () => {
      const { result } = renderHook(() => useProfileDialogs());

      expect(result.current.confirmDialog.visible).toBe(false);
      expect(result.current.confirmDialog.title).toBe("");
      expect(result.current.confirmDialog.message).toBe("");
      expect(typeof result.current.confirmDialog.onConfirm).toBe("function");
    });

    it("returns alertDialog as not visible", () => {
      const { result } = renderHook(() => useProfileDialogs());

      expect(result.current.alertDialog.visible).toBe(false);
      expect(result.current.alertDialog.title).toBe("");
      expect(result.current.alertDialog.message).toBe("");
      expect(result.current.alertDialog.type).toBe("default");
    });

    it("returns all functions", () => {
      const { result } = renderHook(() => useProfileDialogs());

      expect(typeof result.current.closeConfirmDialog).toBe("function");
      expect(typeof result.current.closeAlertDialog).toBe("function");
      expect(typeof result.current.showAlert).toBe("function");
      expect(typeof result.current.showConfirm).toBe("function");
    });
  });

  describe("showAlert (web)", () => {
    beforeEach(() => {
      Object.defineProperty(Platform, "OS", { value: "web", writable: true });
    });

    it("sets alertDialog state with default type", () => {
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showAlert("Titulo", "Mensagem");
      });

      expect(result.current.alertDialog.visible).toBe(true);
      expect(result.current.alertDialog.title).toBe("Titulo");
      expect(result.current.alertDialog.message).toBe("Mensagem");
      expect(result.current.alertDialog.type).toBe("default");
    });

    it("sets alertDialog state with custom type", () => {
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showAlert("Erro", "Algo deu errado", "error");
      });

      expect(result.current.alertDialog.visible).toBe(true);
      expect(result.current.alertDialog.type).toBe("error");
    });

    it("supports all alert types", () => {
      const { result } = renderHook(() => useProfileDialogs());

      const types: Array<"default" | "error" | "success" | "warning"> = [
        "default",
        "error",
        "success",
        "warning",
      ];

      for (const type of types) {
        act(() => {
          result.current.showAlert("Title", "Message", type);
        });
        expect(result.current.alertDialog.type).toBe(type);
      }
    });

    it("does not call native Alert.alert on web", () => {
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showAlert("Titulo", "Mensagem");
      });

      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe("showAlert (mobile)", () => {
    beforeEach(() => {
      Object.defineProperty(Platform, "OS", {
        value: "android",
        writable: true,
      });
    });

    it("calls native Alert.alert on mobile", () => {
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showAlert("Titulo", "Mensagem");
      });

      expect(Alert.alert).toHaveBeenCalledWith("Titulo", "Mensagem");
    });

    it("does not set alertDialog state on mobile", () => {
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showAlert("Titulo", "Mensagem");
      });

      expect(result.current.alertDialog.visible).toBe(false);
    });
  });

  describe("closeAlertDialog", () => {
    beforeEach(() => {
      Object.defineProperty(Platform, "OS", { value: "web", writable: true });
    });

    it("sets alertDialog visible to false", () => {
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showAlert("Titulo", "Mensagem");
      });

      expect(result.current.alertDialog.visible).toBe(true);

      act(() => {
        result.current.closeAlertDialog();
      });

      expect(result.current.alertDialog.visible).toBe(false);
    });

    it("preserves other alert dialog fields when closing", () => {
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showAlert("Titulo", "Mensagem", "error");
      });

      act(() => {
        result.current.closeAlertDialog();
      });

      expect(result.current.alertDialog.title).toBe("Titulo");
      expect(result.current.alertDialog.message).toBe("Mensagem");
      expect(result.current.alertDialog.type).toBe("error");
    });
  });

  describe("showConfirm (web)", () => {
    beforeEach(() => {
      Object.defineProperty(Platform, "OS", { value: "web", writable: true });
    });

    it("sets confirmDialog state", () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showConfirm("Confirmar?", "Tem certeza?", onConfirm);
      });

      expect(result.current.confirmDialog.visible).toBe(true);
      expect(result.current.confirmDialog.title).toBe("Confirmar?");
      expect(result.current.confirmDialog.message).toBe("Tem certeza?");
    });

    it("onConfirm closes dialog and calls original callback", () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showConfirm("Confirmar?", "Tem certeza?", onConfirm);
      });

      // Call the wrapped onConfirm
      act(() => {
        result.current.confirmDialog.onConfirm();
      });

      expect(result.current.confirmDialog.visible).toBe(false);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("does not call native Alert.alert on web", () => {
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showConfirm("Confirmar?", "Tem certeza?", jest.fn());
      });

      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe("showConfirm (mobile)", () => {
    beforeEach(() => {
      Object.defineProperty(Platform, "OS", { value: "ios", writable: true });
    });

    it("calls native Alert.alert with cancel/confirm buttons", () => {
      const onConfirm = jest.fn();
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showConfirm("Confirmar?", "Tem certeza?", onConfirm);
      });

      expect(Alert.alert).toHaveBeenCalledWith("Confirmar?", "Tem certeza?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: onConfirm },
      ]);
    });

    it("does not set confirmDialog state on mobile", () => {
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showConfirm("Confirmar?", "Tem certeza?", jest.fn());
      });

      expect(result.current.confirmDialog.visible).toBe(false);
    });
  });

  describe("closeConfirmDialog", () => {
    beforeEach(() => {
      Object.defineProperty(Platform, "OS", { value: "web", writable: true });
    });

    it("sets confirmDialog visible to false", () => {
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showConfirm("Titulo", "Msg", jest.fn());
      });

      expect(result.current.confirmDialog.visible).toBe(true);

      act(() => {
        result.current.closeConfirmDialog();
      });

      expect(result.current.confirmDialog.visible).toBe(false);
    });

    it("preserves other confirm dialog fields when closing", () => {
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showConfirm("Titulo", "Mensagem", jest.fn());
      });

      act(() => {
        result.current.closeConfirmDialog();
      });

      expect(result.current.confirmDialog.title).toBe("Titulo");
      expect(result.current.confirmDialog.message).toBe("Mensagem");
    });
  });

  describe("reset flow", () => {
    beforeEach(() => {
      Object.defineProperty(Platform, "OS", { value: "web", writable: true });
    });

    it("can open alert, close it, and open again", () => {
      const { result } = renderHook(() => useProfileDialogs());

      act(() => {
        result.current.showAlert("First", "First msg");
      });
      expect(result.current.alertDialog.visible).toBe(true);

      act(() => {
        result.current.closeAlertDialog();
      });
      expect(result.current.alertDialog.visible).toBe(false);

      act(() => {
        result.current.showAlert("Second", "Second msg", "success");
      });
      expect(result.current.alertDialog.visible).toBe(true);
      expect(result.current.alertDialog.title).toBe("Second");
      expect(result.current.alertDialog.type).toBe("success");
    });

    it("can open confirm, close it, and open again with different callback", () => {
      const { result } = renderHook(() => useProfileDialogs());
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      act(() => {
        result.current.showConfirm("First", "Msg", callback1);
      });

      act(() => {
        result.current.closeConfirmDialog();
      });

      act(() => {
        result.current.showConfirm("Second", "Msg2", callback2);
      });

      act(() => {
        result.current.confirmDialog.onConfirm();
      });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });
});
