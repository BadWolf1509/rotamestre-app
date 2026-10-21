/**
 * O que um toque num pino de parada faz — decisão comum ao mapa nativo
 * (MapaMobile) e ao web (MapaWebMapLibre).
 *
 * O 1º toque seleciona (balão/popup). Se a tela oferece ações para a parada
 * (`onSelectedMarkerPress`), tocar de novo no pino já selecionado as abre.
 * Sem ações (mapa do gestor), o toque repetido só seleciona de novo.
 */

export type AcaoDoToque = 'selecionar' | 'abrir-acoes';

export function acaoDoToqueNoPino(
  membros: ReadonlyArray<{ id: string }>,
  selectedParadaId: string | null | undefined,
  temAcoes: boolean,
): AcaoDoToque {
  const jaSelecionado =
    selectedParadaId != null && membros.some((m) => m.id === selectedParadaId);
  return temAcoes && jaSelecionado ? 'abrir-acoes' : 'selecionar';
}
