/**
 * Nome único por inscrição de canal Realtime.
 *
 * POR QUE EXISTE. `supabase.removeChannel` é assíncrono. Uma remontagem rápida
 * — navegar e voltar, que no app do motorista é o normal, ele circula entre
 * Início, Mapa e Checkpoints — reusa um nome de canal cuja remoção ainda não
 * completou. O SDK 56 então lança
 * `cannot add postgres_changes callbacks after subscribe()`, e a inscrição
 * simplesmente não acontece: a tela para de receber atualização ao vivo **sem
 * erro visível para o usuário**, que é o pior formato possível para essa falha.
 *
 * O defeito já tinha sido diagnosticado neste repo, em `useRealtimeRoutes`, que
 * carregava um contador próprio. Os outros cinco call sites tinham a mesma
 * forma e nenhuma proteção. Este módulo existe para que a proteção seja uma só:
 * cinco cópias de um contador seriam cinco lugares para alguém esquecer.
 *
 * O contador é do processo, não do prefixo, e o prefixo continua no nome — o
 * sufixo serve ao SDK, o prefixo serve a quem lê o log.
 */

let contadorDeCanais = 0;

export function nomeDeCanalUnico(prefixo: string): string {
  contadorDeCanais += 1;
  return `${prefixo}#${contadorDeCanais}`;
}
