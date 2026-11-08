/**
 * `secureAuthStorage`: único armazenamento da sessão do Supabase no nativo.
 * Sessão perdida = motorista deslogado no meio da rota, e a fila offline com
 * ações pendentes depende do login. A lógica própria (blocos de 1800
 * caracteres, ponteiro em metadado, migração do AsyncStorage legado) é toda
 * coberta aqui.
 *
 * Escrita atômica (pendência 30(l)): a sessão nova vai em blocos de uma
 * geração (`a`/`b`) que o ponteiro não referencia, e só então o ponteiro
 * (uma chave só, gravação única) troca de geração. Falha em qualquer passo
 * antes da troca deixa a sessão anterior inteira; depois dela, a nova.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '../logger';
import { secureAuthStorage } from '../secureAuthStorage';

const mockCofre = new Map<string, string>();
/** Número da chamada de escrita/remoção (1-based) que deve falhar. */
let mockFalharNaEscrita: number | null = null;
let mockEscritas = 0;

function mockContarEscrita() {
  mockEscritas += 1;
  if (mockFalharNaEscrita === mockEscritas) {
    throw new Error('falha simulada no cofre');
  }
}

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (chave: string) => mockCofre.get(chave) ?? null),
  setItemAsync: jest.fn(async (chave: string, valor: string) => {
    mockContarEscrita();
    mockCofre.set(chave, valor);
  }),
  deleteItemAsync: jest.fn(async (chave: string) => {
    mockContarEscrita();
    mockCofre.delete(chave);
  }),
}));

const CHAVE = 'sb-sessao';
const META = `${CHAVE}.secure.meta`;
const TAMANHO_BLOCO = 1800;

function chavesDoCofre(): string[] {
  return [...mockCofre.keys()].sort();
}

/** Grava `valor` com o cofre limpo e sem falha simulada. */
async function partirDe(valor: string) {
  mockCofre.clear();
  mockFalharNaEscrita = null;
  await secureAuthStorage.setItem(CHAVE, valor);
}

/**
 * Tenta gravar `nova` com a escrita/remoção número `passo` falhando.
 * Devolve se o `setItem` rejeitou.
 */
async function gravarFalhandoNoPasso(
  nova: string,
  passo: number,
): Promise<boolean> {
  mockEscritas = 0;
  mockFalharNaEscrita = passo;
  try {
    await secureAuthStorage.setItem(CHAVE, nova);
    return false;
  } catch {
    return true;
  } finally {
    mockFalharNaEscrita = null;
  }
}

/** Quantas escritas/remoções no cofre o `setItem` de `nova` faz, sem falha. */
async function contarEscritas(
  prepararAnterior: () => Promise<void> | void,
  nova: string,
): Promise<number> {
  mockCofre.clear();
  await prepararAnterior();
  mockEscritas = 0;
  await secureAuthStorage.setItem(CHAVE, nova);
  return mockEscritas;
}

describe('secureAuthStorage', () => {
  beforeEach(() => {
    mockCofre.clear();
    mockFalharNaEscrita = null;
    mockEscritas = 0;
    jest.clearAllMocks();
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('grava e lê um valor que cabe num bloco só', async () => {
    await secureAuthStorage.setItem(CHAVE, '{"a":1}');

    expect(await secureAuthStorage.getItem(CHAVE)).toBe('{"a":1}');
    // Um bloco e o ponteiro, nada mais.
    expect(chavesDoCofre()).toHaveLength(2);
    expect(mockCofre.has(META)).toBe(true);
  });

  it('parte valor grande em blocos de 1800 e o devolve inteiro', async () => {
    const valor = 'x'.repeat(TAMANHO_BLOCO * 2 + 5) + 'FIM';
    await secureAuthStorage.setItem(CHAVE, valor);

    const blocos = chavesDoCofre().filter((chave) => chave !== META);
    expect(blocos).toHaveLength(3);
    expect(mockCofre.get(blocos[0])).toHaveLength(TAMANHO_BLOCO);
    expect(await secureAuthStorage.getItem(CHAVE)).toBe(valor);
  });

  it('sessão nova menor que a antiga não deixa bloco velho no cofre', async () => {
    await secureAuthStorage.setItem(CHAVE, 'y'.repeat(TAMANHO_BLOCO * 3));
    await secureAuthStorage.setItem(CHAVE, 'curta');

    expect(chavesDoCofre()).toHaveLength(2);
    expect(await secureAuthStorage.getItem(CHAVE)).toBe('curta');
  });

  it('gravações seguidas alternam de geração e não acumulam blocos', async () => {
    for (let i = 0; i < 5; i += 1) {
      await secureAuthStorage.setItem(CHAVE, `v${i}`.repeat(TAMANHO_BLOCO));
    }

    expect(await secureAuthStorage.getItem(CHAVE)).toBe(
      'v4'.repeat(TAMANHO_BLOCO),
    );
    expect(chavesDoCofre()).toHaveLength(3);
  });

  it('devolve null se algum bloco sumiu, em vez de uma sessão truncada', async () => {
    await secureAuthStorage.setItem(CHAVE, 'z'.repeat(TAMANHO_BLOCO * 2 + 1));
    const umBloco = chavesDoCofre().find((chave) => chave !== META);
    mockCofre.delete(umBloco as string);

    expect(await secureAuthStorage.getItem(CHAVE)).toBeNull();
  });

  it('devolve null quando não há nada, nem no cofre nem no legado', async () => {
    expect(await secureAuthStorage.getItem(CHAVE)).toBeNull();
  });

  describe('falha no meio da escrita', () => {
    const casos: [string, string, string][] = [
      [
        'anterior e nova com vários blocos',
        'A'.repeat(TAMANHO_BLOCO * 2 + 7),
        'B'.repeat(TAMANHO_BLOCO * 3 + 1),
      ],
      ['nova menor que a anterior', 'C'.repeat(TAMANHO_BLOCO * 3), 'curta'],
      ['nova maior que a anterior', 'curta', 'D'.repeat(TAMANHO_BLOCO * 2)],
    ];

    it.each(casos)(
      '%s: em qualquer passo, a leitura devolve a anterior ou a nova, inteira',
      async (_nome, anterior, nova) => {
        const total = await contarEscritas(
          () => secureAuthStorage.setItem(CHAVE, anterior),
          nova,
        );
        expect(total).toBeGreaterThan(1);
        const desfechos = new Set<boolean>();

        for (let passo = 1; passo <= total; passo += 1) {
          await partirDe(anterior);
          const rejeitou = await gravarFalhandoNoPasso(nova, passo);
          desfechos.add(rejeitou);

          // Rejeitou = a nova não foi confirmada: vale a anterior, inteira.
          // Resolveu = a nova foi confirmada (a falha foi na limpeza).
          expect(await secureAuthStorage.getItem(CHAVE)).toBe(
            rejeitou ? anterior : nova,
          );

          // E a próxima gravação, sem falha, se recupera por completo.
          await secureAuthStorage.setItem(CHAVE, 'depois');
          expect(await secureAuthStorage.getItem(CHAVE)).toBe('depois');
          expect(chavesDoCofre()).toHaveLength(2);
        }

        // A varredura passou por falhas antes e depois da troca do ponteiro.
        expect([...desfechos].sort()).toEqual([false, true]);
      },
    );

    it('falha na primeira operação não apaga a anterior do cofre', async () => {
      const anterior = 'E'.repeat(TAMANHO_BLOCO * 2);
      await partirDe(anterior);

      expect(
        await gravarFalhandoNoPasso('F'.repeat(TAMANHO_BLOCO * 2), 1),
      ).toBe(true);

      expect(await secureAuthStorage.getItem(CHAVE)).toBe(anterior);
    });

    it('falha na limpeza depois da troca não rejeita: a nova já vale', async () => {
      const anterior = 'N'.repeat(TAMANHO_BLOCO * 2);
      const nova = 'O'.repeat(TAMANHO_BLOCO * 2);
      const total = await contarEscritas(
        () => secureAuthStorage.setItem(CHAVE, anterior),
        nova,
      );
      await partirDe(anterior);

      // A última operação é limpeza da geração anterior.
      expect(await gravarFalhandoNoPasso(nova, total)).toBe(false);

      expect(await secureAuthStorage.getItem(CHAVE)).toBe(nova);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  it('gravações simultâneas não se intercalam: vale a última, sem sobra da outra', async () => {
    const primeira = '1'.repeat(TAMANHO_BLOCO * 4);
    const segunda = '2'.repeat(TAMANHO_BLOCO * 3);

    await Promise.all([
      secureAuthStorage.setItem(CHAVE, primeira),
      secureAuthStorage.setItem(CHAVE, segunda),
    ]);

    expect(await secureAuthStorage.getItem(CHAVE)).toBe(segunda);
    // 3 blocos da segunda + ponteiro; nenhum bloco da primeira sobrando.
    expect(chavesDoCofre()).toHaveLength(4);
  });

  describe('formato antigo (aparelhos que já têm sessão gravada)', () => {
    // Formato até esta versão: metadado com a contagem pura ("2") e blocos
    // em `<chave>.secure.<i>`.
    function gravarFormatoAntigo(valor: string) {
      const blocos = Math.ceil(valor.length / TAMANHO_BLOCO);
      mockCofre.set(META, String(blocos));
      for (let i = 0; i < blocos; i += 1) {
        mockCofre.set(
          `${CHAVE}.secure.${i}`,
          valor.slice(i * TAMANHO_BLOCO, (i + 1) * TAMANHO_BLOCO),
        );
      }
    }

    it('lê a sessão gravada no formato antigo sem perdê-la', async () => {
      const valor = 'G'.repeat(TAMANHO_BLOCO * 2 + 3) + 'FIM';
      gravarFormatoAntigo(valor);

      expect(await secureAuthStorage.getItem(CHAVE)).toBe(valor);
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });

    it('a primeira gravação nova sai do formato antigo e apaga os blocos dele', async () => {
      gravarFormatoAntigo('H'.repeat(TAMANHO_BLOCO * 3));

      await secureAuthStorage.setItem(CHAVE, 'nova');

      expect(await secureAuthStorage.getItem(CHAVE)).toBe('nova');
      expect(chavesDoCofre()).toHaveLength(2);
      for (let i = 0; i < 3; i += 1) {
        expect(mockCofre.has(`${CHAVE}.secure.${i}`)).toBe(false);
      }
    });

    it('falha ao sair do formato antigo mantém a sessão antiga legível', async () => {
      const antiga = 'I'.repeat(TAMANHO_BLOCO * 2);
      const nova = 'J'.repeat(TAMANHO_BLOCO * 2);
      const total = await contarEscritas(
        () => gravarFormatoAntigo(antiga),
        nova,
      );

      const desfechos = new Set<boolean>();
      for (let passo = 1; passo <= total; passo += 1) {
        mockCofre.clear();
        gravarFormatoAntigo(antiga);
        const rejeitou = await gravarFalhandoNoPasso(nova, passo);
        desfechos.add(rejeitou);

        expect(await secureAuthStorage.getItem(CHAVE)).toBe(
          rejeitou ? antiga : nova,
        );
      }
      expect([...desfechos].sort()).toEqual([false, true]);
    });

    it('removeItem apaga a sessão no formato antigo', async () => {
      gravarFormatoAntigo('K'.repeat(TAMANHO_BLOCO * 2));

      await secureAuthStorage.removeItem(CHAVE);

      expect(chavesDoCofre()).toEqual([]);
    });
  });

  it('metadado ilegível não derruba a leitura: cai no legado', async () => {
    mockCofre.set(META, 'lixo');

    expect(await secureAuthStorage.getItem(CHAVE)).toBeNull();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(CHAVE);
  });

  it('migra a sessão legada do AsyncStorage: grava no cofre e só então apaga o legado', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{"legado":true}');
    const ordem: string[] = [];
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async () => {
      // No instante em que o legado é apagado, o cofre já tem a sessão.
      ordem.push(`apagou-legado;tem-ponteiro=${mockCofre.has(META)}`);
    });

    expect(await secureAuthStorage.getItem(CHAVE)).toBe('{"legado":true}');

    expect(ordem).toEqual(['apagou-legado;tem-ponteiro=true']);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    expect(await secureAuthStorage.getItem(CHAVE)).toBe('{"legado":true}');
  });

  it('com a sessão já no cofre, não consulta nem migra o legado', async () => {
    await secureAuthStorage.setItem(CHAVE, 'no-mockCofre');
    (AsyncStorage.getItem as jest.Mock).mockClear();

    expect(await secureAuthStorage.getItem(CHAVE)).toBe('no-mockCofre');
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('setItem apaga qualquer cópia legada', async () => {
    await secureAuthStorage.setItem(CHAVE, 'nova');

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CHAVE);
  });

  it('removeItem limpa blocos, metadado e legado', async () => {
    await secureAuthStorage.setItem(CHAVE, 'w'.repeat(TAMANHO_BLOCO + 1));
    await secureAuthStorage.removeItem(CHAVE);

    expect(chavesDoCofre()).toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CHAVE);
    expect(await secureAuthStorage.getItem(CHAVE)).toBeNull();
  });

  it('removeItem apaga também blocos órfãos de gravações que falharam', async () => {
    const anterior = 'L'.repeat(TAMANHO_BLOCO * 2);
    const nova = 'M'.repeat(TAMANHO_BLOCO * 4);
    const total = await contarEscritas(
      () => secureAuthStorage.setItem(CHAVE, anterior),
      nova,
    );

    // Procura, do fim para o começo, o último passo cuja falha ainda rejeita:
    // é o que deixa no cofre o maior número de blocos órfãos da geração nova.
    let maisOrfaos = 0;
    for (let passo = total; passo >= 1; passo -= 1) {
      await partirDe(anterior);
      if (await gravarFalhandoNoPasso(nova, passo)) {
        maisOrfaos = mockCofre.size;
        break;
      }
    }
    // Anterior (2 blocos + ponteiro) + órfãos da nova.
    expect(maisOrfaos).toBeGreaterThan(3);
    expect(await secureAuthStorage.getItem(CHAVE)).toBe(anterior);

    await secureAuthStorage.removeItem(CHAVE);

    expect(chavesDoCofre()).toEqual([]);
    expect(await secureAuthStorage.getItem(CHAVE)).toBeNull();
  });
});
