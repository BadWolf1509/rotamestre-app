import {
  render,
  waitFor,
  fireEvent,
  screen,
} from '@testing-library/react-native';

import { googlePlacesService } from '@/lib/googlePlaces';
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

// Stub de AddressAutocomplete: só o onChangeText de um TextInput comum, sem
// o debounce/geocoding do componente real (mesmo padrão de
// app/onboarding/__tests__/criar-unidade.test.tsx). Sem isto, digitar no
// campo de sede agenda o setTimeout real de 1000ms de
// src/components/AddressAutocomplete.tsx, que sobrevive ao fim do teste.
// Contador de montagens: o prefixo `mock` é o que permite referenciá-lo de
// dentro da factory do jest.mock.
const mockMontagensAutocomplete = { total: 0 };

jest.mock('@/components/AddressAutocomplete', () => {
  const ReactActual = require('react');
  const { TextInput, Text } = require('react-native');
  return {
    AddressAutocomplete: ({
      value,
      onChangeText,
      onSelectAddress,
      placeholder,
    }: any) => {
      ReactActual.useEffect(() => {
        mockMontagensAutocomplete.total += 1;
      }, []);

      return ReactActual.createElement(
        ReactActual.Fragment,
        null,
        ReactActual.createElement(TextInput, {
          testID: 'mock-sede-input',
          placeholder,
          value,
          onChangeText,
        }),
        // Dispara o mesmo contrato do componente real ao escolher uma
        // sugestão: (endereço, place_id, coordenadas) — ver
        // src/components/AddressAutocomplete.tsx:290.
        ReactActual.createElement(
          Text,
          {
            testID: 'mock-selecionar-sugestao',
            onPress: () =>
              onSelectAddress?.(
                'Av. Epitácio Pessoa, 100 - Tambaú, João Pessoa - PB',
                'place-joao-pessoa',
                { latitude: -7.1195, longitude: -34.8331 },
              ),
          },
          'selecionar sugestão',
        ),
        // Sugestão vinda do ViaCEP: place_id sintético, não resolvível pelo
        // Places (src/lib/viacep.ts:176).
        ReactActual.createElement(
          Text,
          {
            testID: 'mock-selecionar-sugestao-cep',
            onPress: () =>
              onSelectAddress?.(
                'Rua Exemplo, Centro, João Pessoa, PB',
                'cep_58068504',
                { latitude: -7.1195, longitude: -34.8331 },
              ),
          },
          'selecionar sugestão de CEP',
        ),
      );
    },
  };
});

// O auto-preenchimento busca os componentes estruturados do endereço. Sem o
// mock, a tela tentaria alcançar a Edge Function real.
jest.mock('@/lib/googlePlaces', () => ({
  googlePlacesService: {
    getPlaceDetails: jest.fn(),
  },
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
 *   entrar em edição → texto '✏️ Editar Informações'
 *   salvar           → texto 'Salvar'
 *   telefone         → placeholder '(00) 00000-0000'
 *   nome             → placeholder 'Nome da unidade'
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

  it('bloqueia o salvamento quando o texto da sede muda mas nenhuma sugestão é selecionada', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });

    render(<UnidadeScreen />);
    await entrarEmEdicao();
    fireEvent.changeText(
      screen.getByTestId('mock-sede-input'),
      'Av. Epitácio Pessoa, 100',
    );
    await salvar();

    // Sem coordenadas, a RPC ignoraria a sede em silêncio (v_atualiza_sede
    // = false) e o resto do formulário salvaria normalmente — o toast de
    // sucesso esconderia que a sede antiga continua valendo.
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(screen.queryByText(/atualizados com sucesso/i)).toBeNull();
    expect(global.mockUseAlert.showWarning).toHaveBeenCalled();
  });

  it('avisa no próprio campo que a sede precisa ser confirmada, sem esperar o submit', async () => {
    render(<UnidadeScreen />);
    await entrarEmEdicao();
    fireEvent.changeText(
      screen.getByTestId('mock-sede-input'),
      'Av. Epitácio Pessoa, 100',
    );

    // Antes, a exigência só aparecia como erro depois de tentar salvar.
    expect(
      await screen.findByText(/Escolha uma das opções sugeridas/i),
    ).toBeTruthy();
  });

  it('preenche endereço, cidade, UF e CEP a partir da sede escolhida', async () => {
    // O bug: dava para mudar a sede para João Pessoa e sair com o CEP da
    // Av. Paulista no cadastro, sem nenhum aviso.
    (googlePlacesService.getPlaceDetails as jest.Mock).mockResolvedValue({
      logradouro: 'Avenida Epitácio Pessoa',
      numero: '100',
      bairro: 'Tambaú',
      cidade: 'João Pessoa',
      // A Edge Function extrai com `longText`, então vem por extenso.
      estado: 'Paraíba',
      cep: '58039000',
      coordenadas: { latitude: -7.1195, longitude: -34.8331 },
      formatted_address: 'Av. Epitácio Pessoa, 100 - João Pessoa - PB',
    });

    render(<UnidadeScreen />);
    await entrarEmEdicao();
    fireEvent.press(screen.getByTestId('mock-selecionar-sugestao'));

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Cidade').props.value).toBe(
        'João Pessoa',
      ),
    );
    expect(screen.getByPlaceholderText('00000-000').props.value).toBe(
      '58039-000',
    );
    expect(
      screen.getByPlaceholderText('Rua, número, complemento').props.value,
    ).toBe('Avenida Epitácio Pessoa, 100');
    // "Paraíba" no campo de UF (maxLength 2) seria truncado para "Pa".
    expect(screen.getByPlaceholderText('UF').props.value).toBe('PB');
  });

  it('não quebra o preenchimento da sede quando o place details falha', async () => {
    (googlePlacesService.getPlaceDetails as jest.Mock).mockRejectedValue(
      new Error('rede indisponível'),
    );

    render(<UnidadeScreen />);
    await entrarEmEdicao();
    fireEvent.press(screen.getByTestId('mock-selecionar-sugestao'));

    // A sede é o que importa: ela vem das coordenadas da própria seleção.
    await waitFor(() =>
      expect(screen.getByTestId('mock-sede-input').props.value).toContain(
        'Epitácio Pessoa',
      ),
    );
    expect(screen.getByPlaceholderText('Cidade').props.value).toBe('São Paulo');
  });

  it('não remonta o autocomplete a cada tecla digitada na sede', async () => {
    render(<UnidadeScreen />);
    await entrarEmEdicao();
    const montagensAposEntrarEmEdicao = mockMontagensAutocomplete.total;

    fireEvent.changeText(screen.getByTestId('mock-sede-input'), 'Av');
    fireEvent.changeText(screen.getByTestId('mock-sede-input'), 'Av. E');
    fireEvent.changeText(screen.getByTestId('mock-sede-input'), 'Av. Epi');

    // Regressão da causa raiz: com o formulário declarado como componente
    // dentro do render, cada tecla dava um TIPO novo ao React e remontava a
    // subárvore. Isso zerava o `hasUserInteracted` do AddressAutocomplete
    // (src/components/AddressAutocomplete.tsx:135) e limpava o debounce — a
    // busca de sugestões nunca rodava e o campo perdia o foco a cada letra.
    // Sem sugestão não há coordenadas, e sem coordenadas a sede não salva.
    expect(mockMontagensAutocomplete.total).toBe(montagensAposEntrarEmEdicao);
  });

  it('não consulta o Places para sugestão vinda do ViaCEP', async () => {
    render(<UnidadeScreen />);
    await entrarEmEdicao();
    fireEvent.press(screen.getByTestId('mock-selecionar-sugestao-cep'));

    // O place_id `cep_...` é sintético: a chamada só voltaria vazia.
    await waitFor(() =>
      expect(screen.getByTestId('mock-sede-input').props.value).toContain(
        'Rua Exemplo',
      ),
    );
    expect(googlePlacesService.getPlaceDetails).not.toHaveBeenCalled();
  });

  it('mostra a sede também fora do modo edição', async () => {
    render(<UnidadeScreen />);

    // UNIDADE_MOCK.sede_endereco é null: sem sede cadastrada o campo tem que
    // aparecer mesmo assim, dizendo que está vazio. Antes ele simplesmente
    // não existia fora da edição.
    expect(
      await screen.findByPlaceholderText('Nenhuma sede cadastrada'),
    ).toBeTruthy();
  });

  it('formata o CEP enquanto o gestor digita', async () => {
    render(<UnidadeScreen />);
    await entrarEmEdicao();
    fireEvent.changeText(screen.getByPlaceholderText('00000-000'), '58039000');

    await waitFor(() =>
      expect(screen.getByPlaceholderText('00000-000').props.value).toBe(
        '58039-000',
      ),
    );
  });
});
