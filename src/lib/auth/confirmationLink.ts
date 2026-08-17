import { Platform } from 'react-native';

import { supabaseUrl } from '@/lib/supabase';

/**
 * Extração e validação do link de confirmação do Supabase escondido no
 * fragmento da URL.
 *
 * Link scanners de email corporativo fazem prefetch das URLs da mensagem para
 * checar malware, consumindo o OTP single-use antes do usuário clicar. Como
 * fragmentos (`#…`) nunca são enviados ao servidor HTTP, o scanner não enxerga
 * o token: ele só vê a página intermediária.
 *
 * Usado por `app/auth/confirm-reset.tsx` (recuperação de senha) e
 * `app/auth/confirm-signup.tsx` (confirmação de cadastro). Os templates de
 * email correspondentes vivem em `supabase/templates/`.
 *
 * Ref: https://github.com/supabase/supabase/discussions/41618
 */

/** Prefixo do fragmento usado pelos templates de email. */
const FRAGMENT_PREFIX = '#url=';

/**
 * Aceita apenas https com host idêntico ao do projeto Supabase.
 *
 * Sem esta checagem as páginas de confirmação virariam open redirect: qualquer
 * um poderia mandar `.../auth/confirm-signup#url=https://phishing.example` e
 * usar o domínio da aplicação como trampolim.
 */
export function isAllowedConfirmationUrl(url: string): boolean {
  if (!supabaseUrl) return false; // env ausente (E2E/CI): rejeita por segurança
  try {
    const target = new URL(url);
    const allowed = new URL(supabaseUrl);
    return target.protocol === 'https:' && target.host === allowed.host;
  } catch {
    return false;
  }
}

/**
 * Lê a URL de confirmação do fragmento da página atual.
 *
 * Devolve `null` quando não há fragmento, quando ele não começa com `#url=`,
 * ou quando o destino não passa em {@link isAllowedConfirmationUrl} — em todos
 * os casos a tela deve mostrar o estado de link inválido.
 *
 * Web-only: no nativo não há `window.location` e o fluxo inteiro acontece na
 * web (ver `docs/PASSWORD_RECOVERY.md`).
 */
export function getConfirmationUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith(FRAGMENT_PREFIX)) return null;
  try {
    const decoded = decodeURIComponent(hash.substring(FRAGMENT_PREFIX.length));
    return isAllowedConfirmationUrl(decoded) ? decoded : null;
  } catch {
    // decodeURIComponent lança em sequências percent malformadas
    return null;
  }
}
