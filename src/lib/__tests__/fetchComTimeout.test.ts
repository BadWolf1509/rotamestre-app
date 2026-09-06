import {
  TIMEOUT_STORAGE_MS,
  TIMEOUT_SUPABASE_MS,
  criarFetchComTimeout,
  prazoParaUrl,
} from '@/lib/fetchComTimeout';

describe('criarFetchComTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('devolve a resposta quando o fetch responde antes do prazo', async () => {
    const resposta = { ok: true } as Response;
    const base = jest.fn().mockResolvedValue(resposta);

    const fetchComTimeout = criarFetchComTimeout(1000, base);
    await expect(fetchComTimeout('https://exemplo/x')).resolves.toBe(resposta);
  });

  it('aborta quando o fetch passa do prazo', async () => {
    // Fetch que só resolve se for abortado — é assim que se comporta uma rede
    // que aceita a conexão TCP e nunca responde, o cenário do motorista com
    // uma barra de sinal.
    const base = jest.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('AbortError')),
          );
        }),
    ) as unknown as typeof fetch;

    const fetchComTimeout = criarFetchComTimeout(1000, base);
    const promessa = fetchComTimeout('https://exemplo/x');
    const capturada = promessa.catch((e: Error) => e);

    jest.advanceTimersByTime(1001);

    await expect(capturada).resolves.toBeInstanceOf(Error);
  });

  it('não deixa o timer sobreviver à resposta', async () => {
    const base = jest.fn().mockResolvedValue({ ok: true } as Response);

    await criarFetchComTimeout(1000, base)('https://exemplo/x');

    // Se o clearTimeout não estivesse no finally, o timer ficaria armado e
    // abortaria um controller já descartado — a mesma armadilha que
    // `sessaoComTimeout` documenta.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('limpa o timer também quando o fetch rejeita', async () => {
    const base = jest.fn().mockRejectedValue(new Error('rede caiu'));

    await expect(
      criarFetchComTimeout(1000, base)('https://exemplo/x'),
    ).rejects.toThrow('rede caiu');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('respeita um AbortSignal que o chamador já trouxe', async () => {
    // O supabase-js passa signal próprio em `.abortSignal()`, e o repo usa isso
    // em `useGestaoRotas`. Sobrescrever o signal do chamador quebraria esse
    // cancelamento.
    const doChamador = new AbortController();
    let sinalRecebido: AbortSignal | undefined;

    const base = jest.fn((_url: unknown, init?: { signal?: AbortSignal }) => {
      sinalRecebido = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new Error('AbortError')),
        );
      });
    }) as unknown as typeof fetch;

    const promessa = criarFetchComTimeout(10000, base)('https://exemplo/x', {
      signal: doChamador.signal,
    });
    const capturada = promessa.catch((e: Error) => e);

    doChamador.abort();

    await expect(capturada).resolves.toBeInstanceOf(Error);
    expect(sinalRecebido?.aborted).toBe(true);
  });

  it('aborta na hora se o signal do chamador já vier abortado', async () => {
    const doChamador = new AbortController();
    doChamador.abort();

    const base = jest.fn((_url: unknown, init?: { signal?: AbortSignal }) => {
      return new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) reject(new Error('AbortError'));
      });
    }) as unknown as typeof fetch;

    await expect(
      criarFetchComTimeout(10000, base)('https://exemplo/x', {
        signal: doChamador.signal,
      }),
    ).rejects.toThrow();
  });

  it('expõe um prazo padrão utilizável', () => {
    expect(TIMEOUT_SUPABASE_MS).toBeGreaterThan(0);
    expect(TIMEOUT_SUPABASE_MS).toBeLessThanOrEqual(30000);
  });

  // ==========================================================================
  // Prazo por caminho.
  //
  // O MESMO cliente Supabase serve consulta e upload de foto. Uma foto a
  // `quality: 0.8` tem 1-3 MB e, na rede ruim em que o motorista trabalha,
  // passa de 15 s com folga — um prazo único abortaria o upload legítimo
  // justamente onde ele mais importa, o que seria pior que o bug original.
  // ==========================================================================

  describe('prazoParaUrl', () => {
    it('dá prazo curto para consulta REST', () => {
      expect(
        prazoParaUrl('https://x.supabase.co/rest/v1/paradas?id=eq.1'),
      ).toBe(TIMEOUT_SUPABASE_MS);
    });

    it('dá prazo curto para auth', () => {
      expect(prazoParaUrl('https://x.supabase.co/auth/v1/token')).toBe(
        TIMEOUT_SUPABASE_MS,
      );
    });

    it('dá prazo longo para upload no storage', () => {
      expect(
        prazoParaUrl('https://x.supabase.co/storage/v1/object/fotos-entrega/a'),
      ).toBe(TIMEOUT_STORAGE_MS);
    });

    it('o prazo de storage é folgado o bastante para uma foto em rede ruim', () => {
      // 2 MB a ~100 kbps ≈ 160 s. Abaixo disso, o prazo viraria o bug.
      expect(TIMEOUT_STORAGE_MS).toBeGreaterThanOrEqual(180000);
    });

    it('na dúvida usa o prazo curto', () => {
      expect(prazoParaUrl('https://x.supabase.co/qualquer/outra/coisa')).toBe(
        TIMEOUT_SUPABASE_MS,
      );
    });
  });

  it('usa o prazo de storage quando a URL é de upload', async () => {
    const base = jest.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('AbortError')),
          );
        }),
    ) as unknown as typeof fetch;

    // Sem timeoutMs explícito: o prazo sai da URL.
    const promessa = criarFetchComTimeout(
      undefined,
      base,
    )('https://x.supabase.co/storage/v1/object/fotos-entrega/a.jpg');
    const capturada = promessa.catch((e: Error) => e);

    // Passou do prazo curto — e NÃO pode ter abortado.
    jest.advanceTimersByTime(TIMEOUT_SUPABASE_MS + 1000);
    expect(jest.getTimerCount()).toBe(1);

    // Passou do prazo longo — aí sim.
    jest.advanceTimersByTime(TIMEOUT_STORAGE_MS);
    await expect(capturada).resolves.toBeInstanceOf(Error);
  });
});
