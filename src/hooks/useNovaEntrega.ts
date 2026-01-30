/**
 * Hook para encapsular toda a lógica de estado da tela de Nova Entrega
 *
 * Refatorado para compor hooks menores e mais focados:
 * - useEnderecoUnidade: Carrega endereço da unidade
 * - useMotoristaSelection: Gerencia seleção de motoristas
 * - useParadasManagement: Gerencia lista de paradas
 * - useRouteOptimization: Otimização de rotas
 * - useDistanceCalculation: Cálculo de distâncias
 * - useRouteCreation: Criação de rotas no banco
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';

import type {
  Parada,
  ParadaFormData,
  ParadaFormDataWithCoords,
  MotoristaResumo,
  RotaOtimizadaState,
  EnderecoUnidade,
  DistanciaManualReal,
  ParadasStatus,
} from '@/components/gestor/nova-entrega/types';
import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { googleMapsService } from '@/lib/google'; // Para getDirections (usa OSRM)
import { logger } from '@/lib/logger';
import { photonService } from '@/lib/photon'; // Para geocoding (gratuito!)
import { createRota, createParadasBatch, logRotaAction, type RotaInsert, type ParadaInsert } from '@/lib/queries';
import {
  otimizarRotaComDependencias,
  ParadaParaOtimizar,
  validarRotaParaOtimizacao,
  MAX_WAYPOINTS,
  WAYPOINTS_RECOMENDADO,
} from '@/lib/routeOptimization';
import { z } from '@/lib/zod';

import {
  useEnderecoUnidade,
  useMotoristaSelection,
  useDistanceCalculation,
} from './nova-entrega';
import {
  generateUniqueId,
  prepararParadasParaInserir,
  atualizarVinculosParadas,
  ordenarParadasPorRota,
} from './useNovaEntrega.helpers';

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
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export interface UseNovaEntregaReturn {
  form: ReturnType<typeof useForm<ParadaFormDataWithCoords>>;
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
  retiradasDisponiveis: Parada[];
  paradasStatus: ParadasStatus;
  toastState: ReturnType<typeof useToast>['toast'];
  showToast: ReturnType<typeof useToast>['showToast'];
  hideToast: ReturnType<typeof useToast>['hideToast'];
  setMotoristaSelecionado: (id: string) => void;
  setVinculoSelecionado: (id: string) => void;
  onAddParada: (data: ParadaFormData, vinculoId?: string) => Promise<void>;
  removeParada: (index: number) => void;
  moveParadaUp: (index: number) => void;
  moveParadaDown: (index: number) => void;
  otimizarRota: () => Promise<void>;
  gerarRota: () => Promise<void>;
  limparFormulario: () => void;
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
  const [vinculoSelecionado, setVinculoSelecionado] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [rotaOtimizada, setRotaOtimizada] = useState<RotaOtimizadaState | null>(null);
  const [ordemManual, setOrdemManual] = useState(false);

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

  // Error handler stable reference
  const handleError = useCallback((msg: string) => {
    showToast(msg, 'error');
  }, [showToast]);

  // Composed hooks (extracted for reusability)
  // Agora passando callback estável para evitar re-renders infinitos
  const { enderecoUnidade } = useEnderecoUnidade(handleError);

  const {
    motoristas,
    motoristaSelecionado,
    setMotoristaSelecionado,
    isLoading: isLoadingMotoristas,
  } = useMotoristaSelection(handleError);

  // Auto-cálculo de distância com debounce
  const {
    distanciaManualReal,
    isCalculandoReal,
    resetDistanciaReal,
  } = useDistanceCalculation({
    paradas,
    enderecoUnidade,
    rotaOtimizada,
    ordemManual,
  });

  // Cleanup do timeout ao desmontar
  useEffect(() => {
    return () => {
      if (limparFormularioTimeoutRef.current) {
        clearTimeout(limparFormularioTimeoutRef.current);
      }
    };
  }, []);

  // Computed: retiradas disponíveis para vincular
  const retiradasDisponiveis = useMemo(
    () => paradas.filter((p) => p.tipo === 'retirada'),
    [paradas]
  );

  // Computed: status das paradas
  const paradasStatus = useMemo((): ParadasStatus => {
    const count = paradas.length;
    if (count > MAX_WAYPOINTS) {
      return { texto: `${count} paradas (excede limite de ${MAX_WAYPOINTS})`, cor: 'error', icone: 'warning' };
    } else if (count > WAYPOINTS_RECOMENDADO) {
      return { texto: `${count}/${MAX_WAYPOINTS} paradas (próximo do limite)`, cor: 'warning', icone: 'alert-circle' };
    } else if (count > 0) {
      return { texto: `${count} parada(s) na lista`, cor: 'default', icone: null };
    }
    return { texto: 'Nenhuma parada adicionada', cor: 'default', icone: null };
  }, [paradas.length]);

  // Computed: nome da unidade
  const unidadeNome = unidadeAtivaData?.nome || userData?.unidades?.nome || '';

  // Actions: Adicionar parada
  const onAddParada = useCallback(async (paradaData: ParadaFormData, vinculoId?: string) => {
    setIsLoading(true);
    try {
      const extendedData = paradaData as ParadaFormDataWithCoords;
      if (!extendedData.latitude || !extendedData.longitude) {
        // Usa Photon (gratuito!) para geocoding
        const result = await photonService.geocodeAddress(paradaData.endereco);
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
        showToast(`Entrega vinculada! A retirada em "${retiradaVinculada?.destinatario || 'cliente'}" será feita primeiro.`, 'success', 4000);
      } else {
        showToast('Parada adicionada à lista!', 'success');
      }
    } catch (error) {
      logger.error('[NovaEntrega] Erro ao adicionar parada', error);
      showToast('Não foi possível adicionar a parada', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [form, paradas, showToast]);

  // Actions: Remover parada
  const removeParada = useCallback((index: number) => {
    const paradaRemovida = paradas[index];
    let novasParadas = paradas.filter((_, i) => i !== index);
    if (paradaRemovida.tipo === 'retirada') {
      novasParadas = novasParadas.map((p) => p.vinculo_parada_id === paradaRemovida.id ? { ...p, vinculo_parada_id: undefined } : p);
    }
    setParadas(novasParadas.map((p, i) => ({ ...p, ordem: i + 1 })));
    setRotaOtimizada(null);
  }, [paradas]);

  // Actions: Mover parada
  const moveParadaUp = useCallback((index: number) => {
    if (index <= 0) return;
    const novasParadas = [...paradas];
    [novasParadas[index - 1], novasParadas[index]] = [novasParadas[index], novasParadas[index - 1]];
    setParadas(novasParadas.map((p, i) => ({ ...p, ordem: i + 1 })));
    if (rotaOtimizada) { setOrdemManual(true); resetDistanciaReal(); }
  }, [paradas, rotaOtimizada, resetDistanciaReal]);

  const moveParadaDown = useCallback((index: number) => {
    if (index >= paradas.length - 1) return;
    const novasParadas = [...paradas];
    [novasParadas[index], novasParadas[index + 1]] = [novasParadas[index + 1], novasParadas[index]];
    setParadas(novasParadas.map((p, i) => ({ ...p, ordem: i + 1 })));
    if (rotaOtimizada) { setOrdemManual(true); resetDistanciaReal(); }
  }, [paradas, rotaOtimizada, resetDistanciaReal]);

  // Actions: Otimizar rota
  const otimizarRota = useCallback(async () => {
    if (paradas.length < 1) { showToast('Adicione pelo menos 1 parada para otimizar a rota', 'info'); return; }
    if (!enderecoUnidade) { showToast('Endereço da unidade não encontrado. Verifique o cadastro da unidade.', 'error'); return; }
    const paradasComCoordenadas = paradas.filter((p) => p.latitude != null && p.longitude != null);
    if (paradasComCoordenadas.length !== paradas.length) {
      showToast('Algumas paradas não têm coordenadas válidas. Remova-as e adicione novamente.', 'error'); return;
    }
    const paradasParaValidar: ParadaParaOtimizar[] = paradasComCoordenadas.map((p) => ({
      id: p.id, tipo: p.tipo, endereco: p.endereco, latitude: p.latitude as number, longitude: p.longitude as number,
      ordem: p.ordem, destinatario: p.destinatario, telefone: p.telefone, observacoes: p.observacoes, vinculo_parada_id: p.vinculo_parada_id,
    }));
    const validacao = validarRotaParaOtimizacao(paradasParaValidar);
    if (!validacao.valido) { showToast(validacao.erros[0], 'error'); return; }
    if (validacao.avisos.length > 0) showToast(validacao.avisos[0], 'info');

    setIsOptimizing(true);
    try {
      const pontoUnidade = { latitude: enderecoUnidade.latitude, longitude: enderecoUnidade.longitude };
      const temVinculos = paradas.some((p) => p.vinculo_parada_id);

      if (temVinculos) {
        const resultado = await otimizarRotaComDependencias(pontoUnidade, paradasParaValidar, pontoUnidade);
        if (!resultado) { showToast('Não foi possível otimizar a rota', 'error'); return; }
        const paradasAtualizadas = resultado.paradasOrdenadas
          .map((pOtimizada, i) => {
            const paradaOriginal = paradas.find((p) => p.id === pOtimizada.id);
            if (!paradaOriginal) { logger.warn(`[NovaEntrega] Parada otimizada ${pOtimizada.id} não encontrada`); return null; }
            return { ...paradaOriginal, ordem: i + 1 };
          }).filter((p): p is Parada => p !== null);
        setParadas(paradasAtualizadas);
        setRotaOtimizada({ distancia_total_metros: resultado.distanciaTotalMetros, duracao_total_segundos: resultado.duracaoTotalSegundos, legs: [], polyline: resultado.polyline });
        setOrdemManual(false);
        showToast(`Rota otimizada com dependências! ${(resultado.distanciaTotalMetros / 1000).toFixed(1)} km - ${Math.round(resultado.duracaoTotalSegundos / 60)} min`, 'success', 4000);
      } else {
        const waypoints = paradasComCoordenadas.map((p) => ({ latitude: p.latitude as number, longitude: p.longitude as number }));
        const resultado = await googleMapsService.getDirections(pontoUnidade, pontoUnidade, waypoints);
        if (!resultado) { showToast('Não foi possível otimizar a rota', 'error'); return; }
        const ordemOtimizada = resultado.ordem_otimizada || [];
        const paradasReordenadas = ordenarParadasPorRota(paradas, ordemOtimizada, resultado.legs);
        setParadas(paradasReordenadas.map((p, i) => ({ ...p, ordem: i + 1 })));
        setRotaOtimizada({ distancia_total_metros: resultado.distancia_total_metros, duracao_total_segundos: resultado.duracao_total_segundos, legs: resultado.legs, polyline: resultado.polyline });
        setOrdemManual(false);
        showToast(`Rota otimizada! ${(resultado.distancia_total_metros / 1000).toFixed(1)} km - ${Math.round(resultado.duracao_total_segundos / 60)} min`, 'success', 4000);
      }
    } catch (error) {
      logger.error('[NovaEntrega] Erro ao otimizar rota', error);
      showToast('Não foi possível otimizar a rota', 'error');
    } finally {
      setIsOptimizing(false);
    }
  }, [enderecoUnidade, paradas, showToast]);

  // Helper: Calcular dados da rota
  const calcularDadosRota = useCallback(async () => {
    if (ordemManual && paradas.length > 0 && enderecoUnidade) {
      const pontoUnidade = { latitude: enderecoUnidade.latitude, longitude: enderecoUnidade.longitude };
      const paradasValidas = paradas.filter((p): p is Parada & { latitude: number; longitude: number } => p.latitude != null && p.longitude != null);
      if (paradasValidas.length > 0) {
        const waypoints = paradasValidas.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
        const resultado = await googleMapsService.getDirections(pontoUnidade, pontoUnidade, waypoints, false);
        if (resultado) return { distanciaKm: Number((resultado.distancia_total_metros / 1000).toFixed(2)), tempoMin: Math.round(resultado.duracao_total_segundos / 60), polyline: resultado.polyline };
      }
      return { distanciaKm: null, tempoMin: null, polyline: undefined };
    }
    if (rotaOtimizada) {
      return { distanciaKm: Number((rotaOtimizada.distancia_total_metros / 1000).toFixed(2)), tempoMin: Math.round(rotaOtimizada.duracao_total_segundos / 60), polyline: rotaOtimizada.polyline };
    }
    if (paradas.length > 0 && enderecoUnidade) {
      const pontoUnidade = { latitude: enderecoUnidade.latitude, longitude: enderecoUnidade.longitude };
      const paradasValidas = paradas.filter((p): p is Parada & { latitude: number; longitude: number } => p.latitude != null && p.longitude != null);
      const waypoints = paradasValidas.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
      const resultado = await googleMapsService.getDirections(pontoUnidade, pontoUnidade, waypoints, false);
      if (resultado) return { distanciaKm: Number((resultado.distancia_total_metros / 1000).toFixed(2)), tempoMin: Math.round(resultado.duracao_total_segundos / 60), polyline: resultado.polyline };
    }
    return { distanciaKm: null, tempoMin: null, polyline: undefined };
  }, [enderecoUnidade, ordemManual, paradas, rotaOtimizada]);

  // Helper: Registrar log (usa query centralizada fire-and-forget)
  const registrarLogRota = useCallback(async (rotaId: string, temVinculos: boolean, totalVinculos: number, distanciaKm: number | null, tempoMin: number | null) => {
    if (!userData?.id) { logger.warn('[NovaEntrega] Não foi possível registrar log: userData não disponível'); return; }
    logRotaAction(userData.id, rotaId, 'rota_criada', {
      total_paradas: paradas.length,
      motorista_id: motoristaSelecionado,
      foi_otimizada: rotaOtimizada !== null && !ordemManual,
      ordem_manual: ordemManual,
      tem_vinculos: temVinculos,
      total_vinculos: totalVinculos,
      distancia_km: distanciaKm,
      tempo_min: tempoMin,
      rota_circular: enderecoUnidade !== null,
    });
  }, [enderecoUnidade, motoristaSelecionado, ordemManual, paradas.length, rotaOtimizada, userData]);

  // Actions: Limpar formulário
  const limparFormulario = useCallback(() => {
    setParadas([]);
    setMotoristaSelecionado('');
    setRotaOtimizada(null);
    setOrdemManual(false);
    resetDistanciaReal();
    form.reset();
  }, [form, setMotoristaSelecionado, resetDistanciaReal]);

  // Actions: Gerar rota
  const gerarRota = useCallback(async () => {
    if (paradas.length === 0) { showToast('Adicione pelo menos uma parada antes de gerar a rota', 'info'); return; }
    if (!motoristaSelecionado) { showToast('Selecione um motorista para a rota', 'info'); return; }
    if (!unidadeAtiva) { showToast('Unidade não selecionada', 'error'); return; }
    if (isLoading) return;

    setIsLoading(true);
    try {
      const { distanciaKm, tempoMin, polyline } = await calcularDadosRota();
      const hoje = new Date();
      const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

      // Build typed rota payload using centralized query types
      const rotaPayload: RotaInsert = {
        unidade_id: unidadeAtiva,
        motorista_id: motoristaSelecionado,
        status: 'pendente',
        data: dataHoje,
        distancia_total: distanciaKm,
        tempo_total: tempoMin,
        polyline: polyline || null,
      };

      // Create rota using centralized query
      const rotaResult = await createRota(rotaPayload);
      if (!rotaResult.success) throw new Error(rotaResult.error.message);

      const rotaData = rotaResult.data;

      const paradasPreparadas = prepararParadasParaInserir({ rotaId: rotaData.id, paradas, enderecoUnidade, nomeUnidade: unidadeAtivaData?.nome || 'Base' });

      // Strip temp fields and cast to ParadaInsert
      const paradasLimpas = paradasPreparadas.map((p) => {
        const { _temp_id, _temp_vinculo_id, ...paradaLimpa } = p;
        return paradaLimpa as ParadaInsert;
      });

      // Create paradas using centralized query
      const paradasResult = await createParadasBatch(paradasLimpas);
      if (!paradasResult.success) throw new Error(paradasResult.error.message);

      const paradasInseridas = paradasResult.data;
      if (paradasInseridas && paradasInseridas.length > 0) {
        await atualizarVinculosParadas(paradasPreparadas, paradasInseridas.map(p => ({ id: p.id, ordem: p.ordem })));
      }

      const temVinculos = paradasPreparadas.some((p) => p._temp_vinculo_id);
      const totalVinculos = paradasPreparadas.filter((p) => p._temp_vinculo_id).length;
      await registrarLogRota(rotaData.id, temVinculos, totalVinculos, distanciaKm, tempoMin);

      showToast(`Rota circular criada com sucesso! ${paradas.length} entrega(s) cadastrada(s).`, 'success', 4000);
      if (limparFormularioTimeoutRef.current) clearTimeout(limparFormularioTimeoutRef.current);
      limparFormularioTimeoutRef.current = setTimeout(() => limparFormulario(), 1000);
    } catch (error) {
      logger.error('[NovaEntrega] Erro ao criar rota', error);
      showToast('Não foi possível criar a rota. Tente novamente.', 'error', 5000);
    } finally {
      setIsLoading(false);
    }
  }, [calcularDadosRota, enderecoUnidade, isLoading, limparFormulario, motoristaSelecionado, paradas, registrarLogRota, showToast, unidadeAtiva, unidadeAtivaData]);

  return {
    form, paradas, motoristas, motoristaSelecionado, vinculoSelecionado, isLoading, isLoadingMotoristas, isOptimizing,
    rotaOtimizada, ordemManual, distanciaManualReal, isCalculandoReal, enderecoUnidade, retiradasDisponiveis, paradasStatus,
    toastState, showToast, hideToast, setMotoristaSelecionado, setVinculoSelecionado, onAddParada,
    removeParada, moveParadaUp, moveParadaDown, otimizarRota, gerarRota, limparFormulario, userData, unidadeNome,
  };
}
