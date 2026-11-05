import { useCallback, useState } from 'react';

import { logger } from '@/lib/logger';

interface ComId {
  id: string;
}

interface Opcoes<T extends ComId> {
  /** Ordem que o estado tem agora (a lista nativa guarda a arrastada). */
  ordemAtual: readonly T[];
  /**
   * Aplica a ordem nova. Devolver `false` (ou lançar) significa que o estado
   * NÃO mudou: a lista nativa é remontada para voltar à ordem do estado.
   */
  aplicar: (nova: T[]) => boolean | void | Promise<boolean | void>;
}

/**
 * Guarda única das listas de arrasto (`react-native-draggable-flatlist`):
 * (i) soltar sem mudar a ordem não faz nada; (ii) recusa ou falha ao aplicar
 * sobe o `resetToken` — use-o em `key` da lista, senão a tela mostra a ordem
 * arrastada que o estado não tem; (iii) a rejeição é tratada aqui.
 */
export function useSoltarNaLista<T extends ComId>({
  ordemAtual,
  aplicar,
}: Opcoes<T>) {
  const [resetToken, setResetToken] = useState(0);

  const onDragEnd = useCallback(
    async (nova: T[]): Promise<void> => {
      const mesmaOrdem =
        nova.length === ordemAtual.length &&
        nova.every((item, i) => item.id === ordemAtual[i]?.id);
      if (mesmaOrdem) return;

      try {
        const resultado = await aplicar(nova);
        if (resultado === false) setResetToken((t) => t + 1);
      } catch (error) {
        logger.error('[useSoltarNaLista] Falha ao aplicar a nova ordem', error);
        setResetToken((t) => t + 1);
      }
    },
    [aplicar, ordemAtual],
  );

  return { onDragEnd, resetToken };
}
