import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  VALIDADE_RASCUNHO_MS,
  lerRascunhoIncidente,
  limparRascunhoIncidente,
  salvarRascunhoIncidente,
} from '../rascunhoIncidente';

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const CHAVE = '@rotamestre:rascunho_incidente';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

const RASCUNHO = {
  paradaId: 'parada-1',
  rotaId: 'rota-9',
  passo: 2,
  categoria: 'blocked',
  descricao: 'portao fechado',
  fotoUri: 'file:///cache/foto.jpg',
  cameraAberta: true,
  em: 1_000,
};

describe('rascunhoIncidente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
  });

  it('guarda o wizard inteiro, não só a foto', async () => {
    // O wizard tem 4 passos. Perder categoria e descrição obriga o motorista a
    // refazer tudo, que é o custo real da recriação da Activity aqui.
    await salvarRascunhoIncidente(RASCUNHO);

    expect(mockSetItem).toHaveBeenCalledWith(CHAVE, JSON.stringify(RASCUNHO));
  });

  it('devolve o rascunho dentro da validade', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(RASCUNHO));

    await expect(
      lerRascunhoIncidente(1_000 + VALIDADE_RASCUNHO_MS - 1),
    ).resolves.toEqual(RASCUNHO);
  });

  it('descarta e apaga rascunho vencido', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(RASCUNHO));

    await expect(
      lerRascunhoIncidente(1_000 + VALIDADE_RASCUNHO_MS + 1),
    ).resolves.toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(CHAVE);
  });

  it('descarta JSON truncado sem estourar', async () => {
    mockGetItem.mockResolvedValue('{"paradaId":"parada-1","cat');

    await expect(lerRascunhoIncidente()).resolves.toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(CHAVE);
  });

  it('descarta rascunho sem os campos de identidade', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ categoria: 'blocked' }));

    await expect(lerRascunhoIncidente()).resolves.toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(CHAVE);
  });

  it('falha do AsyncStorage não derruba o fluxo', async () => {
    mockSetItem.mockRejectedValue(new Error('storage cheio'));

    await expect(salvarRascunhoIncidente(RASCUNHO)).resolves.toBeUndefined();
  });

  it('limpar remove a chave', async () => {
    await limparRascunhoIncidente();

    expect(mockRemoveItem).toHaveBeenCalledWith(CHAVE);
  });
});
