/**
 * Preferências de push da conta para os interruptores das Configurações
 * (motorista e gestor). Regras de banco, cópia, pendência e migração do valor
 * antigo em `src/lib/notificacoes/preferenciasPush.ts`.
 *
 * A tela nunca espera a rede:
 * - abre com a cópia do aparelho (ou o padrão) e atualiza quando o servidor
 *   responde;
 * - o interruptor muda na hora (otimista) e a gravação corre por trás, uma
 *   de cada vez — dois toques rápidos não chegam fora de ordem ao banco;
 * - a resposta do servidor que chegar depois de um toque não desfaz o toque.
 *
 * A sincronização corre FORA da fila e grava o que leu no começo (cópia e,
 * com legado ou pendência, o servidor). Se houve toque enquanto ela corria,
 * esses valores estão velhos: ao fim, o valor ATUAL entra na fila e é
 * regravado por cima (lido na hora de gravar, não na de enfileirar).
 * Alternativa descartada: pôr a sincronização na fila. Os toques esperariam
 * por ela — até 3 idas ao servidor de 15 s cada em rede ruim — sem nem gravar
 * a cópia no aparelho, e um app fechado nessa janela perderia a escolha.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import {
  lerPreferenciasLocais,
  PREFERENCIAS_PADRAO,
  type ResultadoDaGravacao,
  salvarPreferencias,
  sincronizarPreferencias,
} from '@/lib/notificacoes/preferenciasPush';
import type { PreferenciasNotificacao } from '@/types/notifications';

export function usePreferenciasPush() {
  const { user, usuarioOfflineId = null } = useAuth();
  const uid = user?.id ?? usuarioOfflineId ?? null;

  const [preferencias, setPreferencias] =
    useState<PreferenciasNotificacao>(PREFERENCIAS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const atual = useRef<PreferenciasNotificacao>(PREFERENCIAS_PADRAO);
  const toques = useRef(0);
  const fila = useRef<Promise<unknown>>(Promise.resolve());

  const aplicar = useCallback((p: PreferenciasNotificacao) => {
    atual.current = p;
    setPreferencias(p);
  }, []);

  useEffect(() => {
    if (!uid) {
      setCarregando(false);
      return;
    }
    let vivo = true;
    const toquesNoInicio = toques.current;
    (async () => {
      const locais = await lerPreferenciasLocais(uid);
      if (!vivo) return;
      if (locais && toques.current === toquesNoInicio) aplicar(locais);
      setCarregando(false);

      const { preferencias: doServidor } = await sincronizarPreferencias(uid);
      if (toques.current === toquesNoInicio) {
        if (vivo) aplicar(doServidor);
        return;
      }
      // Houve toque durante a sincronização: regrava o valor atual por cima
      // do que ela gravou (vale mesmo com a tela já fechada).
      fila.current = fila.current.then(() =>
        salvarPreferencias(uid, atual.current),
      );
    })();
    return () => {
      vivo = false;
    };
  }, [uid, aplicar]);

  /**
   * Muda uma preferência. Resolve com `sincronizado: false` e o motivo
   * (sem rede ou recusa do servidor) quando ela ficou só no aparelho, para a
   * tela avisar (`avisoDaGravacao`).
   */
  const alterar = useCallback(
    (
      campo: keyof PreferenciasNotificacao,
      valor: boolean,
    ): Promise<ResultadoDaGravacao> => {
      toques.current += 1;
      const proxima = { ...atual.current, [campo]: valor };
      aplicar(proxima);
      if (!uid) {
        return Promise.resolve({ sincronizado: false, motivo: 'sem_rede' });
      }
      const gravacao = fila.current.then(() =>
        salvarPreferencias(uid, proxima),
      );
      fila.current = gravacao;
      return gravacao;
    },
    [uid, aplicar],
  );

  return { preferencias, carregando, alterar };
}
