/**
 * Geração da conta: um número que muda quando a conta que estava no app sai
 * (logout, sessão revogada) ou é trocada por outra. Serve de `key` da pilha
 * raiz de navegação (`app/_layout.tsx`): o logout navega com
 * `router.replace('/auth/login')`, que só troca a tela do topo, e o que a conta
 * anterior abriu continuava montado embaixo, fazendo requisições com a sessão
 * nova e travando a barra de abas de quem entrou depois.
 *
 * Entrar vindo de nenhuma conta não muda a geração: o perfil chega depois do
 * login, e remontar ali refaria a navegação que o login acabou de fazer.
 */
import { useRef } from 'react';

export function useGeracaoDaConta(userId: string | null): number {
  const anteriorRef = useRef<string | null>(userId);
  const geracaoRef = useRef(0);

  const anterior = anteriorRef.current;
  if (anterior !== null && userId !== null && anterior !== userId) {
    geracaoRef.current += 1;
  }
  anteriorRef.current = userId;

  return geracaoRef.current;
}
