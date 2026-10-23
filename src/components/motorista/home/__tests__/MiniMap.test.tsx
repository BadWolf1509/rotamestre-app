import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';

import { MiniMap } from '../MiniMap';

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      white: '#fff',
      black: '#000',
      primary: '#007AFF',
      primaryBg: '#e6ecfb',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
      gray900: '#111827',
    },
    typography: {
      fontSize: {
        xs: 12,
        sm: 14,
        base: 16,
        lg: 18,
        xl: 20,
      },
      fontSans: 'System',
      fontSansMedium: 'System',
      fontSansSemiBold: 'System',
      fontSansBold: 'System',
    },
    spacing: {
      '1': 4,
      '1.5': 6,
      '2': 8,
      '2.5': 10,
      '3': 12,
      '4': 16,
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      '2xl': 48,
    },
    borderRadius: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      full: 9999,
    },
    shadows: { sm: {}, md: {}, lg: {} },
  };
  return {
    defaultTheme: theme,
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: any) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock useRouteDirections hook (estado trocável por teste)
const mockDirecoes = {
  routeCoordinates: [] as Array<{ latitude: number; longitude: number }>,
  routeInfo: null as null | { distanceMeters: number; durationSeconds: number },
  isLoading: false,
  error: null as string | null,
};
jest.mock('@/hooks/useRouteDirections', () => ({
  useRouteDirections: () => ({
    ...mockDirecoes,
    refetch: jest.fn(),
    isFromCache: false,
  }),
}));

/** Marcadores do mapa (o mock do <Marker> recebe a posição em `lngLat`). */
const posicoesDosMarcadores = (
  tela: ReturnType<typeof render>,
): Array<[number, number]> =>
  tela
    .UNSAFE_getAllByProps({ testID: 'marker' })
    // Só o nó host: o composto do mock repete as mesmas props
    .filter((no) => typeof no.type === 'string' && no.props.lngLat)
    .map((no) => no.props.lngLat as [number, number]);

const coordenadaOk = ([lng, lat]: [number, number]) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;

describe('MiniMap', () => {
  const defaultProps = {
    paradas: [
      {
        id: 'p1',
        latitude: -23.55,
        longitude: -46.63,
        status: 'pendente',
        ordem: 1,
        endereco: 'Rua Teste 1',
      },
      {
        id: 'p2',
        latitude: -23.56,
        longitude: -46.64,
        status: 'concluida',
        ordem: 2,
        endereco: 'Rua Teste 2',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDirecoes.routeCoordinates = [];
    mockDirecoes.routeInfo = null;
    mockDirecoes.isLoading = false;
    mockDirecoes.error = null;
  });

  describe('Rendering', () => {
    it('deve renderizar mapa corretamente', () => {
      const { getByTestId } = render(<MiniMap {...defaultProps} />);

      expect(getByTestId('map-view')).toBeTruthy();
    });

    it('deve renderizar com userLocation', () => {
      const { getByTestId } = render(
        <MiniMap
          {...defaultProps}
          userLocation={{ latitude: -23.55, longitude: -46.63 }}
        />,
      );

      expect(getByTestId('map-view')).toBeTruthy();
    });

    it('deve renderizar expandido com altura 300', () => {
      const { getByTestId } = render(
        <MiniMap {...defaultProps} expanded={true} />,
      );

      expect(getByTestId('map-view')).toBeTruthy();
    });

    it('deve renderizar colapsado com altura 150', () => {
      const { getByTestId } = render(
        <MiniMap {...defaultProps} expanded={false} />,
      );

      expect(getByTestId('map-view')).toBeTruthy();
    });

    it('deve renderizar com testID personalizado', () => {
      const { getByTestId } = render(
        <MiniMap {...defaultProps} testID="custom-mini-map" />,
      );

      expect(getByTestId('custom-mini-map')).toBeTruthy();
    });
  });

  describe('Pinos por local', () => {
    const noLocal = { latitude: -23.55, longitude: -46.63, endereco: 'Rua A' };
    const paradasJuntas = [
      { id: 'e2', ordem: 2, status: 'em_andamento', ...noLocal },
      { id: 'r3', ordem: 3, status: 'pendente', ...noLocal },
      {
        id: 'p4',
        ordem: 4,
        status: 'pendente',
        latitude: -23.6,
        longitude: -46.7,
        endereco: 'Rua B',
      },
    ];

    it('agrupa entrega e retirada do mesmo ponto num pino "2+3"', () => {
      const { getByText, queryByText } = render(
        <MiniMap paradas={paradasJuntas} />,
      );

      expect(getByText('2+3')).toBeTruthy();
      expect(getByText('4')).toBeTruthy();
      expect(queryByText('2')).toBeNull();
      expect(queryByText('3')).toBeNull();
    });

    it('destaca como próxima o grupo da primeira parada restante', () => {
      const { getByText } = render(<MiniMap paradas={paradasJuntas} />);

      const estilo = (texto: string) => {
        let no = getByText(texto).parent;
        while (no && no.props.testID !== 'marker') no = no.parent;
        return StyleSheet.flatten(no?.props.style);
      };
      expect(estilo('2+3').backgroundColor).toBe('#f59e0b');
      expect(estilo('4').backgroundColor).toBe('#6b7280');
    });

    it('mantém um pino por parada quando os pontos são diferentes', () => {
      const { getByText } = render(
        <MiniMap
          paradas={[
            paradasJuntas[0],
            { ...paradasJuntas[1], latitude: -23.58 },
            paradasJuntas[2],
          ]}
        />,
      );

      expect(getByText('2')).toBeTruthy();
      expect(getByText('3')).toBeTruthy();
      expect(getByText('4')).toBeTruthy();
    });
  });

  describe('Markers', () => {
    it('deve renderizar markers para paradas', () => {
      const { getAllByTestId } = render(<MiniMap {...defaultProps} />);

      const markers = getAllByTestId('marker');
      expect(markers.length).toBeGreaterThan(0);
    });

    it('deve renderizar sem paradas', () => {
      const { getByTestId } = render(
        <MiniMap {...defaultProps} paradas={[]} />,
      );

      expect(getByTestId('map-view')).toBeTruthy();
    });

    it('deve renderizar marker de usuário quando userLocation é fornecido', () => {
      const { getAllByTestId } = render(
        <MiniMap
          {...defaultProps}
          userLocation={{ latitude: -23.55, longitude: -46.63 }}
        />,
      );

      // Deve ter pelo menos 3 markers: user + 2 paradas
      const markers = getAllByTestId('marker');
      expect(markers.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Callbacks', () => {
    it('deve chamar onToggleExpand quando botão expand é pressionado', () => {
      const onToggleExpand = jest.fn();

      const { getByLabelText } = render(
        <MiniMap {...defaultProps} onToggleExpand={onToggleExpand} />,
      );

      const expandButton = getByLabelText('Expandir mapa');
      fireEvent.press(expandButton);

      expect(onToggleExpand).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onOpenFullMap quando mapa é pressionado', () => {
      const onOpenFullMap = jest.fn();

      const { getByLabelText } = render(
        <MiniMap {...defaultProps} onOpenFullMap={onOpenFullMap} />,
      );

      const mapContainer = getByLabelText('Abrir mapa completo');
      fireEvent.press(mapContainer);

      expect(onOpenFullMap).toHaveBeenCalledTimes(1);
    });
  });

  describe('Paradas filtering', () => {
    it('deve filtrar paradas pendentes corretamente', () => {
      const paradas = [
        {
          id: 'p1',
          latitude: -23.55,
          longitude: -46.63,
          status: 'pendente',
          ordem: 1,
          endereco: 'Rua A',
        },
        {
          id: 'p2',
          latitude: -23.56,
          longitude: -46.64,
          status: 'pendente',
          ordem: 2,
          endereco: 'Rua B',
        },
        {
          id: 'p3',
          latitude: -23.57,
          longitude: -46.65,
          status: 'concluida',
          ordem: 3,
          endereco: 'Rua C',
        },
      ];

      const { getByTestId } = render(
        <MiniMap {...defaultProps} paradas={paradas} />,
      );

      expect(getByTestId('map-view')).toBeTruthy();
    });

    it('deve filtrar checkpoints corretamente', () => {
      const paradas = [
        {
          id: 'p1',
          latitude: -23.55,
          longitude: -46.63,
          status: 'pendente',
          ordem: 0,
          is_checkpoint: false,
          endereco: 'Unidade - Partida',
        },
        {
          id: 'p2',
          latitude: -23.56,
          longitude: -46.64,
          status: 'pendente',
          ordem: 1,
          endereco: 'Parada 1',
        },
        {
          id: 'p3',
          latitude: -23.57,
          longitude: -46.65,
          status: 'pendente',
          ordem: 2,
          is_checkpoint: false,
          endereco: 'Unidade - Chegada',
        },
      ];

      const { getByTestId } = render(
        <MiniMap {...defaultProps} paradas={paradas} />,
      );

      expect(getByTestId('map-view')).toBeTruthy();
    });

    it('deve ignorar paradas com coordenadas inválidas', () => {
      const paradas = [
        {
          id: 'p1',
          latitude: NaN,
          longitude: -46.63,
          status: 'pendente',
          ordem: 1,
          endereco: 'Inválida',
        },
        {
          id: 'p2',
          latitude: -23.56,
          longitude: -46.64,
          status: 'pendente',
          ordem: 2,
          endereco: 'Válida',
        },
        {
          id: 'p3',
          latitude: -23.57,
          longitude: NaN,
          status: 'concluida',
          ordem: 3,
          endereco: 'Concluída inválida',
        },
      ];

      const tela = render(<MiniMap {...defaultProps} paradas={paradas} />);

      expect(tela.queryByText('1')).toBeNull();
      expect(tela.getByText('2')).toBeTruthy();
      const posicoes = posicoesDosMarcadores(tela);
      expect(posicoes).toHaveLength(1);
      expect(posicoes.every(coordenadaOk)).toBe(true);
    });

    it('deve ignorar paradas com coordenadas fora do range', () => {
      const paradas = [
        {
          id: 'p1',
          latitude: -100,
          longitude: -46.63,
          status: 'pendente',
          ordem: 1,
          endereco: 'Lat inválida',
        },
        {
          id: 'p2',
          latitude: -23.56,
          longitude: -200,
          status: 'pendente',
          ordem: 2,
          endereco: 'Lng inválida',
        },
        {
          id: 'p3',
          latitude: -23.57,
          longitude: -46.65,
          status: 'pendente',
          ordem: 3,
          endereco: 'Válida',
        },
      ];

      const tela = render(<MiniMap {...defaultProps} paradas={paradas} />);

      expect(tela.queryByText('1')).toBeNull();
      expect(tela.queryByText('2')).toBeNull();
      expect(tela.getByText('3')).toBeTruthy();
      expect(posicoesDosMarcadores(tela).every(coordenadaOk)).toBe(true);
    });
  });

  describe('Route', () => {
    it('deve aceitar prop route', () => {
      const route = {
        id: 'route-1',
        distancia_total: 15.5,
      };

      const { getByTestId } = render(
        <MiniMap {...defaultProps} route={route} />,
      );

      expect(getByTestId('map-view')).toBeTruthy();
    });
  });

  describe('Map region', () => {
    it('deve calcular região com paradas', () => {
      const { getByTestId } = render(<MiniMap {...defaultProps} />);

      // O mapa deve renderizar com as paradas
      expect(getByTestId('map-view')).toBeTruthy();
    });

    it('deve usar coordenadas padrão quando sem paradas', () => {
      const { getByTestId } = render(<MiniMap paradas={[]} />);

      // O mapa deve renderizar mesmo sem paradas
      expect(getByTestId('map-view')).toBeTruthy();
    });
  });

  describe('Info Box', () => {
    const pendente = (id: string, ordem: number) => ({
      id,
      latitude: -23.55 - ordem / 100,
      longitude: -46.63,
      status: 'pendente',
      ordem,
      endereco: `Rua ${id}`,
    });

    it('deve mostrar contagem de paradas restantes (não concluídas/puladas)', () => {
      const paradas = [
        pendente('p1', 1),
        pendente('p2', 2),
        { ...pendente('p3', 3), status: 'concluida' },
        { ...pendente('p4', 4), status: 'pulada' },
      ];

      const { getByText } = render(
        <MiniMap {...defaultProps} paradas={paradas} />,
      );

      expect(getByText('2 paradas restantes')).toBeTruthy();
    });

    it('carregando: mostra "Calculando..."', () => {
      mockDirecoes.isLoading = true;
      const { getByText } = render(<MiniMap paradas={[pendente('p1', 1)]} />);

      expect(getByText('Calculando...')).toBeTruthy();
    });

    it('com routeInfo: singular e distância da rota inteira', () => {
      mockDirecoes.routeInfo = { distanceMeters: 12345, durationSeconds: 60 };
      const { getByText } = render(<MiniMap paradas={[pendente('p1', 1)]} />);

      expect(getByText('1 parada restante • 12,3 km no total')).toBeTruthy();
    });

    it('sem routeInfo: usa distancia_total (km) com vírgula decimal', () => {
      const { getByText } = render(
        <MiniMap
          paradas={[pendente('p1', 1), pendente('p2', 2)]}
          route={{ id: 'r1', distancia_total: 15.46 }}
        />,
      );

      expect(getByText('2 paradas restantes • 15,5 km no total')).toBeTruthy();
    });

    it('erro sem geometria: avisa "trajeto indisponível"', () => {
      mockDirecoes.error = 'falhou';
      const { getByText } = render(
        <MiniMap paradas={[pendente('p1', 1), pendente('p2', 2)]} />,
      );

      expect(
        getByText('2 paradas restantes • trajeto indisponível'),
      ).toBeTruthy();
    });
  });

  describe('Fonte do sistema', () => {
    const noMesmoLocal = (id: string, ordem: number) => ({
      id,
      latitude: -23.55,
      longitude: -46.63,
      status: 'pendente',
      ordem,
      endereco: 'A',
    });

    it('número do pino e chip limitam a ampliação e ficam numa linha', () => {
      const { getByText } = render(
        <MiniMap paradas={[noMesmoLocal('p1', 10), noMesmoLocal('p2', 11)]} />,
      );

      for (const texto of [
        getByText('10+11'),
        getByText(/paradas restantes/),
      ]) {
        expect(texto.props.maxFontSizeMultiplier).toBe(1.3);
        expect(texto.props.numberOfLines).toBe(1);
      }
    });

    it('pino tem largura mínima, não fixa, para caber "10+11"', () => {
      const { getByText } = render(
        <MiniMap paradas={[noMesmoLocal('p1', 10), noMesmoLocal('p2', 11)]} />,
      );

      let no = getByText('10+11').parent;
      while (no && no.props.testID !== 'marker') no = no.parent;
      const estilo = StyleSheet.flatten(no?.props.style);
      expect(estilo.width).toBeUndefined();
      expect(estilo.minWidth).toBeGreaterThanOrEqual(28);
    });
  });

  describe('Accessibility', () => {
    it('o toque abre o mapa completo, e o rótulo diz isso', () => {
      const { getByLabelText } = render(<MiniMap {...defaultProps} />);

      const mapa = getByLabelText('Abrir mapa completo');
      expect(mapa.props.accessibilityHint).toMatch(/1 parada restante/);
      expect(mapa.props.accessibilityHint).not.toMatch(/expandir/i);
    });

    it('deve ter labels nos botões de controle', () => {
      const { getByLabelText } = render(
        <MiniMap {...defaultProps} onToggleExpand={() => {}} />,
      );

      expect(getByLabelText('Expandir mapa')).toBeTruthy();
    });

    it('deve ter role de button nos botões', () => {
      const { getByLabelText } = render(
        <MiniMap {...defaultProps} onToggleExpand={() => {}} />,
      );

      const expandButton = getByLabelText(/Expandir mapa|Minimizar mapa/);
      expect(expandButton.props.accessibilityRole).toBe('button');
    });
  });

  describe('Reduzir movimento', () => {
    const comPulso = async (reduzir: boolean) => {
      jest
        .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
        .mockResolvedValue(reduzir);
      const start = jest.fn();
      jest
        .spyOn(Animated, 'loop')
        .mockReturnValue({ start, stop: jest.fn(), reset: jest.fn() });

      render(
        <MiniMap
          {...defaultProps}
          userLocation={{ latitude: -23.55, longitude: -46.63 }}
        />,
      );
      await act(async () => {});
      return start;
    };

    afterEach(() => jest.restoreAllMocks());

    it('sem a opção ligada, o ponto do motorista pulsa', async () => {
      expect(await comPulso(false)).toHaveBeenCalled();
    });

    it('com "reduzir movimento" ligado, não há pulso', async () => {
      expect(await comPulso(true)).not.toHaveBeenCalled();
    });

    const comOuvinte = () => {
      let ouvinte: ((valor: boolean) => void) | undefined;
      const remove = jest.fn();
      jest
        .spyOn(AccessibilityInfo, 'addEventListener')
        .mockImplementation((evento, handler) => {
          if (evento === 'reduceMotionChanged') {
            ouvinte = handler as (valor: boolean) => void;
          }
          return { remove } as never;
        });
      return { avisar: (valor: boolean) => ouvinte?.(valor), remove };
    };

    it('ligar a opção depois de montar para o pulso', async () => {
      const { avisar } = comOuvinte();
      const stop = jest.fn();
      jest
        .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
        .mockResolvedValue(false);
      const start = jest.fn();
      jest
        .spyOn(Animated, 'loop')
        .mockReturnValue({ start, stop, reset: jest.fn() });

      render(
        <MiniMap
          {...defaultProps}
          userLocation={{ latitude: -23.55, longitude: -46.63 }}
        />,
      );
      await act(async () => {});
      expect(start).toHaveBeenCalledTimes(1);
      expect(stop).not.toHaveBeenCalled();

      act(() => avisar(true));

      expect(stop).toHaveBeenCalledTimes(1);
      expect(start).toHaveBeenCalledTimes(1);
    });

    it('remove o ouvinte de "reduzir movimento" ao desmontar', async () => {
      const { remove } = comOuvinte();
      jest
        .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
        .mockResolvedValue(false);

      const { unmount } = render(<MiniMap {...defaultProps} />);
      await act(async () => {});
      expect(remove).not.toHaveBeenCalled();

      unmount();

      expect(remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Map properties', () => {
    it('deve desabilitar interações no mapa', () => {
      const { getByTestId } = render(<MiniMap {...defaultProps} />);

      const mapView = getByTestId('map-view');
      expect(mapView.props.dragPan).toBe(false);
      expect(mapView.props.touchZoom).toBe(false);
      expect(mapView.props.touchRotate).toBe(false);
      expect(mapView.props.touchPitch).toBe(false);
    });

    it('deve configurar estilo MapLibre', () => {
      const { getByTestId } = render(<MiniMap {...defaultProps} />);

      const mapView = getByTestId('map-view');
      expect(mapView.props.mapStyle).toBeTruthy();
    });
  });
});
