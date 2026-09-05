import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  VALIDADE_MS,
  lerConclusaoEmVoo,
  limparConclusaoEmVoo,
  marcarConclusaoEmVoo,
  paradaParaReabrir,
} from '../conclusaoEmVoo';

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const CHAVE = '@rotamestre:conclusao_em_voo';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

describe('conclusaoEmVoo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
  });

  it('grava parada, rota e instante', async () => {
    await marcarConclusaoEmVoo('parada-1', 'rota-9', 1_000);

    expect(mockSetItem).toHaveBeenCalledWith(
      CHAVE,
      JSON.stringify({ paradaId: 'parada-1', rotaId: 'rota-9', em: 1_000 }),
    );
  });

  it('devolve o marcador dentro da validade', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ paradaId: 'parada-1', rotaId: 'rota-9', em: 1_000 }),
    );

    const marcador = await lerConclusaoEmVoo(1_000 + VALIDADE_MS - 1);

    expect(marcador).toEqual({
      paradaId: 'parada-1',
      rotaId: 'rota-9',
      em: 1_000,
    });
    // Ler não consome: quem apaga é quem recupera a foto.
    expect(mockRemoveItem).not.toHaveBeenCalled();
  });

  it('descarta e apaga marcador vencido', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ paradaId: 'parada-1', rotaId: 'rota-9', em: 1_000 }),
    );

    const marcador = await lerConclusaoEmVoo(1_000 + VALIDADE_MS + 1);

    expect(marcador).toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(CHAVE);
  });

  it('descarta JSON truncado sem estourar', async () => {
    // Processo morto no meio da escrita deixa exatamente isto.
    mockGetItem.mockResolvedValue('{"paradaId":"parada-1","rot');

    await expect(lerConclusaoEmVoo()).resolves.toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(CHAVE);
  });

  it('descarta marcador com campo faltando', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ paradaId: 'parada-1' }));

    await expect(lerConclusaoEmVoo()).resolves.toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(CHAVE);
  });

  it('sem marcador devolve null e não apaga nada', async () => {
    await expect(lerConclusaoEmVoo()).resolves.toBeNull();
    expect(mockRemoveItem).not.toHaveBeenCalled();
  });

  it('falha do AsyncStorage na leitura não derruba o fluxo', async () => {
    mockGetItem.mockRejectedValue(new Error('storage indisponível'));

    await expect(lerConclusaoEmVoo()).resolves.toBeNull();
  });

  it('falha do AsyncStorage na escrita não derruba o fluxo', async () => {
    // Marcar é best-effort: sem ele o app volta a perder a conclusão numa
    // recriação, mas não pode impedir o motorista de tirar a foto.
    mockSetItem.mockRejectedValue(new Error('storage cheio'));

    await expect(
      marcarConclusaoEmVoo('parada-1', 'rota-9'),
    ).resolves.toBeUndefined();
  });

  it('limpar remove a chave', async () => {
    await limparConclusaoEmVoo();

    expect(mockRemoveItem).toHaveBeenCalledWith(CHAVE);
  });
});

describe('paradaParaReabrir', () => {
  const marcador = { paradaId: 'parada-1', rotaId: 'rota-9', em: 1_000 };
  const rota = { id: 'rota-9', status: 'em_andamento' };
  const paradas = [
    { id: 'parada-0', status: 'concluida' },
    { id: 'parada-1', status: 'pendente' },
  ];

  it('reabre a parada do marcador quando tudo confere', () => {
    expect(paradaParaReabrir(marcador, rota, paradas)).toEqual({
      id: 'parada-1',
      status: 'pendente',
    });
  });

  it('reabre também parada em andamento', () => {
    // É o estado normal da "próxima parada" — recusar aqui mataria o caso
    // mais comum de todos.
    const emAndamento = [{ id: 'parada-1', status: 'em_andamento' }];
    expect(paradaParaReabrir(marcador, rota, emAndamento)).not.toBeNull();
  });

  it('não reabre sem marcador', () => {
    expect(paradaParaReabrir(null, rota, paradas)).toBeNull();
  });

  it('não reabre sem rota carregada', () => {
    expect(paradaParaReabrir(marcador, null, paradas)).toBeNull();
  });

  it('não reabre se o marcador é de outra rota', () => {
    const outraRota = { id: 'rota-outra', status: 'em_andamento' };
    expect(paradaParaReabrir(marcador, outraRota, paradas)).toBeNull();
  });

  it('não reabre com a rota fora de andamento', () => {
    // Concluir parada de rota encerrada só produz erro na cara do motorista.
    for (const status of ['pendente', 'concluida', 'nao_executada']) {
      expect(
        paradaParaReabrir(marcador, { ...rota, status }, paradas),
      ).toBeNull();
    }
  });

  it('não reabre se a parada sumiu da rota', () => {
    expect(paradaParaReabrir(marcador, rota, [paradas[0]])).toBeNull();
  });

  it('não reabre parada já concluída ou pulada', () => {
    // Resolvida pelo gestor, por outro aparelho, ou por um retry que passou.
    for (const status of ['concluida', 'pulada']) {
      const resolvidas = [{ id: 'parada-1', status }];
      expect(paradaParaReabrir(marcador, rota, resolvidas)).toBeNull();
    }
  });
});
