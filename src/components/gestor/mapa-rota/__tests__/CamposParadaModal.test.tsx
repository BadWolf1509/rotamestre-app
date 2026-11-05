import { render } from '@testing-library/react-native';
import React from 'react';
import { useForm } from 'react-hook-form';

import type { ParadaModalFormData } from '@/lib/schemas/parada';

import { CamposParadaModal } from '../CamposParadaModal';

import type { CamposParadaModalProps } from '../CamposParadaModal';

jest.mock('@/components/AddressAutocomplete', () => {
  const { Text } = require('react-native');
  return {
    AddressAutocomplete: ({ value }: { value: string }) => (
      <Text>autocomplete:{value}</Text>
    ),
  };
});

function Tela(
  props: Partial<CamposParadaModalProps> &
    Pick<CamposParadaModalProps, 'rotuloEndereco' | 'rotuloObservacoes'>,
) {
  const { control, formState } = useForm<ParadaModalFormData>({
    defaultValues: {
      endereco: 'Rua A, 1',
      tipo: 'entrega',
      destinatario: '',
      telefone: '',
      observacoes: '',
    },
  });
  return (
    <CamposParadaModal
      control={control}
      errors={formState.errors}
      isDesktop={false}
      handleAddressChange={jest.fn()}
      handleAddressSelect={jest.fn()}
      handlePhoneChange={jest.fn()}
      {...props}
    />
  );
}

describe('CamposParadaModal (R-GES-5)', () => {
  it('modo adicionar: rótulos, selo Validado só com coordenadas', () => {
    const { getByText, queryByText, rerender } = render(
      <Tela
        rotuloEndereco="Endereço *"
        rotuloObservacoes="Observações (opcional)"
        comSeloValidado
        enderecoValidado={false}
      />,
    );
    expect(getByText('Endereço *')).toBeTruthy();
    expect(getByText('Observações (opcional)')).toBeTruthy();
    expect(queryByText('Validado')).toBeNull();

    rerender(
      <Tela
        rotuloEndereco="Endereço *"
        rotuloObservacoes="Observações (opcional)"
        comSeloValidado
        enderecoValidado
      />,
    );
    expect(getByText('Validado')).toBeTruthy();
  });

  it('modo editar: sem selo e com a nota do endereço', () => {
    const { getByText, queryByText } = render(
      <Tela
        rotuloEndereco="Endereço"
        rotuloObservacoes="Observações"
        notaEndereco="A rota será recalculada após salvar"
      />,
    );
    expect(getByText('Endereço')).toBeTruthy();
    expect(queryByText('Validado')).toBeNull();
    expect(getByText('A rota será recalculada após salvar')).toBeTruthy();
    expect(getByText('autocomplete:Rua A, 1')).toBeTruthy();
  });
});
