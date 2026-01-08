/**
 * Hook de gerenciamento de rotas para a tela de Gestão de Rotas
 *
 * Encapsula toda a lógica de estado e ações:
 * - Carregamento de rotas via Supabase
 * - Filtragem por status e busca textual
 * - Exclusão de rotas com confirmação
 * - Exportação para CSV
 * - Atualização em tempo real
 * - Cache local para melhor UX (stale-while-revalidate)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { useDebounce } from '@/hooks/useDebounce';
import { useRealtimeRoutes } from '@/hooks/useRealtimeRoutes';
import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { formatDateBR, formatDateTimeBR } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import {
  ROTA_STATUS_LABELS,
  FILTRO_STATUS_OPTIONS as FILTRO_OPTIONS,
  getRotaStatusLabel,
  type RotaStatus,
  type FiltroStatus,
} from '@/lib/statusLabels';
import { supabase } from '@/lib/supabase';

// ============================================
// CACHE CONSTANTS
// ============================================

const CACHE_KEY_PREFIX = 'gestao_rotas_cache_';

interface CachedRotas {
  data: RotaHistorico[];
  timestamp: number;
}

// ============================================
// TYPES
// ============================================

// Re-export types for backwards compatibility
export type { RotaStatus, FiltroStatus };

export interface RotaHistorico {
  id: string;
  data: string;
  status: RotaStatus;
  distancia_total?: number;
  iniciada_em?: string;
  concluida_em?: string;
  motorista_id?: string;
  motorista_nome?: string;
  paradas_count: number;
  paradas_concluidas: number;
}

// ============================================
// CONSTANTS (re-exports for backwards compatibility)
// ============================================

export const STATUS_LABELS = ROTA_STATUS_LABELS;
export const FILTRO_STATUS_OPTIONS = FILTRO_OPTIONS;

// ============================================
// HOOK
// ============================================

interface UseGestaoRotasOptions {
  statusColorMap: Record<RotaStatus, string>;
  defaultStatusColor: string;
}

export function useGestaoRotas(options: UseGestaoRotasOptions) {
  const { statusColorMap, defaultStatusColor } = options;

  const router = useRouter();
  const { userData } = useUser();
  const { unidadeAtiva } = useUnidadeAtiva();
  const { toast: toastState, showToast, hideToast, withToast } = useToast();

  // ============================================
  // STATE
  // ============================================

  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  const [rotasFiltradas, setRotasFiltradas] = useState<RotaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas');
  const [searchQuery, setSearchQuery] = useState('');

  // Debounce no search para evitar filtragens excessivas
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Estado para modal de confirmação
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [rotaToDelete, setRotaToDelete] = useState<RotaHistorico | null>(null);

  // Estado para ordenação
  const [sortColumn, setSortColumn] = useState<string>('data');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Ref para controlar AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // ============================================
  // CACHE HELPERS
  // ============================================

  const getCacheKey = useCallback(() => {
    return `${CACHE_KEY_PREFIX}${unidadeAtiva}`;
  }, [unidadeAtiva]);

  const loadFromCache = useCallback(async (): Promise<RotaHistorico[] | null> => {
    try {
      const cacheKey = getCacheKey();
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) return null;

      const { data }: CachedRotas = JSON.parse(cached);

      // Stale-while-revalidate: retornar dados mesmo se expirados
      // A revalidação acontece em background no useEffect
      return data;
    } catch {
      return null;
    }
  }, [getCacheKey]);

  const saveToCache = useCallback(async (data: RotaHistorico[]) => {
    try {
      const cacheKey = getCacheKey();
      const cached: CachedRotas = { data, timestamp: Date.now() };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cached));
    } catch {
      // Silently fail - cache is optional
    }
  }, [getCacheKey]);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadRotas = useCallback(async () => {
    if (!unidadeAtiva) return;

    // Cancelar request anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Stale-while-revalidate: mostrar cache primeiro
    const cachedData = await loadFromCache();
    if (cachedData && cachedData.length > 0) {
      setRotas(cachedData);
      setLoading(false);
      // Continua para buscar dados frescos em background
    }

    try {
      // Só mostra loading se não tiver cache
      if (!cachedData || cachedData.length === 0) {
        setLoading(true);
      }

      // Buscar rotas e paradas em paralelo (2 queries ao invés de N+1)
      const [rotasResult, paradasResult] = await Promise.all([
        supabase
          .from('rotas')
          .select(
            'id, data, status, distancia_total, iniciada_em, concluida_em, motorista_id, usuarios!rotas_motorista_id_fkey(id, nome)'
          )
          .eq('unidade_id', unidadeAtiva)
          .order('data', { ascending: false })
          .limit(100)
          .abortSignal(abortControllerRef.current.signal),
        supabase
          .from('paradas')
          .select('rota_id, status, is_checkpoint, rotas!inner(unidade_id)')
          .eq('rotas.unidade_id', unidadeAtiva)
          .abortSignal(abortControllerRef.current.signal),
      ]);

      if (rotasResult.error) throw rotasResult.error;

      // Criar mapa de contagens por rota_id
      const paradasPorRota = new Map<string, { total: number; concluidas: number }>();

      if (!paradasResult.error && paradasResult.data) {
        for (const parada of paradasResult.data) {
          if (parada.is_checkpoint === false) continue;

          const rotaId = parada.rota_id;
          if (!paradasPorRota.has(rotaId)) {
            paradasPorRota.set(rotaId, { total: 0, concluidas: 0 });
          }

          const stats = paradasPorRota.get(rotaId)!;
          stats.total++;
          if (parada.status === 'concluida') {
            stats.concluidas++;
          }
        }
      }

      // Montar resultado final
      const rotasComParadas: RotaHistorico[] = (rotasResult.data || []).map((rota) => {
        const motorista = Array.isArray(rota.usuarios) ? rota.usuarios[0] : rota.usuarios;
        const stats = paradasPorRota.get(rota.id) || { total: 0, concluidas: 0 };

        return {
          id: rota.id,
          data: rota.data,
          status: rota.status,
          distancia_total: rota.distancia_total,
          iniciada_em: rota.iniciada_em,
          concluida_em: rota.concluida_em,
          motorista_id: motorista?.id,
          motorista_nome: motorista?.nome,
          paradas_count: stats.total,
          paradas_concluidas: stats.concluidas,
        };
      });

      setRotas(rotasComParadas);

      // Salvar no cache para uso futuro
      await saveToCache(rotasComParadas);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      // Só mostrar erro se não tiver dados em cache
      if (!cachedData || cachedData.length === 0) {
        logger.error('Erro ao carregar rotas:', error);
        Alert.alert('Erro', 'Não foi possível carregar as rotas');
      }
    } finally {
      setLoading(false);
    }
  }, [unidadeAtiva, loadFromCache, saveToCache]);

  // ============================================
  // EFFECTS
  // ============================================

  // Carregar rotas ao montar/mudar unidade
  useEffect(() => {
    loadRotas();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadRotas]);

  // Realtime: Atualizar quando rotas/paradas mudarem
  useRealtimeRoutes({
    enabled: !!unidadeAtiva,
    onRouteUpdate: () => {
      loadRotas();
    },
  });

  // Filtrar e ordenar rotas (usando debouncedSearchQuery)
  useEffect(() => {
    let resultado = [...rotas];

    // Filtrar por status
    if (filtroStatus !== 'todas') {
      resultado = resultado.filter((rota) => rota.status === filtroStatus);
    }

    // Filtrar por busca de texto
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      resultado = resultado.filter((rota) => {
        const motoristaNome = rota.motorista_nome?.toLowerCase() || '';
        const dataFormatada = formatDateBR(rota.data).toLowerCase();
        return motoristaNome.includes(query) || dataFormatada.includes(query);
      });
    }

    // Ordenar resultados
    resultado.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'data':
          // Ordenar por data (string ISO)
          comparison = a.data.localeCompare(b.data);
          break;
        case 'motorista': {
          // Ordenar por nome do motorista (null-safe)
          const nomeA = a.motorista_nome?.toLowerCase() || '';
          const nomeB = b.motorista_nome?.toLowerCase() || '';
          comparison = nomeA.localeCompare(nomeB);
          break;
        }
        case 'status': {
          // Ordenar por prioridade de status
          const statusOrder: Record<RotaStatus, number> = {
            em_andamento: 0,
            pendente: 1,
            concluida: 2,
            cancelada: 3,
            nao_executada: 4,
          };
          comparison = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
          break;
        }
        default:
          comparison = 0;
      }

      // Aplicar direção da ordenação primária
      comparison = sortDirection === 'asc' ? comparison : -comparison;

      // Ordenação secundária: por hora de início (quando empate)
      if (comparison === 0) {
        const inicioA = a.iniciada_em || '';
        const inicioB = b.iniciada_em || '';
        // Secundária sempre DESC (mais recentes primeiro)
        comparison = inicioB.localeCompare(inicioA);
      }

      return comparison;
    });

    setRotasFiltradas(resultado);
  }, [rotas, filtroStatus, debouncedSearchQuery, sortColumn, sortDirection]);

  // ============================================
  // ACTIONS
  // ============================================

  const verDetalhes = useCallback((rota: RotaHistorico) => {
    router.push({
      pathname: '/gestor/mapa-rota',
      params: { id: rota.id }
    });
  }, [router]);

  const executarExclusao = useCallback(async (rota: RotaHistorico) => {
    if (!userData?.id) {
      showToast('Erro de autenticação. Faça login novamente.', 'error');
      return;
    }

    const usuarioId = userData.id;

    try {
      await withToast(
        async () => {
          const { error } = await supabase
            .from('rotas')
            .delete()
            .eq('id', rota.id);

          if (error) throw error;

          await supabase.from('logs').insert({
            usuario_id: usuarioId,
            rota_id: rota.id,
            evento: 'rota_excluida',
            detalhes: {
              motivo: 'Excluída pelo gestor',
              motorista: rota.motorista_nome,
              paradas_count: rota.paradas_count,
              status_anterior: rota.status,
            },
          });
        },
        {
          loading: 'Excluindo rota...',
          success: 'Rota excluída com sucesso!',
          error: 'Não foi possível excluir a rota',
        }
      );

      loadRotas();
    } catch (error) {
      logger.error('Erro ao excluir rota:', error);
    }
  }, [userData?.id, showToast, withToast, loadRotas]);

  const excluirRota = useCallback((rota: RotaHistorico) => {
    // Validação: não permitir excluir rotas em andamento
    if (rota.status === 'em_andamento') {
      if (Platform.OS === 'web') {
        showToast('Não é possível excluir uma rota em andamento. Aguarde a conclusão ou cancele a rota primeiro.', 'error', 5000);
      } else {
        Alert.alert(
          'Ação não permitida',
          'Não é possível excluir uma rota em andamento. Aguarde a conclusão ou cancele a rota primeiro.'
        );
      }
      return;
    }

    // Web: usar modal customizado
    if (Platform.OS === 'web') {
      setRotaToDelete(rota);
      setShowConfirmModal(true);
    } else {
      // Mobile: usar Alert.alert nativo
      const mensagem = `Tem certeza que deseja excluir esta rota?\n\nMotorista: ${rota.motorista_nome || 'Sem motorista'}\nParadas: ${rota.paradas_count}\n\nEsta ação não pode ser desfeita.`;
      Alert.alert(
        'Confirmar Exclusão',
        mensagem,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: () => executarExclusao(rota),
          },
        ]
      );
    }
  }, [showToast, executarExclusao]);

  const handleConfirmDelete = useCallback(() => {
    setShowConfirmModal(false);
    if (rotaToDelete) {
      executarExclusao(rotaToDelete);
      setRotaToDelete(null);
    }
  }, [rotaToDelete, executarExclusao]);

  const handleCancelDelete = useCallback(() => {
    setShowConfirmModal(false);
    setRotaToDelete(null);
  }, []);

  const exportarParaCSV = useCallback(async () => {
    try {
      if (rotasFiltradas.length === 0) {
        Alert.alert('Atenção', 'Não há rotas para exportar');
        return;
      }

      const headers = [
        'Data',
        'Motorista',
        'Paradas Concluídas',
        'Total Paradas',
        'Distância (km)',
        'Iniciada em',
        'Concluída em',
        'Status'
      ];

      const rows = rotasFiltradas.map(rota => [
        formatDateBR(rota.data),
        rota.motorista_nome || 'Sem motorista',
        rota.paradas_concluidas,
        rota.paradas_count,
        rota.distancia_total ? rota.distancia_total.toFixed(1) : '-',
        formatDateTimeBR(rota.iniciada_em, { showYear: true }),
        formatDateTimeBR(rota.concluida_em, { showYear: true }),
        STATUS_LABELS[rota.status] || rota.status
      ]);

      const csvContent = '\uFEFF' + [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeArquivo = `gestao-rotas-${dataAtual}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', nomeArquivo);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const fileUri = FileSystem.documentDirectory + nomeArquivo;

        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Exportar Relatório de Rotas',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          Alert.alert('Arquivo Salvo', `O arquivo foi salvo em: ${fileUri}`);
        }
      }

      // Log da ação
      if (userData?.id) {
        supabase.from('logs').insert({
          usuario_id: userData.id,
          evento: 'exportacao_rotas',
          detalhes: {
            total_rotas: rotasFiltradas.length,
            filtro_status: filtroStatus,
            formato: 'csv',
            plataforma: Platform.OS,
          },
        }).then(({ error }) => {
          if (error) logger.warn('Falha ao registrar log de exportação:', error.message);
        });
      }

      if (Platform.OS === 'web') {
        Alert.alert('Sucesso', `${rotasFiltradas.length} rotas exportadas com sucesso!`);
      }
    } catch (error) {
      logger.error('Erro ao exportar:', error);
      Alert.alert('Erro', 'Não foi possível exportar os dados');
    }
  }, [rotasFiltradas, filtroStatus, userData?.id]);

  // ============================================
  // SORTING
  // ============================================

  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
  }, []);

  // ============================================
  // HELPERS
  // ============================================

  const getStatusLabel = useCallback((status: RotaStatus | string): string => {
    return getRotaStatusLabel(status);
  }, []);

  const getStatusColor = useCallback((status: RotaStatus | string): string => {
    return statusColorMap[status as RotaStatus] ?? defaultStatusColor;
  }, [statusColorMap, defaultStatusColor]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    rotas,
    rotasFiltradas,
    loading,
    filtroStatus,
    searchQuery,
    showConfirmModal,
    rotaToDelete,
    userData,

    // State Setters
    setFiltroStatus,
    setSearchQuery,

    // Sorting
    sortColumn,
    sortDirection,
    handleSort,

    // Actions
    loadRotas,
    verDetalhes,
    excluirRota,
    handleConfirmDelete,
    handleCancelDelete,
    exportarParaCSV,

    // Helpers
    getStatusLabel,
    getStatusColor,

    // Toast
    toastState,
    showToast,
    hideToast,
  };
}
