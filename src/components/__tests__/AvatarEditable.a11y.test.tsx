/**
 * AvatarEditable – accessibility attributes on the edit TouchableOpacity
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { AvatarEditable } from '../AvatarEditable';

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
