/**
 * Cores do `Switch` nativo, iguais em toda tela.
 *
 * O polegar NÃO sai de `theme.colors.white`/`gray100`: esses tokens se
 * invertem no tema escuro (`white` vira #1a2029), e o polegar ligado ficava
 * escuro sobre a trilha azul. Ele é claro nos dois temas, como no sistema; o
 * tema decide só a trilha. A trilha ligada usa `primaryDark` porque o
 * `primary` do escuro (#7a9bdf, clareado para texto) não dá 3:1 com o branco.
 */
import { defaultTheme } from './styles.base';

import type { Theme } from './styles';

// Paleta clara fixa (como `CORES_SOBRE_O_MAPA`): não se inverte com o tema.
const claro = defaultTheme.colors;
const POLEGAR_LIGADO = claro.white;
const POLEGAR_DESLIGADO = claro.gray100;

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
