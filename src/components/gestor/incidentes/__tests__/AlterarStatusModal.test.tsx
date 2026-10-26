/**
 * AlterarStatusModal: o campo de observações tem limite e contador.
 */

import { render, screen } from '@testing-library/react-native';
import React from 'react';

import type { Incidente } from '@/hooks/incidentes-gestor/types';

import { AlterarStatusModal } from '../AlterarStatusModal';

// DesktopModal real depende de portal/animação; aqui só importa o conteúdo.
jest.mock('@/design-system', () => {
  const { View } = require('react-native');
  return {
    DesktopModal: ({
      visible,
      children,
    }: {
      visible: boolean;
      children: React.ReactNode;
    }) => (visible ? <View>{children}</View> : null),
  };
});

const INCIDENTE = { id: 'inc-1', status: 'aberto' } as Incidente;

function renderizar(observacoes: string) {
  return render(
    <AlterarStatusModal
      incidente={INCIDENTE}
      visible
      onClose={jest.fn()}
      statusLabels={{}}
      novoStatus="aberto"
      observacoes={observacoes}
      atualizando={false}
      onConfirmar={jest.fn()}
      setNovoStatus={jest.fn()}
      setObservacoes={jest.fn()}
    />,
  );
}

describe('AlterarStatusModal — observações', () => {
  it('limita o campo a 1000 caracteres e mostra o contador', () => {
    renderizar('abc');

    const campo = screen.getByPlaceholderText(
      'Adicione observações sobre a resolução...',
    );
    expect(campo.props.maxLength).toBe(1000);
    expect(screen.getByText('3/1000')).toBeTruthy();
  });

  it('observação antiga acima do limite aparece com o erro no campo', () => {
    renderizar('a'.repeat(1001));

    expect(screen.getByText('1001/1000')).toBeTruthy();
    expect(
      screen.getByText('Observações devem ter no máximo 1000 caracteres'),
    ).toBeTruthy();
  });
});
