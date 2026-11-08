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
 * - Sem pisca: a lista só é desenhada quando a medida da abertura ATUAL
 *   responde (resposta atrasada de uma abertura anterior é descartada), e a
 *   âncora é zerada ao fechar. Onde não há `measureInWindow`, ela abre no
 *   canto superior direito.
 * - Perto da borda de baixo, abre para cima do botão. Para decidir, ela fica
 *   invisível até o `onLayout` dar a própria altura (senão pularia).
 * - A janela mudar de tamanho com ela aberta a fecha: a âncora foi medida na
 *   janela de antes e ficaria solta.
 * - Todo toque aqui dentro para a propagação: no web o clique sobe pela
 *   árvore React (o Modal é portal, mas o evento segue o React) até a linha
 *   clicável, que dispararia o `onRowPress` junto.
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
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
  /** Topo da lista quando ela abre para baixo do botão. */
  top: number;
  right: number;
  /** Topo do botão: a borda de baixo da lista quando ela abre para cima. */
  topoDoBotao: number;
}

/** Sem `measureInWindow` (não há como medir): canto superior direito. */
const SEM_MEDIDA = 'sem-medida';

const DISTANCIA_DO_BOTAO = 4;

function pararPropagacao(evento?: GestureResponderEvent) {
  evento?.stopPropagation?.();
}

export function MenuDeAcoes<T>({ item, acoes, testID }: MenuDeAcoesProps<T>) {
  const { theme } = useUnistyles();
  const { width: larguraJanela, height: alturaJanela } = useWindowDimensions();
  const botaoRef = useRef<ViewInstance>(null);
  const [aberto, setAberto] = useState(false);
  // null = medida da abertura atual ainda não chegou: a lista não aparece.
  const [ancora, setAncora] = useState<Ancora | typeof SEM_MEDIDA | null>(null);
  // Altura da lista aberta (onLayout); null = ainda não medida.
  const [alturaLista, setAlturaLista] = useState<number | null>(null);
  // Conta as aberturas: a resposta da medida só vale para a abertura que a pediu.
  const aberturaRef = useRef(0);

  const fechar = useCallback(() => {
    aberturaRef.current += 1;
    setAberto(false);
    setAncora(null);
    setAlturaLista(null);
  }, []);

  // Janela mudou de tamanho com a lista aberta: fecha (a âncora era da
  // janela de antes). A 1ª execução, na montagem, só guarda o tamanho.
  const janelaRef = useRef({ larguraJanela, alturaJanela });
  useEffect(() => {
    const antes = janelaRef.current;
    janelaRef.current = { larguraJanela, alturaJanela };
    if (
      antes.larguraJanela !== larguraJanela ||
      antes.alturaJanela !== alturaJanela
    ) {
      fechar();
    }
  }, [larguraJanela, alturaJanela, fechar]);

  const abrir = (evento?: GestureResponderEvent) => {
    pararPropagacao(evento);
    aberturaRef.current += 1;
    const abertura = aberturaRef.current;
    setAncora(null);
    setAlturaLista(null);
    setAberto(true);
    const medir = botaoRef.current?.measureInWindow;
    if (!medir) {
      setAncora(SEM_MEDIDA);
      return;
    }
    medir.call(botaoRef.current, (x, y, largura, altura) => {
      if (aberturaRef.current !== abertura) return;
      setAncora({
        top: y + altura + DISTANCIA_DO_BOTAO,
        right: Math.max(0, larguraJanela - (x + largura)),
        topoDoBotao: y,
      });
    });
  };

  const escolher = (
    acao: DataTableAction<T>,
    evento?: GestureResponderEvent,
  ) => {
    pararPropagacao(evento);
    fechar();
    acao.onPress(item);
  };

  const tocarFora = (evento?: GestureResponderEvent) => {
    pararPropagacao(evento);
    fechar();
  };

  const medirLista = (evento: LayoutChangeEvent) => {
    setAlturaLista(evento.nativeEvent.layout.height);
  };

  /** Abaixo do botão; para cima quando não cabe embaixo e cabe em cima. */
  const estiloDaPosicao = (posicao: Ancora) => {
    if (alturaLista === null) {
      return { top: posicao.top, right: posicao.right, opacity: 0 };
    }
    const acimaDoBotao = posicao.topoDoBotao - DISTANCIA_DO_BOTAO - alturaLista;
    const naoCabeEmbaixo = posicao.top + alturaLista > alturaJanela;
    return {
      top: naoCabeEmbaixo && acimaDoBotao >= 0 ? acimaDoBotao : posicao.top,
      right: posicao.right,
    };
  };

  // Função chamada no JSX, não componente: identidade nova a cada render
  // remontaria a lista (ver CLAUDE.md).
  const renderLista = (posicao: Ancora | typeof SEM_MEDIDA) => (
    // Pressable só para absorver o clique entre os itens: sem ele, o clique
    // no espaço da lista subiria até a linha clicável.
    <Pressable
      onPress={pararPropagacao}
      accessible={false}
      tabIndex={-1}
      accessibilityRole="menu"
      accessibilityLabel="Ações da linha"
      onLayout={posicao === SEM_MEDIDA ? undefined : medirLista}
      style={[
        styles.lista,
        posicao === SEM_MEDIDA
          ? styles.listaSemAncora
          : estiloDaPosicao(posicao),
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
  );

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
        {ancora ? renderLista(ancora) : null}
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
  // Onde não há medida: canto superior direito.
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
