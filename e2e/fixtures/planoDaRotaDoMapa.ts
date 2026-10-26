/**
 * Decisões puras do fixture do mapa sobre QUAL rota usar e, quando nenhuma
 * serve, como montar a cópia criada por `criar_rota_com_paradas`. Fica fora de
 * `garantir-rota-do-mapa.ts` para ser testável sem tocar o banco.
 *
 * POR QUE O FIXTURE CRIA EM VEZ DE REABRIR. Desde a Migration 75, rota
 * `cancelada`, `concluida` ou `nao_executada` não muda de status por UPDATE
 * vindo da API (P0001 ROTA_ENCERRADA). O fixture reabria a rota demo assim;
 * agora, sem rota aberta, ele cria uma cópia da mais recente pela mesma RPC do
 * painel e a inicia como o app (`pendente → em_andamento`, que segue valendo).
 */
import { createHash } from 'crypto';

export const STATUS_ENCERRADOS = [
  'cancelada',
  'concluida',
  'nao_executada',
] as const;

export interface RotaCandidata {
  id: string;
  status: string;
  data: string;
  created_at: string;
  iniciada_em: string | null;
  concluida_em: string | null;
}

export type PlanoDaRotaDoMapa<R extends RotaCandidata> =
  | { tipo: 'usar'; rota: R }
  | { tipo: 'criar'; modelo: R }
  | { tipo: 'sem-rota' };

const porDataECriacao = (a: RotaCandidata, b: RotaCandidata) =>
  a.data === b.data
    ? a.created_at.localeCompare(b.created_at)
    : a.data.localeCompare(b.data);

/**
 * Com rota aberta, usa a MESMA que o app do motorista abre
 * (`useLoadActiveRoute`: a `em_andamento` de data mais antiga, senão a
 * `pendente` de data mais antiga; empate pela criação) e nunca cria outra —
 * duas rotas ativas fazem o app e o e2e abrirem rotas diferentes. Sem rota
 * aberta, a encerrada mais recente vira o modelo da cópia.
 */
export function escolherRotaDoMapa<R extends RotaCandidata>(
  rotas: ReadonlyArray<R>,
): PlanoDaRotaDoMapa<R> {
  if (rotas.length === 0) return { tipo: 'sem-rota' };

  const ordenadas = [...rotas].sort(porDataECriacao);
  const emAndamento = ordenadas.find((r) => r.status === 'em_andamento');
  if (emAndamento) return { tipo: 'usar', rota: emAndamento };
  const pendente = ordenadas.find((r) => r.status === 'pendente');
  if (pendente) return { tipo: 'usar', rota: pendente };

  return { tipo: 'criar', modelo: ordenadas[ordenadas.length - 1] };
}

/**
 * `p_request_id` derivado do modelo: dois PRs que rodam o fixture ao mesmo
 * tempo sobre a mesma rota encerrada mandam a mesma chave, e a RPC (trava
 * consultiva + `client_request_id`) devolve a mesma rota aos dois em vez de
 * criar duas.
 */
export function chaveDaCopia(modeloId: string): string {
  const h = createHash('sha256')
    .update(`e2e-rota-do-mapa:${modeloId}`)
    .digest('hex');
  const variante = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return (
    `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-` +
    `${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`
  );
}

export interface ParadaDoModelo {
  tipo: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  is_checkpoint: boolean;
  destinatario: string | null;
  telefone: string | null;
  observacoes: string | null;
}

export interface ParadaDaCopia {
  _temp_id: string;
  tipo: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  is_checkpoint: boolean;
  destinatario: string | null;
  telefone: string | null;
  observacoes: string | null;
}

/** Telefone fictício para parada real do modelo sem telefone válido. */
export const TELEFONE_PADRAO_DA_COPIA = '(83) 90000-0000';
const DESTINATARIO_PADRAO = 'Cliente demo E2E';

const telefoneValido = (t: string | null) =>
  t !== null && [10, 11].includes(t.replace(/\D/g, '').length);

/**
 * Copia as paradas do modelo no formato de `criar_rota_com_paradas`. A RPC
 * exige destinatário e telefone (10 ou 11 dígitos) nas paradas reais; a rota
 * demo tem paradas sem eles, que recebem valores fictícios. Vínculos entre
 * retirada e entrega não são copiados.
 */
export function montarParadasDaCopia(
  modelo: ReadonlyArray<ParadaDoModelo>,
): ParadaDaCopia[] {
  const ordenadas = [...modelo].sort((a, b) => a.ordem - b.ordem);
  const pontas = ordenadas.filter((p) => !p.is_checkpoint);
  if (pontas.length !== 2) {
    throw new Error(
      'A rota modelo precisa ter partida e chegada (is_checkpoint=false).',
    );
  }
  if (!ordenadas.some((p) => p.is_checkpoint)) {
    throw new Error('A rota modelo não tem parada real para copiar.');
  }

  // Partida em 0, paradas reais em 1..n na ordem do modelo, chegada em n+1.
  const reais = ordenadas.filter((p) => p.is_checkpoint);
  const emOrdem = [pontas[0], ...reais, pontas[1]];

  return emOrdem.map((p, i) => ({
    _temp_id: `copia-${i}`,
    tipo: p.tipo,
    endereco: p.endereco,
    latitude: p.latitude,
    longitude: p.longitude,
    ordem: i,
    is_checkpoint: p.is_checkpoint,
    destinatario: p.is_checkpoint
      ? p.destinatario?.trim() || DESTINATARIO_PADRAO
      : p.destinatario,
    telefone:
      p.is_checkpoint && !telefoneValido(p.telefone)
        ? TELEFONE_PADRAO_DA_COPIA
        : p.telefone,
    observacoes: p.observacoes,
  }));
}
