import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { Rota, Checkpoint } from '@/types/rota';

export interface RotaComUnidade extends Rota {
    unidades: {
        nome: string;
    };
}

export interface UseResumoRotaResult {
    rota: RotaComUnidade | null;
    paradas: Checkpoint[];
    loading: boolean;
    error: string | null;
    recargar: () => Promise<void>;
}

function normalizeStatus(status?: string): Checkpoint['status'] {
    if (status === 'concluido') return 'concluida';
    if (status === 'pulado') return 'pulada';
    return status as Checkpoint['status'];
}

export function useResumoRota(rotaIdParam?: string): UseResumoRotaResult {
    const { userData } = useUser();
    const [rota, setRota] = useState<RotaComUnidade | null>(null);
    const [paradas, setParadas] = useState<Checkpoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadRota = useCallback(async () => {
        if (!userData?.id) {
            setLoading(false);
            return;
        }

        const errorMessage = 'Não foi possível carregar o resumo da rota';

        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('rotas')
                .select('*, unidades(nome)')
                .eq('motorista_id', userData.id);

            if (rotaIdParam) {
                query = query.eq('id', rotaIdParam);
            } else {
                query = query
                    .eq('status', 'concluida')
                    .order('concluida_em', { ascending: false })
                    .limit(1);
            }

            const { data: rotasData, error: rotasError } = await query.maybeSingle();

            if (rotasError) throw rotasError;

            if (!rotasData) {
                setRota(null);
                setParadas([]);
                return;
            }

            const rotaEncontrada = rotasData as unknown as RotaComUnidade;
            setRota(rotaEncontrada);

            // Carregar paradas
            const { data: paradasData, error: paradasError } = await supabase
                .from('paradas') // Note: In types it is 'checkpoints', but table seems to be 'paradas' based on original code. Keeping 'paradas' as per original file.
                .select('*')
                .eq('rota_id', rotaEncontrada.id)
                .order('ordem');

            if (paradasError) throw paradasError;

            const paradasNormalizadas = (paradasData as Checkpoint[] | null)?.map((parada) => ({
                ...parada,
                status: normalizeStatus(parada.status as string | undefined),
            })) || [];

            setParadas(paradasNormalizadas);

        } catch (error) {
            logger.error('Erro ao carregar resumo:', error);
            setError(errorMessage);
            setRota(null);
            setParadas([]);
            Alert.alert('Erro', errorMessage);
        } finally {
            setLoading(false);
        }
    }, [userData?.id, rotaIdParam]);

    useEffect(() => {
        loadRota();
    }, [loadRota]);

    return {
        rota,
        paradas,
        loading,
        error,
        recargar: loadRota,
    };
}
