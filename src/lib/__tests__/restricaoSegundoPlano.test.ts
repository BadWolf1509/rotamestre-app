import { Linking, Platform } from 'react-native';

import {
  abrirUsoDeBateriaDoApp,
  appComSegundoPlanoRestrito,
} from '../restricaoSegundoPlano';

const mockModulo = {
  estaRestrito: jest.fn(),
  abrirUsoDeBateria: jest.fn(),
};
let mockModuloDisponivel = true;

jest.mock('expo', () => ({
  requireOptionalNativeModule: () => (mockModuloDisponivel ? mockModulo : null),
}));

describe('restricaoSegundoPlano', () => {
  const plataformaOriginal = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockModuloDisponivel = true;
    Platform.OS = 'android';
    jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  });

  afterAll(() => {
    Platform.OS = plataformaOriginal;
  });

  it('responde o que o Android diz sobre a restrição', () => {
    mockModulo.estaRestrito.mockReturnValue(true);
    expect(appComSegundoPlanoRestrito()).toBe(true);

    mockModulo.estaRestrito.mockReturnValue(false);
    expect(appComSegundoPlanoRestrito()).toBe(false);
  });

  it('sem o módulo nativo (binário antigo via OTA), não acusa restrição', () => {
    mockModuloDisponivel = false;
    expect(appComSegundoPlanoRestrito()).toBe(false);
  });

  it('fora do Android, não acusa restrição nem chama o nativo', () => {
    Platform.OS = 'ios';
    expect(appComSegundoPlanoRestrito()).toBe(false);
    expect(mockModulo.estaRestrito).not.toHaveBeenCalled();
  });

  it('se a consulta falhar, não acusa restrição', () => {
    mockModulo.estaRestrito.mockImplementation(() => {
      throw new Error('falhou');
    });
    expect(appComSegundoPlanoRestrito()).toBe(false);
  });

  it('abre a tela de bateria do app pelo nativo', async () => {
    mockModulo.abrirUsoDeBateria.mockResolvedValue(undefined);
    await abrirUsoDeBateriaDoApp();
    expect(mockModulo.abrirUsoDeBateria).toHaveBeenCalledTimes(1);
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });

  it('sem o módulo, cai nas configurações do app', async () => {
    mockModuloDisponivel = false;
    await abrirUsoDeBateriaDoApp();
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  it('se o nativo falhar ao abrir, cai nas configurações do app', async () => {
    mockModulo.abrirUsoDeBateria.mockRejectedValue(new Error('sem tela'));
    await abrirUsoDeBateriaDoApp();
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });
});
