import {
  render,
  waitFor,
  fireEvent,
  screen,
} from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';

import UnidadeScreen from '../index';

jest.mock('@/lib/supabase');

// A tela lê o usuário via useUser() — mockado para fixar um gestor com
// unidade vinculada. `is_gestor_principal: false` é deliberado: é o cenário
// real de todos os 9 gestores hoje e é o que a regressão do Step 1 cobre
// (o gate antigo escondia o botão de edição para todos eles).
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    userData: {
      id: 'usuario-1',
      papel: 'gestor',
      unidade_id: 'unidade-1',
      nome: 'Gestora Teste',
      foto_url: null,
      is_gestor_principal: false,
    },
    loading: false,
  }),
}));

// Força o branch mobile: os seletores abaixo (texto 'Salvar', botão
// '✏️ Editar Informações') só existem nesse branch — o desktop usa
// 'Salvar alterações' dentro de `actions` do DesktopPageLayout.
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

// Unidade usada por `loadUnidade()` (supabase.from('unidades')...). nome
// precisa vir preenchido: handleSave bloqueia o salvamento antes de chegar
// na RPC quando o campo está vazio. sede_endereco null é o cenário "unidade
// sem sede cadastrada" usado no teste de preservação.
const UNIDADE_MOCK = {
  id: 'unidade-1',
  nome: 'Unidade Teste',
  cnpj: '12345678000199',
  telefone: '11999998888',
  endereco: 'Rua Um, 100',
  cidade: 'São Paulo',
  uf: 'SP',
  cep: '01000-000',
  sede_endereco: null,
};

function unidadesQueryBuilder() {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: UNIDADE_MOCK, error: null }),
  };
}

// loadMembrosCount encerra a cadeia em .eq() (select com count:'exact',
// head:true não usa .single()) — o builder precisa resolver aqui, não
// encadear mais.
function usuariosQueryBuilder() {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ count: 3, error: null }),
  };
}

/**
 * Seletores reais da tela (confirmados em app/unidade/index.tsx):
 *   entrar em edição → texto '✏️ Editar Informações' (l. 455)
 *   salvar           → texto 'Salvar'                (l. 370)
 *   telefone         → placeholder '(00) 00000-0000' (l. 262)
 *   nome             → placeholder 'Nome da unidade' (l. 239)
 */
async function entrarEmEdicao() {
  fireEvent.press(await screen.findByText('✏️ Editar Informações'));
}

async function salvar() {
  fireEvent.press(await screen.findByText('Salvar'));
}

describe('tela Minha Unidade', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // O automock de '@/lib/supabase' não vem com .from() parametrizado por
    // tabela. Sem isto, loadUnidade()/loadMembrosCount() lançam "Cannot
    // read properties of undefined" ao encadear .select(), caem no catch,
    // e `nome` nunca é preenchido — handleSave bloquearia antes da RPC e
    // `mockSupabase.rpc` nunca seria chamado em nenhum dos testes abaixo.
    (mockSupabase.from as jest.Mock).mockImplementation((table: string) =>
      table === 'unidades' ? unidadesQueryBuilder() : usuariosQueryBuilder(),
    );
  });

  it('mostra o botão de editar para gestor (hoje some para todos)', async () => {
    render(<UnidadeScreen />);

    // Regressão: o gate era `is_gestor_principal`, false para os 9 gestores.
    expect(await screen.findByText('✏️ Editar Informações')).toBeTruthy();
  });

  it('envia à RPC apenas os campos editáveis — nunca os comerciais', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });

    render(<UnidadeScreen />);
    await entrarEmEdicao();
    fireEvent.changeText(
      screen.getByPlaceholderText('(00) 00000-0000'),
      '11988887777',
    );
    await salvar();

    await waitFor(() => expect(mockSupabase.rpc).toHaveBeenCalled());
    const payload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];

    // Estas colunas não têm caminho pela RPC. Se alguém as acrescentar ao
    // payload, a proteção estrutural vira teatro.
    expect(payload).not.toHaveProperty('p_plano');
    expect(payload).not.toHaveProperty('p_status');
    expect(payload).not.toHaveProperty('p_asaas_customer_id');
    expect(payload).not.toHaveProperty('p_desconto_percentual');
    expect(payload).not.toHaveProperty('p_observacoes_admin');
  });

  it('NÃO exibe sucesso quando a RPC falha', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'SEM_PERMISSAO', code: '42501' },
    });

    render(<UnidadeScreen />);
    await entrarEmEdicao();
    await salvar();

    // O bug desta spec: antes, 0 linhas afetadas virava "sucesso".
    await waitFor(() => expect(mockSupabase.rpc).toHaveBeenCalled());
    expect(screen.queryByText(/atualizados com sucesso/i)).toBeNull();
  });

  it('não envia a sede quando o campo não foi editado', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });

    render(<UnidadeScreen />);
    await entrarEmEdicao();
    fireEvent.changeText(
      screen.getByPlaceholderText('(00) 00000-0000'),
      '11977776666',
    );
    await salvar();

    await waitFor(() => expect(mockSupabase.rpc).toHaveBeenCalled());
    const payload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];

    // Nulos fazem a RPC preservar a sede. Enviar string vazia a apagaria.
    expect(payload.p_sede_latitude).toBeNull();
    expect(payload.p_sede_longitude).toBeNull();
  });
});
