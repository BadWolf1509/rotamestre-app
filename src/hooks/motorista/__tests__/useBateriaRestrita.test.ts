import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useBateriaRestrita } from '../useBateriaRestrita';

const mockRestrito = jest.fn<boolean, []>();
const mockAbrir = jest.fn<Promise<void>, []>();
jest.mock('@/lib/restricaoSegundoPlano', () => ({
  appComSegundoPlanoRestrito: () => mockRestrito(),
  abrirUsoDeBateriaDoApp: () => mockAbrir(),
}));

let ouvinteAppState: ((estado: AppStateStatus) => void) | undefined;

function voltarAoApp() {
  act(() => ouvinteAppState?.('active'));
}

describe('useBateriaRestrita', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ouvinteAppState = undefined;
    mockRestrito.mockReturnValue(true);
    mockAbrir.mockResolvedValue();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_, ouvinte) => {
        ouvinteAppState = ouvinte as (estado: AppStateStatus) => void;
        return { remove: jest.fn() };
      });
  });

  it('avisa quando há rota em andamento e a bateria está restrita', () => {
    const { result } = renderHook(() => useBateriaRestrita({ ativa: true }));
    expect(result.current.avisoVisivel).toBe(true);
  });

  it('não avisa sem restrição', () => {
    mockRestrito.mockReturnValue(false);
    const { result } = renderHook(() => useBateriaRestrita({ ativa: true }));
    expect(result.current.avisoVisivel).toBe(false);
  });

  it('sem rota em andamento, não avisa nem consulta', () => {
    const { result } = renderHook(() => useBateriaRestrita({ ativa: false }));
    expect(result.current.avisoVisivel).toBe(false);
    expect(mockRestrito).not.toHaveBeenCalled();
  });

  it('some ao voltar das configurações com a restrição tirada', () => {
    const { result } = renderHook(() => useBateriaRestrita({ ativa: true }));
    mockRestrito.mockReturnValue(false);
    voltarAoApp();
    expect(result.current.avisoVisivel).toBe(false);
  });

  it('aparece ao voltar ao app se a restrição foi posta com o app aberto', () => {
    mockRestrito.mockReturnValue(false);
    const { result } = renderHook(() => useBateriaRestrita({ ativa: true }));
    mockRestrito.mockReturnValue(true);
    voltarAoApp();
    expect(result.current.avisoVisivel).toBe(true);
  });

  it('dispensado, não volta a cada retorno ao app', () => {
    const { result } = renderHook(() => useBateriaRestrita({ ativa: true }));
    act(() => result.current.dispensar());
    expect(result.current.avisoVisivel).toBe(false);
    voltarAoApp();
    expect(result.current.avisoVisivel).toBe(false);
  });

  it('o botão abre a tela de bateria do app', async () => {
    const { result } = renderHook(() => useBateriaRestrita({ ativa: true }));
    await act(() => result.current.abrirConfiguracoes());
    expect(mockAbrir).toHaveBeenCalledTimes(1);
  });
});
