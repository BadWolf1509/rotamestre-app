/**
 * useExclusaoDeRota — fluxo único de exclusão (Início desktop e Gestão de
 * Rotas). O Dialog é um stub que expõe título, mensagem e `visible`.
 */
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import { Alert, Platform } from 'react-native';

import {
  bancoFalso,
  resetarBancoFalso,
} from '@/__tests__/helpers/bancoFalsoRotas';

import { useExclusaoDeRota, type RotaParaExcluir } from '../useExclusaoDeRota';

jest.mock(
  '@/lib/supabase',
  () => require('@/__tests__/helpers/bancoFalsoRotas').moduloSupabaseFalso,
);
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock('@/design-system', () => ({
  Dialog: ({
    visible,
    title,
    message,
    onConfirm,
  }: {
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }) => {
    const { Text, TouchableOpacity, View } = require('react-native');
    return (
      <View testID={visible ? 'dialogo-aberto' : 'dialogo-fechado'}>
        <Text testID="titulo">{title}</Text>
        <Text testID="mensagem">{message}</Text>
        <TouchableOpacity testID="confirmar" onPress={onConfirm}>
          <Text>Confirmar</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.spyOn(Alert, 'alert');

const plataformaOriginal = Platform.OS;
const concluida: RotaParaExcluir = {
  id: 'r-conc',
  status: 'concluida',
  motorista_nome: 'Bia',
  total_paradas: 2,
};
const pendente: RotaParaExcluir = {
  id: 'r-pend',
  status: 'pendente',
  motorista_nome: 'Caio',
  total_paradas: 1,
};

beforeEach(() => {
  (Alert.alert as jest.Mock).mockClear();
  Platform.OS = 'web';
  resetarBancoFalso([
    {
      id: 'r-conc',
      status: 'concluida',
      data: '2026-10-21',
      motorista_id: 'm2',
    },
    {
      id: 'r-pend',
      status: 'pendente',
      data: '2026-10-23',
      motorista_id: 'm3',
    },
  ]);
});
afterAll(() => {
  Platform.OS = plataformaOriginal;
});

function montar() {
  const showToast = jest.fn();
  const aoExcluir = jest.fn();
  const hook = renderHook(() =>
    useExclusaoDeRota({ showToast, usuarioId: 'g1', aoExcluir }),
  );
  const tela = () => render(<>{hook.result.current.dialogo}</>);
  return { ...hook, showToast, aoExcluir, tela };
}

describe('useExclusaoDeRota', () => {
  it('o título do diálogo não muda ao confirmar (fica até a próxima pergunta)', async () => {
    const { result, tela } = montar();
    act(() => result.current.pedirExclusao(concluida));
    const { getByTestId, rerender } = tela();
    expect(getByTestId('titulo').props.children).toBe(
      'Excluir rota concluída?',
    );
    expect(getByTestId('dialogo-aberto')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('confirmar'));
    });
    rerender(<>{result.current.dialogo}</>);

    // Fechou, mas o texto é o da rota concluída (e não volta a "Excluir Rota").
    expect(getByTestId('dialogo-fechado')).toBeTruthy();
    expect(getByTestId('titulo').props.children).toBe(
      'Excluir rota concluída?',
    );
  });

  it('em andamento: avisa pelo toast e não abre o diálogo', () => {
    const { result, showToast, tela } = montar();
    act(() =>
      result.current.pedirExclusao({ ...pendente, status: 'em_andamento' }),
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/em andamento/),
      'error',
      5000,
    );
    expect(tela().getByTestId('dialogo-fechado')).toBeTruthy();
  });

  it('confirmar apaga a rota, avisa e chama aoExcluir', async () => {
    const { result, showToast, aoExcluir, tela } = montar();
    act(() => result.current.pedirExclusao(pendente));
    const { getByTestId } = tela();

    await act(async () => {
      fireEvent.press(getByTestId('confirmar'));
    });

    await waitFor(() => expect(aoExcluir).toHaveBeenCalledTimes(1));
    expect(bancoFalso.rotas.some((r) => r.id === 'r-pend')).toBe(false);
    expect(showToast).toHaveBeenCalledWith(
      'Rota excluída com sucesso!',
      'success',
    );
  });

  it('em andamento no nativo: Alert de ação não permitida', () => {
    Platform.OS = 'android';
    const { result } = montar();
    act(() =>
      result.current.pedirExclusao({ ...pendente, status: 'em_andamento' }),
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Ação não permitida',
      expect.stringMatching(/em andamento/),
    );
  });

  it('nativo: pede confirmação por Alert, e Excluir apaga', async () => {
    Platform.OS = 'android';
    const { result, aoExcluir } = montar();
    act(() => result.current.pedirExclusao(pendente));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Excluir Rota',
      expect.stringContaining('Tem certeza que deseja excluir esta rota?'),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancelar' }),
        expect.objectContaining({ text: 'Excluir', style: 'destructive' }),
      ]),
    );
    const botoes = (Alert.alert as jest.Mock).mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    await act(async () => {
      botoes.find((b) => b.text === 'Excluir')?.onPress?.();
    });
    await waitFor(() => expect(aoExcluir).toHaveBeenCalled());
    expect(bancoFalso.rotas.some((r) => r.id === 'r-pend')).toBe(false);
  });

  it('cancelar fecha o diálogo sem apagar', () => {
    const { result, aoExcluir, tela } = montar();
    act(() => result.current.pedirExclusao(pendente));
    const { getByTestId, rerender } = tela();
    expect(getByTestId('dialogo-aberto')).toBeTruthy();

    act(() => result.current.dialogo.props.onCancel());
    rerender(<>{result.current.dialogo}</>);

    expect(getByTestId('dialogo-fechado')).toBeTruthy();
    expect(aoExcluir).not.toHaveBeenCalled();
    expect(bancoFalso.rotas.some((r) => r.id === 'r-pend')).toBe(true);
  });

  it('concluída: apaga e grava o log rota_excluida (a FK exige o log antes do DELETE)', async () => {
    const { result, tela } = montar();
    act(() => result.current.pedirExclusao(concluida));
    const { getByTestId } = tela();

    await act(async () => {
      fireEvent.press(getByTestId('confirmar'));
    });

    await waitFor(() =>
      expect(bancoFalso.rotas.some((r) => r.id === 'r-conc')).toBe(false),
    );
    expect(bancoFalso.logs).toEqual([
      expect.objectContaining({
        evento: 'rota_excluida',
        usuario_id: 'g1',
        detalhes: expect.objectContaining({
          rota_id: 'r-conc',
          status_anterior: 'concluida',
        }),
      }),
    ]);
  });

  it('a tela mostra pendente mas o servidor já iniciou: não apaga, explica e recarrega', async () => {
    resetarBancoFalso([
      {
        id: 'r-pend',
        status: 'em_andamento',
        data: '2026-10-23',
        motorista_id: null,
      },
    ]);
    const { result, showToast, aoExcluir, tela } = montar();
    act(() => result.current.pedirExclusao(pendente));
    const { getByTestId } = tela();

    await act(async () => {
      fireEvent.press(getByTestId('confirmar'));
    });

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringMatching(/em andamento/),
        'error',
        5000,
      ),
    );
    expect(bancoFalso.rotas.some((r) => r.id === 'r-pend')).toBe(true);
    expect(bancoFalso.logs).toHaveLength(0);
    expect(aoExcluir).toHaveBeenCalled();
  });

  it('sem usuário: recusa com aviso de autenticação', async () => {
    const showToast = jest.fn();
    const { result } = renderHook(() =>
      useExclusaoDeRota({
        showToast,
        usuarioId: undefined,
        aoExcluir: jest.fn(),
      }),
    );
    act(() => result.current.pedirExclusao(pendente));
    await act(async () => {
      result.current.dialogo.props.onConfirm();
    });
    expect(showToast).toHaveBeenCalledWith(
      'Erro de autenticação. Faça login novamente.',
      'error',
    );
    expect(bancoFalso.rotas.some((r) => r.id === 'r-pend')).toBe(true);
  });
});
