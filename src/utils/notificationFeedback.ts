import { Platform } from "react-native";

import type { Notificacao } from "@/types/notifications";
import { notifyGenericWeb } from "@/utils/browserNotification";
import { warningHaptic } from "@/utils/haptics";
import { playNotificationSound } from "@/utils/notificationSound";
import { toast } from "@/utils/toast";

/**
 * Triggers multi-platform feedback for a new notification:
 * - Web: browser notification + sound
 * - Mobile: haptic + sound
 * - Both: in-app toast
 */
export function triggerNewNotificationFeedback(notification: Notificacao) {
  if (Platform.OS === "web") {
    notifyGenericWeb(
      notification.titulo,
      notification.mensagem || "Nova notificação",
    );
    playNotificationSound();
  } else {
    warningHaptic();
    playNotificationSound();
  }
  toast.info(notification.mensagem || "Nova notificação", notification.titulo);
}
