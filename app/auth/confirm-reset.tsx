import { ConfirmLinkScreen } from '@/components/auth/ConfirmLinkScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Página intermediária do fluxo de recuperação de senha.
 *
 * Existe para proteger o OTP single-use de link scanners de email corporativo:
 * o link do email traz a URL real do Supabase no fragmento (`#url=`), que nunca
 * chega ao servidor HTTP. Layout, extração e validação do destino vivem em
 * `ConfirmLinkScreen` / `src/lib/auth/confirmationLink.ts` — aqui ficam só os
 * textos e as ações de fallback deste fluxo.
 *
 * Ver `docs/PASSWORD_RECOVERY.md` e `supabase/templates/reset-password.html`.
 */
function ConfirmResetContent() {
  return (
    <ConfirmLinkScreen
      valido={{
        titulo: 'Recuperação de Senha',
        mensagem:
          'Clique no botão abaixo para continuar com a redefinição da sua senha.',
        labelBotao: 'Continuar',
        accessibilityLabelBotao: 'Continuar para redefinir senha',
      }}
      invalido={{
        titulo: 'Link inválido',
        mensagem:
          'O link de recuperação de senha é inválido ou está incompleto. Solicite um novo link.',
        acoes: [
          {
            label: 'Solicitar Novo Link',
            accessibilityLabel: 'Solicitar novo link de recuperação',
            destino: '/auth/forgot-password',
          },
          {
            label: 'Voltar para login',
            accessibilityLabel: 'Voltar para login',
            destino: '/auth/login',
          },
        ],
      }}
    />
  );
}

/** Invólucro com ErrorBoundary — ver comentário em app/auth/login.tsx. */
export default function ConfirmReset() {
  return (
    <ErrorBoundary>
      <ConfirmResetContent />
    </ErrorBoundary>
  );
}
