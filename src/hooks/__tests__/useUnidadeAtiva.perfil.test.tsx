/**
 * O provider da loja ativa acompanha o perfil (revisão da tarefa 7, C1).
 *
 * O `UnidadeAtivaProvider` mora na raiz e nunca desmonta. A instância de
 * `useUser` dele buscava o perfil uma vez: no cadastro, "sem linha" (o perfil
 * só nasce na RPC do onboarding). Depois do onboarding, o gestor entrava no
 * painel com `unidadeAtiva = null` em todas as telas até recarregar o app,
 * porque nenhuma mudança de perfil chegava à instância da raiz.
 *
 * Aqui `useUser` e o provider são os de verdade; só a rede é falsa.
 */
import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { useCriarUnidade } from '../onboarding/useCriarUnidade';
import { UnidadeAtivaProvider, useUnidadeAtiva } from '../useUnidadeAtiva';
import { useUser } from '../useUser';

jest.mock('../useAuth', () => ({
  useAuth: () => ({ user: { id: 'g-novo' }, loading: false }),
}));
jest.mock('@/lib/auth/sessao', () => ({
  exigirSessaoDe: async () => {},
}));
jest.mock('@/lib/auth/perfilConhecido', () => ({
  gravarPerfilConhecido: async () => {},
  apagarPerfilConhecido: async () => {},
  lerPerfilConhecido: async () => null,
}));
jest.mock('@/lib/notifications', () => ({
  initializePushNotifications: async () => {},
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

/** O que a tabela `usuarios` tem para a conta (null = antes do onboarding). */
let mockPerfilNoBanco: Record<string, unknown> | null = null;
let mockConsultasDePerfil = 0;
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (tabela: string) => {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        order: () => consulta,
        update: () => consulta,
        maybeSingle: () => {
          mockConsultasDePerfil += 1;
          return Promise.resolve({
            data: mockPerfilNoBanco,
            error: null,
            status: 200,
          });
        },
        returns: () => {
          return Promise.resolve({
            data: mockPerfilNoBanco
              ? [
                  {
                    id: 'v1',
                    usuario_id: 'g-novo',
                    unidade_id: 'loja-nova',
                    papel: 'gestor',
                    is_principal: true,
                    ativo: true,
                    created_at: '2026-10-24',
                    unidades: { id: 'loja-nova', nome: 'Loja Nova' },
                  },
                ]
              : [],
            error: null,
          });
        },
      };
      void tabela;
      return consulta;
    },
  },
}));

const PERFIL = {
  id: 'g-novo',
  nome: 'Gestora Nova',
  papel: 'gestor',
  unidade_id: 'loja-nova',
  ativo: true,
};

function Leitor() {
  const { unidadeAtiva } = useUnidadeAtiva();
  return <Text testID="loja">{unidadeAtiva ?? 'nenhuma'}</Text>;
}

beforeEach(async () => {
  mockPerfilNoBanco = null;
  mockConsultasDePerfil = 0;
  mockRpc.mockReset();
  await require('@/lib/cache').clearAllCache();
});

describe('UnidadeAtivaProvider acompanha o perfil', () => {
  it('perfil que nasce depois: a busca de outra instância chega ao provider (classe)', async () => {
    let mostrarTela: (v: boolean) => void = () => {};
    function TelaDoGestor() {
      useUser(); // como o useRequireAuth do GestorLayout, que monta depois
      return null;
    }
    function Raiz() {
      const [tela, setTela] = React.useState(false);
      mostrarTela = setTela;
      return (
        <UnidadeAtivaProvider>
          <Leitor />
          {tela ? <TelaDoGestor /> : null}
        </UnidadeAtivaProvider>
      );
    }
    const arvore = render(<Raiz />);
    await waitFor(() => expect(mockConsultasDePerfil).toBe(1));
    expect(arvore.getByTestId('loja').props.children).toBe('nenhuma');

    // O perfil passa a existir no banco (por qualquer caminho) e uma tela
    // nova busca o perfil: o provider, que já estava montado, acompanha.
    mockPerfilNoBanco = PERFIL;
    act(() => mostrarTela(true));

    await waitFor(() =>
      expect(arvore.getByTestId('loja').props.children).toBe('loja-nova'),
    );
  });

  it('o fim do onboarding avisa as instâncias: a loja aparece sem recarregar o app', async () => {
    let criar: ReturnType<typeof useCriarUnidade>['criarUnidade'] = async () => ({
      ok: true,
    });
    function Onboarding() {
      criar = useCriarUnidade().criarUnidade;
      return null;
    }
    const arvore = render(
      <UnidadeAtivaProvider>
        <Leitor />
        <Onboarding />
      </UnidadeAtivaProvider>,
    );
    await waitFor(() => expect(mockConsultasDePerfil).toBe(1));

    mockRpc.mockImplementation(async () => {
      mockPerfilNoBanco = PERFIL;
      return { error: null };
    });
    await act(async () => {
      await criar({
        gestorNome: 'Gestora Nova',
        unidadeNome: 'Loja Nova',
        cidade: 'Recife',
        uf: 'PE',
        endereco: 'Rua A, 1',
        latitude: -8,
        longitude: -34.9,
      });
    });

    await waitFor(() =>
      expect(arvore.getByTestId('loja').props.children).toBe('loja-nova'),
    );
  });
});
