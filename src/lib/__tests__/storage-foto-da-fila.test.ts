/**
 * Foto de comprovante que esperava no aparelho (`processOfflinePhotos`).
 *
 * Regra: comprovante NUNCA se perde. Sobe sempre que a conta dona puder
 * subir; liga em `paradas.foto_url` só se a parada estiver visível e ainda
 * sem foto (não sobrescreve comprovante de outro caminho). Sem ligar, o
 * caminho do objeto fica registrado em `logs` (com `parada_id` dentro de
 * `detalhes`) para o gestor recuperar. O resultado só sai `null` — "a foto
 * fica no aparelho" — quando nada disso foi confirmado.
 *
 * O Supabase aqui é um fake com as regras que importam: o UPDATE condicional
 * devolve as linhas alteradas (0 = parada invisível pela RLS ou já com foto).
 */
import { salvarFotoParada, subirFotoDaFilaOffline } from '../storage';

jest.mock('../logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

interface Estado {
  uploadFalha: boolean;
  /** Linhas que o UPDATE condicional altera (0 = invisível ou já tem foto). */
  linhasLigadas: number;
  updateErro: Error | null;
  /** Inserts em logs recusados enquanto o rota_id vier preenchido. */
  logRecusaComRota: boolean;
  logErro: Error | null;
  /** `prevent_duplicate_log` cancela o INSERT sem erro. */
  logDuplicado: boolean;
  uploads: string[];
  updates: { dados: unknown; filtros: [string, string, unknown][] }[];
  logs: Record<string, unknown>[];
}

const mockEstado: Estado = {} as Estado;

jest.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: async (path: string) => {
          if (mockEstado.uploadFalha) {
            return { data: null, error: new Error('rede') };
          }
          mockEstado.uploads.push(path);
          return { data: { path }, error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
    from: (tabela: string) => {
      if (tabela === 'logs') {
        return {
          insert: (linha: Record<string, unknown>) => ({
            select: async () => {
              if (mockEstado.logErro) {
                return { data: null, error: mockEstado.logErro };
              }
              if (mockEstado.logRecusaComRota && linha.rota_id) {
                return { data: null, error: { code: '42501', message: 'RLS' } };
              }
              // Gatilho de duplicata: cancela sem erro e sem linha.
              if (mockEstado.logDuplicado) return { data: [], error: null };
              mockEstado.logs.push(linha);
              return { data: [{ id: 'log-1' }], error: null };
            },
          }),
        };
      }
      const registro = {
        dados: null as unknown,
        filtros: [] as [string, string, unknown][],
      };
      const consulta = {
        update: (dados: unknown) => {
          registro.dados = dados;
          return consulta;
        },
        eq: (c: string, v: unknown) => {
          registro.filtros.push(['eq', c, v]);
          return consulta;
        },
        is: (c: string, v: unknown) => {
          registro.filtros.push(['is', c, v]);
          return consulta;
        },
        select: async () => {
          mockEstado.updates.push(registro);
          if (mockEstado.updateErro) {
            return { data: null, error: mockEstado.updateErro };
          }
          return {
            data: Array.from({ length: mockEstado.linhasLigadas }, () => ({
              id: 'p1',
            })),
            error: null,
          };
        },
      };
      return consulta;
    },
  },
}));

global.fetch = jest.fn(async () => ({
  blob: async () => {
    const b = new Blob(['x'], { type: 'image/jpeg' });
    Object.defineProperty(b, 'size', { value: 1000 });
    (b as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer =
      async () => new ArrayBuffer(1000);
    return b;
  },
})) as unknown as typeof fetch;

beforeEach(() => {
  Object.assign(mockEstado, {
    uploadFalha: false,
    linhasLigadas: 1,
    updateErro: null,
    logRecusaComRota: false,
    logErro: null,
    logDuplicado: false,
    uploads: [],
    updates: [],
    logs: [],
  });
});

const subir = () =>
  subirFotoDaFilaOffline({
    unidadeId: 'u1',
    rotaId: 'r1',
    paradaId: 'p1',
    fotoUri: 'file:///foto.jpg',
    usuarioId: 'mot-1',
  });

describe('subirFotoDaFilaOffline', () => {
  it('parada visível e sem foto: sobe e liga, sem sobrescrever (UPDATE só com foto_url nula)', async () => {
    const r = await subir();

    expect(r).toEqual({ resultado: 'ligada', path: mockEstado.uploads[0] });
    expect(mockEstado.uploads[0]).toMatch(/^u1\/r1\/p1_\d+\.jpg$/);
    expect(mockEstado.updates[0].filtros).toContainEqual([
      'is',
      'foto_url',
      null,
    ]);
    expect(mockEstado.logs).toEqual([]);
  });

  it('parada invisível ou já com foto: sobe, não liga e registra o caminho em logs para o gestor', async () => {
    mockEstado.linhasLigadas = 0;

    const r = await subir();

    expect(r).toEqual({ resultado: 'registrada', path: mockEstado.uploads[0] });
    expect(mockEstado.logs).toEqual([
      {
        usuario_id: 'mot-1',
        rota_id: 'r1',
        evento: 'foto_comprovante_sem_vinculo',
        detalhes: { parada_id: 'p1', foto_path: mockEstado.uploads[0] },
      },
    ]);
  });

  it('rota fora do alcance do log (RLS): registra sem rota_id, a parada vai em detalhes', async () => {
    mockEstado.linhasLigadas = 0;
    mockEstado.logRecusaComRota = true;

    const r = await subir();

    expect(r?.resultado).toBe('registrada');
    expect(mockEstado.logs).toEqual([
      expect.objectContaining({
        rota_id: null,
        detalhes: { parada_id: 'p1', foto_path: mockEstado.uploads[0] },
      }),
    ]);
  });

  it('upload falhou: null (a foto fica no aparelho)', async () => {
    mockEstado.uploadFalha = true;
    expect(await subir()).toBeNull();
    expect(mockEstado.logs).toEqual([]);
  });

  it('não ligou e o registro também falhou: null (a foto fica no aparelho)', async () => {
    mockEstado.linhasLigadas = 0;
    mockEstado.logErro = new Error('rede');
    expect(await subir()).toBeNull();
  });

  it('registro cancelado em silêncio pelo gatilho de duplicata: null (não finge que registrou)', async () => {
    mockEstado.linhasLigadas = 0;
    mockEstado.logDuplicado = true;
    expect(await subir()).toBeNull();
  });

  it('erro ao ligar (rede): null, sem fingir que ligou', async () => {
    mockEstado.updateErro = new Error('rede');
    expect(await subir()).toBeNull();
  });
});

describe('salvarFotoParada', () => {
  it('UPDATE sem linha alterada (parada invisível) não é sucesso', async () => {
    mockEstado.linhasLigadas = 0;
    expect(await salvarFotoParada('p1', 'u1/r1/p1.jpg')).toBe(false);
  });

  it('com a linha alterada, é sucesso', async () => {
    expect(await salvarFotoParada('p1', 'u1/r1/p1.jpg')).toBe(true);
  });
});
