/**
 * Fila de incidentes reportados sem rede (pendência 30(k)).
 *
 * POR QUE EXISTE. Sem sinal, o wizard de incidente só dizia "tente de novo
 * quando o sinal voltar" — e o motorista, no meio da rua, tinha de lembrar de
 * refazer o reporte inteiro (categoria, texto, foto). Agora o reporte fica no
 * aparelho e sobe sozinho, pelo mesmo orquestrador das fotos e das ações de
 * parada (`solicitarEnvioFila` em `src/lib/offline.ts`), depois delas.
 *
 * Segue o modelo de `filaAcoesParada.ts`:
 * - **Idempotente pelo `id`.** O id do incidente nasce no aparelho e vai como
 *   `incidentes.id` (a coluna aceita id do cliente: está no GRANT de INSERT).
 *   Se o INSERT gravou e a resposta se perdeu, o reenvio bate na chave
 *   primária (23505) e conta como enviado — nunca duas linhas.
 * - **A foto sobe ANTES da linha**, como a do comprovante offline: cópia
 *   durável no aparelho ao enfileirar (o cache da câmera pode ser limpo pelo
 *   sistema), upload para `incidentes/…` (a policy de INSERT do Storage aceita
 *   essa pasta para o dono do objeto) e o path guardado no item antes do
 *   INSERT, para o reenvio não subir a foto de novo.
 * - **Por motorista.** O item guarda o `motoristaId`; só a sessão dessa pessoa
 *   o envia (a de outra conta nem toca no item).
 * - **Recusa vira aviso, rede não conta.** Rede, sessão, 5xx/408/429: espera,
 *   sem contar tentativa (`ehErroDefinitivo`, o mesmo classificador da fila de
 *   paradas). Permissão (42501, a rota passou a outro motorista) e violação de
 *   integridade (classe 23): o servidor vai responder igual sempre — descarta
 *   na hora, com aviso. Outra recusa definitiva conta tentativa e descarta no
 *   limite (`MAX_TENTATIVAS`).
 * - **Ordem preservada.** Falha de rede para o lote; o resto espera.
 *
 * O acesso ao servidor entra por uma porta (`PortaIncidentes`): os testes usam
 * um servidor em memória com as mesmas regras; o app, `portaIncidentesSupabase`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { lerJsonParaExibir, lerJsonParaGravar } from '@/lib/leituraLocal';
import { logger } from '@/lib/logger';
import { logIncidenteAction } from '@/lib/queries';
import type { IncidenteCategoria } from '@/lib/queries';
import { criarSerie } from '@/lib/serie';
import { enviarFotoDeIncidente } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

import {
  ehErroDefinitivo,
  lerUsuarioParaEnvio,
  MAX_TENTATIVAS,
} from './filaAcoesParada';

const CHAVE_FILA = '@rotamestre:fila_incidentes';
const CHAVE_DESCARTES = '@rotamestre:fila_incidentes_descartes';
const DIRETORIO_FOTOS = `${FileSystem.documentDirectory}offline_incidentes/`;

export interface IncidenteNaFila {
  /** Gerado no aparelho; vira `incidentes.id` (chave da idempotência). */
  id: string;
  /** Quem reportou; só a sessão dele envia. */
  motoristaId: string;
  rotaId: string | null;
  paradaId: string | null;
  categoria: IncidenteCategoria;
  descricao: string;
  endereco: string;
  /** Cópia durável da foto no aparelho, até subir. */
  fotoLocal?: string;
  /** Path no Storage, quando a foto já subiu (o reenvio não sobe de novo). */
  fotoPath?: string;
  /** Momento do reporte no aparelho. */
  em: string;
  /** Recusas definitivas já sofridas (rede não conta). */
  tentativas: number;
}

export type MotivoDescarteIncidente = 'recusado' | 'falha_persistente';

export interface DescarteDeIncidente {
  incidente: IncidenteNaFila;
  motivo: MotivoDescarteIncidente;
  em: string;
}

export interface PortaIncidentes {
  /** Sobe a foto e devolve o path. Lança na falha. */
  subirFoto(incidente: IncidenteNaFila, fotoLocal: string): Promise<string>;
  /** INSERT da linha com o `id` do item. Lança na falha (23505 inclusive). */
  inserir(incidente: IncidenteNaFila, fotoPath: string | null): Promise<void>;
  /** Rastro `incidente_reportado` em `logs`. Não lança (fire-and-forget). */
  registrar(incidente: IncidenteNaFila, fotoPath: string | null): Promise<void>;
}

// ---------------------------------------------------------------------------
// Persistência (serializada, como em filaAcoesParada)
// ---------------------------------------------------------------------------

let emSerie = criarSerie();

function lerParaGravar<T>(chave: string): Promise<T[]> {
  return lerJsonParaGravar<T[]>(chave, []);
}

async function gravarLista<T>(chave: string, lista: T[]): Promise<void> {
  await AsyncStorage.setItem(chave, JSON.stringify(lista));
}

/** Lê, muda e grava a fila num passo só da série. */
function mudarFila(
  mudar: (fila: IncidenteNaFila[]) => IncidenteNaFila[],
): Promise<void> {
  return emSerie(async () => {
    const fila = await lerParaGravar<IncidenteNaFila>(CHAVE_FILA);
    await gravarLista(CHAVE_FILA, mudar(fila));
  });
}

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();

/** Avisa quem mostra "reporte aguardando envio" que a fila mudou. */
export function ouvirFilaIncidentes(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function avisarOuvintes() {
  ouvintes.forEach((o) => {
    try {
      o();
    } catch (error) {
      logger.warn('[FilaIncidentes] Ouvinte falhou', error);
    }
  });
}

/** Só para ler/exibir: na falha devolve vazio. */
export function lerFilaIncidentes(): Promise<IncidenteNaFila[]> {
  return lerJsonParaExibir<IncidenteNaFila[]>(
    CHAVE_FILA,
    [],
    '[FilaIncidentes] Falha ao ler a fila',
  );
}

/**
 * Copia a foto para um diretório do app (o cache da câmera pode ser limpo
 * pelo sistema antes de a rede voltar), como `savePhotoOffline`. Na web não
 * há FileSystem: a URI vale enquanto a aba viver.
 */
async function guardarFotoNoAparelho(
  fotoUri: string,
  incidenteId: string,
): Promise<string> {
  if (Platform.OS === 'web' || fotoUri.startsWith(DIRETORIO_FOTOS)) {
    return fotoUri;
  }
  const dir = await FileSystem.getInfoAsync(DIRETORIO_FOTOS);
  if (!dir.exists) {
    await FileSystem.makeDirectoryAsync(DIRETORIO_FOTOS, {
      intermediates: true,
    });
  }
  const destino = `${DIRETORIO_FOTOS}${incidenteId}.jpg`;
  await FileSystem.copyAsync({ from: fotoUri, to: destino });
  return destino;
}

async function apagarFotoDoAparelho(fotoLocal?: string): Promise<void> {
  if (!fotoLocal || Platform.OS === 'web') return;
  if (!fotoLocal.startsWith(DIRETORIO_FOTOS)) return;
  try {
    await FileSystem.deleteAsync(fotoLocal, { idempotent: true });
  } catch (error) {
    // Não crítico: sobra um arquivo no diretório do app.
    logger.warn('[FilaIncidentes] Falha ao apagar a foto local', error);
  }
}

/**
 * A foto guardada ainda pode ser lida? Na web a fila guarda a URI `blob:` do
 * seletor, que morre ao recarregar a aba: a leitura dela (local, não é rede)
 * falha com TypeError, que a fila tomaria por falha de rede e esperaria para
 * sempre. Ler aqui e tratar a falha como "foto sumiu" faz o reporte subir sem
 * ela, como no nativo com a cópia apagada. Alternativa descartada: enfileirar
 * sem foto na web — perderia também a foto da aba que nunca foi recarregada.
 */
async function fotoExiste(fotoLocal: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (!/^(blob|data):/.test(fotoLocal)) return true;
    try {
      await fetch(fotoLocal);
      return true;
    } catch {
      // URI de outra sessão da aba: a foto não existe mais.
      return false;
    }
  }
  return (await FileSystem.getInfoAsync(fotoLocal)).exists;
}

/**
 * Guarda o incidente no aparelho, com cópia durável da foto. O mesmo `id` não
 * entra duas vezes. Lança se não conseguir guardar (quem chama avisa que o
 * reporte NÃO ficou salvo).
 */
export async function enfileirarIncidente(i: IncidenteNaFila): Promise<void> {
  const fotoLocal =
    i.fotoLocal && !i.fotoPath
      ? await guardarFotoNoAparelho(i.fotoLocal, i.id)
      : undefined;
  const item: IncidenteNaFila = { ...i, fotoLocal };
  await mudarFila((fila) =>
    fila.some((x) => x.id === item.id) ? fila : [...fila, item],
  );
  avisarOuvintes();
}

export async function lerDescartesDeIncidentes(
  motoristaId: string,
): Promise<DescarteDeIncidente[]> {
  const todos = await lerJsonParaExibir<DescarteDeIncidente[]>(
    CHAVE_DESCARTES,
    [],
    '[FilaIncidentes] Falha ao ler os descartes',
  );
  return todos.filter((d) => d.incidente.motoristaId === motoristaId);
}

export async function dispensarDescartesDeIncidentes(
  motoristaId: string,
): Promise<void> {
  await emSerie(async () => {
    const todos = await lerParaGravar<DescarteDeIncidente>(CHAVE_DESCARTES);
    await gravarLista(
      CHAVE_DESCARTES,
      todos.filter((d) => d.incidente.motoristaId !== motoristaId),
    );
  });
  avisarOuvintes();
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

/** A mesma resposta virá sempre: descartar já, sem gastar tentativas. */
function ehRecusaPermanente(erro: unknown): boolean {
  const code = (erro as { code?: unknown } | null)?.code;
  return typeof code === 'string' && (code === '42501' || /^23/.test(code));
}

function ehDuplicata(erro: unknown): boolean {
  return (erro as { code?: unknown } | null)?.code === '23505';
}

async function descartar(
  item: IncidenteNaFila,
  motivo: MotivoDescarteIncidente,
): Promise<void> {
  await emSerie(async () => {
    const todos = await lerParaGravar<DescarteDeIncidente>(CHAVE_DESCARTES);
    todos.push({ incidente: item, motivo, em: new Date().toISOString() });
    await gravarLista(CHAVE_DESCARTES, todos);
  });
  await mudarFila((fila) => fila.filter((x) => x.id !== item.id));
  await apagarFotoDoAparelho(item.fotoLocal);
}

async function contarTentativa(id: string): Promise<number> {
  let tentativas = 0;
  await mudarFila((fila) =>
    fila.map((x) => {
      if (x.id !== id) return x;
      tentativas = x.tentativas + 1;
      return { ...x, tentativas };
    }),
  );
  return tentativas;
}

/**
 * Envia um item: `inserido` agora, ou `ja_existia` (gravado antes), com o
 * path da foto que foi junto (null = sem foto). Lança
 * o erro do servidor quando não houve resposta definitiva ou houve recusa.
 */
async function enviarItem(
  item: IncidenteNaFila,
  porta: PortaIncidentes,
): Promise<{ resultado: 'inserido' | 'ja_existia'; fotoPath: string | null }> {
  let fotoPath = item.fotoPath ?? null;
  if (!fotoPath && item.fotoLocal) {
    if (await fotoExiste(item.fotoLocal)) {
      try {
        fotoPath = await porta.subirFoto(item, item.fotoLocal);
      } catch (erroFoto) {
        // Rede/5xx: o reporte espera junto com a foto. Recusa definitiva da
        // foto (tamanho, policy do bucket): ela nunca vai passar — o reporte
        // sobe sem ela, como o envio na hora faz com `fotoPerdida`, em vez de
        // gastar as tentativas e descartar o reporte inteiro.
        if (!ehErroDefinitivo(erroFoto)) throw erroFoto;
        logger.warn('[FilaIncidentes] Foto recusada; envia sem ela', erroFoto);
      }
      if (fotoPath) {
        // Guarda o path ANTES do INSERT: se ele cair, o reenvio não sobe a
        // foto de novo (um objeto a mais no Storage seria só custo).
        const path = fotoPath;
        await mudarFila((fila) =>
          fila.map((x) => (x.id === item.id ? { ...x, fotoPath: path } : x)),
        );
      }
    } else {
      // Cópia apagada (limpeza do sistema, app reinstalado): o reporte vale
      // mais que a foto, e travar aqui seguraria a fila para sempre.
      logger.warn('[FilaIncidentes] Foto local sumiu; envia sem ela', item.id);
    }
  }
  try {
    await porta.inserir(item, fotoPath);
    return { resultado: 'inserido', fotoPath };
  } catch (erro) {
    // Gravou numa tentativa anterior e a resposta se perdeu.
    if (ehDuplicata(erro)) return { resultado: 'ja_existia', fotoPath };
    throw erro;
  }
}

export async function processarFilaIncidentes({
  usuarioAtual,
  porta = portaIncidentesSupabase,
}: {
  usuarioAtual: string;
  porta?: PortaIncidentes;
}): Promise<{ enviados: number; descartados: number }> {
  let enviados = 0;
  let descartados = 0;
  try {
    const meus = (await lerFilaIncidentes()).filter(
      (i) => i.motoristaId === usuarioAtual,
    );
    for (const item of meus) {
      try {
        const { fotoPath } = await enviarItem(item, porta);
        // Rastro também no `ja_existia`: a tentativa que gravou a linha perdeu
        // a resposta antes de registrar.
        void porta
          .registrar(item, fotoPath)
          .catch((e) => logger.warn('[FilaIncidentes] Falha no rastro', e));
        await mudarFila((fila) => fila.filter((x) => x.id !== item.id));
        await apagarFotoDoAparelho(item.fotoLocal);
        enviados++;
      } catch (erro) {
        // Rede, sessão, 5xx/408/429, erro sem código: espera a próxima vez,
        // e os seguintes esperam junto (ordem).
        if (!ehErroDefinitivo(erro)) break;
        logger.warn('[FilaIncidentes] Servidor recusou o incidente', erro);
        if (ehRecusaPermanente(erro)) {
          await descartar(item, 'recusado');
          descartados++;
          continue;
        }
        if ((await contarTentativa(item.id)) >= MAX_TENTATIVAS) {
          await descartar(item, 'falha_persistente');
          descartados++;
        }
      }
    }
  } finally {
    avisarOuvintes();
  }
  return { enviados, descartados };
}

/**
 * Envia a fila com a sessão atual — chamado por `solicitarEnvioFila`, depois
 * das fotos e das ações de parada. Sem item guardado, nem lê a sessão; sem
 * sessão, espera.
 */
export async function sincronizarFilaIncidentes(
  porta: PortaIncidentes = portaIncidentesSupabase,
): Promise<{ enviados: number; descartados: number }> {
  const vazio = { enviados: 0, descartados: 0 };
  if ((await lerFilaIncidentes()).length === 0) return vazio;
  try {
    const usuarioAtual = await lerUsuarioParaEnvio();
    if (!usuarioAtual) return vazio;
    return await processarFilaIncidentes({ usuarioAtual, porta });
  } catch (error) {
    logger.warn('[FilaIncidentes] Falha ao sincronizar a fila', error);
    return vazio;
  }
}

// ---------------------------------------------------------------------------
// Porta real (Supabase)
// ---------------------------------------------------------------------------

export const portaIncidentesSupabase: PortaIncidentes = {
  async subirFoto(incidente, fotoLocal) {
    // Nome novo a cada tentativa: um upload que passou com a resposta perdida
    // não é sobrescrito (a policy do bucket não dá UPDATE em `storage.objects`).
    return enviarFotoDeIncidente(
      fotoLocal,
      `${incidente.id}_${Date.now()}.jpg`,
    );
  },

  async inserir(incidente, fotoPath) {
    const { error } = await supabase.from('incidentes').insert({
      id: incidente.id,
      motorista_id: incidente.motoristaId,
      rota_id: incidente.rotaId,
      parada_id: incidente.paradaId,
      categoria: incidente.categoria,
      descricao: incidente.descricao,
      endereco: incidente.endereco,
      foto_url: fotoPath,
      status: 'aberto',
    });
    if (error) throw error;
  },

  async registrar(incidente, fotoPath) {
    // Rastro, como no envio na hora (`logAction` não lança). A parada vai em
    // `detalhes`: `logs` não tem coluna `parada_id`.
    if (incidente.rotaId) {
      await logIncidenteAction(
        incidente.motoristaId,
        incidente.id,
        'incidente_reportado',
        {
          categoria: incidente.categoria,
          descricao: incidente.descricao,
          tem_foto: !!(fotoPath || incidente.fotoLocal),
          foto_upload_sucesso: !!fotoPath,
          parada_id: incidente.paradaId,
          endereco: incidente.endereco,
          rota_id: incidente.rotaId,
          enviado_da_fila: true,
          reportado_em: incidente.em,
        },
      );
    }
  },
};

/**
 * Zera a fila de escrita e os ouvintes.
 * @internal só para testes.
 */
export function _resetFilaIncidentes(): void {
  emSerie = criarSerie();
  ouvintes.clear();
}
