type AppDeNavegacao = 'waze' | 'google_maps' | 'apple_maps' | 'default';

/**
 * Rótulo do botão que entrega a rota ao app externo. "Abrir no Maps" não
 * dizia qual app abriria — e quem tem o Waze como preferido abria o Waze.
 * Sem preferência, `abrirNavegacao` mostra um menu de escolha: "GPS".
 *
 * Com app escolhido, vai só o nome, ao lado do ícone de navegar: o botão
 * divide a linha com "Pular" e "Concluir", e "Abrir no Google Maps" quebrou
 * em duas linhas num moto g15 (05/10/2026), empurrando o ícone para fora.
 */
export function rotuloAppExterno(app: AppDeNavegacao | undefined): string {
  switch (app) {
    case 'waze':
      return 'Waze';
    case 'google_maps':
      return 'Google Maps';
    case 'apple_maps':
      return 'Apple Maps';
    default:
      return 'Abrir no GPS';
  }
}
