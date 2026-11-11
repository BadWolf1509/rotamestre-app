/**
 * Cabeçalho do Histórico: números do PERÍODO, somados no servidor.
 *
 * Vêm de `resumo_desempenho_motorista` (`buscarResumoDesempenho` com
 * `intervalo`), sem corte em hoje, e não da lista baixada: a lista é uma
 * página de 50. O cabeçalho segue só o período, não o chip de status.
 *
 * "{n} este mês" é o mês corrente em qualquer período: com "Este mês" reusa o
 * total do resumo; nos outros, uma consulta à parte.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import { buscarResumoDesempenho } from '@/lib/motorista/resumoDesempenho';
import { resolverPeriodo } from '@/lib/periodo';

import type { Metricas } from './types';

interface Entrada {
  /** Período lembrado lido e usuário conhecido. */
  habilitado: boolean;
  motoristaId: string | undefined;
  de: string | null;
  ate: string | null;
  /** O filtro é "Este mês": o total do resumo já é o do mês. */
  ehEsteMes: boolean;
}

interface Retorno {
  metricas: Metricas | null;
  carregando: boolean;
  recarregar: () => void;
}

export function useHistoricoMetrics({
  habilitado,
  motoristaId,
  de,
  ate,
  ehEsteMes,
}: Entrada): Retorno {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  // Só a consulta mais recente escreve: trocar de período rápido deixa
  // respostas em voo, e a velha chegando por último sobrescreveria a nova.
  const requisicaoRef = useRef(0);

  useEffect(() => {
    const minha = ++requisicaoRef.current;
    const vigente = () => minha === requisicaoRef.current;
    if (!habilitado) return;
    if (!motoristaId) {
      setMetricas(null);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    const buscar = async () => {
      try {
        const [resumo, doMes] = await Promise.all([
          buscarResumoDesempenho(motoristaId, { intervalo: { de, ate } }),
          ehEsteMes
            ? Promise.resolve(null)
            : buscarResumoDesempenho(motoristaId, {
                intervalo: resolverPeriodo({ tipo: 'este_mes' }),
              }),
        ]);
        if (!vigente()) return;
        const taxaSucesso =
          resumo.totalParadas > 0
            ? Math.round((resumo.paradasConcluidas / resumo.totalParadas) * 100)
            : 0;
        setMetricas({
          rotasTotais: resumo.totalRotas,
          rotasConcluidas: resumo.rotasConcluidas,
          rotasMes: (doMes ?? resumo).totalRotas,
          paradasTotais: resumo.totalParadas,
          paradasConcluidas: resumo.paradasConcluidas,
          distanciaTotal: Math.round(resumo.distanciaTotal * 10) / 10,
          tempoMedioMinutos: Math.round(resumo.tempoMedioMinutos ?? 0),
          taxaSucesso,
        });
      } catch (error) {
        logger.error('Erro ao carregar o cabeçalho do histórico', error);
        if (vigente()) setMetricas(null);
      } finally {
        if (vigente()) setCarregando(false);
      }
    };
    // Disparo proposital, sem espera: o carregador trata o próprio erro.
    void buscar();
  }, [habilitado, motoristaId, de, ate, ehEsteMes, recarga]);

  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);

  return { metricas, carregando, recarregar };
}
