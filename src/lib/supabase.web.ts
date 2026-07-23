import 'react-native-url-polyfill/auto';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';

import { logger } from '@/lib/logger';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Adapter para usar localStorage no navegador
// Implements SupportedStorage interface from Supabase
const webStorage: SupportedStorage = {
  getItem: (key: string) => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }

    return null;
  },

  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  },

  removeItem: (key: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  },
};

const isSupabaseConfigured =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

let supabaseClient;

if (isSupabaseConfigured) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: webStorage,

      autoRefreshToken: true,

      persistSession: true,

      detectSessionInUrl: false,
    },

    realtime: {
      // Disable realtime on web to avoid node-fetch import issues
      // Web app doesn't need realtime updates for MVP
    },
  });
} else {
  logger.warn(
    '[Supabase Web] Credentials not configured - using placeholder for E2E/CI',
  );

  supabaseClient = createClient(
    'https://placeholder.supabase.co',
    'placeholder-key',
    {
      auth: {
        storage: webStorage,

        autoRefreshToken: false,

        persistSession: false,

        detectSessionInUrl: false,
      },
    },
  );
}

/**
 * Detecta se a URL atual carrega um token de recuperação de senha.
 *
 * No web usamos detectSessionInUrl:false (por causa da página anti-scanner
 * /auth/confirm-reset), então o hash/query com `type=recovery` é tratado
 * manualmente. Este export dá paridade com o cliente nativo (supabase.ts): o
 * app/index.tsx usa isso para redirecionar tokens que caiam na raiz ("/") para
 * /auth/reset-password. Antes NÃO era exportado aqui → `undefined` no web → o
 * branch de recovery do index virava código morto e o usuário caía no /auth/login.
 */
export const isRecoveryRedirect =
  typeof window !== 'undefined' &&
  ((window.location.hash || '').includes('type=recovery') ||
    (window.location.search || '').includes('type=recovery'));

export const supabase = supabaseClient;
export { isSupabaseConfigured, supabaseUrl };
