import { render } from '@testing-library/react-native';
import React from 'react';

import { FieldError } from '../FieldError';

jest.mock('@/utils/styles', () => {
  const theme = {
    colors: { error: '#ef4444' },
    typography: { fontSize: { sm: 14 }, fontSans: 'System' },
    spacing: { xs: 4 },
  };
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: any) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  };
});

describe('FieldError', () => {
  it('renderiza a mensagem quando presente', () => {
    const { getByText } = render(<FieldError message="E-mail inválido" />);
    expect(getByText('E-mail inválido')).toBeTruthy();
  });

  it('não renderiza nada quando vazio', () => {
    const { toJSON } = render(<FieldError message={undefined} />);
    expect(toJSON()).toBeNull();
  });
});
