import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  RAIZ_REPOSITORIO,
  caminhoRelativo,
  exigirVolume,
  lerFontes,
  listarFontes,
} from '../fontes';

describe('listarFontes', () => {
  let raiz: string;

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'fontes-'));
    mkdirSync(join(raiz, 'src', 'a', '__tests__'), { recursive: true });
    mkdirSync(join(raiz, 'src', 'node_modules', 'x'), { recursive: true });
    writeFileSync(join(raiz, 'src', 'um.ts'), 'um');
    writeFileSync(join(raiz, 'src', 'a', 'dois.tsx'), 'dois');
    writeFileSync(join(raiz, 'src', 'a', 'tipos.d.ts'), 'tipos');
    writeFileSync(join(raiz, 'src', 'a', 'x.test.ts'), 'teste');
    writeFileSync(join(raiz, 'src', 'a', '__tests__', 'y.ts'), 'y');
    writeFileSync(join(raiz, 'src', 'node_modules', 'x', 'z.ts'), 'z');
    writeFileSync(join(raiz, 'src', 'leia.md'), 'md');
  });

  afterAll(() => rmSync(raiz, { recursive: true, force: true }));

  it('lista só .ts/.tsx de produção, sem __tests__, node_modules, .test nem .d.ts', () => {
    const achados = listarFontes({ pastas: ['src'], raiz }).map((f) => caminhoRelativo(f, raiz));
    expect(achados).toEqual(['src/a/dois.tsx', 'src/um.ts']);
  });

  it('respeita extensões e diretórios ignorados informados', () => {
    const achados = listarFontes({
      pastas: ['src'],
      raiz,
      extensoes: ['.md'],
      ignorarDiretorios: [],
    }).map((f) => caminhoRelativo(f, raiz));
    expect(achados).toEqual(['src/leia.md']);
  });

  it('incluirTestesEDts traz testes e .d.ts', () => {
    const achados = listarFontes({ pastas: ['src'], raiz, incluirTestesEDts: true, ignorarDiretorios: ['node_modules'] }).map((f) =>
      caminhoRelativo(f, raiz),
    );
    expect(achados).toEqual(['src/a/__tests__/y.ts', 'src/a/dois.tsx', 'src/a/tipos.d.ts', 'src/a/x.test.ts', 'src/um.ts']);
  });

  it('lança quando a pasta pedida não existe (guarda cega não passa)', () => {
    expect(() => listarFontes({ pastas: ['nao-existe'], raiz })).toThrow(/nao-existe/);
  });

  it('lerFontes devolve caminho relativo e conteúdo', () => {
    expect(lerFontes({ pastas: ['src'], raiz })).toEqual([
      { arquivo: 'src/a/dois.tsx', fonte: 'dois' },
      { arquivo: 'src/um.ts', fonte: 'um' },
    ]);
  });

  it('varre o repositório real: src e app têm centenas de fontes', () => {
    const fontes = listarFontes({ pastas: ['src', 'app'] });
    exigirVolume(fontes, 300);
    expect(RAIZ_REPOSITORIO).toBeTruthy();
  });
});

describe('exigirVolume', () => {
  it('passa com o piso atingido', () => {
    expect(() => exigirVolume([1, 2, 3], 3)).not.toThrow();
  });

  it('falha com lista abaixo do piso', () => {
    expect(() => exigirVolume([], 1)).toThrow(/cega/);
  });
});
