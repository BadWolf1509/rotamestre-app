/**
 * MenuDeAcoes — botão "⋯" ("Mais ações") de uma linha do DataTable desktop.
 *
 * Guarda as ações destrutivas (`type: 'danger'`), que saem da linha. A lista
 * abre num `Modal` transparente, posicionada logo abaixo do botão (medido com
 * `measureInWindow`). O Modal resolve o que um `position: absolute` dentro da
 * tabela não resolveria: o `overflow: hidden` do cartão cortaria a lista na
 * última linha, e as linhas seguintes a cobririam.
 *
 * - Abre com toque/clique; no web, Enter e Espaço acionam o mesmo `onPress`
 *   do botão (papel `button`).
 * - Fecha com Esc (o react-native-web chama `onRequestClose` no Escape), com
 *   toque fora e ao escolher um item.
 * - Todo toque aqui dentro para a propagação: no web o clique sobe pela
 *   árvore React (o Modal é portal, mas o evento segue o React) até a linha
 *   clicável, que dispararia o `onRowPress` junto.
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type ViewInstance,
} from 'react-native';

import { StyleSheet, useUnistyles } from '@/utils/styles';

import type { DataTableAction } from './types';

interface MenuDeAcoesProps<T> {
  item: T;
  acoes: DataTableAction<T>[];
  testID?: string;
}

interface Ancora {
  top: number;
  right: number;
}

const DISTANCIA_DO_BOTAO = 4;

function pararPropagacao(evento?: GestureResponderEvent) {
  evento?.stopPropagation?.();
}

export function MenuDeAcoes<T>({ item, acoes, testID }: MenuDeAcoesProps<T>) {
  const { theme } = useUnistyles();
  const { width: larguraJanela } = useWindowDimensions();
  const botaoRef = useRef<ViewInstance>(null);
  const [aberto, setAberto] = useState(false);
  const [ancora, setAncora] = useState<Ancora | null>(null);

  const fechar = useCallback(() => setAberto(false), []);

  const abrir = (evento?: GestureResponderEvent) => {
    pararPropagacao(evento);
    setAberto(true);
    botaoRef.current?.measureInWindow?.((x, y, largura, altura) => {
      setAncora({
        top: y + altura + DISTANCIA_DO_BOTAO,
        right: Math.max(0, larguraJanela - (x + largura)),
      });
    });
  };

  const escolher = (
    acao: DataTableAction<T>,
    evento?: GestureResponderEvent,
  ) => {
    pararPropagacao(evento);
    setAberto(false);
    acao.onPress(item);
  };

  const tocarFora = (evento?: GestureResponderEvent) => {
    pararPropagacao(evento);
    fechar();
  };

  return (
    <View ref={botaoRef} collapsable={false}>
      <Pressable
        testID={testID}
        onPress={abrir}
        style={styles.botao}
        accessibilityRole="button"
        accessibilityLabel="Mais ações"
        accessibilityState={{ expanded: aberto }}
        aria-haspopup="menu"
      >
        <Ionicons
          name="ellipsis-horizontal"
          size={18}
          color={theme.colors.gray600}
        />
      </Pressable>

      <Modal
        visible={aberto}
        transparent
        animationType="none"
        onRequestClose={fechar}
      >
        <Pressable
          testID={testID ? `${testID}-fora` : undefined}
          style={styles.fundo}
          onPress={tocarFora}
          accessible={false}
          // RNW 0.21: Pressable emite tabIndex 0 e ignora `focusable`; sem
          // -1, a trava de foco do Modal focaria este fundo invisível.
          tabIndex={-1}
        />
        {/* Pressable só para absorver o clique entre os itens: sem ele, o
            clique no espaço da lista subiria até a linha clicável. */}
        <Pressable
          onPress={pararPropagacao}
          accessible={false}
          tabIndex={-1}
          accessibilityRole="menu"
          accessibilityLabel="Ações da linha"
          style={[
            styles.lista,
            ancora
              ? { top: ancora.top, right: ancora.right }
              : styles.listaSemAncora,
          ]}
        >
          {acoes.map((acao, indice) => {
            const rotulo =
              typeof acao.label === 'function' ? acao.label(item) : acao.label;
            const icone = acao.icon
              ? typeof acao.icon === 'function'
                ? acao.icon(item)
                : acao.icon
              : undefined;
            const perigo = acao.type === 'danger';
            const cor = perigo ? theme.colors.error : theme.colors.gray800;

            return (
              <Pressable
                key={indice}
                onPress={(evento) => escolher(acao, evento)}
                style={styles.item}
                accessibilityRole="menuitem"
                accessibilityLabel={rotulo}
              >
                {icone && <Ionicons name={icone} size={16} color={cor} />}
                <Text style={[styles.itemTexto, { color: cor }]}>{rotulo}</Text>
              </Pressable>
            );
          })}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  botao: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    ...(Platform.OS === 'web' &&
      ({
        cursor: 'pointer',
        ':hover': { backgroundColor: theme.colors.gray100 },
      } as any)),
  },
  fundo: {
    ...StyleSheet.absoluteFillObject,
  },
  lista: {
    position: 'absolute',
    minWidth: 180,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    ...theme.shadows.md,
  },
  // Antes da medida chegar (ou onde não há medida): canto superior direito.
  listaSemAncora: {
    top: theme.spacing.xl,
    right: theme.spacing.xl,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    ...(Platform.OS === 'web' &&
      ({
        cursor: 'pointer',
        ':hover': { backgroundColor: theme.colors.gray50 },
      } as any)),
  },
  itemTexto: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
