type AppDeNavegacao = 'waze' | 'google_maps' | 'apple_maps' | 'default';

/**
 * Rótulo do botão que entrega a rota ao app externo. "Abrir no Maps" não
 * dizia qual app abriria — e quem tem o Waze como preferido abria o Waze.
 * Sem preferência, `abrirNavegacao` mostra um menu de escolha: "GPS".
 */
export function rotuloAppExterno(app: AppDeNavegacao | undefined): string {
  switch (app) {
    case 'waze':
      return 'Abrir no Waze';
    case 'google_maps':
      return 'Abrir no Google Maps';
    case 'apple_maps':
      return 'Abrir no Apple Maps';
    default:
      return 'Abrir no GPS';
  }
}
