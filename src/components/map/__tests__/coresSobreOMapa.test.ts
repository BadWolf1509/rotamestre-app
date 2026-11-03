import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

import {
  CORES_DE_STATUS_SOBRE_O_MAPA,
  CORES_SOBRE_O_MAPA,
} from '@/components/map/coresSobreOMapa';
import { darkTheme, defaultTheme } from '@/utils/styles.base';

const RAIZ = join(__dirname, '..', '..', '..', '..');

/**
 * Lista os .ts/.tsx de src, app e e2e andando pelo disco (e não por
 * `git ls-files`): não depende do binário do git no ambiente do teste e
 * enxerga também arquivo novo ainda não rastreado.
 */
function arquivosTs(pasta: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(pasta)) {
    if (nome === 'node_modules' || nome === '.git') continue;
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) {
      achados.push(...arquivosTs(caminho));
    } else if (/\.tsx?$/.test(nome)) {
      achados.push(caminho);
    }
  }
  return achados;
}

describe('CORES_SOBRE_O_MAPA', () => {
  it('é a paleta clara, não a do tema escuro', () => {
    expect(CORES_SOBRE_O_MAPA.branco).toBe(defaultTheme.colors.white);
    expect(CORES_SOBRE_O_MAPA.sombra).toBe(defaultTheme.colors.black);
    expect(CORES_SOBRE_O_MAPA.branco).not.toBe(darkTheme.colors.white);
    expect(CORES_SOBRE_O_MAPA.marca).toBe(defaultTheme.colors.primary);
  });

  it('ninguém importa a paleta da pasta do mini-mapa', () => {
    const importaDoMiniMap =
      /CORES_SOBRE_O_MAPA[^;]*from ['"][^'"]*miniMapCompartilhado['"]/s;
    const esteArquivo = __filename;

    const ofensores = ['src', 'app', 'e2e']
      .flatMap((pasta) => arquivosTs(join(RAIZ, pasta)))
      .filter((arquivo) => arquivo !== esteArquivo)
      .filter((arquivo) => {
        const texto = readFileSync(arquivo, 'utf8');
        if (importaDoMiniMap.test(texto)) return true;
        return (
          arquivo.endsWith('miniMapCompartilhado.ts') &&
          texto.includes('export const CORES_SOBRE_O_MAPA')
        );
      })
      .map((arquivo) => relative(RAIZ, arquivo).split(sep).join('/'));

    expect(ofensores).toEqual([]);
  });
});

describe('CORES_SOBRE_O_MAPA: chaves do modo navegação', () => {
  it('contorno e apagada vêm da paleta clara', () => {
    expect(CORES_SOBRE_O_MAPA.contorno).toBe(defaultTheme.colors.gray200);
    expect(CORES_SOBRE_O_MAPA.apagada).toBe(defaultTheme.colors.gray400);
  });
});

describe('CORES_SOBRE_O_MAPA: popup e pinos do mapa web do gestor', () => {
  it('textoSecundario é o da paleta clara (popup tem fundo branco)', () => {
    expect(CORES_SOBRE_O_MAPA.textoSecundario).toBe(
      defaultTheme.colors.textSecondary,
    );
    expect(CORES_SOBRE_O_MAPA.textoSecundario).not.toBe(
      darkTheme.colors.textSecondary,
    );
  });

  it('CORES_DE_STATUS_SOBRE_O_MAPA é o recorte claro das cores de status', () => {
    const { primary, successDark, warningDark, errorDark, gray500 } =
      defaultTheme.colors;
    expect(CORES_DE_STATUS_SOBRE_O_MAPA).toEqual({
      primary,
      successDark,
      warningDark,
      errorDark,
      gray500,
    });
  });
});
