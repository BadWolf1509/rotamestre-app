/**
 * Larguras das colunas do DataTable desktop, usadas pela tabela e pelo
 * skeleton: a mesma regra nos dois evita o salto ao terminar de carregar.
 *
 * As colunas partem da largura-base (`width`), crescem e encolhem na
 * proporção dela e param no mínimo (`minWidth`). A tabela só rola na
 * horizontal quando o cartão fica mais estreito que a soma dos mínimos
 * (`larguraMinimaDaTabela`).
 */

import type { DataTableAction, DataTableColumn } from './types';
import type { DimensionValue, ViewStyle } from 'react-native';

/** Largura-base sem `width` (era o `minWidth` de antes). */
const LARGURA_BASE_PADRAO = 100;
/** Botão cujo rótulo depende do item (função): não dá para medir antes. */
const LARGURA_BOTAO_SEM_ROTULO_FIXO = 130;
/**
 * Botão de ação: padding 12 + 12, ícone 16, gap 4 e o rótulo a 13 px
 * semibold (Nunito Sans), estimado em 6,5 px por caractere (medido no
 * Chrome: 5,9; "Alterar status" tem 81 px).
 */
const LARGURA_FIXA_DO_BOTAO = 44;
const LARGURA_POR_CARACTERE = 6.5;
/** Botão "⋯" (32) e o espaço entre os itens da célula (gap 4). */
const LARGURA_MENU = 32;
const ESPACO_ENTRE_ACOES = 4;
/** Padding horizontal da célula (8 + 8) e da linha (12 + 12). */
const PADDING_DA_CELULA = 16;
const PADDING_DA_LINHA = 24;

/**
 * Número: parte da base (`width`), cresce e encolhe na proporção dela
 * (`flexGrow`/`flexShrink`) e não passa abaixo de `minimo` (sem ele, da
 * própria base). String ('20%'): largura fixa, como antes.
 *
 * `width`, e não `flexBasis`: dentro do ScrollView horizontal o conteúdo se
 * mede pelo max-content, e no Chrome a contribuição de um item flex vem do
 * conteúdo, não do flex-basis — um nome longo em nowrap alargaria a tabela
 * inteira (rolagem horizontal, sem reticências). Com `width`, a
 * contribuição é a própria largura.
 */
export function larguraDaColuna(
  width: number | string | undefined,
  minimo?: number,
): ViewStyle {
  if (typeof width === 'string') {
    return { width: width as DimensionValue, minWidth: LARGURA_BASE_PADRAO };
  }
  const base = width ?? LARGURA_BASE_PADRAO;
  return {
    width: base,
    flexGrow: base,
    flexShrink: base,
    minWidth: Math.min(minimo ?? base, base),
  };
}

/**
 * Ações `danger` e as marcadas `emMenu` vão para o menu "⋯"; as outras ficam
 * como botão na linha.
 */
export function separarAcoes<T>(actions: DataTableAction<T>[] | undefined) {
  const lista = actions ?? [];
  const noMenu = (a: DataTableAction<T>) => a.type === 'danger' || !!a.emMenu;
  return {
    acoesNaLinha: lista.filter((a) => !noMenu(a)),
    acoesNoMenu: lista.filter(noMenu),
  };
}

function larguraDoBotao<T>(acao: DataTableAction<T>): number {
  if (typeof acao.label !== 'string') return LARGURA_BOTAO_SEM_ROTULO_FIXO;
  return Math.ceil(
    LARGURA_FIXA_DO_BOTAO + acao.label.length * LARGURA_POR_CARACTERE,
  );
}

/** Coluna de ações: os botões da linha, mais o "⋯" se houver menu. */
export function larguraDaColunaDeAcoes<T>(
  actions: DataTableAction<T>[] | undefined,
): ViewStyle {
  const { acoesNaLinha, acoesNoMenu } = separarAcoes(actions);
  const larguras = acoesNaLinha.map(larguraDoBotao);
  if (acoesNoMenu.length > 0) larguras.push(LARGURA_MENU);
  const conteudo =
    larguras.reduce((soma, l) => soma + l, 0) +
    Math.max(0, larguras.length - 1) * ESPACO_ENTRE_ACOES;
  return {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: larguras.length > 0 ? PADDING_DA_CELULA + conteudo : 0,
  };
}

/**
 * Menor largura em que a tabela cabe sem cortar nada: os mínimos das colunas,
 * a coluna de ações e o recuo da linha. Abaixo disso, ela rola.
 */
export function larguraMinimaDaTabela<T>(
  columns: Pick<DataTableColumn<T>, 'width' | 'minWidth'>[],
  actions: DataTableAction<T>[] | undefined,
): number {
  const colunas = columns.reduce((soma, coluna) => {
    const { minWidth } = larguraDaColuna(coluna.width, coluna.minWidth);
    return soma + (typeof minWidth === 'number' ? minWidth : 0);
  }, 0);
  const acoes = larguraDaColunaDeAcoes(actions).flexBasis as number;
  return colunas + acoes + PADDING_DA_LINHA;
}
