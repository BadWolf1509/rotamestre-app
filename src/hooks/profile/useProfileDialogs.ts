import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";

import type { AlertDialogState, ConfirmDialogState } from "./types";

/**
 * Manages cross-platform alert/confirm dialogs.
 * On web: uses React state for custom dialog components.
 * On mobile: uses native Alert.alert.
 */
export function useProfileDialogs() {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, visible: false }));
  }, []);

  const [alertDialog, setAlertDialog] = useState<AlertDialogState>({
    visible: false,
    title: "",
    message: "",
    type: "default",
  });

  const closeAlertDialog = useCallback(() => {
    setAlertDialog((prev) => ({ ...prev, visible: false }));
  }, []);

  const showAlert = useCallback(
    (
      title: string,
      message: string,
      type: AlertDialogState["type"] = "default",
    ) => {
      if (Platform.OS === "web") {
        setAlertDialog({ visible: true, title, message, type });
      } else {
        Alert.alert(title, message);
      }
    },
    [],
  );

  const showConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      if (Platform.OS === "web") {
        setConfirmDialog({
          visible: true,
          title,
          message,
          onConfirm: () => {
            setConfirmDialog((prev) => ({ ...prev, visible: false }));
            onConfirm();
          },
        });
      } else {
        Alert.alert(title, message, [
          { text: "Cancelar", style: "cancel" },
          { text: "Confirmar", onPress: onConfirm },
        ]);
      }
    },
    [],
  );

  return {
    confirmDialog,
    closeConfirmDialog,
    alertDialog,
    closeAlertDialog,
    showAlert,
    showConfirm,
  };
}
