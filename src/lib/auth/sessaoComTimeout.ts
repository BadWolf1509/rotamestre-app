/**
 * Corre a busca de sessão contra um timeout, sem o timer sobreviver à corrida.
 *
 * POR QUE EXISTE. O `app/index.tsx` fazia `Promise.race([sessao, timeout])`
 * com o `setTimeout` logando "Session check timeout - assuming not
 * authenticated" no callback. `Promise.race` não cancela o perdedor: o timer
 * disparava 10s depois **mesmo quando a sessão já tinha sido encontrada**, e o
 * aviso saía em todo boot autenticado.
 *
 * O custo não é o log em si — é que um aviso que aparece sempre para de
 * significar alguma coisa. Varrendo o app em 05/09/2026 eu vi essa linha com a
 * sessão válida na tela e abri uma investigação atrás de um bug que não
 * existia.
 *
 * O timeout continua: sem ele o app trava quando o Supabase não responde
 * (github.com/supabase/supabase/issues/35754). O que muda é que ele só se
 * anuncia quando de fato decidiu o resultado.
 */
export async function obterSessaoComTimeout<T>(
  obterSessao: () => Promise<T>,
  timeoutMs: number,
  aoExpirar: () => void,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expiracao = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      aoExpirar();
      resolve(null);
    }, timeoutMs);
  });

  try {
    return await Promise.race([obterSessao(), expiracao]);
  } finally {
    // Ganhando ou perdendo a corrida, o timer não sobrevive a ela.
    if (timer !== undefined) clearTimeout(timer);
  }
}
