# Fluxo de Recuperação de Senha

Visão de ponta a ponta do fluxo "esqueci minha senha". Todas as plataformas (web e
native) concluem o fluxo **na web** — o app nativo não tem handler de deep link nem
`detectSessionInUrl`, então o link do email leva sempre a `https://app.rotamestre.tec.br`.

## Etapas

1. **Solicitação** — `app/auth/forgot-password.tsx`
   - Rate limit local: 3 envios por hora por email (`passwordResetRateLimiter`,
     `resetOnSuccess: false` — envios bem-sucedidos também contam). O rate limit
     server-side do Supabase continua valendo por cima.
   - `authService.resetPassword(email)` envia `redirectTo` apontando para
     `/auth/reset-password` na web (origin atual no web; `extra.baseUrl` do
     `app.config.js` no native).
   - 429 do Supabase é tratado como "email já enviado"; erros de email inexistente
     mostram a mesma mensagem de sucesso (anti-enumeração).

2. **Email → página intermediária** — `app/auth/confirm-reset.tsx`
   - O template de email do Supabase aponta para
     `https://app.rotamestre.tec.br/auth/confirm-reset#url={{ .ConfirmationURL }}`.
   - O fragmento `#url=` nunca chega ao servidor HTTP, então link scanners de email
     corporativo não conseguem consumir o OTP single-use (anti link-scanner).
   - A URL extraída é **validada** antes do redirect: precisa ser `https` com host
     idêntico ao do projeto Supabase (`EXPO_PUBLIC_SUPABASE_URL`). Sem isso a página
     seria um open redirect para phishing. URL reprovada cai no estado "Link inválido".

3. **Verificação → formulário** — `app/auth/reset-password.tsx`
   - O verify do Supabase redireciona para `/auth/reset-password` com tokens no hash
     (implicit flow).
   - A sessão de recovery é estabelecida por estratégia múltipla em
     `src/lib/auth/sessionRecovery.ts`: `setSession` com tokens do hash, PKCE
     (`exchangeCodeForSession` com `?code=`) e `verifyOtp` (`?token_hash=`).
     O hook `useSessionRecovery` (web-only) coordena com `onAuthStateChange` para
     evitar a race condition do SDK (ver refs nos comentários dos arquivos).
   - `authService.updatePassword` troca a senha; em "Auth session missing" há um
     retry após recuperação manual da sessão. Link expirado/usado mostra o estado
     dedicado com opção de pedir novo link.

4. **Pós-sucesso**
   - `authService.marcarPrimeiraSenhaConcluida()` zera `usuarios.primeira_senha`
     (não-crítico, nunca lança) — sem isso o onboarding de primeira senha exigiria
     nova troca logo após o reset. RLS permite o update da própria linha
     (policy `usuarios_update`).
   - Redirect para `/`, que roteia por papel (gestor/motorista).

## Configuração no Supabase (painel)

- **Auth → URL Configuration → Redirect URLs**: deve conter
  `https://app.rotamestre.tec.br/auth/reset-password`. (A entrada antiga
  `rotamestre://reset-password` ficou obsoleta.)
- **Auth → Email Templates → Reset Password**: o link deve ser
  `{{ .SiteURL }}/auth/confirm-reset#url={{ .ConfirmationURL }}` — tanto no `href`
  quanto no **texto visível** do link alternativo. Sem o `#url=` no texto, quem
  copia e cola chega sem fragmento e cai em "Link inválido".
  O HTML vive versionado em `supabase/templates/` (ver o README de lá); o painel
  continua sendo o único lugar que o Supabase lê, então é preciso colar.
- Se um **custom domain de auth** for configurado no futuro, o host do
  `ConfirmationURL` muda e a validação do confirm-reset (que compara com
  `EXPO_PUBLIC_SUPABASE_URL`) precisa ser ajustada junto.

## Atenção: client web é outro módulo

Builds web resolvem `src/lib/supabase.web.ts` (extensão `.web.ts` do Metro), não
`src/lib/supabase.ts`. Os dois divergem hoje (`detectSessionInUrl`, `flowType`,
`isRecoveryRedirect` só existe no nativo) — o fluxo web funciona pelas estratégias
manuais de `sessionRecovery.ts`. Qualquer export novo consumido por telas de auth
precisa existir **nos dois módulos** (ex.: `supabaseUrl`).
