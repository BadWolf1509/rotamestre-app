/**
 * Loja ativa compartilhada (DP-3/G13).
 *
 * Antes cada chamada de `useUnidadeAtiva` tinha o seu estado: a troca de loja
 * num lugar não valia nos outros (o cabeçalho trocava e a tela seguia na loja
 * velha), e cada instância consultava as vinculações de novo.
 */
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { UnidadeAtivaProvider, useUnidadeAtiva } from '../useUnidadeAtiva';

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
}));

let mockUserData: { id: string; unidade_id: string; papel: string } | null;
jest.mock('../useUser', () => ({
  useUser: () => ({ userData: mockUserData, refresh: jest.fn() }),
}));

const mockEmitProfileUpdate = jest.fn();
jest.mock('@/lib/profileEvents', () => ({
  emitProfileUpdate: () => mockEmitProfileUpdate(),
  onProfileUpdate: () => () => {},
}));

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  isSupabaseConfigured: true,
}));

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

function vinculo(usuario: string, unidade: string, papel = 'gestor') {
  return {
    id: `${usuario}-${unidade}`,
    usuario_id: usuario,
    unidade_id: unidade,
    papel,
    is_principal: unidade.endsWith('1'),
    ativo: true,
    created_at: '2026-01-01',
    unidades: { id: unidade, nome: `Loja ${unidade}` },
  };
}

const vinculosPorUsuario: Record<string, unknown[]> = {
  g1: [vinculo('g1', 'loja-1'), vinculo('g1', 'loja-2')],
  g2: [vinculo('g2', 'loja-9')],
};

let consultasDeVinculos = 0;

beforeEach(() => {
  jest.clearAllMocks();
  consultasDeVinculos = 0;
  mockUserData = { id: 'g1', unidade_id: 'loja-1', papel: 'gestor' };
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockFrom.mockImplementation((tabela: string) => {
    if (tabela === 'usuarios') {
      return {
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    }
    let usuario = '';
    const consulta = {
      select: () => consulta,
      eq: (coluna: string, valor: string) => {
        if (coluna === 'usuario_id') usuario = valor;
        return consulta;
      },
      order: () => consulta,
      returns: () => {
        consultasDeVinculos += 1;
        return Promise.resolve({
          data: vinculosPorUsuario[usuario] ?? [],
          error: null,
        });
      },
    };
    return consulta;
  });
});

function Leitor({ id }: { id: string }) {
  const { unidadeAtiva } = useUnidadeAtiva();
  return <Text testID={id}>{unidadeAtiva ?? 'nenhuma'}</Text>;
}

let trocar: (id: string) => Promise<void> = async () => {};
function Trocador() {
  const { trocarUnidade } = useUnidadeAtiva();
  trocar = trocarUnidade;
  return null;
}

describe('UnidadeAtivaProvider', () => {
  it('a troca de loja num lugar vale em todos, com uma consulta só', async () => {
    const tela = render(
      <UnidadeAtivaProvider>
        <Trocador />
        <Leitor id="cabecalho" />
        <Leitor id="tela" />
      </UnidadeAtivaProvider>,
    );
    await waitFor(() =>
      expect(tela.getByTestId('tela').props.children).toBe('loja-1'),
    );
    expect(consultasDeVinculos).toBe(1);

    await act(async () => {
      await trocar('loja-2');
    });

    expect(tela.getByTestId('cabecalho').props.children).toBe('loja-2');
    expect(tela.getByTestId('tela').props.children).toBe('loja-2');
    // Todas as instâncias de useUser recarregam (numa consulta só).
    expect(mockEmitProfileUpdate).toHaveBeenCalledTimes(1);
  });

  it('o valor do contexto é estável entre renders sem mudança', async () => {
    const valores: unknown[] = [];
    function Coletor() {
      valores.push(useUnidadeAtiva());
      return null;
    }
    const { rerender } = render(
      <UnidadeAtivaProvider>
        <Coletor />
      </UnidadeAtivaProvider>,
    );
    await waitFor(() =>
      expect(
        (valores[valores.length - 1] as { loading: boolean }).loading,
      ).toBe(false),
    );
    const antes = valores[valores.length - 1];
    rerender(
      <UnidadeAtivaProvider>
        <Coletor />
      </UnidadeAtivaProvider>,
    );
    expect(valores[valores.length - 1]).toBe(antes);
  });

  it('troca de conta zera a loja da anterior antes de carregar a nova', async () => {
    const vistas: (string | null)[] = [];
    function Espia() {
      vistas.push(useUnidadeAtiva().unidadeAtiva);
      return null;
    }
    const arvore = () => (
      <UnidadeAtivaProvider>
        <Espia />
      </UnidadeAtivaProvider>
    );
    const { rerender } = render(arvore());
    await waitFor(() => expect(vistas[vistas.length - 1]).toBe('loja-1'));

    vistas.length = 0;
    mockUserData = { id: 'g2', unidade_id: 'loja-9', papel: 'gestor' };
    rerender(arvore());
    await waitFor(() => expect(vistas[vistas.length - 1]).toBe('loja-9'));

    // Nenhum render da conta nova com a loja da conta anterior.
    expect(vistas).not.toContain('loja-1');
  });

  it('sem provider, falha alto em vez de devolver um estado próprio', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useUnidadeAtiva())).toThrow(
      /UnidadeAtivaProvider/,
    );
  });
});
