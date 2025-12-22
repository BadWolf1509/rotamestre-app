import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { notifyRoutePending } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import {
  stopBackgroundTracking,
  requestAndStartTracking,
} from '@/services/unifiedLocationTracking';
import { notifyNewRouteWeb } from '@/utils/browserNotification';
import { warningHaptic } from '@/utils/haptics';
import { playNotificationSound } from '@/utils/notificationSound';

export type RouteStatus = 'no-route' | 'pending' | 'active' | 'last-stop' | 'ready-to-complete' | 'completed';

export interface RouteData {
  id: string;
  status: string;
  unidade_nome: string;
  distancia_total?: number;
  tempo_total?: number;
  iniciada_em?: string;
  concluida_em?: string;
  data?: string;
  created_at?: string;
}

export interface ParadaData {
  id: string;
  endereco: string;
  ordem: number;
  status: string;
  tipo: string;
  latitude: number;
  longitude: number;
  destinatario?: string;
  telefone?: string;
  observacoes?: string;
  foto_url?: string | null;
  /** false = checkpoint de partida/chegada, true/undefined = entrega real */
  is_checkpoint?: boolean;
  /** Timestamp quando a parada foi concluída */
  concluida_em?: string;
  /** true se a parada foi concluída automaticamente pelo sistema de tracking */
  auto_concluida?: boolean;
}

interface RouteStatusContextData {
  routeStatus: RouteStatus;
  route: RouteData | null;
  paradas: ParadaData[];
  currentStop: ParadaData | null;
  nextStop: ParadaData | null;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  /** Quantidade de outras rotas pendentes (além da atual) */
  pendingRoutesCount: number;
  loading: boolean;
  refreshRoute: () => Promise<void>;
  startRoute: () => Promise<void>;
  completeStop: (paradaId: string, fotoUrl?: string) => Promise<void>;
  skipStop: (paradaId: string) => Promise<void>;
  completeRoute: () => Promise<void>;
}

const RouteStatusContext = createContext<RouteStatusContextData>({} as RouteStatusContextData);

export function RouteStatusProvider({ children }: { children: ReactNode }) {
  const { userData, loading: userLoading } = useUser();
  const { session } = useAuth();
  const motoristaId = userData?.id;
  const [route, setRoute] = useState<RouteData | null>(null);
  const [paradas, setParadas] = useState<ParadaData[]>([]);
  const [pendingRoutesCount, setPendingRoutesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Refs para controle do Realtime
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isSubscribed = useRef(false);

  // Determina o status da rota (excluindo checkpoints da contagem)
  // Inclui reset diário às 00:00 e timeout de 1h para estado completed
  const getRouteStatus = (): RouteStatus => {
    if (!route) return 'no-route';

    // Reset diário: rotas de dias anteriores não são exibidas
    // IMPORTANTE: Usar data LOCAL, não UTC (evita problema de timezone)
    const now = new Date();
    const hoje = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const rotaData = route.data || route.created_at?.split('T')[0];

    if (rotaData && rotaData < hoje) {
      return 'no-route'; // Rota expirada (dia anterior)
    }

    if (route.status === 'pendente') return 'pending';

    if (route.status === 'em_andamento') {
      // Contar apenas paradas reais (excluindo checkpoints de partida/chegada)
      const pendingStops = paradas.filter(p => p.status === 'pendente' && p.is_checkpoint !== false);

      if (pendingStops.length === 0) return 'ready-to-complete';
      if (pendingStops.length === 1) return 'last-stop';
      return 'active';
    }

    if (route.status === 'concluida') {
      // Timeout de 1 hora: após esse período, mostrar no-route
      if (route.concluida_em) {
        const concluidaEm = new Date(route.concluida_em).getTime();
        const agora = Date.now();
        const umaHoraMs = 60 * 60 * 1000; // 1 hora em milissegundos

        if (agora - concluidaEm > umaHoraMs) {
          return 'no-route'; // Celebração expirou
        }
      }
      return 'completed';
    }

    return 'no-route';
  };

  // Calcula progresso (excluindo checkpoints de partida/chegada)
  const getProgress = () => {
    const paradasReais = paradas.filter(p => p.is_checkpoint !== false);
    const completed = paradasReais.filter(p => p.status === 'concluida').length;
    const total = paradasReais.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  };

  // Pega a parada atual (próxima pendente, excluindo checkpoints)
  const getCurrentStop = (): ParadaData | null => {
    return paradas
      .filter(p => p.status === 'pendente' && p.is_checkpoint !== false)
      .sort((a, b) => a.ordem - b.ordem)[0] || null;
  };

  // Pega a próxima parada após a atual (excluindo checkpoints)
  const getNextStop = (): ParadaData | null => {
    const pendingStops = paradas
      .filter(p => p.status === 'pendente' && p.is_checkpoint !== false)
      .sort((a, b) => a.ordem - b.ordem);

    return pendingStops[1] || null;
  };

  // Carrega rota ativa (aguarda userData estar carregado para evitar 406)
  // OTIMIZAÇÃO: Usa única query para buscar rotas ativas OU última concluída
  // PRIORIDADE: data ASC (rota de hoje antes de amanhã), created_at ASC
  const loadActiveRoute = useCallback(async () => {
    // Aguardar carregamento completo do userData antes de fazer queries
    if (userLoading || !motoristaId) {
      if (!userLoading && !motoristaId) {
        setRoute(null);
        setParadas([]);
        setPendingRoutesCount(0);
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);

      // OTIMIZAÇÃO: Única query que busca rotas ativas E última concluída
      // Ordenação por data ASC garante que rota de hoje tem prioridade sobre amanhã
      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select(`
          id,
          status,
          distancia_total,
          tempo_total,
          iniciada_em,
          concluida_em,
          created_at,
          data,
          unidades (nome)
        `)
        .eq('motorista_id', motoristaId)
        .in('status', ['pendente', 'em_andamento', 'concluida'])
        .order('data', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(20);

      if (rotasError) {
        console.error('[RouteStatus] Query error:', rotasError);
        setRoute(null);
        setParadas([]);
        setPendingRoutesCount(0);
        setLoading(false);
        return;
      }

      if (!rotasData || rotasData.length === 0) {
        setRoute(null);
        setParadas([]);
        setPendingRoutesCount(0);
        setLoading(false);
        return;
      }

      // Separar rotas por status
      const activeStatuses = ['pendente', 'em_andamento'];
      const activeRoutes = rotasData.filter(r => activeStatuses.includes(r.status));
      const completedRoutes = rotasData.filter(r => r.status === 'concluida');

      // Prioridade: em_andamento > pendente (por data ASC) > concluída
      const inProgressRoute = activeRoutes.find(r => r.status === 'em_andamento');
      const pendingRoutes = activeRoutes.filter(r => r.status === 'pendente');
      const firstPendingRoute = pendingRoutes[0]; // Já ordenada por data ASC

      // Contar outras rotas pendentes (excluindo a selecionada)
      const otherPendingCount = inProgressRoute
        ? pendingRoutes.length // Se em andamento, todas as pendentes são "outras"
        : Math.max(0, pendingRoutes.length - 1); // Se pendente, excluir a atual

      setPendingRoutesCount(otherPendingCount);

      // Selecionar rota: em_andamento > primeira pendente > última concluída
      const lastCompletedRoute = completedRoutes.sort((a, b) =>
        new Date(b.concluida_em || 0).getTime() - new Date(a.concluida_em || 0).getTime()
      )[0];

      const selectedRoute = inProgressRoute || firstPendingRoute || lastCompletedRoute;

      if (!selectedRoute) {
        setRoute(null);
        setParadas([]);
        setPendingRoutesCount(0);
        setLoading(false);
        return;
      }

      const unidadeData = selectedRoute.unidades as unknown as { nome: string } | null;
      setRoute({
        ...selectedRoute,
        unidade_nome: unidadeData?.nome || '',
      } as RouteData);

      // Carrega paradas da rota selecionada
      const { data: paradasData } = await supabase
        .from('paradas')
        .select('*')
        .eq('rota_id', selectedRoute.id)
        .order('ordem');

      setParadas(paradasData || []);
    } catch (error) {
      console.error('Erro ao carregar rota:', error);
      setRoute(null);
      setParadas([]);
    } finally {
      setLoading(false);
    }
  }, [userLoading, motoristaId]);

  // Inicia rota
  const startRoute = async () => {
    if (!route || !userData) return;

    // Validar se a rota está em status pendente (evita reiniciar rota já concluída/cancelada)
    if (route.status !== 'pendente') {
      console.warn(`[startRoute] Tentativa de iniciar rota com status '${route.status}' - ignorado`);
      return;
    }

    try {
      const now = new Date().toISOString();

      // 1. Atualizar status da rota
      const { error } = await supabase
        .from('rotas')
        .update({
          status: 'em_andamento',
          iniciada_em: now,
        })
        .eq('id', route.id);

      if (error) throw error;

      // 2. Registrar log de início da rota
      await supabase.from('logs').insert({
        usuario_id: userData.id,
        rota_id: route.id,
        evento: 'motorista_iniciou_rota',
        detalhes: {
          motorista_id: userData.id,
          motorista_nome: userData.nome,
          unidade_nome: route.unidade_nome,
        },
      });

      // 3. Marcar checkpoint de partida (ordem 0, is_checkpoint=false) como concluído
      const checkpointPartida = paradas.find(p => p.is_checkpoint === false && p.ordem === 0);
      if (checkpointPartida) {
        await supabase
          .from('paradas')
          .update({
            status: 'concluida',
            concluida_em: now,
          })
          .eq('id', checkpointPartida.id);
      }

      // 4. Iniciar rastreamento de localização em background (apenas mobile)
      if (Platform.OS !== 'web') {
        await requestAndStartTracking({
          rotaId: route.id,
          motoristaId: userData.id,
          motoristaNome: userData.nome || 'Motorista',
          startedAt: now,
        });
      }

      await loadActiveRoute();
    } catch (error) {
      console.error('Erro ao iniciar rota:', error);
      throw error;
    }
  };

  // Completa parada
  const completeStop = async (paradaId: string, fotoUrl?: string) => {
    // Validar se a rota está em andamento
    if (!route || route.status !== 'em_andamento') {
      console.warn(`[completeStop] Tentativa de concluir parada com rota em status '${route?.status}' - ignorado`);
      throw new Error('A rota precisa estar em andamento para concluir paradas');
    }

    try {
      const updateData: any = {
        status: 'concluida',
        concluida_em: new Date().toISOString(),
      };

      if (fotoUrl) {
        updateData.foto_url = fotoUrl;
      }

      const { error } = await supabase
        .from('paradas')
        .update(updateData)
        .eq('id', paradaId);

      if (error) throw error;

      await loadActiveRoute();
    } catch (error) {
      console.error('Erro ao concluir parada:', error);
      throw error;
    }
  };

  // Pula parada
  const skipStop = async (paradaId: string) => {
    // Validar se a rota está em andamento
    if (!route || route.status !== 'em_andamento') {
      console.warn(`[skipStop] Tentativa de pular parada com rota em status '${route?.status}' - ignorado`);
      throw new Error('A rota precisa estar em andamento para pular paradas');
    }

    try {
      const { error } = await supabase
        .from('paradas')
        .update({
          status: 'pulada',
        })
        .eq('id', paradaId);

      if (error) throw error;

      await loadActiveRoute();
    } catch (error) {
      console.error('Erro ao pular parada:', error);
      throw error;
    }
  };

  // Finaliza rota
  const completeRoute = async () => {
    if (!route) return;

    try {
      const now = new Date().toISOString();

      // 1. Parar rastreamento de localização em background
      if (Platform.OS !== 'web') {
        await stopBackgroundTracking();
      }

      // 2. Atualizar status da rota
      const { error } = await supabase
        .from('rotas')
        .update({
          status: 'concluida',
          concluida_em: now,
        })
        .eq('id', route.id);

      if (error) throw error;

      // 3. Marcar checkpoint de chegada (última parada com is_checkpoint=false) como concluído
      const checkpointChegada = paradas
        .filter(p => p.is_checkpoint === false)
        .sort((a, b) => b.ordem - a.ordem)[0]; // Pega a de maior ordem

      if (checkpointChegada) {
        await supabase
          .from('paradas')
          .update({
            status: 'concluida',
            concluida_em: now,
          })
          .eq('id', checkpointChegada.id);
      }

      await loadActiveRoute();
    } catch (error) {
      console.error('Erro ao concluir rota:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadActiveRoute();
  }, [loadActiveRoute]);

  // Realtime subscription com autenticação e debounce
  useEffect(() => {
    // Aguardar autenticação E motorista ID
    if (!motoristaId || !session?.access_token) {
      return;
    }

    // Evitar reconexão desnecessária
    if (isSubscribed.current) {
      return;
    }

    // CRÍTICO: Configurar token ANTES de criar o canal
    // Sem isso, RLS bloqueia os eventos
    supabase.realtime.setAuth(session.access_token);

    isSubscribed.current = true;

    // Função de debounce para evitar múltiplas chamadas
    const debouncedReload = () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        loadActiveRoute();
      }, 500); // 500ms debounce
    };

    const channel = supabase
      .channel(`motorista-routes-${motoristaId}`)
      // INSERT e UPDATE usam filtro (mais eficiente)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rotas',
          filter: `motorista_id=eq.${motoristaId}`,
        },
        async (payload) => {
          // Feedback imediato para o motorista
          const unidadeNome = (payload.new as any).unidades?.nome || 'Nova rota';

          if (Platform.OS === 'web') {
            // Web: Browser notification + som
            notifyNewRouteWeb(unidadeNome);
            playNotificationSound();
          } else {
            // Mobile: Haptic + Local notification + som
            warningHaptic();
            playNotificationSound();
            notifyRoutePending(unidadeNome);
          }

          debouncedReload();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rotas',
          filter: `motorista_id=eq.${motoristaId}`,
        },
        () => {
          debouncedReload();
        }
      )
      // DELETE sem filtro (Replica Identity não está FULL)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'rotas',
        },
        () => {
          debouncedReload();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'paradas',
        },
        () => {
          debouncedReload();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[Realtime:Motorista] Erro na conexão');
          isSubscribed.current = false;
        }
      });

    return () => {
      isSubscribed.current = false;
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      supabase.removeChannel(channel);
    };
  }, [loadActiveRoute, motoristaId, session?.access_token]);

  return (
    <RouteStatusContext.Provider
      value={{
        routeStatus: getRouteStatus(),
        route,
        paradas,
        currentStop: getCurrentStop(),
        nextStop: getNextStop(),
        progress: getProgress(),
        pendingRoutesCount,
        loading,
        refreshRoute: loadActiveRoute,
        startRoute,
        completeStop,
        skipStop,
        completeRoute,
      }}
    >
      {children}
    </RouteStatusContext.Provider>
  );
}

export function useRouteStatus() {
  const context = useContext(RouteStatusContext);

  if (!context) {
    throw new Error('useRouteStatus must be used within RouteStatusProvider');
  }

  return context;
}
