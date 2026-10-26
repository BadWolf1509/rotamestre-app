/**
 * Cores do `Switch` nativo, iguais em toda tela.
 *
 * O polegar NÃO sai de `theme.colors.white`/`gray100`: esses tokens se
 * invertem no tema escuro (`white` vira #1a2029), e o polegar ligado ficava
 * escuro sobre a trilha azul. Ele é claro nos dois temas, como no sistema; o
 * tema decide só a trilha. A trilha ligada usa `primaryDark` porque o
 * `primary` do escuro (#7a9bdf, clareado para texto) não dá 3:1 com o branco.
 */
import type { Theme } from './styles';

const POLEGAR_LIGADO = '#ffffff';
// O cinza-claro padrão do Switch do React Native no Android.
const POLEGAR_DESLIGADO = '#f4f3f4';

export function coresDoSwitch(theme: Theme, ligado: boolean) {
  return {
    trackColor: {
      false: theme.colors.gray400,
      true: theme.colors.primaryDark,
    },
    thumbColor: ligado ? POLEGAR_LIGADO : POLEGAR_DESLIGADO,
    ios_backgroundColor: theme.colors.gray400,
  };
}
