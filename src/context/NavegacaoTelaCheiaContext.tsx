/**
 * Liga a "tela cheia" do modo navegação: o layout de abas do motorista
 * esconde cabeçalho e barra de abas enquanto a Início mostra a navegação.
 *
 * O estado mora no layout (`app/motorista/(tabs)/_layout.tsx`), que é quem
 * desenha as duas barras; a tela só avisa. Fora do layout (testes, web
 * sem abas) o default não faz nada.
 */
import { createContext, useContext } from 'react';

interface NavegacaoTelaCheia {
  setTelaCheia: (ativa: boolean) => void;
}

export const NavegacaoTelaCheiaContext = createContext<NavegacaoTelaCheia>({
  setTelaCheia: () => {},
});

export function useNavegacaoTelaCheia(): NavegacaoTelaCheia {
  return useContext(NavegacaoTelaCheiaContext);
}
