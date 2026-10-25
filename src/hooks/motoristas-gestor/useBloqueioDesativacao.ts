/**
 * Estado do aviso "motorista com rotas abertas" (Migration 54): a desativação
 * foi recusada e a tela mostra as rotas para o gestor reatribuir ou cancelar.
 * Usado nas três portas do toggle (Motoristas, perfil e Equipe).
 */
import { useCallback, useState } from 'react';

import {
  rotasAbertasDoErro,
  type RotaAbertaDoMotorista,
} from '@/lib/motorista/rotasAbertasDoMotorista';

export interface BloqueioDesativacao {
  nomeMotorista: string;
  rotas: RotaAbertaDoMotorista[];
}

export function useBloqueioDesativacao() {
  const [bloqueio, setBloqueio] = useState<BloqueioDesativacao | null>(null);

  /** true quando o erro é a recusa por rota aberta (e o aviso foi aberto). */
  const mostrarSeBloqueado = useCallback(
    (error: unknown, nomeMotorista: string): boolean => {
      const rotas = rotasAbertasDoErro(error);
      if (!rotas) return false;
      setBloqueio({ nomeMotorista, rotas });
      return true;
    },
    [],
  );

  const fecharBloqueio = useCallback(() => setBloqueio(null), []);

  return { bloqueio, mostrarSeBloqueado, fecharBloqueio };
}
