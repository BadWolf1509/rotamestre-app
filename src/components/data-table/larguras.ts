/**
 * Larguras das colunas do DataTable desktop, usadas pela tabela e pelo
 * skeleton: a mesma regra nos dois evita o salto ao terminar de carregar.
 */

import type { DataTableAction } from './types';
import type { DimensionValue, ViewStyle } from 'react-native';

/** Largura-base sem `width` (era o `minWidth` de antes). */
const LARGURA_BASE_PADRAO = 100;
/** Largura de cada botão de ação visível e do botão "⋯". */
const LARGURA_BOTAO_ACAO = 130;
const LARGURA_MENU = 48;

/**
 * Número: parte da base (`width`) e cresce na proporção dela (`flexGrow`),
 * sem encolher. String ('20%'): largura fixa, como antes.
 *
 * `width`, e não `flexBasis`: dentro do ScrollView horizontal o conteúdo se
 * mede pelo max-content, e no Chrome a contribuição de um item flex vem do
 * conteúdo, não do flex-basis — um nome longo em nowrap alargaria a tabela
 * inteira (rolagem horizontal, sem reticências).
 */
export function larguraDaColuna(width: number | string | undefined): ViewStyle {
  if (typeof width === 'string') {
    return { width: width as DimensionValue, minWidth: LARGURA_BASE_PADRAO };
  }
  const base = width ?? LARGURA_BASE_PADRAO;
  return { width: base, flexGrow: base, flexShrink: 0 };
}

/** Ações `danger` vão para o menu "⋯"; as outras ficam como botão na linha. */
export function separarAcoes<T>(actions: DataTableAction<T>[] | undefined) {
  const lista = actions ?? [];
  return {
    acoesNaLinha: lista.filter((a) => a.type !== 'danger'),
    acoesNoMenu: lista.filter((a) => a.type === 'danger'),
  };
}

/** Coluna de ações: um botão por ação na linha, mais o "⋯" se houver menu. */
export function larguraDaColunaDeAcoes<T>(
  actions: DataTableAction<T>[] | undefined,
): ViewStyle {
  const { acoesNaLinha, acoesNoMenu } = separarAcoes(actions);
  return {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis:
      acoesNaLinha.length * LARGURA_BOTAO_ACAO +
      (acoesNoMenu.length > 0 ? LARGURA_MENU : 0),
  };
}
