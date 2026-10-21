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
 * balão caber inteiro acima dele. Em mapa baixo (o do gestor no celular tem
 * 400 dp) usa no máximo 45% da altura, senão o pino desceria demais.
 */
const ESPACO_DO_BALAO = 240;
const FRACAO_MAXIMA_DO_MAPA = 0.45;

function espacoDoBalao(alturaDoMapa: number | null): number {
  return alturaDoMapa == null
    ? ESPACO_DO_BALAO
    : Math.min(ESPACO_DO_BALAO, alturaDoMapa * FRACAO_MAXIMA_DO_MAPA);
}

interface UseBalaoSobrepostoOptions {
  mapRef: RefObject<MapRef | null>;
  cameraRef: RefObject<CameraRef | null>;
  /** Coordenada do pino selecionado; null sem seleção. */
  alvo: LngLat | null;
  /** Altura da área do mapa (dp); null antes do primeiro layout. */
  alturaDoMapa: number | null;
}

export function useBalaoSobreposto({
  mapRef,
  cameraRef,
  alvo,
  alturaDoMapa,
}: UseBalaoSobrepostoOptions) {
  const [ponto, setPonto] = useState<[number, number] | null>(null);
  const [emMovimento, setEmMovimento] = useState(false);
  const alvoRef = useRef<LngLat | null>(null);
  // Lida no efeito da seleção sem ser dependência: mudar de tamanho não
  // deve re-centralizar.
  const alturaRef = useRef(alturaDoMapa);
  alturaRef.current = alturaDoMapa;
  // A câmera começou a se mover depois do easeTo: quem traz o balão de volta
  // é o onRegionDidChange, não o fim nominal da animação.
  const regiaoMudouRef = useRef(false);
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
    regiaoMudouRef.current = false;
    setEmMovimento(true);
    cameraRef.current?.easeTo({
      center: [lng, lat],
      padding: { top: espacoDoBalao(alturaRef.current) },
      duration: DURACAO_CENTRALIZAR,
    });
    // Câmera que já está no lugar não emite onRegionDidChange.
    const fimDaAnimacao = setTimeout(() => {
      if (regiaoMudouRef.current) return;
      setEmMovimento(false);
      void reprojetar();
    }, DURACAO_CENTRALIZAR + 50);
    return () => clearTimeout(fimDaAnimacao);
  }, [lng, lat, cameraRef, reprojetar]);

  // Sem seleção, nada a esconder: evita re-renderizar o mapa a cada gesto.
  const onRegionWillChange = useCallback(() => {
    if (!alvoRef.current) return;
    regiaoMudouRef.current = true;
    setEmMovimento(true);
  }, []);

  const onRegionDidChange = useCallback(() => {
    if (!alvoRef.current) return;
    setEmMovimento(false);
    void reprojetar();
  }, [reprojetar]);

  return {
    ponto: emMovimento ? null : ponto,
    onRegionWillChange,
    onRegionDidChange,
  };
}
