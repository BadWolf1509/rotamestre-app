/**
 * Busca do perfil na abertura do app (`app/index.tsx`).
 *
 * POR QUE EXISTE. Com Wi-Fi sem internet, a rota em cache já aparece em
 * ~10 s, e a espera que sobrava era esta busca: ela aguardava o DNS do
 * Android desistir (4–8 s) para só então seguir pelo perfil conhecido.
 *
 * Regra: só quem tem perfil conhecido guardado (da própria conta) muda.
 * - Queda de rede já observada (`redeCaidaObservada`): nem consulta — mesmo
 *   raciocínio do #678 (`buscaComumDoPerfil` em `useUser`).
 * - Senão, a busca corre contra `PRAZO_PERFIL_ABERTURA_MS`; estourou, segue
 *   pelo perfil conhecido. A busca não é cancelada; a resposta tardia é
 *   descartada aqui, e o `useUser` do layout busca o perfil fresco de novo.
 * Sem perfil conhecido: espera como antes (não há para onde cair; o online
 * sem perfil guardado não muda).
 *
 * Alternativas comparadas: (a) prazo fixo (escolhida, com o atalho da queda
 * observada); (b) corrida só com o sinal de queda (`aoCairRede`) — na
 * abertura nenhuma consulta anterior falhou, e o sinal só dispara quando ESTA
 * busca falha, junto com a rejeição dela: não ganha nada; (c) seguir sempre
 * pelo perfil conhecido e revalidar depois — mudaria também quem está online
 * e adiaria o portão da conta desativada e da troca de senha para todos.
 * Custo de (a): numa rede lenta de verdade (> prazo), a abertura segue pelo
 * perfil guardado sem o portão da conta desativada, como já acontece offline.
 */
import type { Usuario } from '@/types/usuario';

/** Folga sobre uma consulta saudável (< 1 s) e bem abaixo dos 4–8 s do DNS. */
export const PRAZO_PERFIL_ABERTURA_MS = 3_000;

export type PerfilDaAbertura =
  | { origem: 'servidor'; usuario: Usuario | null }
  | { origem: 'conhecido'; usuario: Usuario };

interface Opcoes {
  buscar: () => Promise<Usuario | null>;
  lerConhecido: (userId: string) => Promise<Usuario | null>;
  redeCaida: () => boolean;
  prazoMs?: number;
}

export async function buscarPerfilNaAbertura(
  userId: string,
  {
    buscar,
    lerConhecido,
    redeCaida,
    prazoMs = PRAZO_PERFIL_ABERTURA_MS,
  }: Opcoes,
): Promise<PerfilDaAbertura> {
  const conhecido = await lerConhecido(userId);
  if (!conhecido) {
    return { origem: 'servidor', usuario: await buscar() };
  }
  if (redeCaida()) return { origem: 'conhecido', usuario: conhecido };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<PerfilDaAbertura>((resolve) => {
    timer = setTimeout(
      () => resolve({ origem: 'conhecido', usuario: conhecido }),
      prazoMs,
    );
  });
  const busca = buscar().then((usuario): PerfilDaAbertura => ({
    origem: 'servidor',
    usuario,
  }));
  // A busca que perdeu a corrida pode rejeitar depois: sem dono, viraria
  // "unhandled rejection".
  busca.catch(() => undefined);
  try {
    return await Promise.race([busca, prazo]);
  } finally {
    clearTimeout(timer);
  }
}
