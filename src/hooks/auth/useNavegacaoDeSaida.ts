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
 * (c) `router.dismissAll()` antes do `replace` — medido no expo-router 58
 *     (N-1, 07/11): age na pilha aninhada mais funda e, com telas empilhadas
 *     no gestor e na raiz, deixa as da raiz montadas sob o login.
 *
 * Como leva ao login (N-1): esvazia a pilha raiz e troca a tela que sobrou
 * pelo login (`irAoLoginComPilhaLimpa`). Até 07/11 a `key` da pilha raiz
 * (`useGeracaoDaConta`) mudava na saída e remontava a pilha ANTES deste
 * replace: os logs [P33] do dev client mostraram a remontagem caindo na área
 * antiga sem sessão (`gestor/ajuda`, abas do motorista), não na `index`. A
 * `key` agora só muda na troca direta de conta (A→B).
 *
 * Onde age: nas áreas protegidas e na `index` depois de uma sessão (a `index`
 * pode estar na tela quando a sessão sai; ela consulta `haSaidaEmCurso()` e
 * deixa a navegação com a dona). Na abertura do app (nunca houve sessão) a
 * `index` decide sozinha; `auth`/`onboarding`/páginas públicas não exigem
 * sessão.
 */
import { useNavigationContainerRef, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '../useAuth';

type ContainerDeNavegacao = ReturnType<typeof useNavigationContainerRef>;
type Router = ReturnType<typeof useRouter>;

/**
 * Leva ao login com a pilha raiz limpa (N-1): nada do que a conta abriu fica
 * montado embaixo. `router.replace` só troca a tela do topo da pilha raiz —
 * medido no expo-router 58 (`navegacao-de-saida-pilha-real.test.tsx`): o
 * gestor seguia montado sob o login.
 *
 * Primeiro volta a pilha raiz à primeira tela (POP_TO_TOP endereçado à pilha
 * raiz pela chave: `router.dismissAll()` age na pilha aninhada mais funda que
 * tenha o que tirar e, com telas empilhadas no gestor E na raiz, deixava as da
 * raiz), depois troca essa tela pelo login. Com uma tela só, basta o replace.
 */
function irAoLoginComPilhaLimpa(
  container: ContainerDeNavegacao,
  router: Router,
): void {
  // O container do expo-router tem uma rota interna (o layout raiz); a pilha
  // de `app/_layout.tsx` é o estado aninhado dela.
  const raiz = container.isReady() ? container.getRootState() : undefined;
  const pilhaRaiz = raiz?.routes[raiz.index]?.state;
  if (pilhaRaiz?.key && (pilhaRaiz.index ?? 0) > 0) {
    container.dispatch({ type: 'POP_TO_TOP', target: pilhaRaiz.key });
  }
  router.replace('/auth/login');
}

/**
 * Com o login já no topo — aberto por quem navega sozinho de propósito (a
 * exclusão de conta, a conta desativada da `index`) —, tira tudo o que ficou
 * embaixo dele, sem tocar no próprio login (Rodada 1 da revisão da N-1).
 *
 * Um RESET da pilha raiz só com a tela do topo, endereçado pela chave. O
 * estado vem completo do container (`stale: false`), como o fork de navegação
 * do expo-router 58 exige no RESET; a rota do topo mantém a chave, então o
 * login não remonta e os parâmetros (`?conta=desativada`) ficam. Alternativa
 * descartada: POP_TO_TOP + `replace` com a URL atual — remontaria o login e
 * teria de remontar a URL com os parâmetros.
 */
function limparDebaixoDoLogin(container: ContainerDeNavegacao): void {
  const raiz = container.isReady() ? container.getRootState() : undefined;
  const pilhaRaiz = raiz?.routes[raiz.index]?.state;
  if (!pilhaRaiz?.key || pilhaRaiz.stale !== false || pilhaRaiz.index === 0) {
    return;
  }
  const topo = pilhaRaiz.routes[pilhaRaiz.index];
  container.dispatch({
    type: 'RESET',
    payload: { ...pilhaRaiz, index: 0, routes: [topo] },
    target: pilhaRaiz.key,
  });
}

/**
 * Espera para a navegação sair com os modais já fechados. A animação de saída
 * do `Modal` do Android (~300 ms) é nativa e não avisa o JS quando termina
 * (`onDismiss` é só do iOS). O `InteractionManager` não serve: foi removido
 * no RN 0.88 (SDK 58), e acessá-lo lança `Invariant Violation`.
 */
export const PRAZO_FECHAR_MODAIS_MS = 400;

/** Áreas que exigem sessão (as que montam `useRequireAuth`). */
const AREAS_PROTEGIDAS = new Set(['gestor', 'motorista', 'perfil', 'unidade']);

// Uma dona só (montada no layout raiz): o estado do episódio pode morar no
// módulo, onde a `index` o lê sem contexto.
let saidaEmCurso = false;

/** Há uma saída de conta esperando para levar ao login (a dona navega). */
export function haSaidaEmCurso(): boolean {
  return saidaEmCurso;
}

export function useNavegacaoDeSaida(): void {
  const router = useRouter();
  // Ref estável do container (objeto do módulo do expo-router).
  const container = useNavigationContainerRef();
  const segments = useSegments() as string[];
  const { user, loading, usuarioOfflineId = null } = useAuth();

  const semSessao = !loading && !user && !usuarioOfflineId;

  // Já houve sessão neste app: a `index` sem sessão aparece depois de uma
  // saída (ela estava na tela), não é a abertura.
  const teveSessaoRef = useRef(false);
  if (user || usuarioOfflineId) teveSessaoRef.current = true;

  const raiz = segments[0];
  const ondeADonaAge =
    AREAS_PROTEGIDAS.has(raiz ?? '') ||
    (segments.length === 0 && teveSessaoRef.current);
  const deveIrAoLogin = semSessao && ondeADonaAge;
  const naTelaDeLogin = raiz === 'auth';

  // Episódio de saída: a sessão acabou NESTE app (houve sessão e saiu) e a
  // pilha ainda não foi limpa. É o critério para limpar embaixo de um login
  // aberto por outra parte: login aberto sem a sessão ter acabado aqui (um
  // botão "Entrar" de página pública) não é saída, e a dona não mexe.
  const episodioRef = useRef<'nenhum' | 'pendente' | 'limpo'>('nenhum');

  // Lidos por ref: o router muda de identidade entre renders em algumas
  // versões, e os segmentos mudam durante a espera.
  const routerRef = useRef(router);
  routerRef.current = router;
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelar = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    saidaEmCurso = false;
  };

  useEffect(() => {
    // A sessão voltou antes do prazo (refresh): nada a fazer. Mudança de
    // segmento NÃO cancela — a pilha pode passar pela `index` na espera.
    if (!semSessao) {
      cancelar();
      episodioRef.current = 'nenhum';
      return;
    }
    if (teveSessaoRef.current && episodioRef.current === 'nenhum') {
      episodioRef.current = 'pendente';
    }
    // O login já está no topo, aberto por quem navega sozinho na saída (a
    // exclusão de conta, a conta desativada): falta limpar embaixo dele.
    const deveLimpar = naTelaDeLogin && episodioRef.current === 'pendente';
    // Uma ação por episódio.
    if ((!deveIrAoLogin && !deveLimpar) || timerRef.current) return;
    saidaEmCurso = true;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      saidaEmCurso = false;
      const comSaidaPendente = episodioRef.current === 'pendente';
      episodioRef.current = 'limpo';
      // Outra parte (a exceção que navega sozinha, ou o login aberto por um
      // botão) já levou ao login: sem replace; só limpa embaixo se a sessão
      // acabou neste app.
      if (segmentsRef.current[0] === 'auth') {
        if (comSaidaPendente) limparDebaixoDoLogin(container);
        return;
      }
      irAoLoginComPilhaLimpa(container, routerRef.current);
    }, PRAZO_FECHAR_MODAIS_MS);
  }, [semSessao, deveIrAoLogin, naTelaDeLogin, container]);

  useEffect(() => cancelar, []);
}
