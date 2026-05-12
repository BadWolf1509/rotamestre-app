/**
 * Breadcrumbs – accessibility on clickable breadcrumb items
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { Breadcrumbs } from '../Breadcrumbs';

const items = [
  { label: 'Dashboard', onPress: jest.fn() },
  { label: 'Rotas', onPress: jest.fn() },
  { label: 'Rota #42' },
];

describe('Breadcrumbs – accessibility', () => {
  it('clickable breadcrumb has accessibilityLabel matching its label', () => {
    const { getByLabelText } = render(<Breadcrumbs items={items} />);
    const dashboardLink = getByLabelText('Dashboard');
    expect(dashboardLink).toBeTruthy();
    expect(dashboardLink.props.accessibilityRole).toBe('link');
  });

  it('second clickable breadcrumb has accessibilityLabel and role link', () => {
    const { getByLabelText } = render(<Breadcrumbs items={items} />);
    const rotasLink = getByLabelText('Rotas');
    expect(rotasLink).toBeTruthy();
    expect(rotasLink.props.accessibilityRole).toBe('link');
  });

  it('last (active) breadcrumb is not wrapped in TouchableOpacity', () => {
    const { queryByLabelText } = render(<Breadcrumbs items={items} />);
    // The last item has no onPress so it should not be a link
    expect(queryByLabelText('Rota #42')).toBeNull();
  });
});
