/**
 * useMotoristasForm — formulários de criar/editar motorista com Zod.
 *
 * A validação é do schema (motoristaSchema / motoristaEdicaoSchema): erro vai
 * para o campo (formState.errors), e o submit inválido não chama quem grava.
 * As utilidades de telefone NÃO são mockadas: a regra testada é a real.
 */

import { renderHook, act } from '@testing-library/react-native';

import { useMotoristasForm, valoresEdicaoDe } from '../useMotoristasForm';

const VALIDO = {
  nome: 'Carlos Eduardo',
  email: 'carlos@example.com',
  telefone: '(11) 99988-7766',
  senha: 'Abcdef1!',
};

/**
 * Lê o erro direto do estado do form: o `formState` é um proxy que só
 * re-renderiza o que foi lido no render, e o teste lê depois.
 */
function erroDe<C extends string>(
  form: { getFieldState: (nome: C) => { error?: { message?: string } } },
  campo: C,
) {
  return form.getFieldState(campo).error?.message;
}

async function submeterCriar(
  result: { current: ReturnType<typeof useMotoristasForm> },
  onValido: jest.Mock,
) {
  await act(async () => {
    await result.current.formCriar.handleSubmit(onValido)();
  });
}

describe('useMotoristasForm', () => {
  describe('criar', () => {
    it('começa vazio e sem erros', () => {
      const { result } = renderHook(() => useMotoristasForm());
      expect(result.current.formCriar.getValues()).toEqual({
        nome: '',
        email: '',
        telefone: '',
        senha: '',
      });
      expect(result.current.formCriar.formState.errors).toEqual({});
    });

    it('senha fraca não submete e o erro fica no campo senha', async () => {
      const { result } = renderHook(() => useMotoristasForm());
      act(() => {
        result.current.formCriar.reset({ ...VALIDO, senha: '123456' });
      });
      const onValido = jest.fn();

      await submeterCriar(result, onValido);

      expect(onValido).not.toHaveBeenCalled();
      expect(erroDe(result.current.formCriar, 'senha')).toBe(
        'Senha deve ter no mínimo 8 caracteres',
      );
    });

    it('e-mail inválido e telefone incompleto ficam nos seus campos', async () => {
      const { result } = renderHook(() => useMotoristasForm());
      act(() => {
        result.current.formCriar.reset({
          ...VALIDO,
          email: 'nao-e-email',
          telefone: '(11) 9998',
        });
      });
      const onValido = jest.fn();

      await submeterCriar(result, onValido);

      expect(onValido).not.toHaveBeenCalled();
      expect(erroDe(result.current.formCriar, 'email')).toBe('E-mail inválido');
      expect(erroDe(result.current.formCriar, 'telefone')).toBe(
        'Telefone deve ter 10 ou 11 dígitos',
      );
    });

    it('válido submete com o telefone mascarado como digitado', async () => {
      const { result } = renderHook(() => useMotoristasForm());
      act(() => {
        result.current.formCriar.reset(VALIDO);
      });
      const onValido = jest.fn();

      await submeterCriar(result, onValido);

      expect(onValido).toHaveBeenCalledWith(VALIDO, undefined);
    });

    it('telefone vazio é aceito (opcional)', async () => {
      const { result } = renderHook(() => useMotoristasForm());
      act(() => {
        result.current.formCriar.reset({ ...VALIDO, telefone: '' });
      });
      const onValido = jest.fn();

      await submeterCriar(result, onValido);

      expect(onValido).toHaveBeenCalled();
    });

    it('resetFormulario limpa valores e erros', async () => {
      const { result } = renderHook(() => useMotoristasForm());
      act(() => {
        result.current.formCriar.reset({ ...VALIDO, senha: '1' });
      });
      await submeterCriar(result, jest.fn());
      expect(erroDe(result.current.formCriar, 'senha')).toBeDefined();

      act(() => {
        result.current.resetFormulario();
      });

      expect(result.current.formCriar.getValues().nome).toBe('');
      expect(erroDe(result.current.formCriar, 'senha')).toBeUndefined();
    });
  });

  describe('editar', () => {
    it('prefillForm preenche nome e telefone (null vira "")', () => {
      const { result } = renderHook(() => useMotoristasForm());
      act(() => {
        result.current.prefillForm({ nome: 'João Silva', telefone: null });
      });
      expect(result.current.formEditar.getValues()).toEqual({
        nome: 'João Silva',
        telefone: '',
      });
    });

    it('submete sem senha e sem e-mail', async () => {
      const { result } = renderHook(() => useMotoristasForm());
      act(() => {
        result.current.prefillForm({
          nome: 'João Silva',
          telefone: '(11) 99988-7766',
        });
      });
      const onValido = jest.fn();

      await act(async () => {
        await result.current.formEditar.handleSubmit(onValido)();
      });

      expect(onValido).toHaveBeenCalledWith(
        { nome: 'João Silva', telefone: '(11) 99988-7766' },
        undefined,
      );
    });

    it('telefone inválido fica no campo e não submete', async () => {
      const { result } = renderHook(() => useMotoristasForm());
      act(() => {
        result.current.prefillForm({ nome: 'João Silva', telefone: '(11) 9' });
      });
      const onValido = jest.fn();

      await act(async () => {
        await result.current.formEditar.handleSubmit(onValido)();
      });

      expect(onValido).not.toHaveBeenCalled();
      expect(erroDe(result.current.formEditar, 'telefone')).toBeDefined();
    });
  });

  it('valoresEdicaoDe tolera telefone ausente', () => {
    expect(valoresEdicaoDe({ nome: 'Ana Maria' })).toEqual({
      nome: 'Ana Maria',
      telefone: '',
    });
  });
});
