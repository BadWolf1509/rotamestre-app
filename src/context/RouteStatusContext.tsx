import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';

export type RouteStatus = 'no-route' | 'pending' | 'active' | 'last-stop' | 'ready-to-complete' | 'completed';

interface RouteData {
  id: string;
  status: string;
  unidade_nome: string;
  distancia_total?: number;
  tempo_total?: number;
  iniciada_em?: string;
  concluida_em?: string;
}

interface ParadaData {
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
  is_checkpoint?: boolean;
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
  loading: boolean;
  refreshRoute: () => Promise<void>;
  startRoute: () => Promise<void>;
  completeStop: (paradaId: string, fotoUrl?: string) => Promise<void>;
  skipStop: (paradaId: string) => Promise<void>;
  completeRoute: () => Promise<void>;
}

const RouteStatusContext = createContext<RouteStatusContextData>({} as RouteStatusContextData);

export function RouteStatusProvider({ children }: { children: ReactNode }) {
  const { userData } = useUser();
  const motoristaId = userData?.id;
  const [route, setRoute] = useState<RouteData | null>(null);
  const [paradas, setParadas] = useState<ParadaData[]>([]);
  const [loading, setLoading] = useState(true);

  // Determina o status da rota (excluindo checkpoints da contagem)
  const getRouteStatus = (): RouteStatus => {
    if (!route) return 'no-route';

    if (route.status === 'pendente') return 'pending';

    if (route.status === 'em_andamento') {
      // Contar apenas paradas reais (excluindo checkpoints de partida/chegada)
      const pendingStops = paradas.filter(p => p.status === 'pendente' && p.is_checkpoint !== false);

      if (pendingStops.length === 0) return 'ready-to-complete';
      if (pendingStops.length === 1) return 'last-stop';
      return 'active';
    }

    if (route.status === 'concluida') return 'completed';

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

  // Carrega rota ativa
  const loadActiveRoute = useCallback(async () => {
    if (!motoristaId) {
      setRoute(null);
      setParadas([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Busca rota ativa
      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .select(`
          id,
          status,
          distancia_total,
          tempo_total,
          iniciada_em,
          concluida_em,
          unidades (nome)
        `)
        .eq('motorista_id', motoristaId)
        .in('status', ['pendente', 'em_andamento'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (rotaError || !rotaData) {
        // Busca última rota concluída para mostrar resumo
        const { data: lastRoute } = await supabase
          .from('rotas')
          .select(`
            id,
            status,
            distancia_total,
            tempo_total,
            iniciada_em,
            concluida_em,
            unidades (nome)
          `)
        .eq('motorista_id', motoristaId)
          .eq('status', 'concluida')
          .order('concluida_em', { ascending: false })
          .limit(1)
          .single();

        if (lastRoute) {
          const unidade = lastRoute.unidades as unknown as { nome: string } | null;
          setRoute({
            ...lastRoute,
            unidade_nome: unidade?.nome || '',
          } as RouteData);

          // Carrega TODAS as paradas da rota concluída (incluindo checkpoints)
          const { data: paradasData } = await supabase
            .from('paradas')
            .select('*')
            .eq('rota_id', lastRoute.id)
            .order('ordem');

          setParadas(paradasData || []);
        } else {
          setRoute(null);
          setParadas([]);
        }
      } else {
        const unidadeData = rotaData.unidades as unknown as { nome: string } | null;
        setRoute({
          ...rotaData,
          unidade_nome: unidadeData?.nome || '',
        } as RouteData);

        // Carrega TODAS as paradas (incluindo checkpoints de partida/chegada)
        const { data: paradasData } = await supabase
          .from('paradas')
          .select('*')
          .eq('rota_id', rotaData.id)
          .order('ordem');

        setParadas(paradasData || []);
      }
    } catch (error) {
      console.error('Erro ao carregar rota:', error);
      setRoute(null);
      setParadas([]);
    } finally {
      setLoading(false);
    }
  }, [motoristaId]);

  // Inicia rota
  const startRoute = async () => {
    if (!route) return;

    try {
      const { error } = await supabase
        .from('rotas')
        .update({
          status: 'em_andamento',
          iniciada_em: new Date().toISOString(),
        })
        .eq('id', route.id);

      if (error) throw error;

      await loadActiveRoute();
    } catch (error) {
      console.error('Erro ao iniciar rota:', error);
      throw error;
    }
  };

  // Completa parada
  const completeStop = async (paradaId: string, fotoUrl?: string) => {
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
      const { error } = await supabase
        .from('rotas')
        .update({
          status: 'concluida',
          concluida_em: new Date().toISOString(),
        })
        .eq('id', route.id);

      if (error) throw error;

      await loadActiveRoute();
    } catch (error) {
      console.error('Erro ao concluir rota:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadActiveRoute();
  }, [loadActiveRoute]);

  // Realtime subscription
  useEffect(() => {
    if (!motoristaId) return;

    const channel = supabase
      .channel('route-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rotas',
          filter: `motorista_id=eq.${motoristaId}`,
        },
        () => {
          loadActiveRoute();
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
          loadActiveRoute();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadActiveRoute, motoristaId]);

  return (
    <RouteStatusContext.Provider
      value={{
        routeStatus: getRouteStatus(),
        route,
        paradas,
        currentStop: getCurrentStop(),
        nextStop: getNextStop(),
        progress: getProgress(),
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
