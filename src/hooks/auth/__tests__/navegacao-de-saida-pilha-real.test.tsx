/**
 * N-1 (varredura de 07/11): a saída da conta leva ao login com a pilha LIMPA,
 * medida no expo-router de verdade (`renderRouter`), não num mock do router.
 *
 * `router.replace('/auth/login')` só troca a tela do topo da pilha raiz: o que
 * a conta abriu antes (gestor com telas empilhadas, Minha Unidade, abas do
 * motorista) seguia montado embaixo do login. Era isso que a `key` da pilha
 * raiz tentava apagar remontando tudo — e a remontagem caía na área antiga sem
 * sessão (`gestor/ajuda`, `motorista/(tabs)`) antes do replace (logs [P33] do
 * dev client, 07/11). A dona agora esvazia a pilha raiz e só então troca a
 * tela que sobrou pelo login.
 */
import fs from 'fs';
import path from 'path';

import { Stack, Tabs, router, useNavigationContainerRef } from 'expo-router';
import { act, renderRouter } from 'expo-router/testing-library';
import React, { useEffect } from 'react';
import { Text } from 'react-native';

import {
  PRAZO_FECHAR_MODAIS_MS,
  useNavegacaoDeSaida,
} from '../useNavegacaoDeSaida';

// O jest.setup troca o expo-router (e o que ele usa) por mocks; aqui vale o
// real. O babel-jest sobe os `jest.unmock` para antes dos imports.
jest.unmock('expo-router');
jest.unmock('react-native-safe-area-context');
jest.unmock('react-native/Libraries/EventEmitter/NativeEventEmitter');
jest.unmock('react-native/Libraries/Components/Keyboard/Keyboard');

// Sessão controlável: a troca re-renderiza quem lê (como o useAuth real).
const mockSessao = {
  user: { id: 'conta-a' } as { id: string } | null,
  ouvintes: new Set<() => void>(),
};
jest.mock('../../useAuth', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return {
    useAuth: () => {
      const user = useSyncExternalStore(
        (avisar: () => void) => {
          mockSessao.ouvintes.add(avisar);
          return () => mockSessao.ouvintes.delete(avisar);
        },
        () => mockSessao.user,
      );
      return { user, loading: false, usuarioOfflineId: null };
    },
  };
});

const montadas = new Map<string, number>();
function tela(nome: string) {
  return function Tela() {
    useEffect(() => {
      montadas.set(nome, (montadas.get(nome) ?? 0) + 1);
      return () => {
        montadas.set(nome, (montadas.get(nome) ?? 0) - 1);
      };
    }, []);
    return <Text>{nome}</Text>;
  };
}
const telasMontadas = () =>
  [...montadas.entries()].filter(([, n]) => n > 0).map(([nome]) => nome);

const OPCOES = { headerShown: false, animation: 'none' } as const;

let container: ReturnType<typeof useNavigationContainerRef> | null = null;
function LayoutRaiz() {
  useNavegacaoDeSaida();
  container = useNavigationContainerRef();
  return <Stack screenOptions={OPCOES} />;
}
const pilha = () => <Stack screenOptions={OPCOES} />;

const ROTAS = {
  _layout: LayoutRaiz,
  index: tela('index'),
  'auth/_layout': pilha,
  'auth/login': tela('auth/login'),
  'gestor/_layout': pilha,
  'gestor/ajuda': tela('gestor/ajuda'),
  'gestor/inicio': tela('gestor/inicio'),
  'gestor/motoristas': tela('gestor/motoristas'),
  'unidade/index': tela('unidade'),
  'motorista/_layout': pilha,
  'motorista/(tabs)/_layout': () => (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="paradas" />
    </Tabs>
  ),
  'motorista/(tabs)/index': tela('motorista/inicio'),
  'motorista/(tabs)/paradas': tela('motorista/paradas'),
  'motorista/resumo': tela('motorista/resumo'),
};

/**
 * Âncora declarada no layout real (`unstable_settings.anchor`; no expo-router
 * 58 o `initialRouteName` é obsoleto e avisa no console). Lida do texto para
 * não carregar o layout inteiro; falha se a âncora apontar para rota que não
 * existe na pasta.
 */
function ancoraDoLayout(area: 'gestor' | 'motorista'): string {
  const pasta = path.resolve(__dirname, '../../../../app', area);
  const fonte = fs.readFileSync(path.join(pasta, '_layout.tsx'), 'utf8');
  const achou = fonte.match(
    /export const unstable_settings = \{\s*anchor: '([^']+)'/,
  );
  if (!achou)
    throw new Error(`app/${area}/_layout.tsx sem unstable_settings.anchor`);
  const rota = achou[1];
  const existe =
    fs.existsSync(path.join(pasta, `${rota}.tsx`)) ||
    fs.existsSync(path.join(pasta, rota, '_layout.tsx'));
  if (!existe) throw new Error(`âncora '${rota}' não é rota de app/${area}`);
  return rota;
}

async function sairDaConta() {
  act(() => {
    mockSessao.user = null;
    mockSessao.ouvintes.forEach((avisar) => avisar());
  });
  // O renderRouter liga os fake timers do jest.
  act(() => {
    jest.advanceTimersByTime(PRAZO_FECHAR_MODAIS_MS);
  });
}

describe('navegação de saída sobre o expo-router real (N-1)', () => {
  beforeEach(() => {
    montadas.clear();
    mockSessao.user = { id: 'conta-a' };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('gestor com telas empilhadas nas duas pilhas: só o login fica montado', async () => {
    const r = await renderRouter(ROTAS, { initialUrl: '/gestor/inicio' });
    act(() => router.push('/unidade'));
    act(() => router.push('/gestor/inicio'));
    act(() => router.push('/gestor/motoristas'));
    expect(telasMontadas()).toEqual(
      expect.arrayContaining(['gestor/inicio', 'unidade', 'gestor/motoristas']),
    );

    await sairDaConta();

    expect(r.getPathname()).toBe('/auth/login');
    expect(telasMontadas()).toEqual(['auth/login']);
  });

  it('saída na Minha Unidade, sobre o gestor: o gestor não fica embaixo do login', async () => {
    const r = await renderRouter(ROTAS, { initialUrl: '/gestor/inicio' });
    act(() => router.push('/unidade'));

    await sairDaConta();

    expect(r.getPathname()).toBe('/auth/login');
    expect(telasMontadas()).toEqual(['auth/login']);
  });

  it('motorista nas abas com uma tela por cima: só o login fica montado', async () => {
    const r = await renderRouter(ROTAS, { initialUrl: '/motorista' });
    act(() => router.push('/motorista/resumo'));
    act(() => router.push('/unidade'));
    expect(telasMontadas()).toEqual(
      expect.arrayContaining([
        'motorista/inicio',
        'motorista/resumo',
        'unidade',
      ]),
    );

    await sairDaConta();

    expect(r.getPathname()).toBe('/auth/login');
    expect(telasMontadas()).toEqual(['auth/login']);
  });

  // C3 (cinto da N-1): a pilha do gestor que nasce sem tela-alvo (remontagem,
  // estado perdido) ia para a 1ª rota em ordem alfabética, `gestor/ajuda` —
  // o que os logs [P33] mostraram. A âncora do layout manda para a Início.
  // A âncora usada é a do arquivo real (ver `ancoraDoLayout`).
  it.each([
    ['gestor', false, '/gestor/ajuda'],
    ['gestor', true, '/gestor/inicio'],
    ['motorista', true, '/motorista'],
  ] as const)(
    'pilha do %s que nasce sem tela-alvo (âncora do app=%s) começa em %s',
    async (area, comAncora, esperado) => {
      const r = await renderRouter(
        {
          ...ROTAS,
          [`${area}/_layout`]: comAncora
            ? {
                default: pilha,
                unstable_settings: { anchor: ancoraDoLayout(area) },
              }
            : pilha,
        },
        { initialUrl: '/unidade' },
      );
      act(() => {
        const raiz = container?.getRootState();
        const pilhaRaiz = raiz?.routes[raiz.index]?.state;
        container?.dispatch({
          type: 'NAVIGATE',
          payload: { name: area },
          target: pilhaRaiz?.key,
        });
      });
      expect(r.getPathname()).toBe(esperado);
    },
  );

  it('pilha raiz com uma tela só: troca pelo login, sem ação sobrando', async () => {
    const r = await renderRouter(ROTAS, { initialUrl: '/gestor/inicio' });

    await sairDaConta();

    expect(r.getPathname()).toBe('/auth/login');
    expect(telasMontadas()).toEqual(['auth/login']);
  });
});
