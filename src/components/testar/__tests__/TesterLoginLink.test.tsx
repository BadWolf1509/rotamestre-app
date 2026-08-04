import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { TesterLoginLink } from '../TesterLoginLink';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockIsEnabled = jest.fn();
jest.mock('@/lib/testerLinks', () => ({
  isRecruitmentEnabled: () => mockIsEnabled(),
}));

describe('TesterLoginLink', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renderiza o link quando o recrutamento está ativo', () => {
    mockIsEnabled.mockReturnValue(true);
    const { getByText } = render(<TesterLoginLink />);
    expect(getByText('📱 Seja um testador do app')).toBeTruthy();
  });

  it('não renderiza nada quando o recrutamento está desativado', () => {
    mockIsEnabled.mockReturnValue(false);
    const { queryByText } = render(<TesterLoginLink />);
    expect(queryByText('📱 Seja um testador do app')).toBeNull();
  });

  it('navega para /testar ao tocar', () => {
    mockIsEnabled.mockReturnValue(true);
    const { getByText } = render(<TesterLoginLink />);
    fireEvent.press(getByText('📱 Seja um testador do app'));
    expect(mockPush).toHaveBeenCalledWith('/testar');
  });
});
