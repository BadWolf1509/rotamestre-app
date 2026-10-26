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
 *   pelo perfil conhecido. A busca não é cancelada: volta em `tardia`, e
 *   `app/index.tsx` roda nela o portão da conta desativada quando chegar.
 * Sem perfil conhecido: espera como antes (não há para onde cair; o online
 * sem perfil guardado não muda).
 *
 * Alternativas comparadas: (a) prazo fixo (escolhida, com o atalho da queda
 * observada); (b) corrida só com o sinal de queda (`aoCairRede`) — na
 * abertura nenhuma consulta anterior falhou, e o sinal só dispara quando ESTA
 * busca falha, junto com a rejeição dela: não ganha nada; (c) seguir sempre
 * pelo perfil conhecido e revalidar depois — mudaria também quem está online
 * e adiaria o portão da conta desativada e da troca de senha para todos.
 * Custo de (a): numa rede lenta de verdade (> prazo), a abertura entra pelo
 * perfil guardado e o portão da conta desativada roda depois, na resposta
 * tardia. Com a queda observada (nada em voo), fica como no ramo offline.
 */
import type { Usuario } from '@/types/usuario';

/** Folga sobre uma consulta saudável (< 1 s) e bem abaixo dos 4–8 s do DNS. */
export const PRAZO_PERFIL_ABERTURA_MS = 3_000;

export type PerfilDaAbertura =
  | { origem: 'servidor'; usuario: Usuario | null }
  | {
      origem: 'conhecido';
      usuario: Usuario;
      /**
       * A busca que estourou o prazo e segue em voo (ausente quando nem saiu,
       * com a queda observada): quem chama roda nela o portão da conta
       * desativada, sem consulta extra de perfil.
       */
      tardia?: Promise<Usuario | null>;
    };

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

  const resposta = buscar();
  // A busca que perdeu a corrida pode rejeitar depois: sem dono, viraria
  // "unhandled rejection". Quem usa `tardia` trata a falha dela.
  resposta.catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<PerfilDaAbertura>((resolve) => {
    timer = setTimeout(
      () =>
        resolve({ origem: 'conhecido', usuario: conhecido, tardia: resposta }),
      prazoMs,
    );
  });
  const busca = resposta.then((usuario): PerfilDaAbertura => ({
    origem: 'servidor',
    usuario,
  }));
  busca.catch(() => undefined);
  try {
    return await Promise.race([busca, prazo]);
  } finally {
    clearTimeout(timer);
  }
}
