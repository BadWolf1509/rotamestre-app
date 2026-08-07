import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Platform } from 'react-native';
import { z } from 'zod';

import type {
  DistanciaManualReal,
  EnderecoUnidade,
  MotoristaResumo,
  Parada,
  ParadaFormData,
  ParadaFormDataWithCoords,
  ParadasStatus,
  RotaOtimizadaState,
  RouteDraftValidation,
} from '@/components/gestor/nova-entrega/types';
import type {
  BulkImportResult,
  BulkParadaInput,
} from '@/hooks/nova-entrega/useParadasManagement';
import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';

import {
  useDistanceCalculation,
  useEnderecoUnidade,
  useMotoristaSelection,
  useNovaEntregaDraft,
  useParadasManagement,
  useRouteCreation,
  useRouteOptimization,
} from './nova-entrega';
import {
  encontrarParadaDuplicada,
  validarRascunhoRota,
} from './useNovaEntrega.helpers';

// Exportado para que o teste do FormularioParada monte um form real com a
// mesma validação da tela, em vez de duplicar o schema e testar uma cópia.
export const paradaSchema = z
  .object({
    endereco: z.string().trim().min(5, 'Informe um endereço válido.'),
    tipo: z.enum(['entrega', 'retirada']),
    destinatario: z.string().trim().min(3, 'Informe o nome do destinatário.'),
    telefone: z
      .string()
      .min(1, 'Telefone de contato é obrigatório.')
      .refine((value) => {
        const digits = value.replace(/\D/g, '');
        return digits.length === 10 || digits.length === 11;
      }, 'Telefone deve ter DDD e 10 ou 11 dígitos.'),
    observacoes: z
      .string()
      .max(300, 'As observações devem ter no máximo 300 caracteres.')
      .optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })
  .superRefine((value, context) => {
    if (value.latitude == null || value.longitude == null) {
      context.addIssue({
        code: 'custom',
        path: ['endereco'],
        message: 'Selecione um endereço nas sugestões para validá-lo.',
      });
    }
  });

function localToday(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export interface UseNovaEntregaReturn {
  form: ReturnType<typeof useForm<ParadaFormDataWithCoords>>;
  paradas: Parada[];
  motoristas: MotoristaResumo[];
  motoristaSelecionado: string;
  vinculoSelecionado: string;
  dataRota: string;
  setDataRota: (date: string) => void;
  isLoading: boolean;
  isLoadingMotoristas: boolean;
  isLoadingEndereco: boolean;
  isOptimizing: boolean;
  isDraftHydrating: boolean;
  isDraftSaving: boolean;
  draftLastSavedAt: string | null;
  draftSaveError: string | null;
  rotaOtimizada: RotaOtimizadaState | null;
  ordemManual: boolean;
  distanciaManualReal: DistanciaManualReal | null;
  isCalculandoReal: boolean;
  enderecoUnidade: EnderecoUnidade | null;
  retiradasDisponiveis: Parada[];
  paradasStatus: ParadasStatus;
  routeValidation: RouteDraftValidation;
  canGenerateRoute: boolean;
  editingParada: Parada | null;
  toastState: ReturnType<typeof useToast>['toast'];
  showToast: ReturnType<typeof useToast>['showToast'];
  hideToast: () => void;
  setMotoristaSelecionado: (id: string) => void;
  setVinculoSelecionado: (id: string) => void;
  onAddParada: (
    data: ParadaFormData,
    vinculoId?: string,
    allowDuplicate?: boolean,
  ) => Promise<boolean>;
  importParadas: (items: BulkParadaInput[]) => Promise<BulkImportResult>;
  startEditParada: (index: number) => void;
  cancelEditParada: () => void;
  removeParada: (index: number) => void;
  moveParadaUp: (index: number) => void;
  moveParadaDown: (index: number) => void;
  reorderParadas: (data: Parada[]) => void;
  otimizarRota: () => Promise<void>;
  gerarRota: () => Promise<boolean>;
  limparFormulario: () => void;
  findDuplicate: (data: ParadaFormData) => Parada | null;
  userData: ReturnType<typeof useUser>['userData'];
  unidadeNome: string;
}

export function useNovaEntrega(): UseNovaEntregaReturn {
  const { userData } = useUser();
  const { unidadeAtiva, unidadeAtivaData } = useUnidadeAtiva();
  const { toast: toastState, showToast, hideToast } = useToast();
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [vinculoSelecionado, setVinculoSelecionado] = useState('');
  const [editingParadaId, setEditingParadaId] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [dataRota, setDataRota] = useState(localToday);

  const form = useForm<ParadaFormDataWithCoords>({
    resolver: zodResolver(paradaSchema),
    defaultValues: {
      tipo: 'entrega',
      endereco: '',
      destinatario: '',
      telefone: '',
      observacoes: '',
      latitude: undefined,
      longitude: undefined,
    },
    shouldFocusError: true,
  });

  const handleError = useCallback(
    (message: string) => showToast(message, 'error', 5000),
    [showToast],
  );
  const { enderecoUnidade, isLoading: isLoadingEndereco } =
    useEnderecoUnidade(handleError);
  const {
    motoristas,
    motoristaSelecionado,
    setMotoristaSelecionado,
    isLoading: isLoadingMotoristas,
  } = useMotoristaSelection(handleError);

  const routeOptimization = useRouteOptimization({
    paradas,
    enderecoUnidade,
    showToast,
  });
  const {
    rotaOtimizada,
    setRotaOtimizada,
    ordemManual,
    setOrdemManual,
    isOptimizing,
    resetOptimization,
  } = routeOptimization;

  const {
    distanciaManualReal,
    isCalculandoReal,
    calculationError,
    resetDistanciaReal,
  } = useDistanceCalculation({
    paradas,
    enderecoUnidade,
    rotaOtimizada,
    ordemManual,
  });

  const resetStopForm = useCallback(() => {
    form.reset();
    setVinculoSelecionado('');
    setEditingParadaId(null);
  }, [form]);

  const paradasManagement = useParadasManagement({
    paradas,
    setParadas,
    rotaOtimizada,
    onOrdemManualChange: setOrdemManual,
    onRotaOtimizadaReset: () => setRotaOtimizada(null),
    onDistanciaManualRealReset: resetDistanciaReal,
    showToast,
    onFormReset: resetStopForm,
  });

  const draftPayload = useMemo(
    () => ({
      paradas,
      motoristaSelecionado,
      dataRota,
      rotaOtimizada,
      ordemManual,
    }),
    [dataRota, motoristaSelecionado, ordemManual, paradas, rotaOtimizada],
  );

  const restoreDraft = useCallback(
    (draft: typeof draftPayload | null) => {
      setParadas(draft?.paradas ?? []);
      setMotoristaSelecionado(draft?.motoristaSelecionado ?? '');
      setDataRota(draft?.dataRota ?? localToday());
      setRotaOtimizada(draft?.rotaOtimizada ?? null);
      setOrdemManual(draft?.ordemManual ?? false);
      resetStopForm();
      resetDistanciaReal();
    },
    [
      resetDistanciaReal,
      resetStopForm,
      setMotoristaSelecionado,
      setOrdemManual,
      setRotaOtimizada,
    ],
  );

  const {
    isHydrating: isDraftHydrating,
    isSaving: isDraftSaving,
    lastSavedAt: draftLastSavedAt,
    saveError: draftSaveError,
    clearDraft,
  } = useNovaEntregaDraft({
    userId: userData?.id ?? null,
    unidadeId: unidadeAtiva,
    payload: draftPayload,
    onRestore: restoreDraft,
  });

  const coreRouteValidation = useMemo(
    () =>
      validarRascunhoRota({
        paradas,
        motoristaId: motoristaSelecionado,
        dataRota,
        enderecoUnidade,
      }),
    [dataRota, enderecoUnidade, motoristaSelecionado, paradas],
  );

  const routeValidation = useMemo((): RouteDraftValidation => {
    const erros = [...coreRouteValidation.erros];
    if (coreRouteValidation.valido) {
      const routeMetrics =
        rotaOtimizada && !ordemManual ? rotaOtimizada : distanciaManualReal;

      if (routeMetrics?.isEstimated) {
        erros.push(
          'O percurso disponível é apenas uma estimativa. Recalcule antes de criar.',
        );
      } else if (isCalculandoReal) {
        erros.push('Aguarde o cálculo da distância e do tempo da rota.');
      } else if (!routeMetrics) {
        erros.push(
          calculationError ||
            'Calcule a distância e o tempo da rota antes de continuar.',
        );
      }
    }

    return {
      ...coreRouteValidation,
      valido: erros.length === 0,
      erros,
    };
  }, [
    calculationError,
    coreRouteValidation,
    distanciaManualReal,
    isCalculandoReal,
    ordemManual,
    rotaOtimizada,
  ]);

  const clearAfterSuccess = useCallback(
    (_rotaId: string) => {
      setParadas([]);
      setMotoristaSelecionado('');
      setDataRota(localToday());
      resetOptimization();
      resetDistanciaReal();
      resetStopForm();
      clearDraft().catch(() => {
        // O RPC também remove o rascunho; esta chamada é apenas sincronização local.
      });
    },
    [
      clearDraft,
      resetDistanciaReal,
      resetOptimization,
      resetStopForm,
      setMotoristaSelecionado,
    ],
  );

  const { gerarRota } = useRouteCreation({
    paradas,
    enderecoUnidade,
    rotaOtimizada,
    distanciaManualReal,
    ordemManual,
    motoristaSelecionado,
    unidadeAtiva,
    unidadeNome: unidadeAtivaData?.nome || 'Base',
    dataRota,
    isLoading: routeLoading || paradasManagement.isLoading,
    setIsLoading: setRouteLoading,
    showToast,
    onSuccess: clearAfterSuccess,
  });

  const onAddParada = useCallback(
    (data: ParadaFormData, vinculoId?: string, allowDuplicate = false) =>
      paradasManagement.onAddParada(
        data,
        vinculoId,
        editingParadaId ?? undefined,
        allowDuplicate,
      ),
    [editingParadaId, paradasManagement],
  );

  const startEditParada = useCallback(
    (index: number) => {
      const parada = paradas[index];
      if (!parada) return;
      setEditingParadaId(parada.id);
      setVinculoSelecionado(parada.vinculo_parada_id ?? '');
      form.reset({
        tipo: parada.tipo,
        endereco: parada.endereco,
        destinatario: parada.destinatario,
        telefone: parada.telefone,
        observacoes: parada.observacoes ?? '',
        latitude: parada.latitude,
        longitude: parada.longitude,
      });
    },
    [form, paradas],
  );

  const cancelEditParada = useCallback(() => resetStopForm(), [resetStopForm]);

  const otimizarRota = useCallback(async () => {
    const reordered = await routeOptimization.otimizarRota();
    if (reordered) setParadas(reordered);
  }, [routeOptimization]);

  const limparFormulario = useCallback(() => {
    const motoristaAnterior = motoristaSelecionado;
    const dataAnterior = dataRota;
    const rotaAnterior = rotaOtimizada;
    const ordemManualAnterior = ordemManual;
    paradasManagement.clearParadas(() => {
      setMotoristaSelecionado(motoristaAnterior);
      setDataRota(dataAnterior);
      setRotaOtimizada(rotaAnterior);
      setOrdemManual(ordemManualAnterior);
    });
    setMotoristaSelecionado('');
    setDataRota(localToday());
    resetStopForm();
  }, [
    dataRota,
    motoristaSelecionado,
    ordemManual,
    paradasManagement,
    resetStopForm,
    rotaOtimizada,
    setMotoristaSelecionado,
    setOrdemManual,
    setRotaOtimizada,
  ]);

  const findDuplicate = useCallback(
    (data: ParadaFormData) =>
      encontrarParadaDuplicada(paradas, data, editingParadaId ?? undefined),
    [editingParadaId, paradas],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || paradas.length === 0) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [paradas.length]);

  useEffect(() => {
    if (
      isLoadingMotoristas ||
      !motoristaSelecionado ||
      motoristas.some((motorista) => motorista.id === motoristaSelecionado)
    ) {
      return;
    }

    setMotoristaSelecionado('');
    showToast(
      'O motorista salvo no rascunho não está mais disponível nesta unidade.',
      'info',
      5000,
    );
  }, [
    isLoadingMotoristas,
    motoristaSelecionado,
    motoristas,
    setMotoristaSelecionado,
    showToast,
  ]);

  const unidadeNome = unidadeAtivaData?.nome || userData?.unidades?.nome || '';
  const editingParada =
    paradas.find((parada) => parada.id === editingParadaId) ?? null;
  const isLoading = routeLoading || paradasManagement.isLoading;
  const canGenerateRoute =
    routeValidation.valido && !isLoading && !isDraftHydrating;

  return {
    form,
    paradas,
    motoristas,
    motoristaSelecionado,
    vinculoSelecionado,
    dataRota,
    setDataRota,
    isLoading,
    isLoadingMotoristas,
    isLoadingEndereco,
    isOptimizing,
    isDraftHydrating,
    isDraftSaving,
    draftLastSavedAt,
    draftSaveError,
    rotaOtimizada,
    ordemManual,
    distanciaManualReal,
    isCalculandoReal,
    enderecoUnidade,
    retiradasDisponiveis: paradasManagement.retiradasDisponiveis,
    paradasStatus: paradasManagement.paradasStatus,
    routeValidation,
    canGenerateRoute,
    editingParada,
    toastState,
    showToast,
    hideToast,
    setMotoristaSelecionado,
    setVinculoSelecionado,
    onAddParada,
    importParadas: paradasManagement.importParadas,
    startEditParada,
    cancelEditParada,
    removeParada: paradasManagement.removeParada,
    moveParadaUp: paradasManagement.moveParadaUp,
    moveParadaDown: paradasManagement.moveParadaDown,
    reorderParadas: paradasManagement.reorderParadas,
    otimizarRota,
    gerarRota,
    limparFormulario,
    findDuplicate,
    userData,
    unidadeNome,
  };
}
