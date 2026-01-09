import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Adapter para usar localStorage no navegador

const webStorage = {

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



const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;



let supabaseClient;



if (isSupabaseConfigured) {

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {

    auth: {

      storage: webStorage as any,

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

  console.warn('[Supabase Web] Credentials not configured - using placeholder for E2E/CI');

  supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key', {

    auth: {

      storage: webStorage as any,

      autoRefreshToken: false,

      persistSession: false,

      detectSessionInUrl: false,

    },

  });

}



export const supabase = supabaseClient;
export { isSupabaseConfigured };
