/**
 * Configuração dos links de recrutamento de testadores (teste fechado Android).
 *
 * Environment variables (nunca em versioned code, só em runtime via Vercel):
 * - EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL: link para opt-in do teste fechado
 * - EXPO_PUBLIC_PLAY_TESTER_GROUP_URL: link para grupo de testadores
 * - EXPO_PUBLIC_PLAY_STORE_URL: link para a Play Store (default se não definido)
 *
 * Os links são operacionais e NUNCA ficam no Git — vêm de env vars
 * EXPO_PUBLIC_* (valores reais no Vercel). A presença do link de opt-in
 * funciona como interruptor da feature em toda a plataforma web.
 *
 * process.env é lido dentro das funções de propósito, para refletir o
 * ambiente em runtime e permitir teste direto.
 */
const DEFAULT_STORE_URL =
  'https://play.google.com/store/apps/details?id=br.tec.rotamestre.app';

export interface TesterLinks {
  optInUrl: string;
  groupUrl: string;
  storeUrl: string;
}

export function isRecruitmentEnabled(): boolean {
  return (
    (process.env.EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL || '').trim().length > 0
  );
}

export function getTesterLinks(): TesterLinks {
  return {
    optInUrl: process.env.EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL || '',
    groupUrl: process.env.EXPO_PUBLIC_PLAY_TESTER_GROUP_URL || '',
    storeUrl: process.env.EXPO_PUBLIC_PLAY_STORE_URL || DEFAULT_STORE_URL,
  };
}
