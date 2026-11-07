/**
 * Geração da conta: chave da pilha raiz de navegação.
 *
 * Muda só quando uma conta é trocada por OUTRA sem passar por "sem conta"
 * (A→B direto): as telas de A não podem seguir montadas com a sessão de B. Na
 * saída (A→null) quem limpa a pilha é a dona da navegação de saída
 * (`useNavegacaoDeSaida`, N-1): remontar ali fazia a pilha renascer na área
 * antiga sem sessão (`gestor/ajuda`, abas do motorista — logs [P33] do dev
 * client, 07/11) antes de a dona levar ao login, e desmontava os modais que
 * ela espera fechar.
 */
import { renderHook } from '@testing-library/react-native';

import { useGeracaoDaConta } from '../useGeracaoDaConta';

function montar(inicial: string | null) {
  return renderHook(({ id }: { id: string | null }) => useGeracaoDaConta(id), {
    initialProps: { id: inicial },
  });
}

describe('useGeracaoDaConta', () => {
  it('não muda quando a conta sai (a dona da saída limpa a pilha)', () => {
    const { result, rerender } = montar('gestor');
    const antes = result.current;

    rerender({ id: null });

    expect(result.current).toBe(antes);
  });

  it('muda quando uma conta é trocada por outra sem passar por null', () => {
    const { result, rerender } = montar('gestor');
    const antes = result.current;

    rerender({ id: 'motorista' });

    expect(result.current).not.toBe(antes);
  });

  it('não muda quando alguém entra vindo de nenhuma conta', () => {
    // O login acabou de navegar: remontar aqui refaria a navegação dele.
    const { result, rerender } = montar(null);
    const antes = result.current;

    rerender({ id: 'motorista' });

    expect(result.current).toBe(antes);
  });

  it('sai e entra outra conta (A→null→B): não muda — a saída já limpou a pilha', () => {
    const { result, rerender } = montar('gestor');
    const antes = result.current;

    rerender({ id: null });
    rerender({ id: 'motorista' });

    expect(result.current).toBe(antes);
  });

  it('não muda enquanto a conta é a mesma', () => {
    const { result, rerender } = montar('gestor');
    const antes = result.current;

    rerender({ id: 'gestor' });

    expect(result.current).toBe(antes);
  });

  it('duas trocas diretas seguidas: muda a cada uma', () => {
    const { result, rerender } = montar('a');
    const g0 = result.current;
    rerender({ id: 'b' });
    const g1 = result.current;
    rerender({ id: 'c' });

    expect(g1).not.toBe(g0);
    expect(result.current).not.toBe(g1);
  });
});
