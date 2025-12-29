/**
 * Hook para encapsular toda a lógica de estado da tela de Nova Entrega
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';

import type {
  Parada,
  ParadaFormData,
  ParadaFormDataWithCoords,
  MotoristaResumo,
  VinculacaoMotorista,
  RotaOtimizadaState,
  EnderecoUnidade,
  DistanciaManualReal,
  DistanciaManualAproximada,
  ParadasStatus,
} from '@/components/gestor/nova-entrega/types';
import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { googleMapsService } from '@/lib/google';
import {
  otimizarRotaComDependencias,
  ParadaParaOtimizar,
  validarRotaParaOtimizacao,
  MAX_WAYPOINTS,
  WAYPOINTS_RECOMENDADO,
} from '@/lib/routeOptimization';
import { supabase } from '@/lib/supabase';
import { z } from '@/lib/zod';
import { GoogleDirectionsLeg } from '@/types/google-directions';

// Constante para fator de correção Haversine em áreas urbanas
const HAVERSINE_URBAN_CORRECTION_FACTOR = 1.3;

// Schema de validação (inclui latitude/longitude para coordenadas do autocomplete)
const paradaSchema = z.object({
  endereco: z
    .string()
    .min(5, 'Endereço deve ter no mínimo 5 caracteres'),
  tipo: z.enum(['entrega', 'retirada']),
  destinatario: z
    .string()
    .min(3, 'Nome do destinatário deve ter no mínimo 3 caracteres'),
  telefone: z
    .string()
    .min(1, 'Telefone de contato é obrigatório')
    .refine((val) => val.replace(/\D/g, '').length >= 10, {
      message: 'Telefone deve ter no mínimo 10 dígitos',
    }),
  observacoes: z.string().optional(),
  // Coordenadas são preenchidas automaticamente pelo autocomplete
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// Função para gerar ID único
function generateUniqueId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Interfaces para helpers de geração de rota
interface ParadaParaInserir {
  rota_id: string;
  tipo: 'entrega' | 'retirada';
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  destinatario: string | null;
  telefone: string | null;
  observacoes: string | null;
  status: 'pendente';
  is_checkpoint?: boolean;
  _temp_id?: string;
  _temp_vinculo_id?: string;
}

interface CriarParadaCheckpointParams {
  rotaId: string;
  tipo: 'retirada' | 'entrega';
  enderecoUnidade: EnderecoUnidade;
  ordem: number;
  nomeUnidade: string;
  observacoes: string;
}

/**
 * Cria uma parada de checkpoint (partida ou chegada)
 */
function criarParadaCheckpoint({
  rotaId,
  tipo,
  enderecoUnidade,
  ordem,
  nomeUnidade,
  observacoes,
}: CriarParadaCheckpointParams): ParadaParaInserir {
  // Sempre usar o endereço formatado da unidade
  // A Routes API só retorna coordenadas, não endereços formatados
  return {
    rota_id: rotaId,
    tipo,
    endereco: enderecoUnidade.endereco,
    latitude: enderecoUnidade.latitude,
    longitude: enderecoUnidade.longitude,
    ordem,
    destinatario: nomeUnidade,
    telefone: null,
    observacoes,
    status: 'pendente',
    is_checkpoint: false,
  };
}

interface PrepararParadasParams {
  rotaId: string;
  paradas: Parada[];
  enderecoUnidade: EnderecoUnidade | null;
  nomeUnidade: string;
}

/**
 * Prepara o array de paradas para inserção no banco
 */
function prepararParadasParaInserir({
  rotaId,
  paradas,
  enderecoUnidade,
  nomeUnidade,
}: PrepararParadasParams): ParadaParaInserir[] {
  const paradasParaInserir: ParadaParaInserir[] = [];

  // Adicionar ponto de partida (checkpoint)
  if (enderecoUnidade) {
    paradasParaInserir.push(
      criarParadaCheckpoint({
        rotaId,
        tipo: 'retirada',
        enderecoUnidade,
        ordem: 0,
        nomeUnidade,
        observacoes: 'Ponto de partida',
      })
    );
  }

  // Adicionar paradas do usuário
  paradas.forEach((p, index) => {
    // Validar coordenadas antes de inserir
    if (p.latitude == null || p.longitude == null) {
      console.warn(`Parada ${p.id} sem coordenadas válidas, ignorando`);
      return;
    }

    paradasParaInserir.push({
      rota_id: rotaId,
      tipo: p.tipo,
      // Sempre usar o endereço original do autocomplete (p.endereco)
      // A Routes API só retorna coordenadas, não endereços formatados
      endereco: p.endereco,
      latitude: p.latitude,
      longitude: p.longitude,
      ordem: index + 1,
      destinatario: p.destinatario,
      telefone: p.telefone,
      observacoes: p.observacoes || null,
      status: 'pendente',
      _temp_id: p.id,
      _temp_vinculo_id: p.vinculo_parada_id,
    });
  });

  // Adicionar ponto de chegada (checkpoint)
  if (enderecoUnidade) {
    paradasParaInserir.push(
      criarParadaCheckpoint({
        rotaId,
        tipo: 'entrega',
        enderecoUnidade,
        ordem: paradas.length + 1,
        nomeUnidade,
        observacoes: 'Ponto de chegada',
      })
    );
  }

  return paradasParaInserir;
}

/**
 * Atualiza vínculos entre paradas após inserção
 */
async function atualizarVinculosParadas(
  paradasParaInserir: ParadaParaInserir[],
  paradasInseridas: { id: string; ordem: number }[]
): Promise<void> {
  const temVinculos = paradasParaInserir.some((p) => p._temp_vinculo_id);
  if (!temVinculos) return;

  // Mapear IDs temporários para IDs reais
  const tempIdToRealId: Record<string, string> = {};
  paradasParaInserir.forEach((p, index) => {
    if (p._temp_id && paradasInseridas[index]) {
      tempIdToRealId[p._temp_id] = paradasInseridas[index].id;
    }
  });

  // Criar promises de atualização
  const updatePromises = paradasParaInserir
    .map((p, index) => {
      if (p._temp_vinculo_id && tempIdToRealId[p._temp_vinculo_id]) {
        const realVinculoId = tempIdToRealId[p._temp_vinculo_id];
        const realParadaId = paradasInseridas[index]?.id;

        if (realParadaId) {
          return supabase
            .from('paradas')
            .update({ vinculo_parada_id: realVinculoId })
            .eq('id', realParadaId);
        }
      }
      return null;
    })
    .filter(Boolean);

  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }
}

// Função para calcular distância em metros usando Haversine
function distanceInMeters(
  parada: { latitude?: number; longitude?: number },
  coords?: { latitude: number; longitude: number }
): number {
  if (
    parada.latitude == null ||
    parada.longitude == null ||
    !coords
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(coords.latitude - parada.latitude);
  const dLon = toRad(coords.longitude - parada.longitude);

  const lat1 = toRad(parada.latitude);
  const lat2 = toRad(coords.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function ordenarParadasPorRota(
  paradas: Parada[],
  ordemOtimizada: number[],
  legs?: GoogleDirectionsLeg[]
): Parada[] {
  if (ordemOtimizada?.length === paradas.length) {
    return ordemOtimizada.map((index) => paradas[index]);
  }

  if (legs?.length) {
    const utilizados = new Set<number>();
    const ordenadas: Parada[] = [];

    legs.forEach((leg, idx) => {
      if (idx === legs.length - 1) return;

      let melhorIndex = -1;
      let menorDistancia = Number.POSITIVE_INFINITY;

      paradas.forEach((parada, paradaIndex) => {
        if (utilizados.has(paradaIndex)) return;
        const distancia = distanceInMeters(parada, leg.coordenadas_fim);
        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          melhorIndex = paradaIndex;
        }
      });

      if (melhorIndex !== -1) {
        ordenadas.push(paradas[melhorIndex]);
        utilizados.add(melhorIndex);
      }
    });

    paradas.forEach((parada, index) => {
      if (!utilizados.has(index)) {
        ordenadas.push(parada);
        utilizados.add(index);
      }
    });

    if (ordenadas.length === paradas.length) {
      return ordenadas;
    }
  }

  return [...paradas];
}

export interface UseNovaEntregaReturn {
  // Form
  form: ReturnType<typeof useForm<ParadaFormDataWithCoords>>;

  // State
  paradas: Parada[];
  motoristas: MotoristaResumo[];
  motoristaSelecionado: string;
  vinculoSelecionado: string;
  isLoading: boolean;
  isLoadingMotoristas: boolean;
  isOptimizing: boolean;
  rotaOtimizada: RotaOtimizadaState | null;
  ordemManual: boolean;
  distanciaManualReal: DistanciaManualReal | null;
  isCalculandoReal: boolean;
  enderecoUnidade: EnderecoUnidade | null;

  // Computed
  retiradasDisponiveis: Parada[];
  paradasStatus: ParadasStatus;
  distanciaManualAproximada: DistanciaManualAproximada | null;

  // Toast
  toastState: ReturnType<typeof useToast>['toast'];
  showToast: ReturnType<typeof useToast>['showToast'];
  hideToast: ReturnType<typeof useToast>['hideToast'];

  // Actions
  setMotoristaSelecionado: (id: string) => void;
  setVinculoSelecionado: (id: string) => void;
  onAddParada: (data: ParadaFormData, vinculoId?: string) => Promise<void>;
  removeParada: (index: number) => void;
  moveParadaUp: (index: number) => void;
  moveParadaDown: (index: number) => void;
  otimizarRota: () => Promise<void>;
  calcularDistanciaReal: () => Promise<void>;
  gerarRota: () => Promise<void>;
  limparFormulario: () => void;

  // User data (para evitar chamada duplicada de useUser na tela)
  userData: ReturnType<typeof useUser>['userData'];
  unidadeNome: string;
}

export function useNovaEntrega(): UseNovaEntregaReturn {
  const { userData } = useUser();
  const { unidadeAtiva, unidadeAtivaData } = useUnidadeAtiva();
  const { toast: toastState, showToast, hideToast } = useToast();

  // Ref para cleanup do setTimeout
  const limparFormularioTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [motoristas, setMotoristas] = useState<MotoristaResumo[]>([]);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<string>('');
  const [vinculoSelecionado, setVinculoSelecionado] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMotoristas, setIsLoadingMotoristas] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [rotaOtimizada, setRotaOtimizada] = useState<RotaOtimizadaState | null>(null);
  const [ordemManual, setOrdemManual] = useState(false);
  const [distanciaManualReal, setDistanciaManualReal] = useState<DistanciaManualReal | null>(null);
  const [isCalculandoReal, setIsCalculandoReal] = useState(false);
  const [enderecoUnidade, setEnderecoUnidade] = useState<EnderecoUnidade | null>(null);

  // Form
  const form = useForm<ParadaFormDataWithCoords>({
    resolver: zodResolver(paradaSchema),
    defaultValues: {
      tipo: 'entrega',
      endereco: '',
      destinatario: '',
      telefone: '',
      observacoes: '',
    },
  });

  // Computed: retiradas disponíveis para vincular
  const retiradasDisponiveis = useMemo(
    () => paradas.filter((p) => p.tipo === 'retirada'),
    [paradas]
  );

  // Computed: status das paradas
  const paradasStatus = useMemo((): ParadasStatus => {
    const count = paradas.length;

    if (count > MAX_WAYPOINTS) {
      return {
        texto: `${count} paradas (excede limite de ${MAX_WAYPOINTS})`,
        cor: 'error',
        icone: 'warning',
      };
    } else if (count > WAYPOINTS_RECOMENDADO) {
      return {
        texto: `${count}/${MAX_WAYPOINTS} paradas (próximo do limite)`,
        cor: 'warning',
        icone: 'alert-circle',
      };
    } else if (count > 0) {
      return {
        texto: `${count} parada(s) na lista`,
        cor: 'default',
        icone: null,
      };
    }
    return {
      texto: 'Nenhuma parada adicionada',
      cor: 'default',
      icone: null,
    };
  }, [paradas.length]);

  // Computed: distância aproximada (Haversine com correção)
  const calcularDistanciaAproximada = useCallback(() => {
    if (!enderecoUnidade || paradas.length === 0) return 0;

    let distanciaTotal = 0;
    let pontoAnterior = { latitude: enderecoUnidade.latitude, longitude: enderecoUnidade.longitude };

    for (const parada of paradas) {
      if (parada.latitude && parada.longitude) {
        const distancia = distanceInMeters(parada, pontoAnterior);
        if (distancia !== Number.POSITIVE_INFINITY) {
          distanciaTotal += distancia;
        }
        pontoAnterior = { latitude: parada.latitude, longitude: parada.longitude };
      }
    }

    const distanciaRetorno = distanceInMeters(
      { latitude: enderecoUnidade.latitude, longitude: enderecoUnidade.longitude },
      pontoAnterior
    );
    if (distanciaRetorno !== Number.POSITIVE_INFINITY) {
      distanciaTotal += distanciaRetorno;
    }

    return distanciaTotal;
  }, [enderecoUnidade, paradas]);

  const distanciaManualAproximada = useMemo((): DistanciaManualAproximada | null => {
    if (!ordemManual || !rotaOtimizada) return null;
    const distanciaMetros = calcularDistanciaAproximada();
    const distanciaCorrigida = distanciaMetros * HAVERSINE_URBAN_CORRECTION_FACTOR;
    const distanciaBase = rotaOtimizada.distancia_total_metros;
    // Evita divisão por zero
    const percentual = distanciaBase > 0
      ? ((distanciaCorrigida - distanciaBase) / distanciaBase) * 100
      : 0;
    return {
      metros: distanciaCorrigida,
      diferenca: distanciaCorrigida - distanciaBase,
      percentual,
    };
  }, [ordemManual, rotaOtimizada, calcularDistanciaAproximada]);

  // Load endereço da unidade
  const loadEnderecoUnidade = useCallback(async () => {
    if (!unidadeAtivaData) {
      console.warn('Usuário sem unidade vinculada');
      return;
    }

    const parseCoordinate = (value: unknown): number | null => {
      if (value === null || value === undefined) return null;
      const numeric = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const latitudeFromDb = parseCoordinate(unidadeAtivaData.sede_latitude);
    const longitudeFromDb = parseCoordinate(unidadeAtivaData.sede_longitude);
    const enderecoBase = unidadeAtivaData.sede_endereco || unidadeAtivaData.endereco;

    const enderecoCompleto = [
      enderecoBase,
      unidadeAtivaData.cidade,
      unidadeAtivaData.uf,
      unidadeAtivaData.cep,
    ]
      .filter((parte) => typeof parte === 'string' && parte.trim().length > 0)
      .join(', ');

    if (latitudeFromDb != null && longitudeFromDb != null) {
      setEnderecoUnidade({
        latitude: latitudeFromDb,
        longitude: longitudeFromDb,
        endereco: enderecoCompleto || enderecoBase || 'Sede da unidade',
      });
      return;
    }

    if (!enderecoCompleto) {
      console.warn('Unidade sem endereço completo cadastrado');
      showToast('Endereço da unidade não encontrado. Complete o cadastro antes de gerar rotas.', 'error');
      return;
    }

    try {
      const result = await googleMapsService.geocodeAddress(enderecoCompleto);
      if (result?.coordenadas) {
        setEnderecoUnidade({
          latitude: result.coordenadas.latitude,
          longitude: result.coordenadas.longitude,
          endereco: result.formatted_address || enderecoCompleto,
        });
      } else {
        console.error('Não foi possível geocodificar o endereço da unidade');
        showToast('Endereço da unidade não encontrado. Verifique o cadastro da unidade.', 'error');
      }
    } catch (error) {
      console.error('Erro ao geocodificar endereço da unidade:', error);
    }
  }, [showToast, unidadeAtivaData]);

  // Load motoristas
  const loadMotoristas = useCallback(async () => {
    if (!unidadeAtiva) {
      setIsLoadingMotoristas(false);
      return;
    }

    try {
      setIsLoadingMotoristas(true);
      const { data: vinculacoesData, error: vinculacoesError } = (await supabase
        .from('usuario_unidades')
        .select(`
          usuario_id,
          usuarios (id, nome, email, ativo)
        `)
        .eq('unidade_id', unidadeAtiva)
        .eq('papel', 'motorista')
        .eq('ativo', true)) as { data: VinculacaoMotorista[] | null; error: Error | null };

      if (vinculacoesError) throw vinculacoesError;

      const motoristasData = vinculacoesData
        ?.map((v) => v.usuarios)
        .filter((u): u is MotoristaResumo => u !== null && u.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome));

      setMotoristas(motoristasData || []);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
      showToast('Não foi possível carregar os motoristas', 'error');
    } finally {
      setIsLoadingMotoristas(false);
    }
  }, [showToast, unidadeAtiva]);

  // Effects
  useEffect(() => {
    loadMotoristas();
  }, [loadMotoristas]);

  useEffect(() => {
    if (unidadeAtivaData) {
      loadEnderecoUnidade();
    }
  }, [loadEnderecoUnidade, unidadeAtivaData]);

  // Cleanup do timeout ao desmontar
  useEffect(() => {
    return () => {
      if (limparFormularioTimeoutRef.current) {
        clearTimeout(limparFormularioTimeoutRef.current);
      }
    };
  }, []);

  // Actions
  const onAddParada = useCallback(async (paradaData: ParadaFormData, vinculoId?: string) => {
    setIsLoading(true);
    try {
      const extendedData = paradaData as ParadaFormDataWithCoords;

      if (!extendedData.latitude || !extendedData.longitude) {
        const result = await googleMapsService.geocodeAddress(paradaData.endereco);

        if (!result) {
          showToast('Não foi possível localizar o endereço. Use o autocomplete para selecionar um endereço válido.', 'error');
          return;
        }

        extendedData.latitude = result.coordenadas.latitude;
        extendedData.longitude = result.coordenadas.longitude;
      }

      const novaParada: Parada = {
        ...extendedData,
        id: generateUniqueId(),
        latitude: extendedData.latitude,
        longitude: extendedData.longitude,
        ordem: paradas.length + 1,
        vinculo_parada_id: vinculoId,
      };

      setParadas([...paradas, novaParada]);
      form.reset();

      if (vinculoId) {
        const retiradaVinculada = paradas.find((p) => p.id === vinculoId);
        showToast(
          `Entrega vinculada! A retirada em "${retiradaVinculada?.destinatario || 'cliente'}" será feita primeiro.`,
          'success',
          4000
        );
      } else {
        showToast('Parada adicionada à lista!', 'success');
      }
    } catch (error) {
      console.error('Erro ao adicionar parada:', error);
      showToast('Não foi possível adicionar a parada', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [form, paradas, showToast]);

  const removeParada = useCallback((index: number) => {
    const paradaRemovida = paradas[index];
    let novasParadas = paradas.filter((_, i) => i !== index);

    if (paradaRemovida.tipo === 'retirada') {
      novasParadas = novasParadas.map((p) => {
        if (p.vinculo_parada_id === paradaRemovida.id) {
          return { ...p, vinculo_parada_id: undefined };
        }
        return p;
      });
    }

    const reordenadas = novasParadas.map((p, i) => ({ ...p, ordem: i + 1 }));
    setParadas(reordenadas);
    setRotaOtimizada(null);
  }, [paradas]);

  const moveParadaUp = useCallback((index: number) => {
    if (index <= 0) return;

    const novasParadas = [...paradas];
    [novasParadas[index - 1], novasParadas[index]] = [novasParadas[index], novasParadas[index - 1]];

    const reordenadas = novasParadas.map((p, i) => ({ ...p, ordem: i + 1 }));
    setParadas(reordenadas);

    if (rotaOtimizada) {
      setOrdemManual(true);
      setDistanciaManualReal(null);
    }
  }, [paradas, rotaOtimizada]);

  const moveParadaDown = useCallback((index: number) => {
    if (index >= paradas.length - 1) return;

    const novasParadas = [...paradas];
    [novasParadas[index], novasParadas[index + 1]] = [novasParadas[index + 1], novasParadas[index]];

    const reordenadas = novasParadas.map((p, i) => ({ ...p, ordem: i + 1 }));
    setParadas(reordenadas);

    if (rotaOtimizada) {
      setOrdemManual(true);
      setDistanciaManualReal(null);
    }
  }, [paradas, rotaOtimizada]);

  const calcularDistanciaReal = useCallback(async () => {
    if (!enderecoUnidade || paradas.length === 0) return;

    setIsCalculandoReal(true);
    try {
      const pontoUnidade = {
        latitude: enderecoUnidade.latitude,
        longitude: enderecoUnidade.longitude,
      };

      const waypoints = paradas
        .filter((p): p is Parada & { latitude: number; longitude: number } =>
          p.latitude != null && p.longitude != null
        )
        .map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
        }));

      const resultado = await googleMapsService.getDirectionsSequential(
        pontoUnidade,
        pontoUnidade,
        waypoints
      );

      if (resultado) {
        setDistanciaManualReal({
          metros: resultado.distancia_total_metros,
          segundos: resultado.duracao_total_segundos,
        });
        showToast('Distância real calculada!', 'success');
      } else {
        showToast('Não foi possível calcular a distância real', 'error');
      }
    } catch (error) {
      console.error('Erro ao calcular distância real:', error);
      showToast('Erro ao calcular distância', 'error');
    } finally {
      setIsCalculandoReal(false);
    }
  }, [enderecoUnidade, paradas, showToast]);

  const otimizarRota = useCallback(async () => {
    if (paradas.length < 1) {
      showToast('Adicione pelo menos 1 parada para otimizar a rota', 'info');
      return;
    }

    if (!enderecoUnidade) {
      showToast('Endereço da unidade não encontrado. Verifique o cadastro da unidade.', 'error');
      return;
    }

    // Filtrar paradas sem coordenadas válidas
    const paradasComCoordenadas = paradas.filter((p) => p.latitude != null && p.longitude != null);
    if (paradasComCoordenadas.length !== paradas.length) {
      showToast('Algumas paradas não têm coordenadas válidas. Remova-as e adicione novamente.', 'error');
      return;
    }

    const paradasParaValidar: ParadaParaOtimizar[] = paradasComCoordenadas.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      endereco: p.endereco,
      latitude: p.latitude as number,
      longitude: p.longitude as number,
      ordem: p.ordem,
      destinatario: p.destinatario,
      telefone: p.telefone,
      observacoes: p.observacoes,
      vinculo_parada_id: p.vinculo_parada_id,
    }));

    const validacao = validarRotaParaOtimizacao(paradasParaValidar);

    if (!validacao.valido) {
      showToast(validacao.erros[0], 'error');
      return;
    }

    if (validacao.avisos.length > 0) {
      showToast(validacao.avisos[0], 'info');
    }

    setIsOptimizing(true);
    try {
      const pontoUnidade = {
        latitude: enderecoUnidade.latitude,
        longitude: enderecoUnidade.longitude,
      };

      const temVinculos = paradas.some((p) => p.vinculo_parada_id);

      if (temVinculos) {
        const resultado = await otimizarRotaComDependencias(
          pontoUnidade,
          paradasParaValidar,
          pontoUnidade
        );

        if (!resultado) {
          showToast('Não foi possível otimizar a rota', 'error');
          return;
        }

        const paradasAtualizadas = resultado.paradasOrdenadas
          .map((pOtimizada, i) => {
            const paradaOriginal = paradas.find((p) => p.id === pOtimizada.id);
            if (!paradaOriginal) {
              console.warn(`Parada otimizada ${pOtimizada.id} não encontrada nas paradas originais`);
              return null;
            }
            return {
              ...paradaOriginal,
              ordem: i + 1,
            };
          })
          .filter((p): p is Parada => p !== null);

        setParadas(paradasAtualizadas);
        setRotaOtimizada({
          distancia_total_metros: resultado.distanciaTotalMetros,
          duracao_total_segundos: resultado.duracaoTotalSegundos,
          legs: [],
          polyline: resultado.polyline,
        });
        setOrdemManual(false);

        showToast(
          `Rota otimizada com dependências! ${(resultado.distanciaTotalMetros / 1000).toFixed(1)} km - ${Math.round(resultado.duracaoTotalSegundos / 60)} min`,
          'success',
          4000
        );
      } else {
        // Usa paradasComCoordenadas que já foi validado anteriormente
        const waypoints = paradasComCoordenadas.map((p) => ({
          latitude: p.latitude as number,
          longitude: p.longitude as number,
        }));

        const resultado = await googleMapsService.getDirections(
          pontoUnidade,
          pontoUnidade,
          waypoints
        );

        if (!resultado) {
          showToast('Não foi possível otimizar a rota', 'error');
          return;
        }

        const ordemOtimizada = resultado.ordem_otimizada || [];
        const paradasReordenadas = ordenarParadasPorRota(paradas, ordemOtimizada, resultado.legs);

        const paradasComNovaOrdem = paradasReordenadas.map((p, i) => ({
          ...p,
          ordem: i + 1,
        }));

        setParadas(paradasComNovaOrdem);
        setRotaOtimizada({
          distancia_total_metros: resultado.distancia_total_metros,
          duracao_total_segundos: resultado.duracao_total_segundos,
          legs: resultado.legs,
          polyline: resultado.polyline,
        });
        setOrdemManual(false);

        showToast(
          `Rota otimizada! ${(resultado.distancia_total_metros / 1000).toFixed(1)} km - ${Math.round(resultado.duracao_total_segundos / 60)} min`,
          'success',
          4000
        );
      }
    } catch (error) {
      console.error('Erro ao otimizar rota:', error);
      showToast('Não foi possível otimizar a rota', 'error');
    } finally {
      setIsOptimizing(false);
    }
  }, [enderecoUnidade, paradas, showToast]);

  /**
   * Calcula distâncias e tempo da rota (usa otimização prévia ou calcula na hora)
   */
  const calcularDadosRota = useCallback(async () => {
    if (ordemManual) {
      if (paradas.length > 0 && enderecoUnidade) {
        const pontoUnidade = {
          latitude: enderecoUnidade.latitude,
          longitude: enderecoUnidade.longitude,
        };

        const paradasValidas = paradas.filter(
          (p): p is Parada & { latitude: number; longitude: number } =>
            p.latitude != null && p.longitude != null
        );

        if (paradasValidas.length > 0) {
          const waypoints = paradasValidas.map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
          }));

          const resultado = await googleMapsService.getDirectionsSequential(
            pontoUnidade,
            pontoUnidade,
            waypoints
          );

          if (resultado) {
            return {
              distanciaKm: Number((resultado.distancia_total_metros / 1000).toFixed(2)),
              tempoMin: Math.round(resultado.duracao_total_segundos / 60),
              polyline: resultado.polyline,
            };
          }
        }
      }

      return {
        distanciaKm: null as number | null,
        tempoMin: null as number | null,
        polyline: undefined as string | undefined,
      };
    }

    if (rotaOtimizada) {
      return {
        distanciaKm: Number((rotaOtimizada.distancia_total_metros / 1000).toFixed(2)),
        tempoMin: Math.round(rotaOtimizada.duracao_total_segundos / 60),
        polyline: rotaOtimizada.polyline,
      };
    }

    if (paradas.length > 0 && enderecoUnidade) {
      const pontoUnidade = {
        latitude: enderecoUnidade.latitude,
        longitude: enderecoUnidade.longitude,
      };

      const paradasValidas = paradas.filter(
        (p): p is Parada & { latitude: number; longitude: number } =>
          p.latitude != null && p.longitude != null
      );
      const waypoints = paradasValidas.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));

      const resultado = await googleMapsService.getDirections(
        pontoUnidade,
        pontoUnidade,
        waypoints,
        false
      );

      if (resultado) {
        return {
          distanciaKm: Number((resultado.distancia_total_metros / 1000).toFixed(2)),
          tempoMin: Math.round(resultado.duracao_total_segundos / 60),
          polyline: resultado.polyline,
        };
      }
    }

    return {
      distanciaKm: null as number | null,
      tempoMin: null as number | null,
      polyline: undefined as string | undefined,
    };
  }, [enderecoUnidade, ordemManual, paradas, rotaOtimizada]);

  /**
   * Registra log de criação da rota
   */
  const registrarLogRota = useCallback(async (
    rotaId: string,
    temVinculos: boolean,
    totalVinculos: number,
    distanciaKm: number | null,
    tempoMin: number | null
  ) => {
    // Validar userData antes de registrar log
    if (!userData?.id) {
      console.warn('Não foi possível registrar log: userData não disponível');
      return;
    }

    try {
      const { error } = await supabase.from('logs').insert({
        usuario_id: userData.id,
        rota_id: rotaId,
        evento: 'rota_criada',
        detalhes: {
          total_paradas: paradas.length,
          motorista_id: motoristaSelecionado,
          foi_otimizada: rotaOtimizada !== null && !ordemManual,
          ordem_manual: ordemManual,
          tem_vinculos: temVinculos,
          total_vinculos: totalVinculos,
          distancia_km: distanciaKm,
          tempo_min: tempoMin,
          rota_circular: enderecoUnidade !== null,
        },
      });

      if (error) {
        console.error('Erro ao registrar log de criação da rota:', error);
      }
    } catch (error) {
      console.error('Erro inesperado ao registrar log:', error);
    }
  }, [enderecoUnidade, motoristaSelecionado, ordemManual, paradas.length, rotaOtimizada, userData]);

  // ⚠️ limparFormulario deve ser declarado ANTES de gerarRota para evitar erro de inicialização
  const limparFormulario = useCallback(() => {
    setParadas([]);
    setMotoristaSelecionado('');
    setRotaOtimizada(null);
    setOrdemManual(false);
    setDistanciaManualReal(null);
    form.reset();
  }, [form]);

  const gerarRota = useCallback(async () => {
    // Validações
    if (paradas.length === 0) {
      showToast('Adicione pelo menos uma parada antes de gerar a rota', 'info');
      return;
    }
    if (!motoristaSelecionado) {
      showToast('Selecione um motorista para a rota', 'info');
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    try {
      // 1. Calcular dados da rota
      const { distanciaKm, tempoMin, polyline } = await calcularDadosRota();

      // 2. Criar payload da rota
      const hoje = new Date();
      const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

      const rotaPayload: Record<string, unknown> = {
        unidade_id: unidadeAtiva,
        motorista_id: motoristaSelecionado,
        status: 'pendente',
        data: dataHoje,
      };
      if (distanciaKm !== null) rotaPayload.distancia_total = distanciaKm;
      if (tempoMin !== null) rotaPayload.tempo_total = tempoMin;
      if (polyline) rotaPayload.polyline = polyline;

      // 3. Inserir rota no banco
      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .insert(rotaPayload)
        .select()
        .single();
      if (rotaError) throw rotaError;

      // 4. Preparar paradas para inserção
      const paradasPreparadas = prepararParadasParaInserir({
        rotaId: rotaData.id,
        paradas,
        enderecoUnidade,
        nomeUnidade: unidadeAtivaData?.nome || 'Base',
      });

      // 5. Limpar campos temporários e inserir paradas
      const paradasLimpas = paradasPreparadas.map((p) => {
        const { _temp_id, _temp_vinculo_id, ...paradaLimpa } = p;
        return paradaLimpa;
      });

      const { data: paradasInseridas, error: paradasError } = await supabase
        .from('paradas')
        .insert(paradasLimpas)
        .select('id, ordem');
      if (paradasError) throw paradasError;

      // 6. Atualizar vínculos entre paradas
      if (paradasInseridas) {
        await atualizarVinculosParadas(paradasPreparadas, paradasInseridas);
      }

      // 7. Registrar log
      const temVinculos = paradasPreparadas.some((p) => p._temp_vinculo_id);
      const totalVinculos = paradasPreparadas.filter((p) => p._temp_vinculo_id).length;
      await registrarLogRota(rotaData.id, temVinculos, totalVinculos, distanciaKm, tempoMin);

      // 8. Sucesso
      showToast(
        `Rota circular criada com sucesso! ${paradas.length} entrega(s) cadastrada(s).`,
        'success',
        4000
      );
      // Limpar timeout anterior se existir
      if (limparFormularioTimeoutRef.current) {
        clearTimeout(limparFormularioTimeoutRef.current);
      }
      limparFormularioTimeoutRef.current = setTimeout(() => limparFormulario(), 1000);
    } catch (error) {
      console.error('Erro ao criar rota:', error);
      showToast('Não foi possível criar a rota. Tente novamente.', 'error', 5000);
    } finally {
      setIsLoading(false);
    }
  }, [calcularDadosRota, enderecoUnidade, isLoading, limparFormulario, motoristaSelecionado, paradas, registrarLogRota, showToast, unidadeAtiva, unidadeAtivaData]);

  // Computed: nome da unidade para exibição
  const unidadeNome = unidadeAtivaData?.nome || userData?.unidades?.nome || '';

  return {
    form,
    paradas,
    motoristas,
    motoristaSelecionado,
    vinculoSelecionado,
    isLoading,
    isLoadingMotoristas,
    isOptimizing,
    rotaOtimizada,
    ordemManual,
    distanciaManualReal,
    isCalculandoReal,
    enderecoUnidade,
    retiradasDisponiveis,
    paradasStatus,
    distanciaManualAproximada,
    toastState,
    showToast,
    hideToast,
    setMotoristaSelecionado,
    setVinculoSelecionado,
    onAddParada,
    removeParada,
    moveParadaUp,
    moveParadaDown,
    otimizarRota,
    calcularDistanciaReal,
    gerarRota,
    limparFormulario,
    // Dados do usuário para a tela
    userData,
    unidadeNome,
  };
}
