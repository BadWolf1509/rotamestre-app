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
import { logger } from '@/lib/logger';
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

  // Determina o status da UI baseado na rota selecionada
  // NOTA: A priorização (ativas > concluídas) é feita em loadActiveRoute()
  // Este método apenas mapeia o status da rota para o estado da UI
  //
  // IMPORTANTE: Rotas pendentes/em_andamento SEMPRE aparecem!
  // A expiração é controlada pelo job backend (22:00) que muda status para 'nao_executada'.
  // O frontend confia no status do banco - não duplica lógica de expiração.
  const getRouteStatus = (): RouteStatus => {
    if (!route) return 'no-route';

    // Rotas pendentes SEMPRE aparecem (backend controla expiração via job 22:00)
    if (route.status === 'pendente') return 'pending';

    // Rotas em andamento SEMPRE aparecem
    if (route.status === 'em_andamento') {
      // Contar apenas paradas reais (excluindo checkpoints de partida/chegada)
      const pendingStops = paradas.filter(
        p =>
          p.is_checkpoint !== false &&
          (p.status === 'pendente' || p.status === 'em_andamento')
      );

      if (pendingStops.length === 0) return 'ready-to-complete';
      if (pendingStops.length === 1) return 'last-stop';
      return 'active';
    }

    // Rotas concluídas: aplicar timeout de 1h para celebração
    if (route.status === 'concluida') {
      // Fallback: verificar timeout de 1h (principal está na query de loadActiveRoute)
      if (route.concluida_em) {
        const concluidaEm = new Date(route.concluida_em).getTime();
        const agora = Date.now();
        const umaHoraMs = 60 * 60 * 1000;

        if (agora - concluidaEm > umaHoraMs) {
          return 'no-route';
        }
      }
      return 'completed';
    }

    // Status desconhecido ou expirado pelo backend (nao_executada, cancelada, etc)
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
    const orderedStops = paradas
      .filter(p => p.is_checkpoint !== false)
      .sort((a, b) => a.ordem - b.ordem);

    const inProgressStop = orderedStops.find(p => p.status === 'em_andamento');
    if (inProgressStop) return inProgressStop;

    return orderedStops.find(p => p.status === 'pendente') || null;
  };

  // Pega a próxima parada após a atual (excluindo checkpoints)
  const getNextStop = (): ParadaData | null => {
    const orderedStops = paradas
      .filter(p => p.is_checkpoint !== false)
      .sort((a, b) => a.ordem - b.ordem);

    const currentStop = orderedStops.find(p => p.status === 'em_andamento')
      || orderedStops.find(p => p.status === 'pendente');

    if (!currentStop) return null;

    return orderedStops.find(
      p => p.status === 'pendente' && p.ordem > currentStop.ordem
    ) || null;
  };

  // Carrega rota ativa (aguarda userData estar carregado para evitar 406)
  // PRIORIDADE ABSOLUTA: Rotas ativas (pendente/em_andamento) > Rota concluída
  // Isso garante que o motorista sempre veja trabalho pendente, nunca ficando
  // "preso" na tela de rota concluída quando há nova rota atribuída.
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

      // Helper para montar o objeto RouteData
      const buildRouteData = (rota: any): RouteData => {
        const unidadeData = rota.unidades as unknown as { nome: string } | null;
        return {
          ...rota,
          unidade_nome: unidadeData?.nome || '',
        } as RouteData;
      };

      // ========================================
      // QUERY 1: Buscar rotas ATIVAS primeiro
      // (pendente ou em_andamento)
      // ========================================
      const { data: rotasAtivas, error: errorAtivas } = await supabase
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
        .in('status', ['pendente', 'em_andamento'])
        .order('data', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(10);

      if (errorAtivas) {
        logger.error('[RouteStatus] Erro ao buscar rotas ativas', errorAtivas);
        setRoute(null);
        setParadas([]);
        setPendingRoutesCount(0);
        setLoading(false);
        return;
      }

      // Se tem rotas ativas, usa a de maior prioridade
      if (rotasAtivas && rotasAtivas.length > 0) {
        // Prioridade: em_andamento > pendente (por data ASC)
        const inProgressRoute = rotasAtivas.find(r => r.status === 'em_andamento');
        const pendingRoutes = rotasAtivas.filter(r => r.status === 'pendente');
        const selectedRoute = inProgressRoute || pendingRoutes[0];

        // Contar outras rotas pendentes (excluindo a selecionada)
        const otherPendingCount = inProgressRoute
          ? pendingRoutes.length
          : Math.max(0, pendingRoutes.length - 1);

        setPendingRoutesCount(otherPendingCount);
        setRoute(buildRouteData(selectedRoute));

        // Carrega paradas da rota selecionada
        const { data: paradasData } = await supabase
          .from('paradas')
          .select('*')
          .eq('rota_id', selectedRoute.id)
          .order('ordem');

        setParadas(paradasData || []);
        setLoading(false);
        return;
      }

      // ========================================
      // QUERY 2: Se NÃO tem rotas ativas,
      // buscar última rota concluída (para celebração)
      // ========================================
      setPendingRoutesCount(0); // Sem rotas ativas = sem pendentes

      // Timeout de celebração: 1 hora
      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: rotaConcluida, error: errorConcluida } = await supabase
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
        .eq('status', 'concluida')
        .gte('concluida_em', umaHoraAtras) // Apenas concluídas há menos de 1h
        .order('concluida_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errorConcluida) {
        logger.error('[RouteStatus] Erro ao buscar rota concluída', errorConcluida);
        setRoute(null);
        setParadas([]);
        setLoading(false);
        return;
      }

      // Se tem rota concluída recente, mostra ela
      if (rotaConcluida) {
        setRoute(buildRouteData(rotaConcluida));

        // Carrega paradas da rota concluída
        const { data: paradasData } = await supabase
          .from('paradas')
          .select('*')
          .eq('rota_id', rotaConcluida.id)
          .order('ordem');

        setParadas(paradasData || []);
        setLoading(false);
        return;
      }

      // Sem rotas ativas nem concluídas recentes
      setRoute(null);
      setParadas([]);
    } catch (error) {
      logger.error('[RouteStatus] Erro ao carregar rota', error);
      setRoute(null);
      setParadas([]);
    } finally {
      setLoading(false);
    }
  }, [userLoading, motoristaId]);

  /**
   * Marca a próxima parada pendente como "em_andamento"
   * Encontra a parada com menor ordem que ainda está pendente
   */
  const marcarProximaParadaEmAndamento = async (paradasAtuais: ParadaData[]) => {
    // Encontrar próxima parada pendente (menor ordem, não checkpoint)
    const proximaPendente = paradasAtuais
      .filter(p => p.status === 'pendente' && p.is_checkpoint !== false)
      .sort((a, b) => a.ordem - b.ordem)[0];

    if (proximaPendente) {
      const { error } = await supabase
        .from('paradas')
        .update({ status: 'em_andamento' })
        .eq('id', proximaPendente.id);

      if (error) {
        logger.error('[RouteStatus] marcarProximaParadaEmAndamento Erro', error);
      }
    }
  };

  // Inicia rota
  const startRoute = async () => {
    if (!route || !userData) return;

    // Validar se a rota está em status pendente (evita reiniciar rota já concluída/cancelada)
    if (route.status !== 'pendente') {
      logger.warn(`[RouteStatus] startRoute Tentativa de iniciar rota com status '${route.status}' - ignorado`);
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

      // NOTA: Log 'motorista_iniciou_rota' é criado automaticamente pelo trigger
      // do banco (log_rota_status_change) quando o status muda para 'em_andamento'

      // 2. Marcar ponto de partida (ordem 0) como concluído
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

      // 3. Marcar primeira parada real como "em_andamento"
      await marcarProximaParadaEmAndamento(paradas);

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
      logger.error('[RouteStatus] Erro ao iniciar rota', error);
      throw error;
    }
  };

  // Completa parada
  const completeStop = async (paradaId: string, fotoUrl?: string) => {
    // Validar se a rota está em andamento
    if (!route || route.status !== 'em_andamento') {
      logger.warn(`[RouteStatus] completeStop Tentativa de concluir parada com rota em status '${route?.status}' - ignorado`);
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

      // Marcar próxima parada pendente como "em_andamento"
      // (simulamos o estado atualizado excluindo a parada recém-concluída)
      const paradasRestantes = paradas.map(p =>
        p.id === paradaId ? { ...p, status: 'concluida' } : p
      );
      await marcarProximaParadaEmAndamento(paradasRestantes);

      await loadActiveRoute();
    } catch (error) {
      logger.error('[RouteStatus] Erro ao concluir parada', error);
      throw error;
    }
  };

  // Pula parada
  const skipStop = async (paradaId: string) => {
    // Validar se a rota está em andamento
    if (!route || route.status !== 'em_andamento') {
      logger.warn(`[RouteStatus] skipStop Tentativa de pular parada com rota em status '${route?.status}' - ignorado`);
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

      // Marcar próxima parada pendente como "em_andamento"
      // (simulamos o estado atualizado excluindo a parada recém-pulada)
      const paradasRestantes = paradas.map(p =>
        p.id === paradaId ? { ...p, status: 'pulada' } : p
      );
      await marcarProximaParadaEmAndamento(paradasRestantes);

      await loadActiveRoute();
    } catch (error) {
      logger.error('[RouteStatus] Erro ao pular parada', error);
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
      logger.error('[RouteStatus] Erro ao concluir rota', error);
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
          logger.error('[RouteStatus] Realtime Erro na conexão', { status });
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
