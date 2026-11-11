/**
 * Período escolhido em cada tela, lembrado no aparelho por tela e por usuário.
 *
 * Grava o que a pessoa escolheu (o NOME do atalho, ou as datas do
 * personalizado), nunca o intervalo resolvido: "Este mês" gravado em 31/10 e
 * lido em 01/11 tem de resolver para novembro.
 *
 * Quem sai da conta apaga estas chaves: o prefixo está em `PREFIXOS_DA_CONTA`
 * (`src/lib/auth/limparEstadoLocal.ts`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { lerPeriodo, PERIODO_PADRAO, type Periodo } from '@/lib/periodo';

export type TelaPeriodo =
  | 'gestao_rotas'
  | 'inicio_gestor'
  | 'incidentes'
  | 'perfil_motorista'
  | 'desempenho_motorista'
  | 'historico_motorista';

const PREFIXO_PERIODO = '@rotamestre:periodo:';

export function chavePeriodo(tela: TelaPeriodo, usuarioId: string): string {
  return `${PREFIXO_PERIODO}${tela}:${usuarioId}`;
}

export function usePeriodoLembrado(
  tela: TelaPeriodo,
  padrao: Periodo = PERIODO_PADRAO,
): {
  periodo: Periodo;
  definirPeriodo: (p: Periodo) => void;
  carregado: boolean;
} {
  const { userData } = useUser();
  const usuarioId = userData?.id;
  const [periodo, setPeriodo] = useState<Periodo>(padrao);
  const [carregado, setCarregado] = useState(false);
  const padraoRef = useRef(padrao);
  padraoRef.current = padrao;
  // Escolha feita antes da leitura terminar vence o que estava no disco.
  const escolhidoRef = useRef(false);

  useEffect(() => {
    let ativo = true;
    escolhidoRef.current = false;
    setCarregado(false);
    setPeriodo(padraoRef.current);
    if (!usuarioId) {
      setCarregado(true);
      return;
    }
    void (async () => {
      let lido: Periodo | null = null;
      try {
        const bruto = await AsyncStorage.getItem(chavePeriodo(tela, usuarioId));
        lido = bruto ? lerPeriodo(JSON.parse(bruto)) : null;
      } catch (error) {
        // Não crítico: sem o período lembrado a tela abre no padrão.
        logger.warn('[Periodo] Falha ao ler o período lembrado', error);
      }
      if (!ativo) return;
      if (lido && !escolhidoRef.current) setPeriodo(lido);
      setCarregado(true);
    })();
    return () => {
      ativo = false;
    };
  }, [tela, usuarioId]);

  const definirPeriodo = useCallback(
    (p: Periodo) => {
      escolhidoRef.current = true;
      setPeriodo(p);
      if (!usuarioId) return;
      AsyncStorage.setItem(
        chavePeriodo(tela, usuarioId),
        JSON.stringify(p),
      ).catch((error) => {
        // Não crítico: o período vale na tela, só não é lembrado.
        logger.warn('[Periodo] Falha ao gravar o período', error);
      });
    },
    [tela, usuarioId],
  );

  return { periodo, definirPeriodo, carregado };
}
