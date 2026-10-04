/**
 * Guarda: todo pedido de localização em primeiro plano consulta antes de pedir.
 *
 * No Android, `requestForegroundPermissionsAsync` abre a activity de permissão
 * do sistema MESMO com a permissão concedida, e o app vai a segundo plano por
 * uma fração de segundo. Serviço em primeiro plano iniciado nessa janela é
 * recusado pelo Android 12+: o rastreamento da navegação falhava ao entrar,
 * sem "Rastreando" e sem geofence (moto g15, 03/10/2026, #570). A forma
 * segura é `pedirPermissao(request, get)` (`src/lib/permissoes.ts`), que só
 * pede quando a consulta não deu `granted`.
 *
 * POR QUE ESTÁTICA. A pausa só existe no Android real; no Jest o mock
 * responde na hora e nenhuma corrida aparece. O que dá para guardar é a forma.
 *
 * O QUE ELA NÃO PEGA: chamadas fora de `src/` e `app/`, e quem guardar a
 * função numa variável antes de chamar. Protege contra a reintrodução literal.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');
const DIRETORIOS = ['src', 'app'];
const EXTENSOES = new Set(['.ts', '.tsx']);

// Montado em pedaços para o próprio arquivo não casar com a regra.
const PEDIDO = 'requestForeground' + 'PermissionsAsync(';
const CONSULTA = 'getForeground' + 'PermissionsAsync(';

/**
 * Já consultam por conta própria, com `get…` explícito antes do `request…`.
 * Cada entrada precisa de motivo.
 */
const EXCECOES: Record<string, string> = {
  // `requestLocationPermissions`: o `request` só roda dentro de
  // `if (!foregroundGranted)`, depois de `getForegroundPermissionsAsync`.
  'src/services/unifiedLocationTracking.ts': 'consulta antes, à mão',
};

function listarFontes(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (nome === 'node_modules' || nome === '__tests__') return [];
    if (statSync(caminho).isDirectory()) return listarFontes(caminho);
    return EXTENSOES.has(extname(nome)) ? [caminho] : [];
  });
}

const fontes = DIRETORIOS.flatMap((d) => listarFontes(join(RAIZ, d)));

/** Ocorrências do pedido sem a consulta nas 4 linhas seguintes. */
function pedidosSemConsulta(): string[] {
  const achados: string[] = [];
  for (const arquivo of fontes) {
    const rel = relative(RAIZ, arquivo).replace(/\\/g, '/');
    if (EXCECOES[rel]) continue;
    const linhas = readFileSync(arquivo, 'utf8').split(/\r?\n/);
    linhas.forEach((linha, i) => {
      if (!linha.includes(PEDIDO)) return;
      const janela = linhas.slice(i, i + 5).join('\n');
      if (!janela.includes(CONSULTA)) achados.push(`${rel}:${i + 1}`);
    });
  }
  return achados;
}

describe('permissão de localização: consultar antes de pedir', () => {
  it('a varredura enxerga o código (a guarda não passa por ausência)', () => {
    const comPedido = fontes.filter((f) =>
      readFileSync(f, 'utf8').includes(PEDIDO),
    );
    expect(comPedido.length).toBeGreaterThan(3);
  });

  it('todo pedido passa a consulta junto (pedirPermissao(request, get))', () => {
    expect(pedidosSemConsulta()).toEqual([]);
  });
});
