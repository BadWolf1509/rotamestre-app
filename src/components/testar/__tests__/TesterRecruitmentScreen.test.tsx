import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

import { logger } from '@/lib/logger';
import { toast } from '@/utils/toast';

import { TesterRecruitmentScreen } from '../TesterRecruitmentScreen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => false,
  }),
}));

jest.mock('@/utils/toast', () => ({
  toast: {
    error: jest.fn(),
  },
}));

const mockIsEnabled = jest.fn();
const mockGetLinks = jest.fn();
jest.mock('@/lib/testerLinks', () => ({
  isRecruitmentEnabled: () => mockIsEnabled(),
  getTesterLinks: () => mockGetLinks(),
}));

const mockDetect = jest.fn();
jest.mock('@/utils/detectWebPlatform', () => ({
  detectWebPlatform: () => mockDetect(),
}));

const LINKS = {
  optInUrl: 'https://play.google.com/apps/testing/br.tec.rotamestre.app',
  groupUrl: 'https://groups.google.com/g/testadores-rotamestre',
  storeUrl:
    'https://play.google.com/store/apps/details?id=br.tec.rotamestre.app',
};

describe('TesterRecruitmentScreen', () => {
  let openURLSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLinks.mockReturnValue(LINKS);
    openURLSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);
  });

  afterEach(() => openURLSpy.mockRestore());

  it('mostra estado neutro quando o recrutamento está desativado', () => {
    mockIsEnabled.mockReturnValue(false);
    mockDetect.mockReturnValue('android');
    const { getByText, queryByText } = render(<TesterRecruitmentScreen />);
    expect(getByText(/indisponível no momento/i)).toBeTruthy();
    expect(queryByText('Entre no grupo de testadores')).toBeNull();
  });

  it('mostra os 3 passos e o aviso de Conta Google no Android', () => {
    mockIsEnabled.mockReturnValue(true);
    mockDetect.mockReturnValue('android');
    const { getByText } = render(<TesterRecruitmentScreen />);
    expect(getByText('Entre no grupo de testadores')).toBeTruthy();
    expect(getByText('Aceite o teste')).toBeTruthy();
    expect(getByText('Instale o app')).toBeTruthy();
    expect(getByText(/nos três passos/i)).toBeTruthy();
  });

  it('abre o link de opt-in ao tocar no CTA do passo 2', () => {
    mockIsEnabled.mockReturnValue(true);
    mockDetect.mockReturnValue('android');
    const { getByText } = render(<TesterRecruitmentScreen />);
    fireEvent.press(getByText('Abrir convite de teste'));
    expect(openURLSpy).toHaveBeenCalledWith(LINKS.optInUrl);
  });

  it('mostra aviso de Android-only no iPhone', () => {
    mockIsEnabled.mockReturnValue(true);
    mockDetect.mockReturnValue('ios');
    const { getByText, queryByText } = render(<TesterRecruitmentScreen />);
    expect(getByText(/só para Android/i)).toBeTruthy();
    expect(queryByText('Entre no grupo de testadores')).toBeNull();
  });

  it('mostra a URL de compartilhamento no desktop', () => {
    mockIsEnabled.mockReturnValue(true);
    mockDetect.mockReturnValue('desktop');
    const { getByText } = render(<TesterRecruitmentScreen />);
    expect(getByText(/Está no computador\?/i)).toBeTruthy();
  });

  it('não chama Linking.openURL quando o passo está desabilitado (url vazia)', () => {
    mockIsEnabled.mockReturnValue(true);
    mockDetect.mockReturnValue('android');
    mockGetLinks.mockReturnValue({ ...LINKS, groupUrl: '' });
    const { getByText } = render(<TesterRecruitmentScreen />);
    fireEvent.press(getByText('Entrar no grupo'));
    expect(openURLSpy).not.toHaveBeenCalled();
  });

  it('trata a rejeição de Linking.openURL sem quebrar e mostra toast de erro', async () => {
    mockIsEnabled.mockReturnValue(true);
    mockDetect.mockReturnValue('android');
    const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
    openURLSpy.mockRejectedValueOnce(new Error('falhou'));
    const { getByText } = render(<TesterRecruitmentScreen />);

    fireEvent.press(getByText('Abrir convite de teste'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(loggerWarnSpy).toHaveBeenCalled();
  });
});
