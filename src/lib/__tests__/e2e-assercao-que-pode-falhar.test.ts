import { readdirSync } from 'fs';
import { join } from 'path';

import { RAIZ, lerFonte, semComentarios } from './helpers/varreduraDeFontes';

/**
 * Guarda: teste e2e precisa poder falhar.
 *
 * O QUE ISTO IMPEDE. Em 07/09/2026, 24 dos 124 testes e2e eram satisfeitos por
 * qualquer página que renderizasse — inclusive a de erro. O padrão era sempre o
 * mesmo, e é ele que esta guarda reconhece:
 *
 *     const _hasStatusBreakdown =
 *       bodyText?.includes('Pendente') || bodyText?.includes('Em Andamento');
 *
 *     expect(bodyText?.length).toBeGreaterThan(100);
 *
 * A verificação de verdade era escrita, descartada com prefixo `_` para calar o
 * linter, e no lugar dela ficava uma asserção sobre o COMPRIMENTO da página.
 * Passavam com o app quebrado, e por parecerem cobertura, desencorajavam quem
 * fosse escrever o teste de verdade.
 *
 * POR QUE ESTA GUARDA E NÃO UM CLASSIFICADOR. Tentou-se medir "assercão fraca"
 * de forma geral; três versões do classificador deram 72, 54 e 24, e só a
 * última sobreviveu à leitura dos arquivos. Julgar força de asserção por regex
 * não se sustenta. Estes dois padrões, ao contrário, são sintomas específicos e
 * inequívocos — não exigem julgamento.
 *
 * POR QUE É UMA CATRACA. Os arquivos abaixo já foram convertidos e não podem
 * regredir. Os que ficaram de fora estão nomeados em `AINDA_NAO_CONVERTIDOS`,
 * com o que falta em cada um: a lista é dívida declarada, não isenção — quem
 * converter um arquivo move-o para cá e a catraca aperta.
 *
 * Roda no Jest, não no Playwright: vale em todo PR, inclusive sem os secrets
 * `E2E_*`.
 */

// Sintomas. Ver o cabeçalho para o porquê de serem estes dois e não uma medida
// geral de "asserção fraca".
const SINTOMAS: { padrao: RegExp; explicacao: string }[] = [
  {
    padrao: /\.length\s*\)\s*\.\s*toBeGreaterThan/,
    explicacao:
      'asserção sobre o COMPRIMENTO da página (`expect(bodyText?.length).toBeGreaterThan(...)`) — ' +
      'satisfeita por qualquer página que renderize, inclusive a de erro. ' +
      'Afirme o elemento que a tela deve mostrar.',
  },
  {
    // Vale para qualquer nome, não só `_hasX`: a patologia é computar e
    // descartar, e ela aparece também como `_drawerContent`, `_fileInput`,
    // `_suggestionCount`. Num arquivo de TESTE, valor calculado e não afirmado
    // é sempre suspeito — foi computado para verificar algo.
    padrao: /\bconst\s+_\w+\s*=/,
    explicacao:
      'valor computado e descartado (`const _algo = ...`, com o `_` calando o linter). ' +
      'Se valeu computar, vale afirmar: troque por `await expect(...)`.',
  },
];

const CONVERTIDOS = [
  'auth.e2e.ts',
  'dashboard-reports.e2e.ts',
  'design-system.e2e.ts',
  'gestor-route-creation.e2e.ts',
  'gestor-team-management.e2e.ts',
  'motorista-drawer-menu.e2e.ts',
  'motorista-navigation.e2e.ts',
  'motorista-route-execution.e2e.ts',
  'photo-proof.e2e.ts',
  'smoke.e2e.ts',
  'visual-critical.e2e.ts',
];

// Dívida declarada, com o tamanho de cada uma. Quem converter um arquivo
// move-o para CONVERTIDOS — a catraca só aperta.
//
// ZERADA EM 07/09/2026: todos os arquivos e2e estão em CONVERTIDOS. Manter o
// mapa (vazio) em vez de apagá-lo é deliberado — é ele que dá para onde apontar
// quando um arquivo novo entrar sem poder falhar ainda, sem que se precise
// reinventar o mecanismo.
const AINDA_NAO_CONVERTIDOS: Record<string, string> = {};

function arquivosE2E(): string[] {
  return readdirSync(join(RAIZ, 'e2e'))
    .filter((f) => f.endsWith('.e2e.ts'))
    .sort();
}

describe('teste e2e precisa poder falhar', () => {
  it.each(CONVERTIDOS)(
    '%s não reintroduz asserção que não pode falhar',
    (arquivo) => {
      // `semComentarios` é obrigatório aqui: o cabeçalho de
      // `dashboard-reports.e2e.ts` cita o padrão proibido para explicá-lo, e uma
      // guarda que lesse comentários acusaria a própria documentação. Foi
      // exatamente o que aconteceu com a guarda de pt-BR no PR #493.
      const fonte = semComentarios(lerFonte(`e2e/${arquivo}`));

      for (const { padrao, explicacao } of SINTOMAS) {
        expect(
          padrao.test(fonte) ? `${arquivo}: ${explicacao}` : null,
        ).toBeNull();
      }
    },
  );

  it('a catraca cobre todo arquivo e2e: convertido ou dívida declarada', () => {
    const conhecidos = new Set([
      ...CONVERTIDOS,
      ...Object.keys(AINDA_NAO_CONVERTIDOS),
    ]);
    const novos = arquivosE2E().filter((f) => !conhecidos.has(f));

    // Arquivo e2e novo entra como convertido (nasce afirmando) ou é declarado
    // como dívida com o que falta. O que não pode é entrar sem ninguém olhar.
    expect(novos).toEqual([]);
  });

  it('arquivo listado como dívida ainda existe', () => {
    const existentes = new Set(arquivosE2E());
    const fantasmas = Object.keys(AINDA_NAO_CONVERTIDOS).filter(
      (f) => !existentes.has(f),
    );

    // Dívida de arquivo apagado é ruído: some da lista.
    expect(fantasmas).toEqual([]);
  });

  it('arquivo já limpo não fica pendurado na lista de dívida', () => {
    // Se alguém converteu um arquivo e esqueceu de mover, a lista mente sobre o
    // estado do repo. Aqui a mentira falha.
    const jaLimpos = Object.keys(AINDA_NAO_CONVERTIDOS).filter((arquivo) => {
      const fonte = semComentarios(lerFonte(`e2e/${arquivo}`));
      return !SINTOMAS.some(({ padrao }) => padrao.test(fonte));
    });

    expect(jaLimpos).toEqual([]);
  });
});
