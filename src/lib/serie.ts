/**
 * Fila em série das filas do aparelho (OFF-3).
 *
 * POR QUE EXISTE. Cada fila (ações de parada, posições, índice de fotos, rota
 * guardada) é um item só no AsyncStorage, lido e regravado inteiro. Sem a
 * série, dois passos de ler-modificar-gravar liam o mesmo valor, e quem
 * gravava por último apagava o que o outro tinha acabado de gravar. Aqui cada
 * passo começa só depois do anterior terminar (bem ou mal), na ordem das
 * chamadas. Alternativa descartada: trava (mutex) com fila de espera — mais
 * código para o mesmo efeito.
 *
 * Cada `criarSerie()` é uma série independente: uma fila não espera a outra
 * (a foto não pode ficar atrás da fila de posições). Retry, dono e política
 * de erro continuam em cada fila; aqui só se garante a ordem.
 *
 * `imediato`: com a série livre, o passo começa na hora, sem passar por
 * `.then`, e a série se libera quando o último passo termina. É o caso do
 * índice de fotos: guardar a foto sem rede tem de terminar "na hora", sem
 * timer (`offline-foto-sem-esperar-refresh.test.ts`, que conta microtarefas;
 * o `.then` a mais estourava aquela medida). Por isso a função devolvida não
 * é `async` e devolve a promessa do passo direto.
 */
export function criarSerie(
  opcoes: { imediato?: boolean } = {},
): <T>(fn: () => Promise<T>) => Promise<T> {
  const imediato = opcoes.imediato === true;
  // Livre = null (só no `imediato`); no padrão a cadeia sempre existe.
  let cadeia: Promise<unknown> | null = imediato ? null : Promise.resolve();

  return <T>(fn: () => Promise<T>): Promise<T> => {
    const anterior = cadeia;
    const proxima = anterior ? anterior.then(fn, fn) : fn();
    const fim = proxima.catch(() => undefined);
    cadeia = fim;
    if (imediato) {
      void fim.then(() => {
        if (cadeia === fim) cadeia = null;
      });
    }
    return proxima;
  };
}
