import { ConfirmLinkScreen } from '@/components/auth/ConfirmLinkScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Página intermediária do fluxo de confirmação de cadastro.
 *
 * Mesma proteção anti link-scanner do `confirm-reset`, por um motivo adicional:
 * o verify de signup redireciona com **tokens de sessão** na URL. Um scanner
 * que consome o link não só confirma a conta antes do usuário — ele recebe uma
 * sessão válida. Com o fragmento (`#url=`) o token só é consumido quando uma
 * pessoa clica.
 *
 * Diferente do reset, aqui não há "solicitar novo link": o app não expõe
 * `auth.resend`. Como o scanner que consome o link deixa a conta confirmada, na
 * prática o login costuma funcionar — por isso a única ação é ir para lá.
 *
 * Ver `supabase/templates/confirm-signup.html`.
 */
function ConfirmSignupContent() {
  return (
    <ConfirmLinkScreen
      valido={{
        titulo: 'Confirmação de Cadastro',
        mensagem:
          'Clique no botão abaixo para confirmar seu email e ativar sua conta.',
        labelBotao: 'Confirmar Email',
        accessibilityLabelBotao: 'Confirmar email e ativar conta',
      }}
      invalido={{
        titulo: 'Link inválido',
        mensagem:
          'O link de confirmação é inválido, expirou ou já foi utilizado. Tente entrar com seu email e senha — se a conta já estiver confirmada, o acesso funciona normalmente.',
        acoes: [
          {
            label: 'Ir para o login',
            accessibilityLabel: 'Ir para a tela de login',
            destino: '/auth/login',
          },
        ],
      }}
    />
  );
}

/** Invólucro com ErrorBoundary — ver comentário em app/auth/login.tsx. */
export default function ConfirmSignup() {
  return (
    <ErrorBoundary>
      <ConfirmSignupContent />
    </ErrorBoundary>
  );
}
