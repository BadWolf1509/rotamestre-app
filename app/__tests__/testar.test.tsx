import { render } from '@testing-library/react-native';
import React from 'react';

import Testar from '../testar';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => false,
  }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: false,
    isMobile: true,
    isTablet: false,
    width: 375,
  }),
}));

jest.mock('@/lib/testerLinks', () => ({
  isRecruitmentEnabled: () => false,
  getTesterLinks: () => ({ optInUrl: '', groupUrl: '', storeUrl: '' }),
}));

jest.mock('@/utils/detectWebPlatform', () => ({
  detectWebPlatform: () => 'desktop',
}));

describe('rota /testar', () => {
  it('renderiza sem quebrar (estado neutro)', () => {
    const { getByText } = render(<Testar />);
    expect(getByText(/indisponível no momento/i)).toBeTruthy();
  });
});
