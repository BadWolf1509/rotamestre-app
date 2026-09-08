import { lerFonte, semComentarios } from './helpers/varreduraDeFontes';

/**
 * Guarda: `origin` nunca entra na dependência de `initializeNavigation`.
 *
 * O QUE ISTO IMPEDE. `NavigationMode` passa `origin={userLocation}` — a posição
 * VIVA do motorista, que muda a cada tick do GPS. Com `origin` na dependência
 * do `useCallback`, a identidade da função mudava a cada tick, o efeito que a
 * chama re-executava, e cada segundo de navegação virava:
 *
 *   1. uma rota inteira refeita no OSRM;
 *   2. a limpeza do efeito rodando — `TurnByTurnNavigationService.reset()`;
 *   3. `setIsLoading(true)`, piscando "Calculando rota..." por cima da
 *      navegação em curso.
 *
 * A rota inicial não precisa ser recalculada a cada metro: o avanço já chega
 * pelo watcher de posição. Por isso `origin` é lido de uma ref — e NÃO por
 * coordenadas desestruturadas, porque o drift do GPS traria o problema de volta
 * do mesmo jeito.
 *
 * POR QUE ESTÁTICA, E POR QUE NAS DUAS VARIANTES. O #490 corrigiu a variante
 * nativa; a web ficou de fora porque o componente parecia inalcançável, e
 * voltou a ser alcançável quando o #495 consertou o default de `autoAdvance`.
 * Ou seja: as duas divergiram em silêncio por um release inteiro. O teste de
 * unidade existente importa `'../TurnByTurnNavigation'`, que sob o preset
 * nativo resolve só para o `.tsx` — a variante `.web.tsx` não é exercitada por
 * ninguém. Mesma situação da guarda de fonte de tiles do MapLibre, e mesma
 * saída: comparar as duas fontes estaticamente.
 */
const VARIANTES = [
  'src/components/motorista/TurnByTurnNavigation.tsx',
  'src/components/motorista/TurnByTurnNavigation.web.tsx',
];

/** Extrai a lista de dependências do `useCallback` de `initializeNavigation`. */
function dependenciasDeInitializeNavigation(fonte: string): string[] {
  const inicio = fonte.indexOf('initializeNavigation = useCallback');
  if (inicio === -1) {
    throw new Error(
      'initializeNavigation não encontrado — o componente foi renomeado? ' +
        'Atualize esta guarda em vez de apagá-la.',
    );
  }

  // A primeira `}, [ ... ])` depois do início do callback é o array dele.
  const fecho = fonte.slice(inicio).match(/\}\s*,\s*\[([^\]]*)\]\s*\)/);
  if (!fecho) {
    throw new Error('Array de dependências de initializeNavigation não achado');
  }

  return fecho[1]
    .split(',')
    .map((dep) => dep.trim())
    .filter(Boolean);
}

describe('turn-by-turn: origin mora numa ref, não na dependência', () => {
  it.each(VARIANTES)('%s não tem origin nas dependências', (caminho) => {
    const deps = dependenciasDeInitializeNavigation(
      semComentarios(lerFonte(caminho)),
    );

    expect(deps).not.toContain('origin');
  });

  it.each(VARIANTES)('%s lê a posição inicial de originRef', (caminho) => {
    const fonte = semComentarios(lerFonte(caminho));

    // Ler da ref é o que substitui a dependência. Sem isto, tirar `origin` das
    // deps não corrige nada — só troca o churn por uma rota calculada com a
    // posição errada, presa ao primeiro render.
    expect(fonte).toContain('originRef.current');
  });
});
