import 'react-native-url-polyfill/auto';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { logger } from './logger';
import { secureAuthStorage } from './secureAuthStorage';

// Capture URL hash BEFORE Supabase client processes it (createClient cleans the hash)
// This allows index.tsx to detect recovery redirects reliably
const initialUrlHash =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.hash
    : '';

/** True when the app was opened via a password recovery link */
export const isRecoveryRedirect = initialUrlHash.includes('type=recovery');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if Supabase credentials are configured
// In CI/E2E environments, these may be empty
const isSupabaseConfigured =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

// Create client only if credentials are available
// Otherwise create a dummy client that won't crash but won't work either
// See: https://github.com/orgs/supabase/discussions/3218
let supabase: SupabaseClient;

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: secureAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Web: true to auto-detect recovery/magic-link tokens from URL hash
      // Mobile: false because RN doesn't have real window.location
      detectSessionInUrl: Platform.OS === 'web',
      // auth-js v2.94.1 defaults to 'pkce', but Supabase sends implicit flow tokens
      // (#access_token=... in URL hash). Without this, the SDK ignores recovery tokens entirely.
      flowType: 'implicit',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  // ✅ Sincronizar token de auth com Realtime no nível do módulo
  // Isso garante que o token seja configurado ANTES de qualquer hook tentar subscrever
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) {
      supabase.realtime.setAuth(session.access_token);
    }
  });

  // ✅ Também configurar token inicial se já houver sessão armazenada
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token) {
      supabase.realtime.setAuth(session.access_token);
    }
  });
} else {
  // Dummy placeholder URL for E2E/CI environments
  // This prevents the "supabaseUrl is required" error from crashing the app
  logger.warn(
    '[Supabase] Credentials not configured - using placeholder for E2E/CI',
  );
  supabase = createClient(
    'https://placeholder.supabase.co',
    'placeholder-key',
    {
      auth: {
        storage: secureAuthStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export { supabase, isSupabaseConfigured, supabaseUrl };
