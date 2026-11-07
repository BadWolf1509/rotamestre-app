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
 * Onde age: nas áreas protegidas e na `index` depois de uma sessão. A troca de
 * geração (`useGeracaoDaConta`) remonta a pilha raiz na rota `index`, e a
 * `index` navegaria ao login sozinha, sem esperar os modais; por isso ela
 * consulta `haSaidaEmCurso()` e deixa a navegação com a dona. Na abertura do
 * app (nunca houve sessão) a `index` decide sozinha; `auth`/`onboarding`/
 * páginas públicas não exigem sessão.
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

// Uma dona só (montada no layout raiz): o estado do episódio pode morar no
// módulo, onde a `index` o lê sem contexto.
let saidaEmCurso = false;

/** Há uma saída de conta esperando para levar ao login (a dona navega). */
export function haSaidaEmCurso(): boolean {
  return saidaEmCurso;
}

export function useNavegacaoDeSaida(): void {
  const router = useRouter();
  const segments = useSegments() as string[];
  const { user, loading, usuarioOfflineId = null } = useAuth();

  const semSessao = !loading && !user && !usuarioOfflineId;

  // Já houve sessão neste app: a `index` sem sessão é a pilha remontada
  // depois de uma saída, não a abertura.
  const teveSessaoRef = useRef(false);
  if (user || usuarioOfflineId) teveSessaoRef.current = true;

  const raiz = segments[0];
  const ondeADonaAge =
    AREAS_PROTEGIDAS.has(raiz ?? '') ||
    (segments.length === 0 && teveSessaoRef.current);
  const deveIrAoLogin = semSessao && ondeADonaAge;

  // Lidos por ref: o router muda de identidade entre renders em algumas
  // versões, e os segmentos mudam durante a espera (a pilha remonta).
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
    // segmento NÃO cancela — a remontagem da pilha passa pela `index`.
    if (!semSessao) {
      cancelar();
      return;
    }
    // Um replace por episódio.
    if (!deveIrAoLogin || timerRef.current) return;
    saidaEmCurso = true;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      saidaEmCurso = false;
      // Outra parte (a tela de login aberta por um botão) já levou ao login.
      if (segmentsRef.current[0] === 'auth') return;
      routerRef.current.replace('/auth/login');
    }, PRAZO_FECHAR_MODAIS_MS);
  }, [semSessao, deveIrAoLogin]);

  useEffect(() => cancelar, []);
}
