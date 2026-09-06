import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';

import { getErrorMessage } from '@/lib/errorMapping';
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
const GESTORES_ELEGIVEIS = [
  {
    id: 'gestor-2',
    nome: 'Gestor Dois',
    email: 'gestor.dois@exemplo.com',
    created_at: '2026-08-01T00:00:00Z',
  },
];

// jest.fn() em vez do valor fixo direto: o teste do portão (abaixo) precisa
// sobrescrever is_gestor_principal para false só naquele caso, sem afetar os
// demais. Mesmo padrão já usado neste arquivo para `supabase.rpc`
// (mockSupabase.rpc = mockRpc, reatribuído em beforeEach).
const mockUseUser = jest.fn();

jest.mock('@/hooks/useUser', () => ({
  useUser: () => mockUseUser(),
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

// loadGestoresElegiveis encadeia select().eq().eq().eq().eq().order() —
// mockReturnThis() em select/eq deixa o número de encadeamentos livre para
// mudar sem quebrar o teste (mesmo padrão de app/unidade/__tests__/index.test.tsx).
//
// `update` também precisa responder: antes da Task 5, handleConfirmTransfer
// ainda chama supabase.from('usuarios').update(...).eq(...) diretamente (duas
// vezes). Sem um mock funcional aqui, essa chamada quebraria com "update is
// not a function", e o catch acabaria chamando showError por um motivo que
// nada tem a ver com a RPC — um RED que passa pela razão errada. Resolvendo
// com sucesso, o código antigo segue até showSuccess, e o teste falha (RED)
// pelo motivo certo: a RPC nunca foi consultada.
function usuariosQueryBuilder() {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest
      .fn()
      .mockResolvedValue({ data: GESTORES_ELEGIVEIS, error: null }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
  };
}

const mockRpc = jest.fn();

describe('TransferirGestaoScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUser.mockReturnValue({ userData: GESTOR_PRINCIPAL, loading: false });
    (mockSupabase.from as jest.Mock).mockImplementation(() =>
      usuariosQueryBuilder(),
    );
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
});
