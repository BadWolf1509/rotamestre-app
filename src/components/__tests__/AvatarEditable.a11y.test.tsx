/**
 * AvatarEditable – accessibility attributes on the edit TouchableOpacity
 * + signed URL resolution via useSignedUrl hook
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { useSignedUrl } from '@/hooks/storage/useSignedUrl';

import { AvatarEditable } from '../AvatarEditable';

jest.mock('@/hooks/storage/useSignedUrl', () => ({
  useSignedUrl: jest.fn(() => ({ url: null, loading: false, error: false })),
}));

const mockUseSignedUrl = useSignedUrl as jest.Mock;

beforeEach(() => {
  mockUseSignedUrl.mockReturnValue({ url: null, loading: false, error: false });
});

describe('AvatarEditable – accessibility', () => {
  it('has accessibilityLabel, role button, and state when interactive', () => {
    const { getByLabelText } = render(
      <AvatarEditable name="João Silva" onPress={jest.fn()} />,
    );
    const btn = getByLabelText('Editar foto de perfil');
    expect(btn).toBeTruthy();
    expect(btn.props.accessibilityRole).toBe('button');
  });

  it('reflects disabled state when disabled=true', () => {
    const { getByLabelText } = render(
      <AvatarEditable name="João Silva" onPress={jest.fn()} disabled={true} />,
    );
    const btn = getByLabelText('Editar foto de perfil');
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('reflects disabled state when uploading=true', () => {
    const { getByLabelText } = render(
      <AvatarEditable name="João Silva" onPress={jest.fn()} uploading={true} />,
    );
    const btn = getByLabelText('Editar foto de perfil');
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('AvatarEditable – signed URL resolution', () => {
  it('renders Image with signed url when hook returns a url', () => {
    mockUseSignedUrl.mockReturnValue({
      url: 'https://signed/a',
      loading: false,
      error: false,
    });

    const { UNSAFE_getByType } = render(
      <AvatarEditable name="Usuário Sobrenome" imageUrl="perfis/p.jpg" />,
    );

    const { Image } = require('react-native');
    const image = UNSAFE_getByType(Image);
    expect(image.props.source.uri).toBe('https://signed/a');
  });

  it('renders initials when hook returns null url', () => {
    mockUseSignedUrl.mockReturnValue({
      url: null,
      loading: false,
      error: false,
    });

    const { getByText } = render(
      <AvatarEditable name="Usuário Sobrenome" imageUrl="perfis/p.jpg" />,
    );

    expect(getByText('US')).toBeTruthy();
  });
});
