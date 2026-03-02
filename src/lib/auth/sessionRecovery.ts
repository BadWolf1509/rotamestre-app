/**
 * Session recovery utilities for password reset flow.
 *
 * Handles multiple Supabase recovery methods:
 * - Hash tokens (#access_token=...&refresh_token=...)
 * - PKCE (?code=...)
 * - OTP token hash (?token_hash=...&type=recovery)
 */

import { Platform } from "react-native";

import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

/** Parse error params from URL hash (Supabase redirects with #error=...&error_code=...) */
export function getHashErrorParams(): {
  error?: string;
  errorCode?: string;
  errorDescription?: string;
} {
  if (Platform.OS !== "web" || typeof window === "undefined") return {};
  const hash = window.location.hash.substring(1);
  if (!hash) return {};
  const params = new URLSearchParams(hash);
  return {
    error: params.get("error") || undefined,
    errorCode: params.get("error_code") || undefined,
    errorDescription: params.get("error_description") || undefined,
  };
}

/** Try to manually establish session from URL hash tokens (fallback for SDK race condition) */
async function tryManualSessionRecovery(): Promise<boolean> {
  if (typeof window === "undefined" || !window.location) return false;
  const hash = window.location.hash.substring(1);
  if (!hash) return false;

  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");

  if (!access_token || !refresh_token) return false;

  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) {
    logger.warn("[ResetPassword] Manual session recovery failed", error);
    return false;
  }
  return true;
}

/** Try PKCE recovery from ?code=... (if URL uses PKCE callback format) */
async function tryPKCESessionRecovery(): Promise<boolean> {
  if (typeof window === "undefined" || !window.location) return false;

  const code = new URLSearchParams(window.location.search).get("code");
  if (!code) return false;

  // `exchangeCodeForSession` exists in auth-js but may be absent in tests/mocks.
  const exchangeCodeForSession = (
    supabase.auth as typeof supabase.auth & {
      exchangeCodeForSession?: (
        authCode: string,
      ) => Promise<{ error: unknown }>;
    }
  ).exchangeCodeForSession;

  if (!exchangeCodeForSession) return false;

  const { error } = await exchangeCodeForSession(code);
  if (error) {
    logger.warn("[ResetPassword] PKCE session recovery failed", error);
    return false;
  }
  return true;
}

/** Try OTP hash recovery from ?token_hash=...&type=recovery */
async function tryTokenHashSessionRecovery(): Promise<boolean> {
  if (typeof window === "undefined" || !window.location) return false;

  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get("token_hash");
  const type = params.get("type");

  if (!tokenHash || type !== "recovery") return false;

  // `verifyOtp` exists in auth-js but may be absent in tests/mocks.
  const verifyOtp = (
    supabase.auth as typeof supabase.auth & {
      verifyOtp?: (params: {
        type: "recovery";
        token_hash: string;
      }) => Promise<{ error: unknown }>;
    }
  ).verifyOtp;

  if (!verifyOtp) return false;

  const { error } = await verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });
  if (error) {
    logger.warn("[ResetPassword] token_hash session recovery failed", error);
    return false;
  }
  return true;
}

/** Best-effort session recovery from URL callback parameters */
export async function trySessionRecoveryFromUrl(): Promise<boolean> {
  if (await tryManualSessionRecovery()) return true;
  if (await tryPKCESessionRecovery()) return true;
  if (await tryTokenHashSessionRecovery()) return true;
  return false;
}

/** Detect if current URL likely belongs to a password recovery callback */
export function hasRecoveryParamsInCurrentUrl(): boolean {
  if (
    Platform.OS !== "web" ||
    typeof window === "undefined" ||
    !window.location
  )
    return false;

  const hash = window.location.hash.substring(1);
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);

  return (
    hashParams.get("type") === "recovery" ||
    searchParams.get("type") === "recovery" ||
    (hashParams.has("access_token") && hashParams.has("refresh_token")) ||
    searchParams.has("code") ||
    searchParams.has("token_hash")
  );
}

/** Check if an error is due to missing auth session */
export function isAuthSessionMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  return (
    message.includes("auth session missing") ||
    name.includes("authsessionmissing")
  );
}
