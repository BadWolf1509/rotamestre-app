import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';

import { getErrorMessage } from '@/lib/errorMapping';
import type { MembroDaEquipe } from '@/lib/gestor/equipeDaLoja';
import { supabase } from '@/lib/supabase';

import TransferirGestaoScreen from '../transferir';

jest.mock('@/lib/supabase');

// Acesso ao mock global de useAlert (registrado em jest.setup.js).
declare global {
  var mockUseAlert: {
    showAlert: jest.Mock;
    showSuccess: jest.Mock;
    showWarning: jest.Mock;
    showError: jest.Mock;
    showConfirm: jest.Mock;
    showDestructive: jest.Mock;
    hideAlert: jest.Mock;
    isVisible: boolean;
    AlertDialog: null;
  };
}

const mockShowSuccess = global.mockUseAlert.showSuccess;
const mockShowError = global.mockUseAlert.showError;

// Quem está logado, disparando a transferência. O gate que bloqueia quem não
// é gestor principal (checa userData?.is_gestor_principal antes de montar o
// resto da tela) exige is_gestor_principal:true; unidade_id precisa bater com
// o p_unidade_id esperado pela RPC no teste de caminho feliz.
const GESTOR_PRINCIPAL = {
  id: 'gestor-1',
  nome: 'Gestor Um',
  unidade_id: 'unidade-1',
  is_gestor_principal: true,
  foto_url: null,
};

// Alvo da transferência, devolvido por loadGestoresElegiveis(). O id precisa
// bater com o p_novo_gestor_id esperado pela RPC no teste de caminho feliz.
const membro = (
  id: string,
  nome: string,
  extra: Partial<MembroDaEquipe> = {},
): MembroDaEquipe => ({
  id,
  nome,
  email: `${id}@exemplo.com`,
  papel: 'gestor',
  is_gestor_principal: false,
  ativo: true,
  slot_na_loja: true,
  created_at: '2026-08-01T00:00:00Z',
  foto_url: null,
  ...extra,
});

const GESTORES_ELEGIVEIS = [membro('gestor-2', 'Gestor Dois')];

// A equipe vem de carregarEquipeDaLoja (fonte única da Equipe); a tela só
// filtra quem a RPC aceita como destinatário.
const mockCarregarEquipe = jest.fn();
jest.mock('@/lib/gestor/equipeDaLoja', () => ({
  ...jest.requireActual('@/lib/gestor/equipeDaLoja'),
  carregarEquipeDaLoja: (...args: unknown[]) => mockCarregarEquipe(...args),
}));

// jest.fn() em vez do valor fixo direto: o teste do portão (abaixo) precisa
// sobrescrever is_gestor_principal para false só naquele caso, sem afetar os
// demais. Mesmo padrão já usado neste arquivo para `supabase.rpc`
// (mockSupabase.rpc = mockRpc, reatribuído em beforeEach).
const mockUseUser = jest.fn();

jest.mock('@/hooks/useUser', () => ({
  useUser: () => mockUseUser(),
}));

// Loja aberta no seletor (B-DB-2): a tela segue ela, não a coluna legada
// usuarios.unidade_id.
let mockUnidadeAtiva: string | null = 'unidade-1';
let mockLojaCarregando = false;
jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({
    unidadeAtiva: mockUnidadeAtiva,
    unidadeAtivaData: mockUnidadeAtiva
      ? { id: mockUnidadeAtiva, nome: `Loja ${mockUnidadeAtiva}` }
      : null,
    loading: mockLojaCarregando,
  }),
}));

// Força o branch mobile: mesmo motivo de
// app/unidade/__tests__/{index,equipe}.test.tsx — o branch desktop monta
// DesktopPageLayout por completo.
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: 375,
    height: 812,
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    isMobileOrTablet: true,
    isTabletOrDesktop: false,
    isWeb: true,
    isNative: false,
    breakpoint: 'mobile',
    orientation: 'portrait',
  }),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const mockRpc = jest.fn();

describe('TransferirGestaoScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnidadeAtiva = 'unidade-1';
    mockLojaCarregando = false;
    mockUseUser.mockReturnValue({ userData: GESTOR_PRINCIPAL, loading: false });
    mockCarregarEquipe.mockResolvedValue(GESTORES_ELEGIVEIS);
    mockSupabase.rpc = mockRpc;
  });

  it('mostra erro quando a RPC recusa a transferência', async () => {
    mockRpc.mockResolvedValue({
      error: {
        message: 'Só o gestor principal da unidade pode transferir a gestão',
      },
    });

    render(<TransferirGestaoScreen />);

    // Chegar até a confirmação: selecionar o gestor destino primeiro.
    fireEvent.press(await screen.findByText('Gestor Dois'));
    fireEvent.changeText(
      screen.getByPlaceholderText('TRANSFERIR'),
      'TRANSFERIR',
    );
    fireEvent.press(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalled();
    });
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });

  it('chama a RPC com a unidade e o gestor destino', async () => {
    mockRpc.mockResolvedValue({ error: null });

    render(<TransferirGestaoScreen />);
    fireEvent.press(await screen.findByText('Gestor Dois'));
    fireEvent.changeText(
      screen.getByPlaceholderText('TRANSFERIR'),
      'TRANSFERIR',
    );
    fireEvent.press(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('transferir_gestao_principal', {
        p_unidade_id: 'unidade-1',
        p_novo_gestor_id: 'gestor-2',
      });
    });
  });

  // Correção 1 (fix round 1): handleConfirmTransfer trocava qualquer erro da
  // RPC por uma mensagem genérica fixa ("Não foi possível transferir a
  // gestão..."), inclusive quando a RPC já recusa com uma frase de negócio
  // específica e acionável. `useAlert` é mockado globalmente em
  // jest.setup.js (showError é um jest.fn() sem lógica), então não dá para
  // observar o texto renderizado — o teste aplica a MESMA função real de
  // src/lib/errorMapping.ts sobre o argumento capturado, provando as duas
  // metades do conserto ao mesmo tempo: (a) transferir.tsx repassa o erro
  // bruto da RPC para showError, em vez de um objeto genérico fixo, e (b)
  // errorMapping.ts reconhece essa frase específica em vez de cair no
  // DEFAULT_ERROR. Se qualquer uma das duas metades faltar, este teste falha.
  it('mostra a mensagem específica da RPC — não a genérica — quando o destinatário deixou de ser elegível', async () => {
    const mensagemRpc = 'O destinatário precisa ser gestor ativo desta unidade';
    mockRpc.mockResolvedValue({ error: { message: mensagemRpc } });

    render(<TransferirGestaoScreen />);
    fireEvent.press(await screen.findByText('Gestor Dois'));
    fireEvent.changeText(
      screen.getByPlaceholderText('TRANSFERIR'),
      'TRANSFERIR',
    );
    fireEvent.press(screen.getByText('Confirmar'));

    await waitFor(() => expect(mockShowError).toHaveBeenCalled());

    const erroRecebido = mockShowError.mock.calls[0][0];
    const mensagemGenerica = getErrorMessage(
      new Error('erro tecnico sem padrao cadastrado'),
    ).message;

    expect(getErrorMessage(erroRecebido).message).toBe(mensagemRpc);
    expect(getErrorMessage(erroRecebido).message).not.toBe(mensagemGenerica);
  });

  // Correção 2 (fix round 1): hoje NENHUM dos 16 usuários no banco tem
  // is_gestor_principal = true (ver task-5-report.md, seção Preocupações) —
  // ou seja, todo gestor real que abrir esta tela cai neste portão. Ele
  // nunca tinha teste.
  // B-DB-2: gestor de duas lojas, principal só da A (o flag vale no slot
  // legado usuarios.unidade_id), com a B aberta no seletor. A tela mostrava
  // a A (lista e RPC da loja legada); a RPC só aceita o principal da própria
  // loja, então na B a tela tem de bloquear, sem consultar a equipe.
  it('com outra loja aberta no seletor, bloqueia: o principal é da loja legada', async () => {
    mockUnidadeAtiva = 'unidade-2';

    render(<TransferirGestaoScreen />);

    expect(
      await screen.findByText(
        'Apenas o gestor principal pode transferir a gestão.',
      ),
    ).toBeTruthy();
    expect(mockCarregarEquipe).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('lista os gestores da loja aberta no seletor, pela equipe da loja', async () => {
    render(<TransferirGestaoScreen />);
    await screen.findByText('Gestor Dois');

    expect(mockCarregarEquipe).toHaveBeenCalledWith('unidade-1');
    expect(screen.getByText('Loja unidade-1')).toBeTruthy();
  });

  it('oferece só gestor ativo, que não é o principal e que a RPC aceita', async () => {
    mockCarregarEquipe.mockResolvedValue([
      membro('g-ok', 'Gestor Elegivel'),
      membro('m-1', 'Motorista Um', { papel: 'motorista' }),
      membro('g-inativo', 'Gestor Inativo', { ativo: false }),
      membro('g-principal', 'Gestor Principal', { is_gestor_principal: true }),
      // Vínculo ativo na loja, mas o slot legado aponta para outra: a RPC
      // recusaria ("precisa ser gestor ativo desta unidade").
      membro('g-outro-slot', 'Gestor Outro Slot', { slot_na_loja: false }),
    ]);

    render(<TransferirGestaoScreen />);
    await screen.findByText('Gestor Elegivel');

    expect(screen.queryByText('Motorista Um')).toBeNull();
    expect(screen.queryByText('Gestor Inativo')).toBeNull();
    expect(screen.queryByText('Gestor Principal')).toBeNull();
    expect(screen.queryByText('Gestor Outro Slot')).toBeNull();
  });

  it('com duas cargas em voo (loja A depois B), a que chega por último não vence: vale a da loja aberta', async () => {
    const resolvers: Record<string, (v: MembroDaEquipe[]) => void> = {};
    mockCarregarEquipe.mockImplementation(
      (loja: string) =>
        new Promise<MembroDaEquipe[]>((resolve) => {
          resolvers[loja] = resolve;
        }),
    );
    // O mesmo usuário é principal nas duas lojas para o teste (o slot legado
    // é um só; o que se prova aqui é a ordem de chegada das respostas).
    mockUseUser.mockReturnValue({ userData: GESTOR_PRINCIPAL, loading: false });
    mockUnidadeAtiva = 'unidade-1';
    const { rerender } = render(<TransferirGestaoScreen />);
    await waitFor(() => expect(resolvers['unidade-1']).toBeDefined());

    mockUseUser.mockReturnValue({
      userData: { ...GESTOR_PRINCIPAL, unidade_id: 'unidade-2' },
      loading: false,
    });
    mockUnidadeAtiva = 'unidade-2';
    rerender(<TransferirGestaoScreen />);
    await waitFor(() => expect(resolvers['unidade-2']).toBeDefined());

    await act(async () => {
      resolvers['unidade-2']([membro('gestor-b', 'Gestor da B')]);
    });
    await act(async () => {
      resolvers['unidade-1']([membro('gestor-a', 'Gestor da A')]);
    });

    expect(await screen.findByText('Gestor da B')).toBeTruthy();
    expect(screen.queryByText('Gestor da A')).toBeNull();
  });

  it('bloqueia quem não é gestor principal, sem chamar a RPC ou os alertas', async () => {
    mockUseUser.mockReturnValue({
      userData: { ...GESTOR_PRINCIPAL, is_gestor_principal: false },
      loading: false,
    });

    render(<TransferirGestaoScreen />);

    expect(
      await screen.findByText(
        'Apenas o gestor principal pode transferir a gestão.',
      ),
    ).toBeTruthy();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockShowSuccess).not.toHaveBeenCalled();
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('com a loja ativa ainda carregando, mostra o carregamento e não o bloqueio', () => {
    // Sem loja resolvida, o principal parecia não ser principal desta loja e
    // a tela afirmava "Apenas o gestor principal..." antes de a loja chegar.
    mockUnidadeAtiva = null;
    mockLojaCarregando = true;
    render(<TransferirGestaoScreen />);

    expect(screen.getByText('Carregando gestores...')).toBeTruthy();
    expect(
      screen.queryByText('Apenas o gestor principal pode transferir a gestão.'),
    ).toBeNull();
  });
});
