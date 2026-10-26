import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type {
  BulkParadaInput,
  EnderecoLocalizado,
  ImportParadasFn,
  LocalizarLoteFn,
} from '@/hooks/nova-entrega/useParadasManagement';
import { formatarDecimal } from '@/lib/formatNumber';
import {
  DISTANCIA_CONFERIR_LOTE_KM,
  type FonteEnderecoLote,
} from '@/lib/nova-entrega/localizarEnderecoLote';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface BulkStopImporterProps {
  onLocalizar: LocalizarLoteFn;
  onImport: ImportParadasFn;
  disabled?: boolean;
}

type Etapa = 'colar' | 'conferir';

interface Correcao {
  linha: number;
  texto: string;
  erro: string | null;
  emVoo: boolean;
}

/**
 * Rótulo da origem da coordenada. O CEP sai do ViaCEP, mas a POSIÇÃO vem do
 * Photon sem viés da sede — é a do logradouro/CEP, não a do número; dizer só
 * "CEP" faria o gestor confiar demais nela.
 */
const ROTULO_FONTE: Record<FonteEnderecoLote, string> = {
  google: 'Google',
  viacep: 'CEP (posição aproximada)',
  photon: 'Photon',
};

const PREFIXO_LINHA = /^Linha (\d+): /;

/**
 * Depois de adicionar, o campo fica só com as linhas que não entraram — e a
 * linha 5 do texto antigo vira, digamos, a 2 do novo. Reescreve "Linha N:"
 * pela numeração nova, para a mensagem apontar o que está na tela; mensagem
 * sem esse prefixo passa intacta.
 */
function renumerarMensagens(
  mensagens: string[],
  linhaNova: Map<number, number>,
): string[] {
  return mensagens
    .map((mensagem) => {
      const original = Number(PREFIXO_LINHA.exec(mensagem)?.[1]);
      const nova = linhaNova.get(original);
      return {
        ordem: nova ?? Number.MAX_SAFE_INTEGER,
        texto:
          nova == null
            ? mensagem
            : mensagem.replace(PREFIXO_LINHA, `Linha ${nova}: `),
      };
    })
    .sort((a, b) => a.ordem - b.ordem)
    .map(({ texto }) => texto);
}

function rotuloAdicionar(quantidade: number): string {
  return quantidade === 1
    ? 'Adicionar 1 parada'
    : `Adicionar ${quantidade} paradas`;
}

function splitSemicolonLine(line: string): {
  values: string[];
  hasUnclosedQuote: boolean;
} {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ';' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return { values, hasUnclosedQuote: quoted };
}

export function parseBulkStops(text: string): {
  items: BulkParadaInput[];
  errors: string[];
} {
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({
      value: line.trim(),
      lineNumber: index + 1,
    }))
    .filter((line) => line.value.length > 0);

  if (lines[0]?.value.toLowerCase().startsWith('tipo;')) lines.shift();

  const items = lines.flatMap(({ value, lineNumber }) => {
    const parsedLine = splitSemicolonLine(value);
    if (
      parsedLine.hasUnclosedQuote ||
      parsedLine.values.length < 4 ||
      parsedLine.values.length > 5
    ) {
      errors.push(
        `Linha ${lineNumber}: use 4 ou 5 colunas separadas por ponto e vírgula.`,
      );
      return [];
    }

    const [type, address, recipient, phone, observations = ''] =
      parsedLine.values;
    const normalizedType = type?.trim().toLowerCase();
    const digits = (phone || '').replace(/\D/g, '');

    if (normalizedType !== 'entrega' && normalizedType !== 'retirada') {
      errors.push(`Linha ${lineNumber}: tipo deve ser entrega ou retirada.`);
      return [];
    }
    if (!address || address.length < 5) {
      errors.push(`Linha ${lineNumber}: endereço inválido.`);
      return [];
    }
    if (!recipient || recipient.length < 3) {
      errors.push(`Linha ${lineNumber}: destinatário inválido.`);
      return [];
    }
    if (digits.length !== 10 && digits.length !== 11) {
      errors.push(`Linha ${lineNumber}: telefone inválido.`);
      return [];
    }

    return [
      {
        tipo: normalizedType as 'entrega' | 'retirada',
        endereco: address,
        destinatario: recipient,
        telefone: phone,
        observacoes: observations,
        linha: lineNumber,
      },
    ];
  });

  return { items, errors };
}

interface LinhaConferenciaProps {
  localizado: EnderecoLocalizado;
  correcao: Correcao | null;
  bloqueada: boolean;
  onCorrigir: (localizado: EnderecoLocalizado) => void;
  onRemover: (linha: number) => void;
  onTextoCorrecao: (texto: string) => void;
  onLocalizarCorrecao: () => void;
  onCancelarCorrecao: () => void;
}

/**
 * Uma linha da conferência. Componente no nível do módulo (nunca declarado
 * dentro do render do importador): identidade nova a cada render remontaria a
 * linha e tiraria o foco do campo de correção a cada tecla.
 */
function LinhaConferencia({
  localizado,
  correcao,
  bloqueada,
  onCorrigir,
  onRemover,
  onTextoCorrecao,
  onLocalizarCorrecao,
  onCancelarCorrecao,
}: LinhaConferenciaProps) {
  const { theme } = useUnistyles();
  const { linha, item, enderecoEncontrado, fonte, distanciaSedeKm } =
    localizado;
  const longe =
    distanciaSedeKm != null && distanciaSedeKm > DISTANCIA_CONFERIR_LOTE_KM;

  return (
    <View style={[styles.linha, longe && styles.linhaLonge]}>
      <View style={styles.linhaTopo}>
        <Text style={styles.linhaNumero}>{`Linha ${linha}`}</Text>
        <Text style={styles.fonte}>{ROTULO_FONTE[fonte]}</Text>
      </View>

      <Text style={styles.rotulo}>Colado</Text>
      <Text style={styles.colado}>{item.endereco}</Text>
      <Text style={styles.rotulo}>Encontrado</Text>
      <Text style={styles.encontrado}>{enderecoEncontrado}</Text>

      {distanciaSedeKm != null && (
        <View style={styles.distanciaLinha}>
          <Text style={styles.distancia}>
            {`${formatarDecimal(distanciaSedeKm)} km da sede`}
          </Text>
          {longe && (
            <View style={styles.seloLonge}>
              <Ionicons
                name="warning-outline"
                size={14}
                color={theme.colors.warning}
              />
              <Text style={styles.seloLongeTexto}>
                {`Mais de ${DISTANCIA_CONFERIR_LOTE_KM} km da sede — confira`}
              </Text>
            </View>
          )}
        </View>
      )}

      {correcao ? (
        <View style={styles.correcao}>
          <TextInput
            style={styles.correcaoInput}
            value={correcao.texto}
            onChangeText={onTextoCorrecao}
            editable={!correcao.emVoo}
            autoFocus
            accessibilityLabel={`Endereço da linha ${linha}`}
          />
          {correcao.erro && (
            <Text style={styles.errorText}>{correcao.erro}</Text>
          )}
          <View style={styles.linhaAcoes}>
            <TouchableOpacity
              style={styles.acaoSecundaria}
              onPress={onCancelarCorrecao}
              disabled={correcao.emVoo}
              accessibilityRole="button"
            >
              <Text style={styles.acaoSecundariaTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acaoPrimaria}
              onPress={onLocalizarCorrecao}
              disabled={correcao.emVoo || correcao.texto.trim().length < 5}
              accessibilityRole="button"
            >
              {correcao.emVoo ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.acaoPrimariaTexto}>Localizar de novo</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.linhaAcoes}>
          <TouchableOpacity
            style={styles.acaoSecundaria}
            onPress={() => onCorrigir(localizado)}
            disabled={bloqueada}
            accessibilityRole="button"
            accessibilityLabel={`Corrigir linha ${linha}`}
          >
            <Text style={styles.acaoSecundariaTexto}>Corrigir</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acaoSecundaria}
            onPress={() => onRemover(linha)}
            disabled={bloqueada}
            accessibilityRole="button"
            accessibilityLabel={`Remover linha ${linha}`}
          >
            <Text style={styles.acaoRemoverTexto}>Remover</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/**
 * Importação em lote em duas etapas: colar → conferir. "Localizar endereços"
 * só resolve as linhas; nada vira parada até o gestor conferir texto colado ×
 * endereço encontrado e tocar em "Adicionar N paradas".
 */
export function BulkStopImporter({
  onLocalizar,
  onImport,
  disabled = false,
}: BulkStopImporterProps) {
  const { theme } = useUnistyles();
  const [visible, setVisible] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>('colar');
  const [text, setText] = useState('');
  const [progresso, setProgresso] = useState<{
    atual: number;
    total: number;
  } | null>(null);
  const [conferencia, setConferencia] = useState<EnderecoLocalizado[]>([]);
  const [errosLocalizacao, setErrosLocalizacao] = useState<string[]>([]);
  const [removidas, setRemovidas] = useState<number[]>([]);
  const [correcao, setCorrecao] = useState<Correcao | null>(null);
  const [resultErrors, setResultErrors] = useState<string[]>([]);
  const parsed = useMemo(() => parseBulkStops(text), [text]);

  const localizando = progresso !== null;
  const podeLocalizar =
    !localizando && parsed.items.length > 0 && parsed.errors.length === 0;

  const limparConferencia = () => {
    setConferencia([]);
    setErrosLocalizacao([]);
    setRemovidas([]);
    setCorrecao(null);
  };

  const fechar = () => {
    if (localizando) return;
    setVisible(false);
    setEtapa('colar');
    limparConferencia();
  };

  const voltar = () => {
    setEtapa('colar');
    limparConferencia();
  };

  /*
   * Andamento: o hook avisa por callback (`onProgresso`) em vez de a tela
   * iterar `localizarEnderecoLote` linha a linha. Iterar aqui exigiria repetir
   * a regra de limite/duplicata do hook (ou exportá-la e cuidar da ordem) e
   * levar a sede até o componente; o callback mantém a regra num lugar só.
   */
  const handleLocalizar = async () => {
    if (!podeLocalizar) return;
    setResultErrors([]);
    setProgresso({ atual: 0, total: parsed.items.length });
    try {
      const resultado = await onLocalizar(parsed.items, {
        onProgresso: (atual, total) => setProgresso({ atual, total }),
      });
      setConferencia(resultado.localizados);
      setErrosLocalizacao(resultado.erros);
      setRemovidas([]);
      setCorrecao(null);
      setEtapa('conferir');
    } finally {
      setProgresso(null);
    }
  };

  const remover = (linha: number) => {
    setConferencia((atual) => atual.filter((item) => item.linha !== linha));
    setRemovidas((atual) => [...atual, linha]);
    setCorrecao((atual) => (atual?.linha === linha ? null : atual));
  };

  /*
   * "Corrigir" passa pelo mesmo `onLocalizar` do lote, com uma linha só: assim
   * a linha corrigida também confere limite e duplicata contra a rota. A
   * duplicata contra as OUTRAS linhas da conferência fica para o
   * `importParadas`, que confere tudo de novo antes de criar.
   */
  const localizarCorrecao = async () => {
    if (!correcao || correcao.emVoo) return;
    const original = conferencia.find((item) => item.linha === correcao.linha);
    if (!original) return;
    const linha = correcao.linha;
    setCorrecao({ ...correcao, emVoo: true, erro: null });
    const resultado = await onLocalizar([
      { ...original.item, endereco: correcao.texto.trim() },
    ]);
    const novo = resultado.localizados[0];
    if (novo) {
      setConferencia((atual) =>
        atual.map((item) => (item.linha === linha ? novo : item)),
      );
      setCorrecao(null);
      return;
    }
    setCorrecao((atual) =>
      atual?.linha === linha
        ? {
            ...atual,
            emVoo: false,
            erro:
              resultado.erros[0] ?? `Linha ${linha}: endereço não localizado.`,
          }
        : atual,
    );
  };

  const handleAdicionar = () => {
    if (conferencia.length === 0 || correcao?.emVoo) return;
    const resultado = onImport(conferencia, {
      foraDoLote: parsed.items.length - conferencia.length,
    });

    // Ruling: o campo fica só com as linhas que não entraram (falha de
    // localização, removidas, recusadas na fase 2), no texto ORIGINAL colado.
    const entraram = new Set(resultado.linhasAdicionadas);
    const ficam = parsed.items.filter((item) => !entraram.has(item.linha));
    const linhasDoTexto = text.split(/\r?\n/);
    const linhaNova = new Map(
      ficam.map((item, indice) => [item.linha, indice + 1]),
    );

    limparConferencia();
    setEtapa('colar');

    if (ficam.length === 0) {
      setText('');
      setResultErrors([]);
      setVisible(false);
      return;
    }

    setText(ficam.map((item) => linhasDoTexto[item.linha - 1]).join('\n'));
    setResultErrors(
      renumerarMensagens(
        [
          ...errosLocalizacao,
          ...removidas.map(
            (linha) => `Linha ${linha}: removida na conferência.`,
          ),
          ...resultado.erros,
        ],
        linhaNova,
      ),
    );
  };

  const renderErros = (erros: string[]) =>
    erros.length > 0 && (
      <ScrollView style={styles.errorList}>
        {erros.map((error) => (
          <Text key={error} style={styles.errorText}>
            • {error}
          </Text>
        ))}
      </ScrollView>
    );

  const renderEtapaColar = () => (
    <>
      <Text style={styles.format}>
        tipo;endereço;destinatário;telefone;observações
      </Text>
      <TextInput
        style={styles.textArea}
        value={text}
        onChangeText={(value) => {
          setText(value);
          setResultErrors([]);
        }}
        editable={!localizando}
        multiline
        numberOfLines={10}
        placeholder={
          'entrega;Rua Exemplo, 100, Bairro, Cidade - UF;Maria;(83) 99999-0000;Portaria'
        }
        textAlignVertical="top"
        accessibilityLabel="Linhas de paradas para importação"
      />
      {renderErros([...parsed.errors, ...resultErrors])}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={fechar}
          disabled={localizando}
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.importButton,
            !podeLocalizar && !localizando && styles.importButtonDisabled,
          ]}
          onPress={handleLocalizar}
          disabled={!podeLocalizar}
          accessibilityRole="button"
        >
          {localizando ? (
            <View style={styles.progresso}>
              <ActivityIndicator size="small" color={theme.colors.white} />
              <Text style={styles.importText}>
                {`Localizando ${progresso.atual} de ${progresso.total}…`}
              </Text>
            </View>
          ) : (
            <Text style={styles.importText}>Localizar endereços</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  const renderEtapaConferir = () => (
    <>
      <ScrollView style={styles.listaConferencia}>
        {conferencia.map((localizado) => (
          <LinhaConferencia
            key={localizado.linha}
            localizado={localizado}
            correcao={correcao?.linha === localizado.linha ? correcao : null}
            bloqueada={correcao?.emVoo ?? false}
            onCorrigir={(alvo) =>
              setCorrecao({
                linha: alvo.linha,
                texto: alvo.item.endereco,
                erro: null,
                emVoo: false,
              })
            }
            onRemover={remover}
            onTextoCorrecao={(texto) =>
              setCorrecao((atual) => (atual ? { ...atual, texto } : atual))
            }
            onLocalizarCorrecao={localizarCorrecao}
            onCancelarCorrecao={() => setCorrecao(null)}
          />
        ))}
        {conferencia.length === 0 && (
          <Text style={styles.vazio}>
            Nenhuma linha para adicionar. Volte e corrija o texto.
          </Text>
        )}
      </ScrollView>
      {renderErros(errosLocalizacao)}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={voltar}
          disabled={correcao?.emVoo}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>Voltar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.importButton,
            conferencia.length === 0 && styles.importButtonDisabled,
          ]}
          onPress={handleAdicionar}
          disabled={conferencia.length === 0 || (correcao?.emVoo ?? false)}
          accessibilityRole="button"
        >
          <Text style={styles.importText}>
            {rotuloAdicionar(conferencia.length)}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <>
      <TouchableOpacity
        style={styles.openButton}
        onPress={() => setVisible(true)}
        disabled={disabled}
        accessibilityRole="button"
      >
        <Ionicons
          name="document-text-outline"
          size={18}
          color={theme.colors.primary}
        />
        <Text style={styles.openButtonText}>Importar em lote</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={fechar}
      >
        <Pressable style={styles.overlay} onPress={fechar}>
          <Pressable
            style={styles.modal}
            onPress={(event) => event.stopPropagation()}
            accessibilityViewIsModal
          >
            <View style={styles.header}>
              <View style={styles.headerTexto}>
                <Text style={styles.title}>Importar paradas em lote</Text>
                <Text style={styles.subtitle}>
                  {etapa === 'colar'
                    ? 'Cole uma linha por parada, separada por ponto e vírgula'
                    : 'Confira cada endereço encontrado antes de adicionar'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={fechar}
                disabled={localizando}
                accessibilityLabel="Fechar importação em lote"
              >
                <Ionicons name="close" size={24} color={theme.colors.gray600} />
              </TouchableOpacity>
            </View>
            {etapa === 'colar' ? renderEtapaColar() : renderEtapaConferir()}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  openButtonText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90%',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.xl,
  },
  subtitle: {
    color: theme.colors.gray500,
    fontSize: theme.typography.sm,
    marginTop: theme.spacing.xs,
  },
  format: {
    color: theme.colors.primaryDark,
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.sm,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryBg,
    borderRadius: theme.borderRadius.md,
  },
  textArea: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    color: theme.colors.gray900,
    marginTop: theme.spacing.md,
  },
  errorList: {
    maxHeight: 100,
    marginTop: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.xs,
    marginBottom: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center',
  },
  cancelText: {
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  importButton: {
    minHeight: 44,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary,
  },
  importButtonDisabled: {
    backgroundColor: theme.colors.gray400,
    opacity: 0.6,
  },
  importText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansBold,
  },
  headerTexto: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  progresso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  listaConferencia: {
    marginTop: theme.spacing.md,
    flexShrink: 1,
  },
  vazio: {
    color: theme.colors.gray500,
    fontSize: theme.typography.sm,
    paddingVertical: theme.spacing.lg,
    textAlign: 'center',
  },
  linha: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  linhaLonge: {
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.warningBg,
  },
  linhaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  linhaNumero: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.sm,
  },
  fonte: {
    color: theme.colors.gray600,
    fontSize: theme.typography.xs,
  },
  rotulo: {
    color: theme.colors.gray500,
    fontSize: theme.typography.xs,
    marginTop: theme.spacing.xs,
  },
  colado: {
    color: theme.colors.gray700,
    fontSize: theme.typography.sm,
  },
  encontrado: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  distanciaLinha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  distancia: {
    color: theme.colors.gray600,
    fontSize: theme.typography.xs,
  },
  seloLonge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  seloLongeTexto: {
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.xs,
  },
  linhaAcoes: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  acaoSecundaria: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
  },
  acaoSecundariaTexto: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  acaoRemoverTexto: {
    color: theme.colors.error,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  acaoPrimaria: {
    minHeight: 44,
    minWidth: 140,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary,
  },
  acaoPrimariaTexto: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.sm,
  },
  correcao: {
    marginTop: theme.spacing.sm,
  },
  correcaoInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.gray900,
  },
}));
