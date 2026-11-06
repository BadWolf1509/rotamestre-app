/**
 * Geração da conta: chave da pilha raiz de navegação.
 *
 * O logout navega com `router.replace('/auth/login')`, que só troca a tela do
 * topo: o que a conta anterior abriu continuava montado embaixo. No moto g15
 * (04/11/2026), depois de sair do gestor e entrar como motorista, a Minha
 * Unidade do gestor seguia montada (pedia a equipe com a sessão do motorista e
 * levava 42501) e a barra de abas do motorista parou de responder. Trocar a
 * geração remonta a pilha, e nada da conta anterior sobrevive.
 */
import { renderHook } from '@testing-library/react-native';

import { useGeracaoDaConta } from '../useGeracaoDaConta';

function montar(inicial: string | null) {
  return renderHook(({ id }: { id: string | null }) => useGeracaoDaConta(id), {
    initialProps: { id: inicial },
  });
}

describe('useGeracaoDaConta', () => {
  it('muda quando a conta sai', () => {
    const { result, rerender } = montar('gestor');
    const antes = result.current;

    rerender({ id: null });

    expect(result.current).not.toBe(antes);
  });

  it('muda quando uma conta é trocada por outra sem passar por null', () => {
    const { result, rerender } = montar('gestor');
    const antes = result.current;

    rerender({ id: 'motorista' });

    expect(result.current).not.toBe(antes);
  });

  it('não muda quando alguém entra vindo de nenhuma conta', () => {
    // O perfil chega depois do login: remontar aqui refaria a navegação que o
    // login acabou de fazer.
    const { result, rerender } = montar(null);
    const antes = result.current;

    rerender({ id: 'motorista' });

    expect(result.current).toBe(antes);
  });

  it('não muda enquanto a conta é a mesma', () => {
    const { result, rerender } = montar('gestor');
    const antes = result.current;

    rerender({ id: 'gestor' });

    expect(result.current).toBe(antes);
  });
});
