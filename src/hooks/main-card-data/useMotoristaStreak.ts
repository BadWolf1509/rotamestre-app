/**
 * useMotoristaStreak
 *
 * Hook for calculating consecutive days with completed routes
 */

import { useCallback, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

interface UseMotoristaStreakReturn {
  streak: number;
  loadStreak: () => Promise<void>;
}

/** Tamanho de cada janela de consulta, em dias. */
const DIAS_POR_JANELA = 30;
/** Teto de segurança de janelas (≈ 2 anos); a sequência real para antes. */
const MAX_JANELAS = 24;

/**
 * Hook that calculates the motorista's streak (consecutive days with at least 1 completed route)
 */
export function useMotoristaStreak(
  motoristaId?: string,
): UseMotoristaStreakReturn {
  const [streak, setStreak] = useState(0);
  // Só a carga mais recente escreve (refresh/troca de motorista em voo).
  const requisicaoRef = useRef(0);

  /**
   * Load streak - consecutive days with at least 1 completed route.
   *
   * Sem teto de 30 dias: busca em janelas de 30 dias e só pede a seguinte
   * quando a sequência atravessou a janela inteira. Quem tem sequência curta
   * (o caso comum) continua com UMA consulta; a alternativa de buscar todo o
   * histórico de uma vez custaria centenas de linhas por Início.
   */
  const loadStreak = useCallback(async () => {
    const minha = ++requisicaoRef.current;
    if (!motoristaId) return;

    try {
      const checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);

      const routeDates = new Set<string>();
      let currentStreak = 0;
      let fimJanela: Date | null = null; // null = sem limite superior (até agora)
      const inicioJanela = new Date(checkDate);
      inicioJanela.setDate(inicioJanela.getDate() - DIAS_POR_JANELA);

      for (let janela = 0; janela < MAX_JANELAS; janela++) {
        let consulta = supabase
          .from('rotas')
          .select('concluida_em')
          .eq('motorista_id', motoristaId)
          .eq('status', 'concluida')
          .gte('concluida_em', inicioJanela.toISOString());
        if (fimJanela)
          consulta = consulta.lt('concluida_em', fimJanela.toISOString());
        const { data: rotas, error } = await consulta.order('concluida_em', {
          ascending: false,
        });

        if (error) throw error;
        for (const r of rotas ?? []) {
          routeDates.add(new Date(r.concluida_em).toDateString());
        }

        // Consecutive days with at least 1 route, dentro desta janela.
        while (
          checkDate.getTime() >= inicioJanela.getTime() &&
          routeDates.has(checkDate.toDateString())
        ) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }

        // Quebrou dentro da janela: acabou. Atravessou a janela toda: segue.
        if (checkDate.getTime() >= inicioJanela.getTime()) break;
        fimJanela = new Date(inicioJanela);
        inicioJanela.setDate(inicioJanela.getDate() - DIAS_POR_JANELA);
      }

      if (minha !== requisicaoRef.current) return;
      setStreak(currentStreak);
    } catch (error) {
      logger.error('Error loading streak:', error);
    }
  }, [motoristaId]);

  return {
    streak,
    loadStreak,
  };
}
