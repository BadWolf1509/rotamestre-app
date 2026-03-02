/**
 * Hook to handle session recovery on the password reset screen.
 *
 * Checks for error params from Supabase redirect (expired OTP, access denied)
 * and proactively verifies session when arriving from a recovery redirect.
 *
 * IMPORTANT: Uses onAuthStateChange (not getSession) to detect the session.
 * getSession() can return null due to a race condition in auth-js where the
 * SDK hasn't finished processing the URL hash tokens yet.
 * Ref: https://github.com/orgs/supabase/discussions/19608
 */

import { useEffect, useState } from "react";
import { Platform } from "react-native";

import {
  getHashErrorParams,
  hasRecoveryParamsInCurrentUrl,
  trySessionRecoveryFromUrl,
} from "@/lib/auth/sessionRecovery";
import { logger } from "@/lib/logger";
import { isRecoveryRedirect, supabase } from "@/lib/supabase";

interface UseSessionRecoveryResult {
  checkingSession: boolean;
  linkExpired: boolean;
  setLinkExpired: (value: boolean) => void;
}

export function useSessionRecovery(): UseSessionRecoveryResult {
  const [linkExpired, setLinkExpired] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);

  useEffect(() => {
    const { error, errorCode } = getHashErrorParams();
    if (errorCode === "otp_expired" || error === "access_denied") {
      setLinkExpired(true);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname);
      }
      return;
    }

    const shouldCheckRecoverySession =
      Platform.OS === "web" &&
      (isRecoveryRedirect || hasRecoveryParamsInCurrentUrl());

    if (!shouldCheckRecoverySession) return;

    setCheckingSession(true);
    let resolved = false;

    const resolveWithRecoveryAttempt = async () => {
      if (resolved) return;
      const recovered = await trySessionRecoveryFromUrl();

      if (resolved) return;
      resolved = true;
      if (!recovered) {
        setLinkExpired(true);
      }
      setCheckingSession(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolved) return;

      if (event === "PASSWORD_RECOVERY") {
        resolved = true;
        setCheckingSession(false);
        return;
      }

      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        resolved = true;
        setCheckingSession(false);
        return;
      }

      if (event === "INITIAL_SESSION" && !session) {
        logger.debug(
          "[ResetPassword] INITIAL_SESSION without session, trying manual recovery",
        );
        // Run outside auth-js callback lock to avoid deadlock with setSession/exchange calls.
        setTimeout(() => {
          void resolveWithRecoveryAttempt();
        }, 0);
      }
    });

    // Safety timeout: if no auth event establishes a session within 10s, give up
    const timeout = setTimeout(() => {
      if (!resolved) {
        void resolveWithRecoveryAttempt();
      }
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return { checkingSession, linkExpired, setLinkExpired };
}
