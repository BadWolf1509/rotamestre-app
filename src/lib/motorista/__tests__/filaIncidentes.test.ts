/**
 * Fila de incidentes reportados sem rede (pendência 30(k)).
 *
 * O banco e o Storage aqui são FAKES em memória com as regras que importam no
 * servidor: a chave primária recusa o mesmo `id` duas vezes (23505), o INSERT
 * só vale com `motorista_id` = sessão, e o arquivo local some quando apagado.
 * Os testes julgam o que fica no banco e na fila, não as chamadas.
 */
import { MAX_TENTATIVAS } from '../filaAcoesParada';
import {
  enfileirarIncidente,
  lerFilaIncidentes,
  lerDescartesDeIncidentes,
  dispensarDescartesDeIncidentes,
  processarFilaIncidentes,
  sincronizarFilaIncidentes,
  _resetFilaIncidentes,
  type IncidenteNaFila,
  type PortaIncidentes,
} from '../filaIncidentes';

jest.mock('@react-native-async-storage/async-storage', () => {
  const mapa = new Map<string, string>();
  return {
    __mapa: mapa,
    getItem: jest.fn(async (k: string) => mapa.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mapa.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      mapa.delete(k);
    }),
  };
});

jest.mock('expo-file-system/legacy', () => {
  const arquivos = new Set<string>();
  return {
    __arquivos: arquivos,
    documentDirectory: 'file:///docs/',
    getInfoAsync: jest.fn(async (p: string) => ({ exists: arquivos.has(p) })),
    makeDirectoryAsync: jest.fn(async () => undefined),
    copyAsync: jest.fn(async ({ to }: { from: string; to: string }) => {
      arquivos.add(to);
    }),
    deleteAsync: jest.fn(async (p: string) => {
      arquivos.delete(p);
    }),
  };
});

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const mockLerSessao = jest.fn();
jest.mock('@/lib/auth/sessao', () => ({
  lerSessao: () => mockLerSessao(),
  descartarLeituraEmCurso: jest.fn(),
}));
jest.mock('@/lib/semRede', () => ({
  semRedeConfirmada: jest.fn(async () => false),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/storage', () => ({ enviarFotoDeIncidente: jest.fn() }));
jest.mock('@/lib/queries', () => ({ logIncidenteAction: jest.fn() }));

const arquivos: Set<string> = jest.requireMock(
  'expo-file-system/legacy',
).__arquivos;

const ERRO_DE_REDE = new TypeError('Network request failed');

interface LinhaFake {
  id: string;
  motorista_id: string;
  descricao: string;
  foto_url: string | null;
}

function criarServidor(sessao: () => string) {
  const linhas: LinhaFake[] = [];
  /** Rastro em `logs` (`incidente_reportado`), por id. */
  const registros: string[] = [];
  const objetos: string[] = [];
  let falhaInsert: unknown = null;
  let falhaFoto: unknown = null;
  /** Grava a linha e perde a resposta (o INSERT passou, a volta não). */
  let perderRespostaDoInsert = false;

  const porta: PortaIncidentes = {
    async subirFoto(incidente, fotoLocal) {
      if (falhaFoto) throw falhaFoto;
      if (!arquivos.has(fotoLocal)) throw new Error('arquivo sumiu');
      const path = `incidentes/${incidente.id}_${objetos.length}.jpg`;
      objetos.push(path);
      return path;
    },
    async inserir(incidente, fotoPath) {
      if (falhaInsert) throw falhaInsert;
      if (incidente.motoristaId !== sessao()) {
        throw { code: '42501', message: 'new row violates row-level security' };
      }
      if (linhas.some((l) => l.id === incidente.id)) {
        throw { code: '23505', message: 'duplicate key incidentes_pkey' };
      }
      linhas.push({
        id: incidente.id,
        motorista_id: incidente.motoristaId,
        descricao: incidente.descricao,
        foto_url: fotoPath,
      });
      if (perderRespostaDoInsert) {
        perderRespostaDoInsert = false;
        throw ERRO_DE_REDE;
      }
    },
    async registrar(incidente) {
      registros.push(incidente.id);
    },
  };

  return {
    porta,
    linhas,
    objetos,
    registros,
    falharInsertCom(e: unknown) {
      falhaInsert = e;
    },
    falharFotoCom(e: unknown) {
      falhaFoto = e;
    },
    perderProximaResposta() {
      perderRespostaDoInsert = true;
    },
  };
}

let contador = 0;
function incidente(
  dados: Partial<IncidenteNaFila> & { motoristaId: string },
): IncidenteNaFila {
  contador++;
  return {
    id: `00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`,
    rotaId: 'rota-1',
    paradaId: 'parada-1',
    categoria: 'blocked',
    descricao: `incidente ${contador}`,
    endereco: 'Rua A',
    em: new Date(2026, 10, 8, 10, contador).toISOString(),
    tentativas: 0,
    ...dados,
  };
}

beforeEach(async () => {
  _resetFilaIncidentes();
  jest.requireMock('@react-native-async-storage/async-storage').__mapa.clear();
  arquivos.clear();
  mockLerSessao.mockReset();
});

describe('enfileirarIncidente', () => {
  it('guarda uma cópia durável da foto, fora do cache da câmera', async () => {
    await enfileirarIncidente(
      incidente({ motoristaId: 'mot-1', fotoLocal: 'file:///cache/cam.jpg' }),
    );

    const [guardado] = await lerFilaIncidentes();
    expect(guardado.fotoLocal).toMatch(
      /^file:\/\/\/docs\/offline_incidentes\//,
    );
    expect(arquivos.has(guardado.fotoLocal!)).toBe(true);
  });

  it('o mesmo incidente não entra duas vezes', async () => {
    const i = incidente({ motoristaId: 'mot-1' });
    await enfileirarIncidente(i);
    await enfileirarIncidente(i);
    expect(await lerFilaIncidentes()).toHaveLength(1);
  });
});

describe('processarFilaIncidentes', () => {
  it('com a rede de volta, sobe na ordem, com a foto, e limpa o aparelho', async () => {
    const servidor = criarServidor(() => 'mot-1');
    const primeiro = incidente({
      motoristaId: 'mot-1',
      fotoLocal: 'file:///cache/a.jpg',
    });
    const segundo = incidente({ motoristaId: 'mot-1' });
    await enfileirarIncidente(primeiro);
    await enfileirarIncidente(segundo);
    const [{ fotoLocal: copia }] = await lerFilaIncidentes();

    const r = await processarFilaIncidentes({
      usuarioAtual: 'mot-1',
      porta: servidor.porta,
    });

    expect(r).toEqual({ enviados: 2, descartados: 0 });
    expect(servidor.linhas.map((l) => l.id)).toEqual([primeiro.id, segundo.id]);
    expect(servidor.linhas[0].foto_url).toBe(servidor.objetos[0]);
    expect(servidor.linhas[1].foto_url).toBeNull();
    expect(await lerFilaIncidentes()).toEqual([]);
    expect(arquivos.has(copia!)).toBe(false);
  });

  it('erro de rede não conta tentativa e segura os seguintes (ordem)', async () => {
    const servidor = criarServidor(() => 'mot-1');
    await enfileirarIncidente(incidente({ motoristaId: 'mot-1' }));
    await enfileirarIncidente(incidente({ motoristaId: 'mot-1' }));
    servidor.falharInsertCom(ERRO_DE_REDE);

    const r = await processarFilaIncidentes({
      usuarioAtual: 'mot-1',
      porta: servidor.porta,
    });

    expect(r).toEqual({ enviados: 0, descartados: 0 });
    const fila = await lerFilaIncidentes();
    expect(fila).toHaveLength(2);
    expect(fila.every((i) => i.tentativas === 0)).toBe(true);
  });

  it('5xx sem código também espera, sem contar tentativa', async () => {
    const servidor = criarServidor(() => 'mot-1');
    await enfileirarIncidente(incidente({ motoristaId: 'mot-1' }));
    servidor.falharInsertCom({ status: 503, message: 'upstream' });

    for (let i = 0; i < MAX_TENTATIVAS + 1; i++) {
      await processarFilaIncidentes({
        usuarioAtual: 'mot-1',
        porta: servidor.porta,
      });
    }

    const fila = await lerFilaIncidentes();
    expect(fila).toHaveLength(1);
    expect(fila[0].tentativas).toBe(0);
  });

  it('recusa definitiva (RLS) descarta com aviso ao motorista e segue para o próximo', async () => {
    const servidor = criarServidor(() => 'mot-1');
    const recusado = incidente({
      motoristaId: 'mot-1',
      fotoLocal: 'file:///cache/r.jpg',
    });
    const seguinte = incidente({ motoristaId: 'mot-1' });
    await enfileirarIncidente(recusado);
    await enfileirarIncidente(seguinte);
    const [{ fotoLocal: copia }] = await lerFilaIncidentes();
    // A rota do primeiro passou a outro motorista: o gatilho recusa (42501).
    const inserirOriginal = servidor.porta.inserir;
    servidor.porta.inserir = async (i, f) => {
      if (i.id === recusado.id) throw { code: '42501', message: 'rota' };
      return inserirOriginal(i, f);
    };

    const r = await processarFilaIncidentes({
      usuarioAtual: 'mot-1',
      porta: servidor.porta,
    });

    expect(r).toEqual({ enviados: 1, descartados: 1 });
    expect(servidor.linhas.map((l) => l.id)).toEqual([seguinte.id]);
    const avisos = await lerDescartesDeIncidentes('mot-1');
    expect(avisos).toHaveLength(1);
    expect(avisos[0].incidente.id).toBe(recusado.id);
    expect(avisos[0].motivo).toBe('recusado');
    expect(await lerFilaIncidentes()).toEqual([]);
    expect(arquivos.has(copia!)).toBe(false);

    await dispensarDescartesDeIncidentes('mot-1');
    expect(await lerDescartesDeIncidentes('mot-1')).toEqual([]);
  });

  it('outra recusa do servidor conta tentativa e só descarta no limite', async () => {
    const servidor = criarServidor(() => 'mot-1');
    await enfileirarIncidente(incidente({ motoristaId: 'mot-1' }));
    servidor.falharInsertCom({ code: 'PGRST204', message: 'coluna' });

    for (let i = 0; i < MAX_TENTATIVAS - 1; i++) {
      await processarFilaIncidentes({
        usuarioAtual: 'mot-1',
        porta: servidor.porta,
      });
    }
    expect((await lerFilaIncidentes())[0].tentativas).toBe(MAX_TENTATIVAS - 1);

    await processarFilaIncidentes({
      usuarioAtual: 'mot-1',
      porta: servidor.porta,
    });
    expect(await lerFilaIncidentes()).toEqual([]);
    const [aviso] = await lerDescartesDeIncidentes('mot-1');
    expect(aviso.motivo).toBe('falha_persistente');
  });

  it('a fila é por motorista: a sessão de B não envia o incidente de A', async () => {
    const servidor = criarServidor(() => 'mot-B');
    const deA = incidente({ motoristaId: 'mot-A' });
    const deB = incidente({ motoristaId: 'mot-B' });
    await enfileirarIncidente(deA);
    await enfileirarIncidente(deB);

    const r = await processarFilaIncidentes({
      usuarioAtual: 'mot-B',
      porta: servidor.porta,
    });

    expect(r).toEqual({ enviados: 1, descartados: 0 });
    expect(servidor.linhas.map((l) => l.id)).toEqual([deB.id]);
    // O de A espera a sessão de A, sem tentativa nem aviso para B.
    const fila = await lerFilaIncidentes();
    expect(fila.map((i) => i.id)).toEqual([deA.id]);
    expect(fila[0].tentativas).toBe(0);
    expect(await lerDescartesDeIncidentes('mot-B')).toEqual([]);
  });

  it('duplicata: gravou e a resposta se perdeu — o reenvio não cria outra linha nem sobe a foto de novo', async () => {
    const servidor = criarServidor(() => 'mot-1');
    await enfileirarIncidente(
      incidente({ motoristaId: 'mot-1', fotoLocal: 'file:///cache/d.jpg' }),
    );
    servidor.perderProximaResposta();

    const primeira = await processarFilaIncidentes({
      usuarioAtual: 'mot-1',
      porta: servidor.porta,
    });
    expect(primeira).toEqual({ enviados: 0, descartados: 0 });
    expect(servidor.linhas).toHaveLength(1);
    // O path da foto já subida ficou guardado com o incidente.
    expect((await lerFilaIncidentes())[0].fotoPath).toBe(servidor.objetos[0]);

    const segunda = await processarFilaIncidentes({
      usuarioAtual: 'mot-1',
      porta: servidor.porta,
    });

    expect(segunda).toEqual({ enviados: 1, descartados: 0 });
    expect(servidor.linhas).toHaveLength(1);
    // A linha gravada sem resposta também deixa rastro em `logs`.
    expect(servidor.registros).toEqual([servidor.linhas[0].id]);
    expect(servidor.objetos).toHaveLength(1);
    expect(await lerFilaIncidentes()).toEqual([]);
    expect(await lerDescartesDeIncidentes('mot-1')).toEqual([]);
  });

  it('foto que falhou por rede espera junto com o incidente', async () => {
    const servidor = criarServidor(() => 'mot-1');
    await enfileirarIncidente(
      incidente({ motoristaId: 'mot-1', fotoLocal: 'file:///cache/f.jpg' }),
    );
    servidor.falharFotoCom(ERRO_DE_REDE);

    await processarFilaIncidentes({
      usuarioAtual: 'mot-1',
      porta: servidor.porta,
    });

    expect(servidor.linhas).toHaveLength(0);
    expect((await lerFilaIncidentes())[0].tentativas).toBe(0);
  });

  it.each([
    ['tamanho (413)', { status: 413, message: 'Foto muito grande' }],
    [
      'policy do bucket (403)',
      {
        statusCode: '403',
        status: 403,
        message: 'new row violates row-level security',
      },
    ],
    ['requisição inválida (400)', { status: 400, message: 'Invalid' }],
  ])(
    'recusa definitiva da FOTO (%s): o reporte sobe sem ela, em vez de ser descartado',
    async (_nome, erro) => {
      const servidor = criarServidor(() => 'mot-1');
      await enfileirarIncidente(
        incidente({ motoristaId: 'mot-1', fotoLocal: 'file:///cache/h.jpg' }),
      );
      servidor.falharFotoCom(erro);

      const r = await processarFilaIncidentes({
        usuarioAtual: 'mot-1',
        porta: servidor.porta,
      });

      expect(r).toEqual({ enviados: 1, descartados: 0 });
      expect(servidor.linhas[0].foto_url).toBeNull();
      expect(await lerFilaIncidentes()).toEqual([]);
      expect(await lerDescartesDeIncidentes('mot-1')).toEqual([]);
    },
  );

  it('cópia local apagada: o incidente sobe sem a foto, em vez de travar a fila', async () => {
    const servidor = criarServidor(() => 'mot-1');
    await enfileirarIncidente(
      incidente({ motoristaId: 'mot-1', fotoLocal: 'file:///cache/g.jpg' }),
    );
    arquivos.clear();

    const r = await processarFilaIncidentes({
      usuarioAtual: 'mot-1',
      porta: servidor.porta,
    });

    expect(r.enviados).toBe(1);
    expect(servidor.linhas[0].foto_url).toBeNull();
  });
});

describe('sincronizarFilaIncidentes', () => {
  it('sem sessão, nada sai do aparelho', async () => {
    const servidor = criarServidor(() => 'mot-1');
    await enfileirarIncidente(incidente({ motoristaId: 'mot-1' }));
    mockLerSessao.mockResolvedValue({ session: null, offline: false });

    const r = await sincronizarFilaIncidentes(servidor.porta);

    expect(r).toEqual({ enviados: 0, descartados: 0 });
    expect(servidor.linhas).toHaveLength(0);
  });

  it('envia com a sessão de quem está logado', async () => {
    const servidor = criarServidor(() => 'mot-1');
    await enfileirarIncidente(incidente({ motoristaId: 'mot-1' }));
    mockLerSessao.mockResolvedValue({
      session: { user: { id: 'mot-1' } },
      offline: false,
    });

    const r = await sincronizarFilaIncidentes(servidor.porta);

    expect(r).toEqual({ enviados: 1, descartados: 0 });
  });
});

describe('na web', () => {
  const { Platform } = require('react-native');
  const plataformaOriginal = Platform.OS;
  const fetchOriginal = global.fetch;
  afterEach(() => {
    Platform.OS = plataformaOriginal;
    global.fetch = fetchOriginal;
  });

  it('a foto blob: perdida ao recarregar a aba não trava a fila: sobe sem ela', async () => {
    Platform.OS = 'web';
    // Depois do recarregamento, a URL blob: não resolve mais.
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const servidor = criarServidor(() => 'mot-1');
    await enfileirarIncidente(
      incidente({ motoristaId: 'mot-1', fotoLocal: 'blob:http://app/abc' }),
    );

    const r = await processarFilaIncidentes({
      usuarioAtual: 'mot-1',
      porta: servidor.porta,
    });

    expect(r).toEqual({ enviados: 1, descartados: 0 });
    expect(servidor.linhas[0].foto_url).toBeNull();
  });

  it('a foto blob: ainda viva (mesma aba) sobe normalmente', async () => {
    Platform.OS = 'web';
    global.fetch = jest.fn(async () => ({
      ok: true,
    })) as unknown as typeof fetch;
    const servidor = criarServidor(() => 'mot-1');
    // Na web o fake de upload não vê o disco: a URI vale.
    arquivos.add('blob:http://app/viva');
    await enfileirarIncidente(
      incidente({ motoristaId: 'mot-1', fotoLocal: 'blob:http://app/viva' }),
    );

    await processarFilaIncidentes({
      usuarioAtual: 'mot-1',
      porta: servidor.porta,
    });

    expect(servidor.linhas[0].foto_url).toBe(servidor.objetos[0]);
  });
});
