/**
 * Marca, em memória, que a abertura (`app/index.tsx`) seguiu pelo perfil
 * guardado, e com qual perfil.
 *
 * POR QUE EXISTE. Wi-Fi sem internet com o token válido (moto g15, 1.14.10):
 * o index estoura o prazo de `buscarPerfilNaAbertura` e entra pelo perfil
 * conhecido, mas a busca dele foi só ABANDONADA — não falhou —, então a queda
 * de rede ainda não foi observada (`redeObservada.ts`). O `useUser` do layout
 * fazia a sua busca e esperava o mesmo DNS desistir: a rota levava ≈ 11 s.
 * Com esta marca, a 1ª carga do `useUser` usa o perfil na hora e revalida
 * pela rede em segundo plano.
 *
 * Alternativas comparadas: (a) o index registrar a queda de rede ao estourar
 * o prazo — mas prazo não é queda: `redeObservada` exclui timeout de
 * propósito, e uma rede lenta poria o app inteiro (rota, fila) em modo
 * offline por 20 s; (b) prazo curto também no `useUser` — mais 3 s de espera
 * (≈ 6–7 s, longe dos 4 s) e o prazo valeria para toda carga, inclusive
 * online; (c) esta marca — só o caminho que já entrou pelo perfil guardado
 * muda, e nenhuma espera nova é criada.
 *
 * Só em memória (morre com o processo) e com o dono conferido: o perfil de
 * uma conta nunca responde por outra. Encerrada quando chega resposta fresca
 * da conta ou no logout (`useUser`).
 */
import type { Usuario } from '../../types/usuario';

let perfilDaAbertura: Usuario | null = null;

export function marcarAberturaPeloPerfilConhecido(perfil: Usuario): void {
  perfilDaAbertura = perfil;
}

/** Perfil com que a abertura seguiu, se for de `userId`; senão null. */
export function perfilDaAberturaPara(userId: string): Usuario | null {
  return perfilDaAbertura?.id === userId ? perfilDaAbertura : null;
}

/**
 * Encerra a marca: de `userId` (resposta fresca dele chegou) ou, sem conta,
 * qualquer uma (logout).
 */
export function encerrarAberturaPeloPerfilConhecido(userId?: string): void {
  if (userId === undefined || perfilDaAbertura?.id === userId) {
    perfilDaAbertura = null;
  }
}

/** Só para testes. */
export function _reiniciarAberturaPeloPerfilConhecido(): void {
  perfilDaAbertura = null;
}
