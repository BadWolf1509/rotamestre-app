import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';

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

// Quem está logado, disparando a transferência. O gate de is_gestor_principal
// em transferir.tsx:168 exige is_gestor_principal:true; unidade_id precisa
// bater com o p_unidade_id esperado pela RPC no teste de caminho feliz.
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

jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: GESTOR_PRINCIPAL, loading: false }),
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
});
