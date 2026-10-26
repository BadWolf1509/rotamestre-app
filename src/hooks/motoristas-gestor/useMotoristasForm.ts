/**
 * Formulários de motorista do gestor (criar e editar).
 *
 * Encapsula o `useForm` + `zodResolver` para que a lista de Motoristas e o
 * perfil do motorista usem o MESMO schema e os mesmos valores iniciais:
 * criar com `motoristaSchema`, editar com `motoristaEdicaoSchema`. A tela só
 * liga os campos por `Controller` e mostra `formState.errors` inline.
 *
 * `raw: true` no resolver: o schema VALIDA, mas o submit recebe o valor como
 * digitado — o telefone continua mascarado "(11) 99999-8888", o formato que
 * a tela sempre gravou (o schema o reduziria a dígitos e mudaria o que vai
 * para o banco). Trim de nome/e-mail fica com quem grava.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { type z } from 'zod';

import {
  motoristaEdicaoSchema,
  motoristaSchema,
} from '@/lib/schemas/motorista';

type ValoresCriarMotorista = z.input<typeof motoristaSchema>;
type ValoresEditarMotorista = z.input<typeof motoristaEdicaoSchema>;

const VAZIO_CRIAR: ValoresCriarMotorista = {
  nome: '',
  email: '',
  telefone: '',
  senha: '',
};

const VAZIO_EDITAR: ValoresEditarMotorista = { nome: '', telefone: '' };

/** Formulário de criação (lista de Motoristas). */
export function useFormCriarMotorista(): UseFormReturn<ValoresCriarMotorista> {
  return useForm<ValoresCriarMotorista>({
    resolver: zodResolver(motoristaSchema, undefined, { raw: true }),
    defaultValues: VAZIO_CRIAR,
    mode: 'onTouched',
  });
}

/** Formulário de edição (lista de Motoristas e perfil do motorista). */
export function useFormEditarMotorista(): UseFormReturn<ValoresEditarMotorista> {
  return useForm<ValoresEditarMotorista>({
    resolver: zodResolver(motoristaEdicaoSchema, undefined, { raw: true }),
    defaultValues: VAZIO_EDITAR,
    mode: 'onTouched',
  });
}

/** Valores de edição a partir do motorista salvo (telefone pode vir null). */
export function valoresEdicaoDe(motorista: {
  nome: string;
  telefone?: string | null;
}): ValoresEditarMotorista {
  return { nome: motorista.nome, telefone: motorista.telefone ?? '' };
}

export interface UseMotoristasFormReturn {
  formCriar: UseFormReturn<ValoresCriarMotorista>;
  formEditar: UseFormReturn<ValoresEditarMotorista>;
  /** Limpa os dois formulários (valores e erros). */
  resetFormulario: () => void;
  /** Preenche a edição com o motorista escolhido. */
  prefillForm: (motorista: { nome: string; telefone?: string | null }) => void;
}

export function useMotoristasForm(): UseMotoristasFormReturn {
  const formCriar = useFormCriarMotorista();
  const formEditar = useFormEditarMotorista();
  const { reset: resetCriar } = formCriar;
  const { reset: resetEditar } = formEditar;

  const resetFormulario = useCallback(() => {
    resetCriar(VAZIO_CRIAR);
    resetEditar(VAZIO_EDITAR);
  }, [resetCriar, resetEditar]);

  const prefillForm = useCallback(
    (motorista: { nome: string; telefone?: string | null }) => {
      resetEditar(valoresEdicaoDe(motorista));
    },
    [resetEditar],
  );

  return { formCriar, formEditar, resetFormulario, prefillForm };
}
