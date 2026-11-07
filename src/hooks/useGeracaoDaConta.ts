/**
 * Geração da conta: um número que muda quando a conta da SESSÃO é trocada por
 * outra sem passar por "sem conta" (A→B direto). Serve de `key` da pilha raiz
 * de navegação (`app/_layout.tsx`): as telas de A não seguem montadas com a
 * sessão de B.
 *
 * Não muda:
 * - na saída (A→null): quem limpa a pilha é a dona da navegação de saída
 *   (`useNavegacaoDeSaida`, N-1). Remontar ali fazia a pilha renascer na área
 *   antiga sem sessão antes do login e desmontava os modais que a dona espera
 *   fechar;
 * - na entrada (null→A): o login acabou de navegar, e remontar refaria isso;
 * - por causa do perfil (`usuarios`): o chamador passa o id da sessão, não o
 *   do perfil, que chega depois e pode faltar com a sessão viva (N-2).
 *
 * Sem mutar ref no render: a conta anterior é estado, atualizado durante o
 * render (padrão "informação de renders anteriores" do React). Um render
 * descartado (modo concorrente, StrictMode) não deixa rastro, e o React refaz
 * o render antes de pintar — a `key` antiga nunca chega à tela com a conta
 * nova.
 */
import { useState } from 'react';

export function useGeracaoDaConta(contaId: string | null): number {
  const [estado, setEstado] = useState({ anterior: contaId, geracao: 0 });

  if (estado.anterior !== contaId) {
    const trocouDeConta = estado.anterior !== null && contaId !== null;
    const geracao = estado.geracao + (trocouDeConta ? 1 : 0);
    setEstado({ anterior: contaId, geracao });
    return geracao;
  }

  return estado.geracao;
}
