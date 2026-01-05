import AsyncStorage from '@react-native-async-storage/async-storage';
import { UnistylesRuntime } from 'react-native-unistyles';

import {
  applyThemePreference,
  applyThemePreferences,
  getThemePreference,
  getThemePreferences,
  setThemePreference,
  setDensityPreference,
  setContrastPreference,
  ThemePreferences,
} from '../themePreference';

// Mock AsyncStorage ja configurado globalmente no jest.setup.js
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Mock UnistylesRuntime ja configurado globalmente no jest.setup.js
const mockUnistylesRuntime = UnistylesRuntime as jest.Mocked<typeof UnistylesRuntime>;

describe('themePreference', () => {
  const THEME_PREFERENCE_KEY = '@rotamestre:theme_preference';
  const DENSITY_PREFERENCE_KEY = '@rotamestre:density_preference';
  const CONTRAST_PREFERENCE_KEY = '@rotamestre:contrast_preference';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset UnistylesRuntime mocks para estado inicial
    (mockUnistylesRuntime as any).themeName = 'light';
    (mockUnistylesRuntime as any).colorScheme = 'light';
  });

  // ============================================
  // GRUPO 1: getThemePreference - Carregar preferencia de tema
  // ============================================
  describe('getThemePreference', () => {
    it('deve retornar "light" quando armazenado como light', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('light');

      const result = await getThemePreference();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(THEME_PREFERENCE_KEY);
      expect(result).toBe('light');
    });

    it('deve retornar "dark" quando armazenado como dark', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('dark');

      const result = await getThemePreference();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(THEME_PREFERENCE_KEY);
      expect(result).toBe('dark');
    });

    it('deve retornar null quando nenhuma preferencia foi salva', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await getThemePreference();

      expect(result).toBeNull();
    });

    it('deve retornar null quando valor armazenado e invalido', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('invalid-theme');

      const result = await getThemePreference();

      expect(result).toBeNull();
    });

    it('deve retornar null e logar aviso quando AsyncStorage falha', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockError = new Error('AsyncStorage error');
      mockAsyncStorage.getItem.mockRejectedValueOnce(mockError);

      const result = await getThemePreference();

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to load theme preference:',
        mockError
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // ============================================
  // GRUPO 2: getThemePreferences - Carregar todas as preferencias
  // ============================================
  describe('getThemePreferences', () => {
    it('deve retornar todas as preferencias quando armazenadas', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('dark')      // mode
        .mockResolvedValueOnce('compact')   // density
        .mockResolvedValueOnce('high');     // contrast

      const result = await getThemePreferences();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(THEME_PREFERENCE_KEY);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(DENSITY_PREFERENCE_KEY);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(CONTRAST_PREFERENCE_KEY);
      expect(result).toEqual({
        mode: 'dark',
        density: 'compact',
        contrast: 'high',
      });
    });

    it('deve retornar null quando nenhuma preferencia foi salva', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce(null)  // mode
        .mockResolvedValueOnce(null)  // density
        .mockResolvedValueOnce(null); // contrast

      const result = await getThemePreferences();

      expect(result).toBeNull();
    });

    it('deve usar valores padrao para preferencias invalidas', async () => {
      // Configura o mock do UnistylesRuntime para retornar 'light'
      (mockUnistylesRuntime as any).themeName = 'light';
      (mockUnistylesRuntime as any).colorScheme = 'light';

      mockAsyncStorage.getItem
        .mockResolvedValueOnce('invalid')   // mode invalido
        .mockResolvedValueOnce('invalid')   // density invalido
        .mockResolvedValueOnce('invalid');  // contrast invalido

      const result = await getThemePreferences();

      // Com valores invalidos, mas pelo menos um valor existe, deve retornar
      expect(result).toEqual({
        mode: 'light',     // fallback para getRuntimeMode()
        density: 'regular', // fallback padrao
        contrast: 'normal', // fallback padrao
      });
    });

    it('deve retornar preferencias parciais com valores padrao', async () => {
      (mockUnistylesRuntime as any).themeName = 'dark';
      (mockUnistylesRuntime as any).colorScheme = 'dark';

      mockAsyncStorage.getItem
        .mockResolvedValueOnce(null)      // mode nao definido
        .mockResolvedValueOnce('compact') // density definido
        .mockResolvedValueOnce(null);     // contrast nao definido

      const result = await getThemePreferences();

      expect(result).toEqual({
        mode: 'dark',       // fallback para getRuntimeMode()
        density: 'compact',
        contrast: 'normal', // fallback padrao
      });
    });

    it('deve retornar null e logar aviso quando AsyncStorage falha', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockError = new Error('AsyncStorage error');
      mockAsyncStorage.getItem.mockRejectedValueOnce(mockError);

      const result = await getThemePreferences();

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to load theme preferences:',
        mockError
      );

      consoleWarnSpy.mockRestore();
    });

    it('deve detectar tema dark do runtime quando themeName comeca com dark', async () => {
      (mockUnistylesRuntime as any).themeName = 'darkCompact';

      mockAsyncStorage.getItem
        .mockResolvedValueOnce('invalid')   // mode invalido - vai usar fallback
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await getThemePreferences();

      expect(result?.mode).toBe('dark');
    });

    it('deve detectar tema light do runtime quando themeName comeca com light', async () => {
      (mockUnistylesRuntime as any).themeName = 'lightHighContrast';

      mockAsyncStorage.getItem
        .mockResolvedValueOnce('invalid')   // mode invalido - vai usar fallback
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await getThemePreferences();

      expect(result?.mode).toBe('light');
    });

    it('deve usar colorScheme quando themeName nao indica o modo', async () => {
      (mockUnistylesRuntime as any).themeName = 'customTheme';
      (mockUnistylesRuntime as any).colorScheme = 'dark';

      mockAsyncStorage.getItem
        .mockResolvedValueOnce('invalid')   // mode invalido - vai usar fallback
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await getThemePreferences();

      expect(result?.mode).toBe('dark');
    });
  });

  // ============================================
  // GRUPO 3: setThemePreference - Salvar preferencia de tema
  // ============================================
  describe('setThemePreference', () => {
    it('deve salvar preferencia de tema light', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('light')
        .mockResolvedValueOnce('regular')
        .mockResolvedValueOnce('normal');

      await setThemePreference('light');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        THEME_PREFERENCE_KEY,
        'light'
      );
    });

    it('deve salvar preferencia de tema dark', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('dark')
        .mockResolvedValueOnce('regular')
        .mockResolvedValueOnce('normal');

      await setThemePreference('dark');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        THEME_PREFERENCE_KEY,
        'dark'
      );
    });

    it('deve aplicar tema apos salvar', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('dark')
        .mockResolvedValueOnce('regular')
        .mockResolvedValueOnce('normal');

      await setThemePreference('dark');

      expect(mockUnistylesRuntime.setAdaptiveThemes).toHaveBeenCalledWith(false);
      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('dark');
    });

    it('deve usar preferencias padrao quando nenhuma esta salva', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await setThemePreference('light');

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('light');
    });

    it('deve logar aviso quando AsyncStorage falha ao salvar', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockError = new Error('AsyncStorage setItem error');
      mockAsyncStorage.setItem.mockRejectedValueOnce(mockError);

      await setThemePreference('dark');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save theme preference:',
        mockError
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // ============================================
  // GRUPO 4: setDensityPreference - Salvar preferencia de densidade
  // ============================================
  describe('setDensityPreference', () => {
    it('deve salvar preferencia de densidade regular', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('light')
        .mockResolvedValueOnce('regular')
        .mockResolvedValueOnce('normal');

      await setDensityPreference('regular');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        DENSITY_PREFERENCE_KEY,
        'regular'
      );
    });

    it('deve salvar preferencia de densidade compact', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('light')
        .mockResolvedValueOnce('compact')
        .mockResolvedValueOnce('normal');

      await setDensityPreference('compact');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        DENSITY_PREFERENCE_KEY,
        'compact'
      );
    });

    it('deve aplicar tema com densidade compact correta', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('light')
        .mockResolvedValueOnce('compact')
        .mockResolvedValueOnce('normal');

      await setDensityPreference('compact');

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('lightCompact');
    });

    it('deve usar preferencias padrao quando nenhuma esta salva', async () => {
      (mockUnistylesRuntime as any).themeName = 'dark';

      mockAsyncStorage.getItem
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await setDensityPreference('compact');

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('darkCompact');
    });

    it('deve logar aviso quando AsyncStorage falha ao salvar', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockError = new Error('AsyncStorage setItem error');
      mockAsyncStorage.setItem.mockRejectedValueOnce(mockError);

      await setDensityPreference('compact');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save density preference:',
        mockError
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // ============================================
  // GRUPO 5: setContrastPreference - Salvar preferencia de contraste
  // ============================================
  describe('setContrastPreference', () => {
    it('deve salvar preferencia de contraste normal', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('light')
        .mockResolvedValueOnce('regular')
        .mockResolvedValueOnce('normal');

      await setContrastPreference('normal');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        CONTRAST_PREFERENCE_KEY,
        'normal'
      );
    });

    it('deve salvar preferencia de contraste high', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('light')
        .mockResolvedValueOnce('regular')
        .mockResolvedValueOnce('high');

      await setContrastPreference('high');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        CONTRAST_PREFERENCE_KEY,
        'high'
      );
    });

    it('deve aplicar tema com contraste alto correto', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('light')
        .mockResolvedValueOnce('regular')
        .mockResolvedValueOnce('high');

      await setContrastPreference('high');

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('lightHighContrast');
    });

    it('deve combinar densidade compact com contraste alto', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('dark')
        .mockResolvedValueOnce('compact')
        .mockResolvedValueOnce('high');

      await setContrastPreference('high');

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('darkCompactHighContrast');
    });

    it('deve usar preferencias padrao quando nenhuma esta salva', async () => {
      (mockUnistylesRuntime as any).themeName = 'light';

      mockAsyncStorage.getItem
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await setContrastPreference('high');

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('lightHighContrast');
    });

    it('deve logar aviso quando AsyncStorage falha ao salvar', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockError = new Error('AsyncStorage setItem error');
      mockAsyncStorage.setItem.mockRejectedValueOnce(mockError);

      await setContrastPreference('high');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save contrast preference:',
        mockError
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // ============================================
  // GRUPO 6: applyThemePreferences - Aplicar preferencias completas
  // ============================================
  describe('applyThemePreferences', () => {
    it('deve aplicar tema light basico', () => {
      const preferences: ThemePreferences = {
        mode: 'light',
        density: 'regular',
        contrast: 'normal',
      };

      applyThemePreferences(preferences);

      expect(mockUnistylesRuntime.setAdaptiveThemes).toHaveBeenCalledWith(false);
      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('light');
    });

    it('deve aplicar tema dark basico', () => {
      const preferences: ThemePreferences = {
        mode: 'dark',
        density: 'regular',
        contrast: 'normal',
      };

      applyThemePreferences(preferences);

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('dark');
    });

    it('deve aplicar tema light com densidade compact', () => {
      const preferences: ThemePreferences = {
        mode: 'light',
        density: 'compact',
        contrast: 'normal',
      };

      applyThemePreferences(preferences);

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('lightCompact');
    });

    it('deve aplicar tema dark com densidade compact', () => {
      const preferences: ThemePreferences = {
        mode: 'dark',
        density: 'compact',
        contrast: 'normal',
      };

      applyThemePreferences(preferences);

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('darkCompact');
    });

    it('deve aplicar tema light com contraste alto', () => {
      const preferences: ThemePreferences = {
        mode: 'light',
        density: 'regular',
        contrast: 'high',
      };

      applyThemePreferences(preferences);

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('lightHighContrast');
    });

    it('deve aplicar tema dark com contraste alto', () => {
      const preferences: ThemePreferences = {
        mode: 'dark',
        density: 'regular',
        contrast: 'high',
      };

      applyThemePreferences(preferences);

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('darkHighContrast');
    });

    it('deve aplicar tema light com densidade compact e contraste alto', () => {
      const preferences: ThemePreferences = {
        mode: 'light',
        density: 'compact',
        contrast: 'high',
      };

      applyThemePreferences(preferences);

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('lightCompactHighContrast');
    });

    it('deve aplicar tema dark com densidade compact e contraste alto', () => {
      const preferences: ThemePreferences = {
        mode: 'dark',
        density: 'compact',
        contrast: 'high',
      };

      applyThemePreferences(preferences);

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('darkCompactHighContrast');
    });

    it('deve desativar temas adaptativos', () => {
      const preferences: ThemePreferences = {
        mode: 'light',
        density: 'regular',
        contrast: 'normal',
      };

      applyThemePreferences(preferences);

      expect(mockUnistylesRuntime.setAdaptiveThemes).toHaveBeenCalledWith(false);
    });
  });

  // ============================================
  // GRUPO 7: applyThemePreference - Aplicar apenas modo de tema
  // ============================================
  describe('applyThemePreference', () => {
    it('deve aplicar apenas o modo de tema mantendo outras preferencias', () => {
      // Primeiro aplicamos preferencias completas
      const initialPreferences: ThemePreferences = {
        mode: 'light',
        density: 'compact',
        contrast: 'high',
      };
      applyThemePreferences(initialPreferences);

      jest.clearAllMocks();

      // Agora aplicamos apenas mudanca de modo
      applyThemePreference('dark');

      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('darkCompactHighContrast');
    });

    it('deve usar preferencias padrao quando nenhuma foi definida anteriormente', () => {
      // Primeiro resetamos o cache aplicando preferencias base
      const basePreferences: ThemePreferences = {
        mode: 'light',
        density: 'regular',
        contrast: 'normal',
      };
      applyThemePreferences(basePreferences);

      jest.clearAllMocks();

      // Agora aplicamos mudanca de modo
      applyThemePreference('dark');

      // Deve manter as preferencias base (regular, normal) com o novo modo (dark)
      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('dark');
    });
  });

  // ============================================
  // GRUPO 8: applyWebTheme - Aplicar tema na web
  // ============================================
  describe('applyWebTheme (via applyThemePreferences)', () => {
    // Para testar o comportamento web, precisamos simular Platform.OS = 'web'
    // Como Platform.OS ja esta configurado como 'ios' pelo jest.setup.js,
    // os testes abaixo verificam que a funcao nao faz nada quando nao esta na web

    it('nao deve modificar document quando Platform.OS nao e web', () => {
      // Configuramos um mock de document global
      const mockDocument = {
        documentElement: {
          setAttribute: jest.fn(),
          style: { colorScheme: '' },
        },
      };
      (global as any).document = mockDocument;

      const preferences: ThemePreferences = {
        mode: 'dark',
        density: 'compact',
        contrast: 'high',
      };

      applyThemePreferences(preferences);

      // Como Platform.OS = 'ios' (padrao do jest.setup.js), nao deve chamar setAttribute
      expect(mockDocument.documentElement.setAttribute).not.toHaveBeenCalled();

      delete (global as any).document;
    });

    it('nao deve falhar quando document nao esta definido', () => {
      // Garante que document nao existe
      const originalDocument = (global as any).document;
      delete (global as any).document;

      const preferences: ThemePreferences = {
        mode: 'dark',
        density: 'regular',
        contrast: 'normal',
      };

      // Deve executar sem erros mesmo sem document
      expect(() => applyThemePreferences(preferences)).not.toThrow();

      // Restaurar se existia
      if (originalDocument) {
        (global as any).document = originalDocument;
      }
    });
  });

  // ============================================
  // GRUPO 9: Integracao - Fluxos completos
  // ============================================
  describe('Integracao - Fluxos completos', () => {
    it('deve salvar e carregar preferencias corretamente', async () => {
      // Simula salvar preferencia
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('dark')
        .mockResolvedValueOnce('compact')
        .mockResolvedValueOnce('high');

      await setThemePreference('dark');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        THEME_PREFERENCE_KEY,
        'dark'
      );
      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalled();
    });

    it('deve manter consistencia entre preferencias ao atualizar densidade', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('dark')
        .mockResolvedValueOnce('regular')
        .mockResolvedValueOnce('high');

      await setDensityPreference('compact');

      // Deve aplicar o tema com a nova densidade mantendo modo e contraste
      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('darkCompactHighContrast');
    });

    it('deve manter consistencia entre preferencias ao atualizar contraste', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('light')
        .mockResolvedValueOnce('compact')
        .mockResolvedValueOnce('normal');

      await setContrastPreference('high');

      // Deve aplicar o tema com o novo contraste mantendo modo e densidade
      expect(mockUnistylesRuntime.setTheme).toHaveBeenCalledWith('lightCompactHighContrast');
    });
  });
});
