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
 * Diferente do reset, a única ação do estado inválido é ir para o login — e ela
 * resolve os dois casos: se um scanner consumiu o link, a conta já está
 * confirmada e o acesso funciona; se o link expirou de verdade, o login recusa
 * com "email não confirmado" e oferece ali o reenvio
 * (`handleReenviarConfirmacao` em `app/auth/login.tsx`). Um botão de reenvio
 * aqui exigiria pedir o email de novo, já que o link inválido não diz quem é.
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
          'O link de confirmação é inválido, expirou ou já foi utilizado. Entre com seu email e senha: se a conta já estiver confirmada o acesso funciona normalmente, e se ainda faltar confirmar, o login oferece o reenvio do email.',
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
