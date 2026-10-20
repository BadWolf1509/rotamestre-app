/**
 * Selecionar um pino no mapa nativo: centraliza a câmera e diz onde, na tela,
 * desenhar o balão (BalaoSobreposto).
 *
 * O balão vive fora do <Marker>, então a posição vem de `mapRef.project()`
 * (dp, relativo ao mapa — a mesma unidade do layout do RN). Enquanto a câmera
 * se move o balão some (`ponto` = null) e volta reprojetado quando ela para:
 * projetar a cada quadro do gesto custaria uma ida ao nativo por quadro.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

import { logger } from '@/lib/logger';

import type {
  CameraRef,
  LngLat,
  MapRef,
} from '@maplibre/maplibre-react-native';

/** Duração do easeTo da seleção (ms). */
const DURACAO_CENTRALIZAR = 300;

/**
 * Padding superior do easeTo (dp): desloca o pino para baixo do centro, para o
 * balão caber inteiro acima dele.
 */
export const ESPACO_DO_BALAO = 240;

interface UseBalaoSobrepostoOptions {
  mapRef: RefObject<MapRef | null>;
  cameraRef: RefObject<CameraRef | null>;
  /** Coordenada do pino selecionado; null sem seleção. */
  alvo: LngLat | null;
}

export function useBalaoSobreposto({
  mapRef,
  cameraRef,
  alvo,
}: UseBalaoSobrepostoOptions) {
  const [ponto, setPonto] = useState<[number, number] | null>(null);
  const [emMovimento, setEmMovimento] = useState(false);
  const alvoRef = useRef<LngLat | null>(null);
  const lng = alvo?.[0];
  const lat = alvo?.[1];

  const reprojetar = useCallback(async () => {
    const atual = alvoRef.current;
    if (!atual || !mapRef.current) {
      setPonto(null);
      return;
    }
    try {
      const [x, y] = await mapRef.current.project(atual);
      // Seleção trocou enquanto o nativo respondia: descarta.
      if (alvoRef.current === atual) setPonto([x, y]);
    } catch (error) {
      // Mapa ainda sem viewport: o próximo onRegionDidChange tenta de novo.
      logger.warn('Não foi possível posicionar o balão do mapa', error);
    }
  }, [mapRef]);

  useEffect(() => {
    setPonto(null);
    if (lng == null || lat == null) {
      alvoRef.current = null;
      return;
    }
    alvoRef.current = [lng, lat];
    setEmMovimento(true);
    cameraRef.current?.easeTo({
      center: [lng, lat],
      padding: { top: ESPACO_DO_BALAO },
      duration: DURACAO_CENTRALIZAR,
    });
    // Câmera que já está no lugar não emite onRegionDidChange.
    const fimDaAnimacao = setTimeout(() => {
      setEmMovimento(false);
      void reprojetar();
    }, DURACAO_CENTRALIZAR + 50);
    return () => clearTimeout(fimDaAnimacao);
  }, [lng, lat, cameraRef, reprojetar]);

  const onRegionWillChange = useCallback(() => setEmMovimento(true), []);

  const onRegionDidChange = useCallback(() => {
    setEmMovimento(false);
    void reprojetar();
  }, [reprojetar]);

  return {
    ponto: emMovimento ? null : ponto,
    onRegionWillChange,
    onRegionDidChange,
  };
}
