/**
 * Dona única da navegação "a conta saiu → login" (R-NUC-1, pendência 33).
 *
 * Montada uma vez, no layout raiz. Quem faz logout (menu lateral, Sidebar,
 * Perfil) só chama `authService.signOut()`; os layouts protegidos
 * (`useRequireAuth`) só respondem "não autorizado". Antes, até 4
 * `router.replace('/auth/login')` saíam no mesmo instante (o do menu, o de
 * cada layout montado e o da `index` remontada), cruzados com a saída de dois
 * `Modal` nativos (menu lateral + diálogo "Sair da conta"). No aparelho, a
 * Início do motorista que entrava depois ficava com a tela de login presa por
 * cima: a barra de abas não respondia.
 *
 * Alternativas consideradas (ver o relatório da trilha):
 * (a) esta: uma dona, que navega uma vez por saída e depois de os modais terem
 *     tempo de fechar;
 * (b) manter os `replace` onde estavam, só adiando o do logout — não tira os
 *     `replace` concorrentes dos layouts;
 * (c) `router.dismissAll()` antes do `replace` — sem evidência de que resolve,
 *     e mexe na pilha que a troca de geração (`useGeracaoDaConta`) já remonta.
 *
 * Só age nas áreas protegidas: `index` decide sozinha na abertura do app, e
 * `auth`/`onboarding`/páginas públicas não exigem sessão.
 */
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '../useAuth';

/**
 * Espera para a navegação sair com os modais já fechados. A animação de saída
 * do `Modal` do Android (~300 ms) é nativa e não avisa o JS quando termina
 * (`onDismiss` é só do iOS). O `InteractionManager` não serve: foi removido
 * no RN 0.88 (SDK 58), e acessá-lo lança `Invariant Violation`.
 */
export const PRAZO_FECHAR_MODAIS_MS = 400;

/** Áreas que exigem sessão (as que montam `useRequireAuth`). */
const AREAS_PROTEGIDAS = new Set(['gestor', 'motorista', 'perfil', 'unidade']);

export function useNavegacaoDeSaida(): void {
  const router = useRouter();
  const segments = useSegments() as string[];
  const { user, loading, usuarioOfflineId = null } = useAuth();

  const semSessao = !loading && !user && !usuarioOfflineId;
  const naAreaProtegida = AREAS_PROTEGIDAS.has(segments[0] ?? '');
  const deveIrAoLogin = semSessao && naAreaProtegida;

  // O router muda de identidade entre renders em algumas versões: lido por
  // ref, para não reabrir o efeito (e repetir o replace) por causa dele.
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    // Um replace por episódio: o efeito só reabre quando `deveIrAoLogin`
    // muda — re-render ou troca de segmento dentro da área protegida não.
    if (!deveIrAoLogin) return;

    const timer = setTimeout(() => {
      routerRef.current.replace('/auth/login');
    }, PRAZO_FECHAR_MODAIS_MS);

    // A sessão voltou antes do prazo (refresh), já se está no login, ou o
    // layout desmontou: nada a fazer.
    return () => clearTimeout(timer);
  }, [deveIrAoLogin]);
}
