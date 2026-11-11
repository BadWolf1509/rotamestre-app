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

/** Dono do valor quando não há usuário (definitivamente ausente). */
const SEM_USUARIO = 'sem-usuario';

export function usePeriodoLembrado(
  tela: TelaPeriodo,
  padrao: Periodo = PERIODO_PADRAO,
): {
  periodo: Periodo;
  definirPeriodo: (p: Periodo) => void;
  carregado: boolean;
} {
  const { userData, loading: carregandoUsuario } = useUser();
  const usuarioId = userData?.id;
  // Enquanto o perfil carrega não se sabe de quem é o período: não está pronto.
  const aguardandoUsuario = !usuarioId && carregandoUsuario;
  const chaveAtual = usuarioId ? chavePeriodo(tela, usuarioId) : SEM_USUARIO;
  // O valor guarda a chave de quem ele é. Derivar `carregado` e `periodo`
  // dessa chave (e não de flags mexidas no efeito) impede um render com o
  // período da tela ou do usuário anterior logo após a troca.
  const [estado, setEstado] = useState<{ chave: string; periodo: Periodo }>();
  const padraoRef = useRef(padrao);
  padraoRef.current = padrao;
  // Escolha feita antes da leitura terminar vence o que estava no disco.
  const escolhidoRef = useRef(false);

  useEffect(() => {
    if (aguardandoUsuario) return;
    let ativo = true;
    escolhidoRef.current = false;
    if (!usuarioId) {
      setEstado({ chave: SEM_USUARIO, periodo: padraoRef.current });
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
      if (!ativo || escolhidoRef.current) return;
      setEstado({
        chave: chavePeriodo(tela, usuarioId),
        periodo: lido ?? padraoRef.current,
      });
    })();
    return () => {
      ativo = false;
    };
  }, [tela, usuarioId, aguardandoUsuario]);

  const definirPeriodo = useCallback(
    (p: Periodo) => {
      if (aguardandoUsuario) return;
      escolhidoRef.current = true;
      setEstado({ chave: chaveAtual, periodo: p });
      if (!usuarioId) return;
      AsyncStorage.setItem(chaveAtual, JSON.stringify(p)).catch((error) => {
        // Não crítico: o período vale na tela, só não é lembrado.
        logger.warn('[Periodo] Falha ao gravar o período', error);
      });
    },
    [aguardandoUsuario, chaveAtual, usuarioId],
  );

  const vale = !aguardandoUsuario && estado?.chave === chaveAtual;
  return {
    periodo: vale && estado ? estado.periodo : padrao,
    definirPeriodo,
    carregado: vale,
  };
}
