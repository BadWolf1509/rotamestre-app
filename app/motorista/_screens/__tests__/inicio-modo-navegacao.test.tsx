/**
 * Concluir e pular a partir do MODO NAVEGAÇÃO precisam abrir os modais.
 *
 * POR QUE EXISTE. Com o modo navegação ligado, a Início fazia um `return` só
 * com o `<NavigationMode>` — e o `<StopCompletionFlow>` (foto do comprovante)
 * e o `<SkipReasonModal>` moram no OUTRO ramo. "Concluir" e "Pular" dentro da
 * navegação mudavam o estado para "modal aberto" e nada aparecia: o modal só
 * surgia quando o motorista saía da navegação, fora de contexto, muitas vezes
 * já longe do cliente. O modo ficou alcançável na 1.12.6 (#495), e o efeito
 * em produção foi o de entregas concluídas sem foto.
 *
 * Os componentes visuais viram stubs; o `useInicioModals` é o REAL, porque é
 * o estado dele — aberto, mas sem quem o desenhe — que está em jogo.
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useRestaurarConclusaoEmVoo } from '@/hooks/motorista/useRestaurarConclusaoEmVoo';

import MotoristaInicio from '../inicio';

const PARADA = {
  id: 'parada-1',
  ordem: 1,
  status: 'em_andamento',
  endereco: 'Rua A, 1',
  latitude: -7.1,
  longitude: -34.8,
  is_checkpoint: true,
};

// Cenário da rota por teste (prefixo `mock` libera o uso dentro do jest.mock).
let mockParadas: Array<typeof PARADA> = [PARADA];
let mockCurrentStop: typeof PARADA = PARADA;
const mockSkipStop = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
jest.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({
    showWarning: jest.fn(),
    showSuccess: (...a: unknown[]) => mockShowSuccess(...a),
    showError: (...a: unknown[]) => mockShowError(...a),
    AlertDialog: () => null,
  }),
}));

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    routeStatus: 'active',
    route: { id: 'rota-1', status: 'em_andamento', unidade_id: 'u-1' },
    paradas: mockParadas,
    currentStop: mockCurrentStop,
    nextStop: null,
    progress: { completed: 0, total: 1 },
    pendingRoutesCount: 0,
    refreshRoute: jest.fn(),
    startRoute: jest.fn(),
    completeStop: jest.fn(),
    skipStop: (...a: unknown[]) => mockSkipStop(...a),
    completeRoute: jest.fn(),
  }),
}));

let mockNavegarCom: 'mapa' | 'externo' = 'mapa';
jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: {
    getNavigationPreferences: jest.fn(() =>
      Promise.resolve({ navegarCom: mockNavegarCom }),
    ),
  },
}));

const mockAbrirNavegacao = jest.fn();
jest.mock('@/lib/navigation', () => ({
  abrirNavegacao: (...a: unknown[]) => mockAbrirNavegacao(...a),
}));

jest.mock('@/components/motorista/NavigationMode', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    NavigationMode: (props: {
      onComplete: () => void;
      onSkip: () => void;
      onExit: () => void;
    }) => (
      <>
        <T>modo-navegacao</T>
        <P onPress={props.onComplete}>
          <T>nav-concluir</T>
        </P>
        <P onPress={props.onSkip}>
          <T>nav-pular</T>
        </P>
        <P onPress={props.onExit}>
          <T>nav-sair</T>
        </P>
      </>
    ),
  };
});

jest.mock('@/components/motorista/StopCompletionFlow', () => {
  const { Text: T } = jest.requireActual('react-native');
  return {
    StopCompletionFlow: (props: {
      visible: boolean;
      parada: { id: string } | null;
      contexto?: string | null;
    }) =>
      props.visible && props.parada ? (
        <>
          <T>{`fluxo-conclusao:${props.parada.id}`}</T>
          <T>{`contexto:${props.contexto ?? ''}`}</T>
        </>
      ) : null,
  };
});

jest.mock('@/components/motorista/SkipReasonModal', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    SkipReasonModal: (props: {
      parada: { id: string };
      outrosServicosNoLocal?: Array<{ id: string }>;
      onConfirm: (m: string, o?: string, incluir?: boolean) => void;
    }) => (
      <>
        <T>{`modal-pular:${props.parada.id}`}</T>
        <T>{`outros:${(props.outrosServicosNoLocal ?? []).map((p) => p.id).join(',')}`}</T>
        <P onPress={() => props.onConfirm('cliente_ausente', undefined, true)}>
          <T>confirmar-com-outros</T>
        </P>
        <P onPress={() => props.onConfirm('cliente_ausente', undefined, false)}>
          <T>confirmar-sem-outros</T>
        </P>
      </>
    ),
  };
});

jest.mock('@/components/motorista/home/MainCard', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    MainCard: (props: { onPress: () => void }) => (
      <P onPress={props.onPress}>
        <T>navegar</T>
      </P>
    ),
  };
});

// Stubs sem papel no teste.
jest.mock('@/components/motorista/home/MiniMap', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    MiniMap: (props: { onOpenPiP?: () => void }) => (
      <P onPress={props.onOpenPiP}>
        <T>abrir-mapa-flutuante</T>
      </P>
    ),
  };
});
jest.mock('@/components/motorista/home/QuickActions', () => ({
  FloatingActionButton: () => null,
}));
jest.mock('@/components/motorista/home/StartRouteButton', () => ({
  StartRouteButton: () => null,
}));
jest.mock('@/components/motorista/home/StatusSection', () => ({
  StatusSection: () => null,
}));
jest.mock('@/components/motorista/OptimizationAlert', () => ({
  OptimizationAlert: () => null,
}));
jest.mock('@/components/motorista/PictureInPictureMap', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    PictureInPictureMap: (props: { visible: boolean; onExpand: () => void }) =>
      props.visible ? (
        <P onPress={props.onExpand}>
          <T>pip-abrir-navegacao-completa</T>
        </P>
      ) : null,
  };
});
jest.mock('@/components/IncidentReportWizard', () => ({
  IncidentReportWizard: () => null,
}));
jest.mock('@/components/SwipeOnboarding', () => ({
  SwipeOnboarding: () => null,
  hasSeenSwipeOnboarding: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/design-system', () => ({
  Dialog: () => null,
  SupportModal: () => null,
}));
jest.mock('@/hooks/useDriverLocationBroadcast', () => ({
  useDriverLocationBroadcast: jest.fn(),
}));
jest.mock('@/hooks/motorista/useRestaurarConclusaoEmVoo', () => ({
  useRestaurarConclusaoEmVoo: jest.fn(),
}));
jest.mock('@/hooks/motorista/useRestaurarRascunhoIncidente', () => ({
  useRestaurarRascunhoIncidente: jest.fn(),
}));
jest.mock('@/hooks/useRevalidarPermissaoDeLocalizacao', () => ({
  useRevalidarPermissaoDeLocalizacao: jest.fn(),
}));
jest.mock('@/hooks/useLocationWatcher', () => ({
  useLocationWatcher: jest.fn(),
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'motorista-1', nome: 'Teste' } }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted', canAskAgain: true }),
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted', canAskAgain: true }),
  Accuracy: { Balanced: 3, High: 4 },
}));

async function entrarNoModoNavegacao(
  getByText: (t: string) => unknown,
  findByText: (t: string) => Promise<unknown>,
) {
  fireEvent.press(getByText('navegar') as never);
  await findByText('modo-navegacao');
}

describe('Início do motorista — ações dentro do modo navegação', () => {
  it('"Concluir" abre o fluxo de conclusão com foto', async () => {
    const { getByText, findByText } = render(<MotoristaInicio />);
    await entrarNoModoNavegacao(getByText, findByText);

    fireEvent.press(getByText('nav-concluir'));

    await waitFor(() => {
      expect(getByText('fluxo-conclusao:parada-1')).toBeTruthy();
    });
  });

  it('"Pular" abre o modal de motivo', async () => {
    const { getByText, findByText } = render(<MotoristaInicio />);
    await entrarNoModoNavegacao(getByText, findByText);

    fireEvent.press(getByText('nav-pular'));

    await waitFor(() => {
      expect(getByText('modal-pular:parada-1')).toBeTruthy();
    });
  });
});

/**
 * O "Abrir navegação completa" do mapa flutuante (mini-mapa → "Abrir mapa
 * flutuante" → expandir) é outra porta para o modo navegação. Até 03/10/2026
 * ela ligava o modo SEM consultar o "Navegar com": o motorista que o
 * desligou (a contenção pedida na 1.12.6, cuja chegada concluía a parada sem
 * foto) ainda caía no modo por aqui. A decisão tem de ser a mesma do
 * "Navegar" — e mora num lugar só.
 */
describe('Início do motorista — mapa flutuante respeita o "Navegar com"', () => {
  beforeEach(() => {
    mockAbrirNavegacao.mockClear();
  });

  afterEach(() => {
    mockNavegarCom = 'mapa';
  });

  async function abrirNavegacaoCompletaPeloMapaFlutuante(
    getByText: (t: string) => unknown,
    findByText: (t: string) => Promise<unknown>,
  ) {
    fireEvent.press(getByText('abrir-mapa-flutuante') as never);
    fireEvent.press(
      (await findByText('pip-abrir-navegacao-completa')) as never,
    );
  }

  it('externo: abre o app externo e NÃO entra no modo navegação', async () => {
    mockNavegarCom = 'externo';
    const { getByText, findByText, queryByText } = render(<MotoristaInicio />);

    await abrirNavegacaoCompletaPeloMapaFlutuante(getByText, findByText);

    await waitFor(() => {
      expect(mockAbrirNavegacao).toHaveBeenCalledWith(
        expect.objectContaining({ endereco: 'Rua A, 1' }),
      );
    });
    expect(queryByText('modo-navegacao')).toBeNull();
  });

  it('mapa: entra no modo navegação', async () => {
    mockNavegarCom = 'mapa';
    const { getByText, findByText } = render(<MotoristaInicio />);

    await abrirNavegacaoCompletaPeloMapaFlutuante(getByText, findByText);

    expect(await findByText('modo-navegacao')).toBeTruthy();
    expect(mockAbrirNavegacao).not.toHaveBeenCalled();
  });

  it('externo pelo botão Navegar: abre o app externo', async () => {
    mockNavegarCom = 'externo';
    const { getByText, queryByText } = render(<MotoristaInicio />);

    fireEvent.press(getByText('navegar'));

    await waitFor(() => {
      expect(mockAbrirNavegacao).toHaveBeenCalledWith(
        expect.objectContaining({ endereco: 'Rua A, 1' }),
      );
    });
    expect(queryByText('modo-navegacao')).toBeNull();
  });
});

/**
 * Com cabeçalho e abas visíveis, o mapa da navegação ficava com ~30% da tela
 * e o motorista podia trocar de aba no meio da rota (análise de 03/10/2026).
 */
describe('Início do motorista — modo navegação em tela cheia', () => {
  const { NavegacaoTelaCheiaContext } = jest.requireActual(
    '@/context/NavegacaoTelaCheiaContext',
  );

  function renderComTelaCheia(setTelaCheia: jest.Mock) {
    return render(
      <NavegacaoTelaCheiaContext.Provider value={{ setTelaCheia }}>
        <MotoristaInicio />
      </NavegacaoTelaCheiaContext.Provider>,
    );
  }

  it('esconde cabeçalho e abas ao entrar e devolve ao sair', async () => {
    const setTelaCheia = jest.fn();
    const { getByText, findByText } = renderComTelaCheia(setTelaCheia);

    await entrarNoModoNavegacao(getByText, findByText);
    await waitFor(() => expect(setTelaCheia).toHaveBeenLastCalledWith(true));

    fireEvent.press(getByText('nav-sair'));
    await waitFor(() => expect(setTelaCheia).toHaveBeenLastCalledWith(false));
  });

  it('devolve cabeçalho e abas se a tela desmontar em navegação', async () => {
    const setTelaCheia = jest.fn();
    const { getByText, findByText, unmount } = renderComTelaCheia(setTelaCheia);

    await entrarNoModoNavegacao(getByText, findByText);
    unmount();

    expect(setTelaCheia).toHaveBeenLastCalledWith(false);
  });
});

/**
 * Entrega e retirada no mesmo ponto são UMA visita: quem acabou de resolver a
 * entrega já está no local, então "Navegar" para a retirada mandaria o
 * motorista navegar até 0 m. O toque abre o comprovante da retirada.
 */
describe('Início do motorista — visita no mesmo local', () => {
  const entrega = {
    ...PARADA,
    id: 'entrega',
    ordem: 3,
    status: 'concluida',
    tipo: 'entrega',
  };
  const retirada = {
    ...PARADA,
    id: 'retirada',
    ordem: 4,
    status: 'pendente',
    tipo: 'retirada',
  };

  beforeEach(() => {
    mockAbrirNavegacao.mockClear();
  });

  afterEach(() => {
    mockNavegarCom = 'mapa';
    mockParadas = [PARADA];
    mockCurrentStop = PARADA;
  });

  it('abre o comprovante da retirada, sem navegar nem entrar no modo', async () => {
    mockNavegarCom = 'externo';
    mockParadas = [entrega, retirada];
    mockCurrentStop = retirada;
    const { getByText, findByText, queryByText } = render(<MotoristaInicio />);

    fireEvent.press(getByText('navegar'));

    expect(await findByText('fluxo-conclusao:retirada')).toBeTruthy();
    expect(mockAbrirNavegacao).not.toHaveBeenCalled();
    expect(queryByText('modo-navegacao')).toBeNull();
  });

  it('o atalho vale também com "Navegar com" = mapa', async () => {
    mockNavegarCom = 'mapa';
    mockParadas = [entrega, retirada];
    mockCurrentStop = retirada;
    const { getByText, findByText, queryByText } = render(<MotoristaInicio />);

    fireEvent.press(getByText('navegar'));

    expect(await findByText('fluxo-conclusao:retirada')).toBeTruthy();
    expect(queryByText('modo-navegacao')).toBeNull();
  });

  it('anterior a 40 m: segue o caminho normal ("Navegar com" decide)', async () => {
    mockNavegarCom = 'externo';
    mockParadas = [{ ...entrega, latitude: -7.1 + 0.00036 }, retirada];
    mockCurrentStop = retirada;
    const { getByText, queryByText } = render(<MotoristaInicio />);

    fireEvent.press(getByText('navegar'));

    await waitFor(() => expect(mockAbrirNavegacao).toHaveBeenCalledTimes(1));
    expect(queryByText('fluxo-conclusao:retirada')).toBeNull();
  });
});

describe('Início do motorista — restauração após a câmera', () => {
  const entrega = {
    ...PARADA,
    id: 'entrega',
    ordem: 3,
    status: 'em_andamento',
    tipo: 'entrega',
  };
  const retirada = {
    ...PARADA,
    id: 'retirada',
    ordem: 4,
    status: 'pendente',
    tipo: 'retirada',
  };

  afterEach(() => {
    mockParadas = [PARADA];
    mockCurrentStop = PARADA;
  });

  it('reabre a conclusão pela sequência do local, com o aviso dos demais serviços', async () => {
    mockParadas = [entrega, retirada];
    mockCurrentStop = entrega;
    const restaurar = useRestaurarConclusaoEmVoo as jest.Mock;
    restaurar.mockClear();
    const { findByText } = render(<MotoristaInicio />);

    const aoRestaurar = restaurar.mock.calls.at(-1)?.[2] as (
      p: typeof entrega,
    ) => void;
    act(() => aoRestaurar(entrega));

    expect(await findByText('fluxo-conclusao:entrega')).toBeTruthy();
    expect(
      await findByText('contexto:Mais 1 serviço neste local: Retirada'),
    ).toBeTruthy();
  });
});

/**
 * Cliente ausente vale para o local, não para o serviço: quem pula a entrega
 * porque ninguém atendeu não tem o que retirar ali. O modal oferece pular os
 * outros serviços da visita de uma vez; cada um segue uma linha em `paradas`.
 */
describe('Início do motorista — pular os serviços do local juntos', () => {
  const entrega = {
    ...PARADA,
    id: 'entrega',
    ordem: 3,
    status: 'em_andamento',
    tipo: 'entrega',
  };
  const retirada = {
    ...PARADA,
    id: 'retirada',
    ordem: 4,
    status: 'pendente',
    tipo: 'retirada',
  };

  beforeEach(() => {
    mockSkipStop.mockReset();
    mockSkipStop.mockResolvedValue(undefined);
    mockParadas = [entrega, retirada];
    mockCurrentStop = entrega;
  });

  afterEach(() => {
    mockParadas = [PARADA];
    mockCurrentStop = PARADA;
  });

  async function abrirModalDePular(
    getByText: (t: string) => unknown,
    findByText: (t: string) => Promise<unknown>,
  ) {
    await entrarNoModoNavegacao(getByText, findByText);
    fireEvent.press(getByText('nav-pular') as never);
    await findByText('modal-pular:entrega');
  }

  it('entrega ao modal os outros serviços do mesmo local', async () => {
    const { getByText, findByText } = render(<MotoristaInicio />);
    await abrirModalDePular(getByText, findByText);

    expect(getByText('outros:retirada')).toBeTruthy();
  });

  it('com incluirOutros, pula a parada e depois os outros, com o mesmo motivo', async () => {
    const { getByText, findByText } = render(<MotoristaInicio />);
    await abrirModalDePular(getByText, findByText);

    fireEvent.press(getByText('confirmar-com-outros'));

    await waitFor(() => expect(mockSkipStop).toHaveBeenCalledTimes(2));
    expect(mockSkipStop).toHaveBeenNthCalledWith(
      1,
      'entrega',
      'cliente_ausente',
      undefined,
    );
    expect(mockSkipStop).toHaveBeenNthCalledWith(
      2,
      'retirada',
      'cliente_ausente',
      undefined,
    );
  });

  it('avisa no plural quando pula mais de uma parada', async () => {
    mockShowSuccess.mockClear();
    const { getByText, findByText } = render(<MotoristaInicio />);
    await abrirModalDePular(getByText, findByText);

    fireEvent.press(getByText('confirmar-com-outros'));

    await waitFor(() =>
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'Paradas Puladas',
        expect.any(String),
      ),
    );
  });

  it('avisa no singular quando pula só uma parada', async () => {
    mockShowSuccess.mockClear();
    const { getByText, findByText } = render(<MotoristaInicio />);
    await abrirModalDePular(getByText, findByText);

    fireEvent.press(getByText('confirmar-sem-outros'));

    await waitFor(() =>
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'Parada Pulada',
        expect.any(String),
      ),
    );
  });

  it('sem incluirOutros, pula só a parada', async () => {
    const { getByText, findByText } = render(<MotoristaInicio />);
    await abrirModalDePular(getByText, findByText);

    fireEvent.press(getByText('confirmar-sem-outros'));

    await waitFor(() => expect(mockSkipStop).toHaveBeenCalledTimes(1));
    expect(mockSkipStop).toHaveBeenCalledWith(
      'entrega',
      'cliente_ausente',
      undefined,
    );
  });

  it('se o primeiro pulo falha, não tenta os outros', async () => {
    mockSkipStop.mockRejectedValueOnce(new Error('falhou'));
    const { getByText, findByText } = render(<MotoristaInicio />);
    await abrirModalDePular(getByText, findByText);

    fireEvent.press(getByText('confirmar-com-outros'));

    await waitFor(() => expect(mockSkipStop).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockSkipStop).toHaveBeenCalledTimes(1);
  });

  // Erro genérico depois de um pulo parcial deixava o motorista sem saber se
  // a entrega tinha ido: refazia tudo ou deixava a retirada para trás.
  it('falha parcial diz qual serviço foi pulado e qual falhou', async () => {
    mockShowError.mockClear();
    mockShowSuccess.mockClear();
    mockSkipStop
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('falhou'));
    const { getByText, findByText } = render(<MotoristaInicio />);
    await abrirModalDePular(getByText, findByText);

    fireEvent.press(getByText('confirmar-com-outros'));

    await waitFor(() => expect(mockShowError).toHaveBeenCalledTimes(1));
    const [aviso] = mockShowError.mock.calls[0];
    expect(aviso.title).toBe('Pulo incompleto');
    expect(aviso.message).toContain('Pulada: Entrega (parada 3).');
    expect(aviso.message).toContain('Não foi pulada: Retirada (parada 4).');
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });

  it('falha ao pular um serviço só segue com o erro traduzido', async () => {
    mockShowError.mockClear();
    const erro = new Error('falhou');
    mockSkipStop.mockRejectedValueOnce(erro);
    const { getByText, findByText } = render(<MotoristaInicio />);
    await abrirModalDePular(getByText, findByText);

    fireEvent.press(getByText('confirmar-sem-outros'));

    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith(erro));
  });
});
