# Prontidão de loja e ciclo de vida do rastreamento — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar o watcher de GPS que sobrevive ao próprio cleanup, dar saída para as Configurações a todo pedido de permissão negado, e fazer o primeiro build iOS nascer capaz de abrir a câmera.

**Architecture:** Duas unidades novas assumem responsabilidades hoje espalhadas por dez call sites — `useLocationWatcher` possui o ciclo de vida do `watchPositionAsync` (e passa a ser o único lugar do repo autorizado a chamá-lo), `permissoes.ts` preserva o `canAskAgain` que hoje se descarta e abre as Configurações. Os call sites viram chamadas; duas guardas estáticas impedem que o próximo nasça fora do lugar certo. Em paralelo, `destination`/`onExit` em `NavigationMode.tsx` são memoizados, quebrando a cadeia de 1 Hz que transforma a corrida do watcher num sorteio por segundo.

**Tech Stack:** React Native + Expo (`expo-location` ~56.0.24, `expo-image-picker` ~56.0.24), TypeScript, Jest + `@testing-library/react-native`.

**Spec:** [`docs/superpowers/specs/2026-09-06-prontidao-loja-e-ciclo-de-vida-design.md`](../specs/2026-09-06-prontidao-loja-e-ciclo-de-vida-design.md)

## Global Constraints

- **Idioma:** todo texto visível ao usuário em **pt-BR**. Comentários e nomes novos em pt-BR, seguindo o repo (`conclusaoEmVoo.ts`, `rascunhoIncidente.ts`).
- **Logging:** `logger.warn(mensagem, erro)` — **no máximo 2 argumentos**. Catch não-crítico fica silencioso com um comentário explicando.
- **Sem `as any`** em código de produção.
- **`onLocation` e `options` nunca entram nas dependências de efeito como objeto.** Callback vai para uma ref; opções entram campo a campo (primitivas). Violar isso reintroduz o defeito 2 dentro da própria correção.
- **`s.remove()` no ramo cancelado é obrigatório.** A flag `cancelado` sozinha não resolve — a assinatura nasce órfã do mesmo jeito.
- **Toda mudança de comportamento vem com teste que já falhou** por esse motivo. Para a Task 1 o RED é verificado explicitamente (instruções no passo).
- **Comandos:** `npx jest <caminho>` para um arquivo, `npm test` para tudo, `npm run type-check`, `npm run lint`.
- **Nunca editar** `.env*`, `*.keystore`, `eas.json`, `google-services.json`, `play-store-credentials.json` (hook bloqueia).

## Estrutura de arquivos

**Criados**

| arquivo                                             | responsabilidade                                               |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `src/hooks/useLocationWatcher.ts`                   | ciclo de vida de um `watchPositionAsync`, e nada mais          |
| `src/hooks/__tests__/useLocationWatcher.test.ts`    | a corrida: desmontar durante o `await`                         |
| `src/lib/permissoes.ts`                             | pedir permissão preservando `canAskAgain`; abrir Configurações |
| `src/lib/__tests__/permissoes.test.ts`              | as duas mensagens, a ramificação de plataforma                 |
| `src/lib/motorista/copyDePermissao.ts`              | os três textos de permissão, num lugar só                      |
| `src/lib/__tests__/fonte-unica-localizacao.test.ts` | as duas guardas de monopólio                                   |

**Modificados**

| arquivo                                             | o quê                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `src/components/motorista/NavigationMode.tsx`       | watcher → hook; permissão bloqueada; memoizar `destination`/`onExit` |
| `src/components/motorista/NavigationMode.web.tsx`   | watcher → hook; permissão bloqueada                                  |
| `src/components/motorista/TurnByTurnNavigation.tsx` | watcher → hook; permissão bloqueada                                  |
| `src/hooks/useDriverLocationBroadcast.ts`           | watcher nativo → hook; permissão ambiente                            |
| `app/motorista/_screens/inicio.tsx`                 | watcher → hook; permissão ambiente com `<Alert>`                     |
| `src/components/CameraUpload.tsx`                   | permissão bloqueada ×2; marcador na galeria                          |
| `src/components/IncidentReportWizard.tsx`           | permissão bloqueada ×2; rascunho na galeria                          |
| `src/lib/motorista/rascunhoIncidente.ts`            | `cameraAberta` → `seletorAberto`                                     |
| `app.config.js`                                     | `expo-image-picker` nos `plugins`                                    |

---

## Task 1: `useLocationWatcher`

**Files:**

- Create: `src/hooks/useLocationWatcher.ts`
- Test: `src/hooks/__tests__/useLocationWatcher.test.ts`

**Interfaces:**

- Consumes: nada (primeira task).
- Produces:
  ```ts
  export interface OpcoesDoWatcher {
    accuracy: Location.LocationAccuracy;
    timeInterval: number;
    distanceInterval: number;
  }
  export interface ParametrosDoWatcher {
    enabled: boolean;
    options: OpcoesDoWatcher;
    onLocation: (location: Location.LocationObject) => void;
  }
  export function useLocationWatcher(params: ParametrosDoWatcher): void;
  ```

**Contexto para quem implementa.** Cinco arquivos do repo fazem hoje o mesmo erro: criam a assinatura dentro de uma função `async` e guardam numa variável do escopo do efeito. O cleanup lê essa variável **antes** de ela ser atribuída — a atribuição está depois de um `await` — e a assinatura criada em seguida nunca é removida. Um watcher `Location.Accuracy.BestForNavigation` órfão consome GPS até o processo morrer.

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/hooks/__tests__/useLocationWatcher.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react-native';
import * as Location from 'expo-location';

import {
  useLocationWatcher,
  type OpcoesDoWatcher,
} from '../useLocationWatcher';

jest.mock('expo-location', () => ({
  watchPositionAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6, Balanced: 3, High: 4 },
}));

const OPCOES: OpcoesDoWatcher = {
  accuracy: 6 as Location.LocationAccuracy,
  timeInterval: 1000,
  distanceInterval: 5,
};

describe('useLocationWatcher', () => {
  beforeEach(() => jest.clearAllMocks());

  it('remove a assinatura que nasce DEPOIS do unmount', async () => {
    const remove = jest.fn();
    let resolver!: (s: { remove: jest.Mock }) => void;
    (Location.watchPositionAsync as jest.Mock).mockReturnValue(
      new Promise((res) => {
        resolver = res;
      }),
    );

    const { unmount } = renderHook(() =>
      useLocationWatcher({
        enabled: true,
        options: OPCOES,
        onLocation: jest.fn(),
      }),
    );

    // Desmonta ANTES de a promessa do watcher resolver. É esta ordem que
    // reproduz o defeito: sem ela o teste passa com o código quebrado.
    unmount();
    await act(async () => {
      resolver({ remove });
    });

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('remove a assinatura no unmount normal', async () => {
    const remove = jest.fn();
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({ remove });

    const { unmount } = renderHook(() =>
      useLocationWatcher({
        enabled: true,
        options: OPCOES,
        onLocation: jest.fn(),
      }),
    );
    await act(async () => {});
    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('não cria watcher com enabled: false', async () => {
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: jest.fn(),
    });

    renderHook(() =>
      useLocationWatcher({
        enabled: false,
        options: OPCOES,
        onLocation: jest.fn(),
      }),
    );
    await act(async () => {});

    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('não recria o watcher quando só o callback muda de identidade', async () => {
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: jest.fn(),
    });

    const { rerender } = renderHook(
      ({ cb }) =>
        useLocationWatcher({ enabled: true, options: OPCOES, onLocation: cb }),
      { initialProps: { cb: jest.fn() } },
    );
    await act(async () => {});
    rerender({ cb: jest.fn() });
    await act(async () => {});

    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
  });

  it('não recria o watcher quando só o objeto de opções muda de identidade', async () => {
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: jest.fn(),
    });

    const { rerender } = renderHook(
      ({ opcoes }) =>
        useLocationWatcher({
          enabled: true,
          options: opcoes,
          onLocation: jest.fn(),
        }),
      { initialProps: { opcoes: { ...OPCOES } } },
    );
    await act(async () => {});
    rerender({ opcoes: { ...OPCOES } });
    await act(async () => {});

    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
  });

  it('entrega a localização ao callback mais recente', async () => {
    let emitir!: (l: unknown) => void;
    (Location.watchPositionAsync as jest.Mock).mockImplementation(
      async (_opcoes, cb) => {
        emitir = cb;
        return { remove: jest.fn() };
      },
    );

    const primeiro = jest.fn();
    const segundo = jest.fn();
    const { rerender } = renderHook(
      ({ cb }) =>
        useLocationWatcher({ enabled: true, options: OPCOES, onLocation: cb }),
      { initialProps: { cb: primeiro } },
    );
    await act(async () => {});
    rerender({ cb: segundo });
    await act(async () => {
      emitir({ coords: { latitude: -23.5, longitude: -46.6 } });
    });

    expect(primeiro).not.toHaveBeenCalled();
    expect(segundo).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/hooks/__tests__/useLocationWatcher.test.ts`
Expected: FAIL — `Cannot find module '../useLocationWatcher'`.

- [ ] **Step 3: Implementar**

Crie `src/hooks/useLocationWatcher.ts`:

```ts
/**
 * Dono único do ciclo de vida de um `Location.watchPositionAsync`.
 *
 * POR QUE EXISTE. Cinco arquivos deste repo criavam a assinatura dentro de
 * uma função `async` e a guardavam numa variável do escopo do efeito. Como a
 * atribuição fica depois de um `await`, o cleanup lê `null` quando a
 * desmontagem ganha a corrida — e a assinatura criada em seguida nunca é
 * removida. Um watcher `BestForNavigation` órfão consome GPS até o processo
 * morrer.
 *
 * E a corrida não era rara: as deps do efeito do watcher em
 * `TurnByTurnNavigation` incluíam `destination`, um literal inline vindo de
 * `NavigationMode`, que ganhava identidade nova a cada tick de GPS. O efeito
 * remontava uma vez por segundo, dirigindo.
 *
 * A SUTILEZA: a flag `cancelado` sozinha não resolve. Sem o `s.remove()` no
 * ramo cancelado, a assinatura nasce órfã do mesmo jeito — só que agora com
 * um `if` que dá a impressão de tratar o caso.
 */
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

import { logger } from '@/lib/logger';

export interface OpcoesDoWatcher {
  accuracy: Location.LocationAccuracy;
  timeInterval: number;
  distanceInterval: number;
}

export interface ParametrosDoWatcher {
  /** `false` não cria watcher; o cleanup do ciclo anterior já removeu o antigo. */
  enabled: boolean;
  options: OpcoesDoWatcher;
  onLocation: (location: Location.LocationObject) => void;
}

export function useLocationWatcher({
  enabled,
  options,
  onLocation,
}: ParametrosDoWatcher): void {
  // O callback vive numa ref, e não nas dependências: os chamadores passam
  // funções inline, e uma dependência de identidade recriaria o watcher a
  // cada render — que é o defeito que este hook existe para não ter.
  const onLocationRef = useRef(onLocation);

  // Declarado ANTES do efeito do watcher: efeitos rodam na ordem de
  // declaração, então a ref já está atualizada quando o watcher monta.
  useEffect(() => {
    onLocationRef.current = onLocation;
  }, [onLocation]);

  // Mesmo motivo, para as opções: os chamadores passam literais.
  const { accuracy, timeInterval, distanceInterval } = options;

  useEffect(() => {
    if (!enabled) return;

    let cancelado = false;
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const s = await Location.watchPositionAsync(
          { accuracy, timeInterval, distanceInterval },
          (location) => onLocationRef.current(location),
        );
        if (cancelado) {
          // A metade que faltava nos cinco call sites originais.
          s.remove();
          return;
        }
        sub = s;
      } catch (error) {
        logger.warn('[useLocationWatcher] Falha ao iniciar o watcher', error);
      }
    })();

    return () => {
      cancelado = true;
      try {
        sub?.remove();
      } catch (error) {
        // expo-location: remove() não se comporta bem na web.
        logger.warn('[useLocationWatcher] Falha ao remover o watcher', error);
      }
    };
  }, [enabled, accuracy, timeInterval, distanceInterval]);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest src/hooks/__tests__/useLocationWatcher.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 5: Verificar o RED do teste da corrida**

Este é o único teste do plano cujo vermelho precisa ser visto de propósito: ele é a prova da correção, e um teste que nunca falhou não prova nada.

1. Comente as três linhas do ramo `if (cancelado) { s.remove(); return; }`.
2. Run: `npx jest src/hooks/__tests__/useLocationWatcher.test.ts -t "nasce DEPOIS"`
3. Expected: **FAIL** — `expect(remove).toHaveBeenCalledTimes(1)` recebendo 0.
4. Restaure as linhas e rode de novo: PASS.

Registre no relatório as duas saídas. Se o teste passar com o ramo comentado, ele não está exercitando a corrida — o `unmount()` provavelmente está depois do `resolver(...)`.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useLocationWatcher.ts src/hooks/__tests__/useLocationWatcher.test.ts
git commit -m "feat(motorista): hook dono unico do ciclo de vida do watcher de GPS"
```

---

## Task 2: `permissoes.ts`

**Files:**

- Create: `src/lib/permissoes.ts`
- Test: `src/lib/__tests__/permissoes.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces:
  ```ts
  export interface ResultadoPermissao {
    concedida: boolean;
    podePerguntarDeNovo: boolean;
  }
  export interface CopyDePermissao {
    titulo: string;
    mensagemNegada: string;
    mensagemBloqueada: string;
  }
  export function abrirConfiguracoesDoApp(): void;
  export async function pedirPermissao(
    solicitar: () => Promise<{ status: string; canAskAgain?: boolean }>,
  ): Promise<ResultadoPermissao>;
  export async function oferecerSaidaParaConfiguracoes(
    resultado: ResultadoPermissao,
    copy: CopyDePermissao,
    showConfirm: (opcoes: {
      title: string;
      message: string;
      type?: 'info' | 'success' | 'warning' | 'error';
      confirmText?: string;
      cancelText?: string;
    }) => Promise<boolean>,
  ): Promise<void>;
  ```

**Contexto para quem implementa.** `grep canAskAgain` devolve zero ocorrências no repo. Todo call site faz `status === 'granted'` e joga fora o `canAskAgain`, que é a única informação que distingue "negou agora" de "bloqueou para sempre". Depois da segunda negação o Android não exibe mais o diálogo: sem um caminho para as Configurações, não há volta — e em `CameraUpload` isso significa que **não existe caminho no app para entregar com foto**.

`showConfirm` entra como parâmetro, e não via `useAlert` dentro deste módulo: `useAlert` devolve um elemento `AlertDialog` que o componente precisa renderizar, então chamar o hook aqui criaria um segundo diálogo que ninguém monta. Os componentes já chamam `useAlert` e já renderizam o `AlertDialog`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/lib/__tests__/permissoes.test.ts`:

```ts
import { Linking, Platform } from 'react-native';

import {
  abrirConfiguracoesDoApp,
  oferecerSaidaParaConfiguracoes,
  pedirPermissao,
  type CopyDePermissao,
} from '../permissoes';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Linking: { openURL: jest.fn(), openSettings: jest.fn() },
}));

const COPY: CopyDePermissao = {
  titulo: 'Acesso à câmera',
  mensagemNegada: 'Sem acesso à câmera não é possível registrar o comprovante.',
  mensagemBloqueada:
    'O acesso à câmera está bloqueado. Libere em Configurações.',
};

describe('pedirPermissao', () => {
  it('preserva o canAskAgain que os call sites descartavam', async () => {
    const resultado = await pedirPermissao(async () => ({
      status: 'denied',
      canAskAgain: false,
    }));
    expect(resultado).toEqual({ concedida: false, podePerguntarDeNovo: false });
  });

  it('concedida quando o status é granted', async () => {
    const resultado = await pedirPermissao(async () => ({
      status: 'granted',
      canAskAgain: true,
    }));
    expect(resultado.concedida).toBe(true);
  });

  it('trata canAskAgain ausente como "ainda dá para perguntar"', async () => {
    // Vários mocks do repo devolvem só { status }. A mensagem mais branda é a
    // escolha segura: acusar bloqueio que não existe confunde mais.
    const resultado = await pedirPermissao(async () => ({ status: 'denied' }));
    expect(resultado.podePerguntarDeNovo).toBe(true);
  });
});

describe('abrirConfiguracoesDoApp', () => {
  afterEach(() => {
    (Platform as { OS: string }).OS = 'android';
    jest.clearAllMocks();
  });

  it('usa openSettings no Android', () => {
    (Platform as { OS: string }).OS = 'android';
    abrirConfiguracoesDoApp();
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  it('usa app-settings: no iOS', () => {
    (Platform as { OS: string }).OS = 'ios';
    abrirConfiguracoesDoApp();
    expect(Linking.openURL).toHaveBeenCalledWith('app-settings:');
  });

  it('não faz nada na web', () => {
    (Platform as { OS: string }).OS = 'web';
    abrirConfiguracoesDoApp();
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });
});

describe('oferecerSaidaParaConfiguracoes', () => {
  afterEach(() => jest.clearAllMocks());

  it('usa a mensagem branda quando ainda dá para perguntar', async () => {
    const showConfirm = jest.fn().mockResolvedValue(false);
    await oferecerSaidaParaConfiguracoes(
      { concedida: false, podePerguntarDeNovo: true },
      COPY,
      showConfirm,
    );
    expect(showConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: COPY.mensagemNegada }),
    );
  });

  it('usa a mensagem de bloqueio quando não dá mais', async () => {
    const showConfirm = jest.fn().mockResolvedValue(false);
    await oferecerSaidaParaConfiguracoes(
      { concedida: false, podePerguntarDeNovo: false },
      COPY,
      showConfirm,
    );
    expect(showConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: COPY.mensagemBloqueada }),
    );
  });

  it('abre as Configurações quando o motorista confirma', async () => {
    const showConfirm = jest.fn().mockResolvedValue(true);
    await oferecerSaidaParaConfiguracoes(
      { concedida: false, podePerguntarDeNovo: false },
      COPY,
      showConfirm,
    );
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  it('não abre nada quando o motorista cancela', async () => {
    const showConfirm = jest.fn().mockResolvedValue(false);
    await oferecerSaidaParaConfiguracoes(
      { concedida: false, podePerguntarDeNovo: false },
      COPY,
      showConfirm,
    );
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });

  it('não pergunta nada quando a permissão foi concedida', async () => {
    const showConfirm = jest.fn().mockResolvedValue(false);
    await oferecerSaidaParaConfiguracoes(
      { concedida: true, podePerguntarDeNovo: true },
      COPY,
      showConfirm,
    );
    expect(showConfirm).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/__tests__/permissoes.test.ts`
Expected: FAIL — `Cannot find module '../permissoes'`.

- [ ] **Step 3: Implementar**

Crie `src/lib/permissoes.ts`:

```ts
/**
 * Pedido de permissão que preserva a informação que os call sites descartavam,
 * e o caminho de volta quando ela é negada.
 *
 * POR QUE EXISTE. `grep canAskAgain` devolvia zero ocorrências no repo: dez
 * call sites faziam `status === 'granted'` e jogavam fora o campo que
 * distingue "negou agora" de "bloqueou para sempre". Depois da segunda
 * negação o Android para de exibir o diálogo e devolve `denied` na hora — sem
 * um caminho para as Configurações, não existe volta. Em `CameraUpload` isso
 * fechava o laço: sem câmera não há comprovante, e sem comprovante não há
 * entrega.
 *
 * `showConfirm` entra por parâmetro, e não por `useAlert` aqui dentro: o
 * `useAlert` devolve um elemento `AlertDialog` que o componente precisa
 * renderizar, então chamar o hook neste módulo criaria um segundo diálogo que
 * ninguém monta.
 */
import { Linking, Platform } from 'react-native';

export interface ResultadoPermissao {
  concedida: boolean;
  /** `canAskAgain`: `false` significa que o diálogo do sistema não aparece mais. */
  podePerguntarDeNovo: boolean;
}

export interface CopyDePermissao {
  titulo: string;
  /** Exibida quando o diálogo do sistema ainda pode voltar a aparecer. */
  mensagemNegada: string;
  /** Exibida quando só as Configurações resolvem. */
  mensagemBloqueada: string;
}

type RespostaDePermissao = { status: string; canAskAgain?: boolean };

type ShowConfirm = (opcoes: {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  confirmText?: string;
  cancelText?: string;
}) => Promise<boolean>;

export function abrirConfiguracoesDoApp(): void {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else if (Platform.OS === 'android') {
    Linking.openSettings();
  }
  // Web: não existem configurações de app para abrir.
}

export async function pedirPermissao(
  solicitar: () => Promise<RespostaDePermissao>,
): Promise<ResultadoPermissao> {
  const resposta = await solicitar();
  return {
    concedida: resposta.status === 'granted',
    // Ausente (mocks antigos, versões de lib) conta como "ainda dá para
    // perguntar": acusar um bloqueio que não existe confunde mais do que a
    // mensagem branda.
    podePerguntarDeNovo: resposta.canAskAgain ?? true,
  };
}

export async function oferecerSaidaParaConfiguracoes(
  resultado: ResultadoPermissao,
  copy: CopyDePermissao,
  showConfirm: ShowConfirm,
): Promise<void> {
  if (resultado.concedida) return;

  const abrir = await showConfirm({
    title: copy.titulo,
    message: resultado.podePerguntarDeNovo
      ? copy.mensagemNegada
      : copy.mensagemBloqueada,
    type: 'warning',
    confirmText: 'Abrir Configurações',
    cancelText: 'Agora não',
  });

  if (abrir) abrirConfiguracoesDoApp();
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest src/lib/__tests__/permissoes.test.ts`
Expected: PASS, 11 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissoes.ts src/lib/__tests__/permissoes.test.ts
git commit -m "feat: permissao preserva canAskAgain e oferece saida para Configuracoes"
```

---

## Task 3: Migrar o trio de navegação

**Files:**

- Modify: `src/components/motorista/NavigationMode.tsx:132-165`
- Modify: `src/components/motorista/NavigationMode.web.tsx:448-547`
- Modify: `src/components/motorista/TurnByTurnNavigation.tsx:326-410`
- Modify: `src/components/motorista/__tests__/NavigationMode.test.tsx` (mock)
- Modify: `src/components/motorista/__tests__/TurnByTurnNavigation.test.tsx` (mock)

**Interfaces:**

- Consumes: `useLocationWatcher` e `OpcoesDoWatcher` da Task 1; `pedirPermissao`, `oferecerSaidaParaConfiguracoes`, `CopyDePermissao` da Task 2.
- Produces: nada para tasks seguintes.

**Contexto.** Os três são "ação bloqueada": sem GPS a navegação não faz sentido, então a negação abre `showConfirm` com saída. Os três já chamam `useAlert` e já renderizam `AlertDialog` — `NavigationMode.tsx:53` inclusive já desestrutura `showConfirm`. Os outros dois precisam adicionar `showConfirm` à desestruturação.

**Atenção ao mock existente.** `NavigationMode.test.tsx:22` e `TurnByTurnNavigation.test.tsx` mockam `expo-location` devolvendo `{ status: 'granted' }` **sem `canAskAgain`**. O `?? true` da Task 2 mantém esses testes verdes, mas adicione `canAskAgain: true` aos mocks para eles descreverem a resposta real da API.

- [ ] **Step 1: Constante de copy compartilhada**

Crie `src/lib/motorista/copyDePermissao.ts`:

```ts
import type { CopyDePermissao } from '@/lib/permissoes';

export const COPY_LOCALIZACAO: CopyDePermissao = {
  titulo: 'Acesso à localização',
  mensagemNegada:
    'Sem acesso à sua localização não é possível navegar até a entrega.',
  mensagemBloqueada:
    'O acesso à localização está bloqueado. Libere em Configurações para navegar até a entrega.',
};
```

**Só `COPY_LOCALIZACAO` nesta task.** `COPY_CAMERA` e `COPY_GALERIA` entram no mesmo arquivo na Task 6, que é quem as usa — criá-las aqui deixaria duas constantes sem consumidor no diff desta task, e código sem uso é defeito.

- [ ] **Step 2: `NavigationMode.tsx` — trocar o efeito das linhas 132-165**

Adicione os imports e uma constante de módulo (fora do componente, para as opções não nascerem a cada render):

```ts
import {
  useLocationWatcher,
  type OpcoesDoWatcher,
} from '@/hooks/useLocationWatcher';
import { COPY_LOCALIZACAO } from '@/lib/motorista/copyDePermissao';
import {
  oferecerSaidaParaConfiguracoes,
  pedirPermissao,
} from '@/lib/permissoes';

const OPCOES_NAVEGACAO: OpcoesDoWatcher = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 5,
};
```

Substitua o `useEffect` inteiro das linhas 132-165 por:

```tsx
const [temPermissaoDeLocalizacao, setTemPermissaoDeLocalizacao] =
  useState(false);

useEffect(() => {
  let cancelado = false;

  (async () => {
    const resultado = await pedirPermissao(() =>
      Location.requestForegroundPermissionsAsync(),
    );
    if (cancelado) return;

    setTemPermissaoDeLocalizacao(resultado.concedida);
    await oferecerSaidaParaConfiguracoes(
      resultado,
      COPY_LOCALIZACAO,
      showConfirm,
    );
  })();

  return () => {
    cancelado = true;
  };
}, [showConfirm]);

useLocationWatcher({
  enabled: temPermissaoDeLocalizacao,
  options: OPCOES_NAVEGACAO,
  onLocation: (location) =>
    updateLocationFromCoords(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading,
      },
      location.coords.speed,
    ),
});
```

`useState` já está importado no arquivo; confirme antes de adicionar.

- [ ] **Step 3: `TurnByTurnNavigation.tsx` — mesmo tratamento**

Adicione ao topo do arquivo:

```ts
import {
  useLocationWatcher,
  type OpcoesDoWatcher,
} from '@/hooks/useLocationWatcher';
import { COPY_LOCALIZACAO } from '@/lib/motorista/copyDePermissao';
import {
  oferecerSaidaParaConfiguracoes,
  pedirPermissao,
} from '@/lib/permissoes';

const OPCOES_TURN_BY_TURN: OpcoesDoWatcher = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 5,
};
```

Adicione `showConfirm` à desestruturação do `useAlert` já existente. Substitua o `useEffect` que começa na linha 326 (`// Watch position updates`) por um efeito de permissão idêntico ao do passo 2 (com `COPY_LOCALIZACAO`) mais:

```tsx
useLocationWatcher({
  enabled: temPermissaoDeLocalizacao,
  options: OPCOES_TURN_BY_TURN,
  onLocation: (location) => {
    void processarLocalizacao(location);
  },
});
```

`void` na chamada porque `processarLocalizacao` é `async` e `onLocation` é síncrono. O corpo do callback atual (linhas 345-396) vira este `useCallback`, sem mudança de lógica:

```tsx
const processarLocalizacao = useCallback(
  async (location: Location.LocationObject) => {
    const coords = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    const accuracy = location.coords.accuracy || 50;

    // Throttle: só processa se moveu > 3m.
    const lastLoc = lastProcessedLocation.current;
    if (lastLoc) {
      const delta = calculateHaversineDistance(
        lastLoc.lat,
        lastLoc.lng,
        coords.latitude,
        coords.longitude,
      );
      if (delta < 3) return;
    }
    lastProcessedLocation.current = {
      lat: coords.latitude,
      lng: coords.longitude,
    };

    setUserLocation(coords);
    setSpeed(Math.round((location.coords.speed || 0) * 3.6)); // m/s → km/h
    setHeading(location.coords.heading || 0);

    // Só atualiza a navegação com a rota pronta (evita corrida).
    if (isRouteReady) {
      await updateNavigation(coords, location.coords.speed || 0);
    }

    const distToDestination = calculateHaversineDistance(
      coords.latitude,
      coords.longitude,
      destination.latitude,
      destination.longitude,
    );

    // Chegada: dentro do raio E com GPS confiável (<30m), ou muito perto
    // (<10m) independentemente da precisão.
    const isArrived =
      distToDestination < proximityRadius &&
      (accuracy < 30 || distToDestination < 10);

    if (isArrived && !hasArrivedRef.current) {
      handleArrival();
    }
  },
  [destination, handleArrival, isRouteReady, proximityRadius, updateNavigation],
);
```

`showError` sai das dependências porque a mensagem de permissão negada deixa de ser emitida aqui — quem cuida disso é o efeito de permissão. `destination` continua, e é por isso que a Task 5 importa: sem memoizá-la, `processarLocalizacao` ganha identidade nova a cada tick — mas agora isso só recria uma função, não um watcher de GPS.

- [ ] **Step 4: `NavigationMode.web.tsx` — desfazer o `useCallback` que devolve cleanup**

O `startLocationTracking` da linha 448 devolve uma função de cleanup consumida pelo efeito da linha 535 — e o `cleanup` só é atribuído depois de dois `await`, então a corrida é a mesma. Remova `startLocationTracking` e o efeito da linha 535, e ponha no lugar:

```tsx
const [temPermissaoDeLocalizacao, setTemPermissaoDeLocalizacao] =
  useState(false);

useEffect(() => {
  let cancelado = false;

  (async () => {
    const resultado = await pedirPermissao(() =>
      Location.requestForegroundPermissionsAsync(),
    );
    if (cancelado) return;

    setTemPermissaoDeLocalizacao(resultado.concedida);
    if (!resultado.concedida) {
      await oferecerSaidaParaConfiguracoes(
        resultado,
        COPY_LOCALIZACAO,
        showConfirm,
      );
      return;
    }

    setIsTracking(true);
    try {
      const location = await Location.getCurrentPositionAsync({});
      if (cancelado) return;
      updateLocationFromCoords(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading,
        },
        location.coords.speed,
      );
    } catch (error) {
      logger.warn('[NavigationMode.web] Erro ao obter posição inicial', error);
    }
  })();

  return () => {
    cancelado = true;
    setIsTracking(false);
  };
}, [showConfirm, setIsTracking, updateLocationFromCoords]);

useLocationWatcher({
  enabled: temPermissaoDeLocalizacao,
  options: OPCOES_NAVEGACAO_WEB,
  onLocation: (location) =>
    updateLocationFromCoords(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading,
      },
      location.coords.speed,
    ),
});
```

Com `OPCOES_NAVEGACAO_WEB` no escopo de módulo, iguais às do nativo (`BestForNavigation`, 1000, 5). Adicione `showConfirm` à desestruturação do `useAlert`.

- [ ] **Step 5: Atualizar os mocks dos dois testes existentes**

Em `src/components/motorista/__tests__/NavigationMode.test.tsx:24-26` e no equivalente de `TurnByTurnNavigation.test.tsx`, troque:

```ts
requestForegroundPermissionsAsync: jest
  .fn()
  .mockResolvedValue({ status: 'granted' }),
```

por:

```ts
requestForegroundPermissionsAsync: jest
  .fn()
  .mockResolvedValue({ status: 'granted', canAskAgain: true }),
```

- [ ] **Step 6: Rodar os testes dos três arquivos**

Run: `npx jest src/components/motorista/__tests__/NavigationMode.test.tsx src/components/motorista/__tests__/TurnByTurnNavigation.test.tsx`
Expected: PASS.

- [ ] **Step 7: Type-check e lint**

Run: `npm run type-check && npm run lint`
Expected: exit 0 nos dois.

- [ ] **Step 8: Commit**

```bash
git add src/components/motorista/ src/lib/motorista/copyDePermissao.ts
git commit -m "fix(motorista): trio de navegacao usa o hook do watcher e oferece saida na permissao"
```

---

## Task 4: Migrar `inicio.tsx` e `useDriverLocationBroadcast`

**Files:**

- Modify: `app/motorista/_screens/inicio.tsx:104-160`
- Modify: `src/hooks/useDriverLocationBroadcast.ts:160-185`
- Modify: `src/hooks/__tests__/useDriverLocationBroadcast.test.ts` (mock)

**Interfaces:**

- Consumes: `useLocationWatcher`, `OpcoesDoWatcher` (Task 1); `pedirPermissao`, `abrirConfiguracoesDoApp` (Task 2). `COPY_LOCALIZACAO` (Task 3) **não** é usada aqui — este é o nível ambiente, sem diálogo.
- Produces: nada.

**Contexto.** Estes dois são "ambiente": a permissão melhora a tela mas não bloqueia nada, e `inicio.tsx` abre toda vez que o app abre — um modal ali viraria ruído diário. `inicio.tsx` ganha um `<Alert>` inline dispensável com botão de ação; `useDriverLocationBroadcast` é um hook sem UI e mantém o `logger.warn`.

`useDriverLocationBroadcast` é o de pior consequência do lote: o callback captura o `rotaId` do render anterior, então o watcher órfão continua inserindo em `motorista_locations` para uma rota já encerrada.

**O ramo web fica fora do hook.** `useDriverLocationBroadcast` usa `navigator.geolocation.watchPosition` quando `Platform.OS === 'web'`, que não é `expo-location`. Deixe esse ramo como está — a guarda da Task 8 o lista como exceção nomeada.

- [ ] **Step 1: `inicio.tsx` — estado da permissão e o watcher**

Adicione ao topo:

```ts
import { Alert as AlertInline } from '@/components/Alert';
import {
  useLocationWatcher,
  type OpcoesDoWatcher,
} from '@/hooks/useLocationWatcher';
import { abrirConfiguracoesDoApp, pedirPermissao } from '@/lib/permissoes';

const OPCOES_INICIO: OpcoesDoWatcher = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 10000,
  distanceInterval: 50,
};
```

O import usa alias porque `inicio.tsx` já importa `useAlert`; `Alert` puro confundiria as duas coisas.

Substitua o `useEffect` das linhas 104-160 por:

```tsx
const [temPermissaoDeLocalizacao, setTemPermissaoDeLocalizacao] =
  useState(false);
const [avisoDeLocalizacaoVisivel, setAvisoDeLocalizacaoVisivel] =
  useState(false);

useEffect(() => {
  let cancelado = false;

  (async () => {
    try {
      const resultado = await pedirPermissao(() =>
        Location.requestForegroundPermissionsAsync(),
      );
      if (cancelado) return;

      setTemPermissaoDeLocalizacao(resultado.concedida);
      // Nível ambiente: aviso dispensável, nunca um modal. Esta tela abre a
      // cada abertura do app.
      setAvisoDeLocalizacaoVisivel(!resultado.concedida);
      if (!resultado.concedida) return;

      try {
        const posicao = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelado) return;
        setLocation({
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
        });
      } catch (positionError: unknown) {
        // Não-crítico: o watcher abaixo entrega a posição em seguida.
        logger.warn(
          '[Location] Não foi possível obter a posição atual',
          positionError,
        );
      }
    } catch (error: unknown) {
      logger.error('[Location] Erro ao configurar o rastreamento', error);
    }
  })();

  return () => {
    cancelado = true;
  };
}, []);

useLocationWatcher({
  enabled: temPermissaoDeLocalizacao,
  options: OPCOES_INICIO,
  onLocation: (novaPosicao) =>
    setLocation({
      latitude: novaPosicao.coords.latitude,
      longitude: novaPosicao.coords.longitude,
    }),
});
```

- [ ] **Step 2: `inicio.tsx` — renderizar o aviso**

Logo antes do mapa, no JSX:

```tsx
{
  avisoDeLocalizacaoVisivel && (
    <AlertInline
      type="info"
      title="Localização desativada"
      message="Ative a localização para ver sua posição no mapa e acompanhar a rota."
      actionLabel="Abrir Configurações"
      onAction={abrirConfiguracoesDoApp}
      onClose={() => setAvisoDeLocalizacaoVisivel(false)}
      testID="aviso-localizacao-desativada"
    />
  );
}
```

A prop de fechar é `onClose`, não `onDismiss` — confira `src/components/Alert.tsx:41`.

- [ ] **Step 3: `useDriverLocationBroadcast.ts` — ramo nativo pelo hook**

O bloco das linhas 160-181 (`// Mobile (iOS/Android)` até o fechamento do `try`) some do `startTracking`, que passa a tratar **só** o ramo web. No lugar, no corpo do hook:

```ts
const [temPermissaoDeLocalizacao, setTemPermissaoDeLocalizacao] =
  useState(false);

useEffect(() => {
  if (Platform.OS === 'web' || !shouldTrack) {
    setTemPermissaoDeLocalizacao(false);
    return;
  }

  let cancelado = false;
  (async () => {
    const resultado = await pedirPermissao(() =>
      Location.requestForegroundPermissionsAsync(),
    );
    if (cancelado) return;
    if (!resultado.concedida) {
      // Nível ambiente e sem UI própria: este hook não tem tela para avisar.
      logger.warn('[LocationBroadcast] Permissão de localização negada');
    }
    setTemPermissaoDeLocalizacao(resultado.concedida);
  })();

  return () => {
    cancelado = true;
  };
}, [shouldTrack]);

useLocationWatcher({
  enabled: temPermissaoDeLocalizacao,
  options: {
    accuracy: Location.Accuracy.High,
    timeInterval: updateInterval,
    distanceInterval: 20,
  },
  onLocation: (location) => broadcastLocation(location),
});
```

`isActiveRef.current` deixa de existir no ramo nativo — quem decide se transmite é o `enabled`. Mantenha a ref para o ramo web, que continua usando-a.

- [ ] **Step 4: Atualizar o mock do teste do broadcast**

Em `src/hooks/__tests__/useDriverLocationBroadcast.test.ts`, acrescente `canAskAgain: true` ao `mockResolvedValue` de `requestForegroundPermissionsAsync`.

- [ ] **Step 5: Rodar os testes**

Run: `npx jest src/hooks/__tests__/useDriverLocationBroadcast.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check e lint**

Run: `npm run type-check && npm run lint`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/motorista/_screens/inicio.tsx src/hooks/useDriverLocationBroadcast.ts src/hooks/__tests__/useDriverLocationBroadcast.test.ts
git commit -m "fix(motorista): Inicio e broadcast usam o hook; aviso de GPS ganha saida"
```

---

## Task 5: Identidade de prop em `NavigationMode.tsx`

**Files:**

- Modify: `src/components/motorista/NavigationMode.tsx:330-343`
- Test: `src/components/motorista/__tests__/NavigationMode.test.tsx`

**Interfaces:**

- Consumes: nada das tasks anteriores.
- Produces: nada.

**Contexto — este é o amplificador.** O efeito do watcher em `TurnByTurnNavigation` tem `destination` nas dependências, e `destination` é o literal inline da linha 334. `origin={userLocation}` muda a cada tick de GPS de 1 Hz. A cadeia: tick → `userLocation` muda → `NavigationMode` re-renderiza → `destination` ganha identidade nova → o efeito de `TurnByTurnNavigation` desmonta e remonta. Uma vez por segundo, dirigindo.

Sem esta task, a Task 3 elimina o vazamento mas mantém uma requisição OSRM por segundo, `Speech.stop()` e o TTS rearmando _"Iniciando navegação"_.

O padrão já existe no repo: `src/components/motorista/home/NextStopPreview.tsx:65` memoiza um `destination` exatamente por este motivo, e `src/hooks/navigation/pip/usePiPRouteInfo.ts:158` usa dependências primitivas com um `eslint-disable` explicando por quê.

- [ ] **Step 1: Escrever o teste que falha**

**Por que este teste é estático, e por que isso é legítimo aqui.** `useNavigationModeLogic` não é mockado em `NavigationMode.test.tsx` — o hook real roda. Chegar ao ramo `navigationMode === 'turn-by-turn' && userLocation` exigiria simular o clique que troca o modo mais um fix de GPS que popule `userLocation`: maquinaria frágil para um fato que o texto do arquivo resolve sozinho. Um literal de objeto em JSX **não tem como** ser referencialmente estável — a ausência dele não é um indício da propriedade, é a propriedade.

Isto é o oposto do caso do watcher na Task 1, onde a presença da flag `cancelado` não provava nada sobre o `remove()` ter sido chamado. Lá o teste precisava executar; aqui não há o que executar.

Acrescente a `src/components/motorista/__tests__/NavigationMode.test.tsx`, como um `describe` próprio no fim do arquivo:

```tsx
import { readFileSync } from 'fs';
import { join } from 'path';

describe('identidade das props passadas a TurnByTurnNavigation', () => {
  const fonte = readFileSync(
    join(__dirname, '..', 'NavigationMode.tsx'),
    'utf8',
  );

  // Recorta só o elemento <TurnByTurnNavigation …/>: o resto do arquivo tem
  // literais legítimos (estilos, regiões de mapa) que não são props dele.
  const elemento = fonte.slice(
    fonte.indexOf('<TurnByTurnNavigation'),
    fonte.indexOf('/>', fonte.indexOf('<TurnByTurnNavigation')),
  );

  it('recorta o elemento de fato (a guarda não passa por ausência)', () => {
    expect(elemento).toContain('destination=');
    expect(elemento).toContain('onExit=');
  });

  it('nenhuma prop é literal de objeto', () => {
    // `destination={{…}}` ganha identidade nova a cada render. Como
    // `destination` está nas deps do efeito do watcher de
    // TurnByTurnNavigation e `origin={userLocation}` muda a 1 Hz, isso
    // desmontava e remontava aquele efeito uma vez por segundo, dirigindo.
    expect(elemento).not.toMatch(/=\{\{/);
  });

  it('nenhuma prop é arrow function inline', () => {
    // `onExit={() => …}` tem o mesmo efeito por outro caminho.
    expect(elemento).not.toMatch(/=\{\s*\(\s*\)\s*=>/);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/components/motorista/__tests__/NavigationMode.test.tsx -t "identidade das props"`
Expected: **FAIL** em dois dos três — `destination={{` casa com `/=\{\{/` e `onExit={() =>` casa com a arrow inline. O primeiro teste (o que confere o recorte) passa.

- [ ] **Step 3: Memoizar**

Antes do `return`, no corpo do componente:

```tsx
// Dependências primitivas, não o objeto `currentStop`: ele também muda de
// identidade a cada render, e o memo não valeria nada. Mesmo padrão de
// `src/hooks/navigation/pip/usePiPRouteInfo.ts:158`.
const destinoDaNavegacao = useMemo(
  () => ({
    latitude: currentStop?.latitude,
    longitude: currentStop?.longitude,
    address: currentStop?.endereco,
  }),
  [currentStop?.latitude, currentStop?.longitude, currentStop?.endereco],
);

const sairDaNavegacao = useCallback(
  () => setNavigationMode('map'),
  [setNavigationMode],
);
```

E troque as props nas linhas 334-341:

```tsx
<TurnByTurnNavigation
  origin={userLocation}
  destination={destinoDaNavegacao}
  waypoints={remainingWaypoints}
  onArrive={handleCompleteStop}
  onExit={sairDaNavegacao}
/>
```

O `useMemo` fica **antes** do `if (!currentStop || !region) return null;` da linha 327 — hooks não podem ficar depois de um retorno condicional. Daí o `?.` nas dependências.

Confirme que `useMemo` e `useCallback` estão importados de `react`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest src/components/motorista/__tests__/NavigationMode.test.tsx`
Expected: PASS, incluindo os três testes novos e todos os que já existiam.

- [ ] **Step 5: Conferir `waypoints` e `origin` — as outras duas props**

Ambas já foram verificadas e **não precisam de mudança**; este passo é só confirmar que continua assim.

`remainingWaypoints` já nasce memoizado em `src/hooks/navigation/useNavigationModeLogic.ts:121` (`const remainingWaypoints = useMemo(...)`) e chega a `NavigationMode.tsx:75` pela desestruturação do hook. Confirme com:

```bash
grep -n "remainingWaypoints = useMemo" src/hooks/navigation/useNavigationModeLogic.ts
```

`origin={userLocation}` **deve** mudar a cada tick: é o dado que o watcher produz, não um defeito. Não memoize.

- [ ] **Step 6: Commit**

```bash
git add src/components/motorista/NavigationMode.tsx src/components/motorista/__tests__/NavigationMode.test.tsx
git commit -m "perf(motorista): destination e onExit memoizados param o churn de 1 Hz"
```

---

## Task 6: Câmera, galeria e o marcador que faltava

**Files:**

- Modify: `src/components/CameraUpload.tsx:122-133,166-215`
- Modify: `src/components/IncidentReportWizard.tsx:144,214-284`
- Modify: `src/lib/motorista/rascunhoIncidente.ts:35`
- Test: `src/components/__tests__/CameraUpload.test.tsx`

**Interfaces:**

- Consumes: `pedirPermissao`, `oferecerSaidaParaConfiguracoes` (Task 2); `COPY_CAMERA`, `COPY_GALERIA` (Task 3).
- Produces: nada.

**Contexto.** É o call site mais grave: sem câmera não existe comprovante, e sem comprovante não existe entrega. Hoje o aviso não tem botão nenhum, então depois da segunda negação o motorista fica sem caminho. E a galeria não recebeu as duas metades da correção da câmera: `openCamera:179` marca a conclusão em voo antes de sair do app, `openGallery:200` não marca nada — o mesmo bug já corrigido sobrevivendo no ramo vizinho do mesmo `if`.

- [ ] **Step 1: Renomear `cameraAberta` → `seletorAberto`**

Em `src/lib/motorista/rascunhoIncidente.ts:35`, troque o campo da interface `RascunhoIncidente`. Ajuste o comentário da linha 15, que hoje diz que `cameraAberta` marca o caso da câmera: o campo passa a valer para os dois ramos, porque `ImagePicker.getPendingResultAsync()` recupera o resultado de qualquer um deles.

**Sem camada de compatibilidade, deliberadamente.** O rascunho tem `VALIDADE_RASCUNHO_MS = 15 min` e a escrita e a leitura acontecem com segundos de diferença dentro da mesma execução do app. Um rascunho de formato antigo só existiria se o app fosse atualizado entre abrir o seletor e voltar dele.

Atualize o único leitor, `IncidentReportWizard.tsx:144` (`if (!rascunho.cameraAberta) return;`), e o escritor da linha 237.

- [ ] **Step 2: `CameraUpload.tsx` — permissão com saída**

Adicione `showConfirm` à desestruturação da linha 53 e os imports:

```ts
import { COPY_CAMERA, COPY_GALERIA } from '@/lib/motorista/copyDePermissao';
import {
  oferecerSaidaParaConfiguracoes,
  pedirPermissao,
} from '@/lib/permissoes';
```

Apague `requestCameraPermission` e `requestGalleryPermission` (linhas 122-133) — o `status === 'granted'` delas é justamente o que descarta o `canAskAgain`. Em `openCamera`, troque as linhas 167-175 por:

```tsx
const permissao = await pedirPermissao(() =>
  ImagePicker.requestCameraPermissionsAsync(),
);
if (!permissao.concedida) {
  await oferecerSaidaParaConfiguracoes(permissao, COPY_CAMERA, showConfirm);
  return;
}
```

- [ ] **Step 3: `CameraUpload.tsx` — galeria com permissão e marcador**

Em `openGallery` (linha 200), troque o bloco de permissão pelo mesmo padrão com `COPY_GALERIA`, e envolva a chamada do seletor:

```tsx
// Antes de sair do app, e não depois: se o Android recriar a Activity
// enquanto o seletor está aberto, não existe "depois" neste componente.
// Mesma razão de `openCamera` — faltava só neste ramo.
await marcarConclusaoEmVoo(paradaId, rotaId);

const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 0.8,
});

// Chegou aqui = a Activity sobreviveu e o resultado veio inline.
await limparConclusaoEmVoo();
```

`marcarConclusaoEmVoo` e `limparConclusaoEmVoo` já estão importados no arquivo (linha 25).

- [ ] **Step 4: `IncidentReportWizard.tsx` — os dois ramos**

Adicione `showConfirm` à desestruturação da linha 80 e os mesmos imports. Em `takePhoto` (linha 215) e `pickImage` (linha 265), troque cada bloco de permissão pelo padrão com `COPY_CAMERA` / `COPY_GALERIA`.

Em `pickImage`, replique o bloco de rascunho que `takePhoto` tem nas linhas 229-240, com `seletorAberto: true`, e chame `limparRascunhoIncidente()` depois do `launchImageLibraryAsync`. Acrescente a `pickImage` as mesmas dependências que `takePhoto` tem (`paradaId`, `rotaId`, `currentStep`, `selectedCategory`, `description`, `photoUri`) — sem elas o `useCallback` salva um rascunho com valores velhos.

- [ ] **Step 5: Atualizar os dois testes que afirmam o comportamento antigo**

`src/components/__tests__/CameraUpload.test.tsx` já tem dois testes que **vão quebrar**, e é correto que quebrem — eles afirmam exatamente o defeito:

- por volta da linha 303: `expect(global.mockUseAlert.showWarning).toHaveBeenCalledWith('Permissão negada', 'Precisamos de acesso à câmera para tirar fotos do comprovante de entrega.')`
- por volta da linha 350: o equivalente da galeria.

Troque cada asserção por:

```tsx
await waitFor(() => {
  expect(global.mockUseAlert.showConfirm).toHaveBeenCalledWith(
    expect.objectContaining({ confirmText: 'Abrir Configurações' }),
  );
});
```

Não apague os testes: eles já montam todo o cenário de permissão negada.

- [ ] **Step 6: Escrever os testes novos**

O componente **não** renderiza "Tirar Foto" e "Escolher da Galeria" no JSX — as duas vivem num `Alert.alert` nativo (`CameraUpload.tsx:340-347`). Siga o padrão que o arquivo já usa (linhas 278-296): pressione o botão visível, pegue o array de botões do spy e chame o `onPress`.

```tsx
async function acionarOpcao(
  rotulo: '📷 Tirar Foto' | '🖼️ Escolher da Galeria',
) {
  fireEvent.press(getByText('📸 Adicionar Foto do Comprovante'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  const opcoes = (Alert.alert as jest.Mock).mock.calls.find(
    (call) => call[0] === 'Adicionar Foto',
  )?.[2];
  await opcoes.find((btn: { text: string }) => btn.text === rotulo).onPress();
}

it('abre as Configurações quando a câmera está bloqueada e o motorista aceita', async () => {
  mockRequestCameraPermissionsAsync.mockResolvedValue({
    status: 'denied',
    canAskAgain: false,
  });
  // O mock global já resolve `true` (jest.setup.js:747) — o motorista aceitou.
  const { getByText } = render(<CameraUpload {...defaultProps} />);
  await acionarOpcao('📷 Tirar Foto');

  expect(global.mockUseAlert.showConfirm).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringContaining('bloqueado'),
      confirmText: 'Abrir Configurações',
    }),
  );
  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
});

it('usa a mensagem branda quando ainda dá para perguntar de novo', async () => {
  mockRequestCameraPermissionsAsync.mockResolvedValue({
    status: 'denied',
    canAskAgain: true,
  });
  const { getByText } = render(<CameraUpload {...defaultProps} />);
  await acionarOpcao('📷 Tirar Foto');

  expect(global.mockUseAlert.showConfirm).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.not.stringContaining('bloqueado'),
    }),
  );
});

it('marca a conclusão em voo ANTES de abrir a galeria', async () => {
  mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({
    status: 'granted',
    canAskAgain: true,
  });
  const ordem: string[] = [];
  mockMarcarConclusaoEmVoo.mockImplementation(async () => {
    ordem.push('marcou');
  });
  mockLaunchImageLibraryAsync.mockImplementation(async () => {
    ordem.push('abriu');
    return { canceled: true };
  });

  const { getByText } = render(<CameraUpload {...defaultProps} />);
  await acionarOpcao('🖼️ Escolher da Galeria');

  expect(ordem).toEqual(['marcou', 'abriu']);
});
```

O último afirma a **ordem**, não só que as duas foram chamadas: marcar depois de abrir o seletor não serviria de nada, porque é justamente enquanto ele está aberto que a Activity pode ser recriada. Um `expect(mockMarcarConclusaoEmVoo).toHaveBeenCalled()` passaria com o marcador no lugar errado.

`defaultProps`, `mockMarcarConclusaoEmVoo` (linha 58) e o spy de `Alert.alert` (linha 78) já existem no arquivo. `mockLaunchImageLibraryAsync` e `mockRequestMediaLibraryPermissionsAsync` — confirme os nomes no mock de `expo-image-picker` do topo do arquivo e use os que estiverem lá. `Linking` precisa vir do mock de `react-native`; se o arquivo ainda não o espia, adicione `jest.spyOn(Linking, 'openSettings')`.

**Não crie guarda de plataforma no `marcarConclusaoEmVoo` da galeria.** Na web o `showOptions` chama `openGallery` direto, então o marcador chega a ser escrito ali — mas é inerte: `useRestaurarConclusaoEmVoo.ts:57` já sai cedo com `if (Platform.OS !== 'android') return;`. Marcar incondicionalmente espelha `openCamera` e não cria estado que ninguém consome.

- [ ] **Step 7: Rodar**

Run: `npx jest src/components/__tests__/CameraUpload.test.tsx src/components/__tests__/IncidentReportWizard.test.tsx`
Expected: PASS.

- [ ] **Step 8: Confirmar que o campo antigo sumiu**

Run: `grep -rn "cameraAberta" src/ app/`
Expected: nenhuma ocorrência. Se aparecer em comentário, reescreva o comentário — não deixe o nome antigo circulando.

- [ ] **Step 9: Commit**

```bash
git add src/components/CameraUpload.tsx src/components/IncidentReportWizard.tsx src/lib/motorista/rascunhoIncidente.ts src/components/__tests__/
git commit -m "fix(motorista): camera e galeria com saida de permissao e marcador em voo"
```

---

## Task 7: `expo-image-picker` nos plugins

**Files:**

- Modify: `app.config.js:97-129`

**Interfaces:**

- Consumes: nada.
- Produces: nada.

**Contexto — CORRIGIDO EM 07/09/2026.** Este parágrafo dizia que sem a entrada nos `plugins` a chave `NSCameraUsageDescription` nunca entraria no `Info.plist`, e que isso seria `SIGABRT` imediato. **Medido, é falso:** o Expo auto-aplica o config plugin de pacotes que trazem `app.plugin.js`, e `expo-image-picker` traz — as chaves entram de qualquer jeito. O que a entrada explícita muda é o **texto**: sem ela vale o default de `withImagePicker.js:7`, `'Allow $(PRODUCT_NAME) to access your camera'`, inglês e genérico num app pt-BR. A Guideline 5.1.1 exige purpose string que explique o uso — risco de reprovação, não de crash. O Android não é afetado.

- [ ] **Step 1: Adicionar o plugin**

Em `app.config.js`, dentro do array `plugins`, depois da entrada de `expo-secure-store`:

```js
[
  "expo-image-picker",
  {
    photosPermission:
      "O Rota Mestre usa suas fotos para você anexar o comprovante de entrega.",
    cameraPermission:
      "O Rota Mestre usa a câmera para fotografar o comprovante de entrega.",
  },
],
```

As strings vão literalmente para o `Info.plist` e são lidas pelo revisor da App Store: precisam dizer **para quê**, não só "o app usa a câmera".

- [ ] **Step 2: Gerar o projeto nativo e conferir o `Info.plist`**

```bash
npx expo prebuild --platform ios --no-install
```

Depois:

```bash
grep -A 1 "NSCameraUsageDescription\|NSPhotoLibraryUsageDescription" ios/*/Info.plist
```

Expected: as duas chaves presentes, com as strings acima.

Isto é o que prova a correção sem depender de um build iOS, que não existe (pendência 5 do `PROJECT_CONTEXT`).

- [ ] **Step 3: Limpar o `ios/` gerado**

```bash
rm -rf ios
git status --porcelain
```

Expected: só `app.config.js` modificado. O projeto usa fluxo gerenciado — `ios/` não é versionado e não pode entrar no commit. Se `git status` mostrar `ios/`, confirme que ele está no `.gitignore` antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add app.config.js
git commit -m "fix(ios): purpose strings da camera e da galeria em pt-BR"
```

---

## Task 8: As duas guardas de fonte única

**Files:**

- Create: `src/lib/__tests__/fonte-unica-localizacao.test.ts`

**Interfaces:**

- Consumes: o estado final das Tasks 3, 4 e 6.
- Produces: nada.

**Contexto.** Esta task vem por último de propósito. As guardas afirmam um invariante sobre o repo **inteiro**, então ficariam vermelhas da Task 1 até a Task 7 — e uma suíte vermelha entre tarefas apaga o sinal de qualquer regressão real. Vindo por último, elas também servem de conferência: se falharem, um call site passou batido.

Elas não provam que o ciclo de vida está certo — quem prova isso é o teste da Task 1. A divisão é consciente: o teste prova a correção, a guarda impede que o próximo call site nasça fora do lugar que está correto. Molde: `src/lib/__tests__/maplibre-fonte-unica.test.ts`.

- [ ] **Step 1: Escrever a guarda**

```ts
/**
 * Guarda de fonte única para localização e permissões.
 *
 * POR QUE EXISTE. Cinco arquivos criavam `watchPositionAsync` com a mesma
 * corrida (assinatura atribuída depois de um `await`, cleanup lendo `null`) e
 * dez pediam permissão descartando o `canAskAgain`. Corrigir as instâncias sem
 * fechar a porta só adia: o próximo call site nasce com o mesmo defeito, e
 * nada em CI reclama.
 *
 * O QUE ELA NÃO PEGA: se `useLocationWatcher` ou `permissoes.ts` quebrarem por
 * dentro, esta guarda segue verde. Quem cobre isso é
 * `src/hooks/__tests__/useLocationWatcher.test.ts` — em particular o teste que
 * desmonta durante o `await`.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { sync as glob } from 'glob';

const RAIZ = join(__dirname, '..', '..', '..');

const FONTE_DO_WATCHER = 'src/hooks/useLocationWatcher.ts';
const FONTE_DAS_PERMISSOES = 'src/lib/permissoes.ts';

/**
 * `useDriverLocationBroadcast` usa `navigator.geolocation.watchPosition` no
 * ramo web — API do navegador, não `expo-location`, e sem a corrida que o hook
 * resolve. Fica de fora por natureza, não por dívida.
 */
const EXCECOES_DO_WATCHER: string[] = [];

const EXCECOES_DAS_PERMISSOES = [
  // Já implementa o comportamento correto — o `openSettings` da linha 182 foi
  // a referência de onde `permissoes.ts` saiu. Migrá-lo é refatoração sem
  // ganho de comportamento; fica de fora com o motivo escrito.
  'src/components/motorista/home/PreRouteChecklist.tsx',
];

function arquivosDeProducao(): string[] {
  return glob('{src,app}/**/*.{ts,tsx}', { cwd: RAIZ })
    .filter((caminho) => !caminho.includes('__tests__'))
    .filter((caminho) => !caminho.endsWith('.test.ts'))
    .filter((caminho) => !caminho.endsWith('.test.tsx'));
}

function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('fonte única do watcher de localização', () => {
  it('só o hook chama Location.watchPositionAsync', () => {
    const infratores = arquivosDeProducao()
      .filter(
        (caminho) =>
          caminho !== FONTE_DO_WATCHER &&
          !EXCECOES_DO_WATCHER.includes(caminho),
      )
      .filter((caminho) =>
        /\bwatchPositionAsync\b/.test(
          semComentarios(readFileSync(join(RAIZ, caminho), 'utf8')),
        ),
      );

    expect(infratores).toEqual([]);
  });

  it('o hook realmente chama, para a guarda não passar por ausência', () => {
    const fonte = readFileSync(join(RAIZ, FONTE_DO_WATCHER), 'utf8');
    expect(fonte).toContain('Location.watchPositionAsync');
  });
});

describe('fonte única do pedido de permissão', () => {
  it('nenhum call site pede permissão direto à lib', () => {
    const infratores = arquivosDeProducao()
      .filter((caminho) => !EXCECOES_DAS_PERMISSOES.includes(caminho))
      .filter((caminho) =>
        /\brequest(Foreground|Background|Camera|MediaLibrary)PermissionsAsync\b/.test(
          semComentarios(readFileSync(join(RAIZ, caminho), 'utf8')),
        ),
      )
      // Os call sites legítimos passam a função a `pedirPermissao`, então
      // mencionam o nome. O que a guarda proíbe é consumir o `status` direto.
      .filter((caminho) => {
        const fonte = semComentarios(readFileSync(join(RAIZ, caminho), 'utf8'));
        // O `:` cobre a forma com alias — `const { status: permStatus }` —
        // que é exatamente a que `PreRouteChecklist` usa. Sem ele a guarda
        // teria um buraco do tamanho de um call site real.
        return /const\s*\{\s*status\s*[},:]/.test(fonte);
      });

    expect(infratores).toEqual([]);
  });

  it('permissoes.ts expõe a saída para as Configurações', () => {
    const fonte = readFileSync(join(RAIZ, FONTE_DAS_PERMISSOES), 'utf8');
    expect(fonte).toContain('export function abrirConfiguracoesDoApp');
    expect(fonte).toContain('canAskAgain');
  });
});
```

O `semComentarios` existe porque a Task 1 e a Task 2 documentam o defeito **citando os nomes das APIs** nos comentários de cabeçalho — sem tirar comentário, a guarda acusaria os próprios arquivos que a satisfazem. Este projeto já perdeu um CI por um `#480` em comentário lido como cor hexadecimal.

- [ ] **Step 2: Confirmar que `glob` está disponível**

Run: `node -e "require('glob'); console.log('ok')"`
Se falhar, troque `glob` por uma varredura recursiva com `readdirSync(..., { withFileTypes: true })` — não adicione dependência para isto.

- [ ] **Step 3: Rodar**

Run: `npx jest src/lib/__tests__/fonte-unica-localizacao.test.ts`
Expected: PASS.

Se falhar listando arquivos, **não** os adicione às exceções: é a guarda avisando que um call site das Tasks 3, 4 ou 6 ficou para trás. Exceção só para o que é diferente por natureza, com o motivo escrito.

- [ ] **Step 4: Verificar que a guarda morde**

Acrescente `Location.watchPositionAsync` numa linha de código de qualquer componente, rode de novo, confirme FAIL nomeando o arquivo, e desfaça. Uma guarda que nunca falhou não é uma guarda.

- [ ] **Step 5: Suíte inteira**

Run: `npm test`
Expected: 0 falhas.

- [ ] **Step 6: Commit**

```bash
git add src/lib/__tests__/fonte-unica-localizacao.test.ts
git commit -m "test: guarda de fonte unica para watcher de GPS e pedido de permissao"
```

---

## Verificação final (depois da Task 8)

Antes de abrir o PR:

1. `npm test` — 0 falhas.
2. `npm run type-check && npm run lint` — exit 0.
3. `grep -rn "watchPositionAsync" src/ app/ --include=*.ts --include=*.tsx | grep -v __tests__` — só `useLocationWatcher.ts` e o comentário do broadcast.
4. `grep -rn "canAskAgain" src/ app/ | wc -l` — maior que zero. Era **zero** antes deste trabalho.

O passe em aparelho Android fica com o gestor: negar a câmera duas vezes em uma entrega e confirmar que o botão leva às Configurações; abrir a navegação turn-by-turn em rota e confirmar que não há requisição OSRM por segundo. Nenhuma das quatro checagens acima vê isso.
