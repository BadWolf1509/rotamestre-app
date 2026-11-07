/**
 * Desktop view (table) for DataTable
 *
 * - As colunas preenchem a largura do cartão: `width` é a base, e cada
 *   coluna cresce na proporção dela (`larguraDaColuna`, em `larguras.ts`, a
 *   mesma regra do skeleton). Mais estreito que a soma das bases, a tabela
 *   rola na horizontal.
 * - Célula de texto em uma linha, com reticências, e o texto inteiro no
 *   `accessibilityLabel`.
 * - Ações `danger` vão para o menu "Mais ações" (`MenuDeAcoes`); as outras
 *   seguem como botão.
 * - Com `onRowPress`, a linha inteira é clicável; as ações e o menu param a
 *   propagação, para o clique nelas não abrir a linha também.
 */

import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  type GestureResponderEvent,
} from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { PaginationDesktop } from './DataTablePagination';
import {
  larguraDaColuna,
  larguraDaColunaDeAcoes,
  separarAcoes,
} from './larguras';
import { MenuDeAcoes } from './MenuDeAcoes';
import { dataTableStyles as styles } from './styles';
import { getColumnDisplayValue } from './types';

import type { DataTableColumn, DataTableAction, DataTableItem } from './types';

interface DataTableDesktopViewProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  actions?: DataTableAction<T>[];
  onRowPress?: (item: T) => void;
  keyExtractor: (item: T) => string;
  title?: string;
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  totalItems: number;
  pagination: boolean;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (columnKey: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  testID?: string;
}

function pararPropagacao(evento?: GestureResponderEvent) {
  evento?.stopPropagation?.();
}

function DataTableDesktopViewInner<T>({
  data,
  columns,
  actions,
  onRowPress,
  keyExtractor,
  title,
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  totalItems,
  pagination,
  sortColumn,
  sortDirection,
  onSort,
  onPrevious,
  onNext,
  testID,
}: DataTableDesktopViewProps<T>) {
  const { theme } = useUnistyles();

  const { acoesNaLinha, acoesNoMenu } = separarAcoes(actions);
  const temAcoes = acoesNaLinha.length + acoesNoMenu.length > 0;
  const estiloColunaAcoes = larguraDaColunaDeAcoes(actions);

  // Função chamada no JSX (não componente declarado no render).
  const renderTextoDaCelula = (valor: string | number | null | undefined) => {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return (
      <Text
        style={[styles.tableCellText, styles.tableCellTextNoWrap]}
        numberOfLines={1}
        ellipsizeMode="tail"
        accessibilityLabel={texto}
      >
        {texto}
      </Text>
    );
  };

  return (
    <View style={styles.container} testID={testID}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.tableContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.tableScrollContent}
        >
          <View style={styles.tableScrollInner}>
            {/* Table Header */}
            <View style={styles.tableHeader} accessibilityRole="header">
              {columns.map((column) => {
                const isSorted = column.sortable && sortColumn === column.key;
                const sortLabel = isSorted
                  ? sortDirection === 'asc'
                    ? ', ordenado crescente'
                    : ', ordenado decrescente'
                  : '';

                return (
                  <TouchableOpacity
                    key={column.key}
                    style={[
                      styles.tableHeaderCell,
                      larguraDaColuna(column.width),
                      column.align === 'center' && { alignItems: 'center' },
                      column.align === 'right' && { alignItems: 'flex-end' },
                    ]}
                    onPress={() => column.sortable && onSort(column.key)}
                    disabled={!column.sortable}
                    accessibilityRole={column.sortable ? 'button' : undefined}
                    accessibilityLabel={`${column.label}${sortLabel}`}
                    accessibilityHint={
                      column.sortable ? 'Toque para ordenar' : undefined
                    }
                  >
                    <Text style={styles.tableHeaderText} numberOfLines={1}>
                      {column.label}
                    </Text>
                    {isSorted && (
                      <Text style={styles.sortIndicator}>
                        {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
              {temAcoes && (
                <View
                  style={[
                    styles.tableHeaderCell,
                    styles.tableHeaderCellAcoes,
                    estiloColunaAcoes,
                  ]}
                >
                  <Text style={styles.tableHeaderText} numberOfLines={1}>
                    Ações
                  </Text>
                </View>
              )}
            </View>

            {/* Table Body */}
            {data.length === 0 && (
              <View style={styles.tableRow} accessible accessibilityRole="text">
                <Text style={styles.tableCellText}>
                  Nenhum resultado encontrado
                </Text>
              </View>
            )}
            {data.map((item, index) => {
              const chave = keyExtractor(item);
              const estiloLinha = [
                styles.tableRow,
                index % 2 === 0 && styles.tableRowEven,
              ];
              const rotuloLinha = columns
                .map(
                  (col) =>
                    `${col.label}: ${getColumnDisplayValue(item as DataTableItem, col.key)}`,
                )
                .join(', ');
              const conteudoLinha = (
                <>
                  {columns.map((column) => (
                    <View
                      key={column.key}
                      style={[
                        styles.tableCell,
                        larguraDaColuna(column.width),
                        column.align === 'center' && { alignItems: 'center' },
                        column.align === 'right' && { alignItems: 'flex-end' },
                      ]}
                    >
                      {column.render
                        ? column.render(item)
                        : renderTextoDaCelula(
                            getColumnDisplayValue(
                              item as DataTableItem,
                              column.key,
                            ),
                          )}
                    </View>
                  ))}

                  {/* Desktop Actions */}
                  {temAcoes && (
                    <View
                      style={[
                        styles.tableCell,
                        styles.tableCellActions,
                        estiloColunaAcoes,
                      ]}
                    >
                      {acoesNaLinha.map((action, idx) => {
                        const label =
                          typeof action.label === 'function'
                            ? action.label(item)
                            : action.label;
                        const icon = action.icon
                          ? typeof action.icon === 'function'
                            ? action.icon(item)
                            : action.icon
                          : undefined;

                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[
                              styles.tableActionButton,
                              action.type === 'danger' &&
                                styles.tableActionButtonDanger,
                              action.type === 'secondary' &&
                                styles.tableActionButtonSecondary,
                            ]}
                            onPress={(evento) => {
                              pararPropagacao(evento);
                              action.onPress(item);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={label}
                          >
                            {icon && (
                              <Ionicons
                                name={icon}
                                size={16}
                                color={
                                  action.type === 'danger'
                                    ? theme.colors.error
                                    : action.type === 'secondary'
                                      ? theme.colors.gray600
                                      : theme.colors.primary
                                }
                              />
                            )}
                            <Text
                              style={[
                                styles.tableActionText,
                                action.type === 'danger' &&
                                  styles.tableActionTextDanger,
                                action.type === 'secondary' &&
                                  styles.tableActionTextSecondary,
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {acoesNoMenu.length > 0 && (
                        <MenuDeAcoes
                          item={item}
                          acoes={acoesNoMenu}
                          testID={
                            testID
                              ? `${testID}-menu-${keyExtractor(item)}`
                              : undefined
                          }
                        />
                      )}
                    </View>
                  )}
                </>
              );

              // Pressable só com onRowPress: no RNW 0.21 todo Pressable vira
              // parada de Tab (tabIndex 0, `focusable` é ignorado).
              if (onRowPress) {
                return (
                  <Pressable
                    key={chave}
                    style={[...estiloLinha, styles.tableRowClicavel]}
                    onPress={() => onRowPress(item)}
                    accessibilityRole="button"
                    accessibilityLabel={rotuloLinha}
                    accessibilityHint="Abre o detalhe"
                  >
                    {conteudoLinha}
                  </Pressable>
                );
              }
              return (
                <View
                  key={chave}
                  style={estiloLinha}
                  accessible
                  accessibilityLabel={rotuloLinha}
                >
                  {conteudoLinha}
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Desktop Pagination */}
        {pagination && (
          <PaginationDesktop
            currentPage={currentPage}
            totalPages={totalPages}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalItems}
            onPrevious={onPrevious}
            onNext={onNext}
          />
        )}
      </View>
    </View>
  );
}

export const DataTableDesktopView = memo(
  DataTableDesktopViewInner,
) as typeof DataTableDesktopViewInner;
