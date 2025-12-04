import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ✅ Sincronizar token de auth com Realtime no nível do módulo
// Isso garante que o token seja configurado ANTES de qualquer hook tentar subscrever
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[Supabase] Auth state changed:', event);
  if (session?.access_token) {
    console.log('[Supabase] Configurando token do Realtime');
    supabase.realtime.setAuth(session.access_token);
  }
});

// ✅ Também configurar token inicial se já houver sessão armazenada
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.access_token) {
    console.log('[Supabase] Token inicial configurado para Realtime');
    supabase.realtime.setAuth(session.access_token);
  }
});
