/**
 * Tests for query client utilities
 */

import {
  classifyError,
  isPostgrestAbortShape,
  withRetry,
  safeQuery,
  buildCacheKey,
} from '../queryClient';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('queryClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyError', () => {
    it('should return unknown for null/undefined error', () => {
      expect(classifyError(null)).toEqual({
        type: 'unknown',
        message: 'Erro desconhecido',
      });

      expect(classifyError(undefined)).toEqual({
        type: 'unknown',
        message: 'Erro desconhecido',
      });
    });

    it('should classify network errors', () => {
      const networkError = { message: 'Failed to fetch due to network issue' };
      const result = classifyError(networkError);

      expect(result.type).toBe('network');
      expect(result.message).toBe('Erro de conexão. Verifique sua internet.');
    });

    // PGRST116 é "zero linhas" (not_found), não um código de auth — usar essa
    // fixture aqui esconderia a checagem de prefixo por trás da checagem de
    // mensagem (a msg 'JWT expired' já classifica sozinha). PGRST301 é um
    // código de auth REAL do PostgREST, sem 'JWT' na mensagem: só passa se a
    // checagem de prefixo `PGRST30` estiver de fato funcionando.
    it('should classify auth errors from code', () => {
      const authError = { code: 'PGRST301', message: 'invalid token' };
      const result = classifyError(authError);

      expect(result.type).toBe('auth');
      expect(result.message).toBe('Sessão expirada. Faça login novamente.');
    });

    it('should classify auth errors from JWT message', () => {
      const authError = { message: 'JWT token is invalid' };
      const result = classifyError(authError);

      expect(result.type).toBe('auth');
    });

    it('should classify permission errors from code 42501', () => {
      const permError = { code: '42501', message: 'Permission denied' };
      const result = classifyError(permError);

      expect(result.type).toBe('permission');
      expect(result.message).toBe('Você não tem permissão para esta ação.');
    });

    it('should classify permission errors from message', () => {
      const permError = { message: 'permission denied for table' };
      const result = classifyError(permError);

      expect(result.type).toBe('permission');
    });

    // PGRST116 é "zero linhas", não sessão expirada. A versão anterior deste
    // teste aceitava `['not_found', 'auth']` com o comentário "PGRST116 is also
    // caught by auth check first" — alguém viu o bug e afrouxou o teste em vez
    // de corrigir o código. O efeito em produção: registro que não existe mais
    // (rota reatribuída, parada removida por outro gestor) mandava o motorista
    // fazer login de novo, e o problema continuava depois do login.
    it('should classify not_found errors', () => {
      const notFoundError = { code: 'PGRST116' };
      const result = classifyError(notFoundError);

      expect(result.type).toBe('not_found');
      expect(result.message).toBe('Registro não encontrado.');
    });

    // Os códigos de auth REAIS do PostgREST são a família PGRST30x. O prefixo
    // `PGRST1` que estava aqui pegava justamente a família errada.
    it.each(['PGRST301', 'PGRST302', 'PGRST303'])(
      'should classify %s as auth',
      (code) => {
        expect(classifyError({ code }).type).toBe('auth');
      },
    );

    // Guarda contra a regressão simétrica: outros PGRST1xx não devem virar auth
    // só por causa do prefixo.
    it('should not classify PGRST100 (parse error) as auth', () => {
      expect(classifyError({ code: 'PGRST100' }).type).not.toBe('auth');
    });

    it('should classify validation errors with code starting with 22', () => {
      const validationError = { code: '22001', message: 'Value too long' };
      const result = classifyError(validationError);

      expect(result.type).toBe('validation');
      expect(result.message).toBe('Value too long');
    });

    it('should classify validation errors with code starting with 23', () => {
      const validationError = {
        code: '23505',
        message: 'Unique constraint violation',
      };
      const result = classifyError(validationError);

      expect(result.type).toBe('validation');
    });

    it('should classify server errors with code starting with 5', () => {
      const serverError = { code: '500', message: 'Internal server error' };
      const result = classifyError(serverError);

      expect(result.type).toBe('server');
      expect(result.message).toBe('Erro no servidor. Tente novamente.');
    });

    it('should handle Error objects', () => {
      const error = new Error('Something went wrong');
      const result = classifyError(error);

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Something went wrong');
    });

    // NOTE (fix-report-3.md, PR #480, item 2): os dois testes que viviam
    // aqui ('should handle Error without message' e 'should classify a
    // real (non-empty message) AbortError as cancellation, not unknown')
    // cobriam o ramo `error instanceof Error && error.name === 'AbortError'`
    // — removido por estar morto. Nem postgrest-js (converte pra objeto
    // plano, nunca `instanceof Error`) nem storage-js (relança como `Error`,
    // mas `name` vira 'StorageUnknownError', nunca 'AbortError') produzem
    // essa forma neste repo — e nenhum upload/download passa um
    // AbortSignal do chamador (`grep -n "signal" src/lib/storage.ts` não
    // acha nada), então nem um cancelamento hipotético do storage-js
    // chegaria com `name: 'AbortError'`. Os dois testes só passavam porque
    // construíam a fixture à mão; nenhum caminho real os exercitava.

    it('should handle object with only message', () => {
      const error = { message: 'Custom error message' };
      const result = classifyError(error);

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Custom error message');
    });

    it('should handle non-object errors', () => {
      const result = classifyError('string error');

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Erro desconhecido');
    });

    // fetchComTimeout.ts aborta por prazo com `new Error('timeout')` +
    // `name: 'AbortError'` — motivo deliberado, para não ser confundido com o
    // cancelamento legítimo do chamador (AbortError -> 'network', que
    // continua retentável). Precisa de tipo PRÓPRIO, fora de retryableTypes
    // (['network', 'server']). `name: 'AbortError'` também presente aqui
    // (fetchComTimeout.ts a define para que o retry do postgrest-js desista
    // na hora — ver fix-report-2.md, item 1): a checagem por `message ===
    // 'timeout'` tem que vencer a checagem por `name === 'AbortError'` que
    // vem logo depois dela em classifyError, senão nosso próprio timeout
    // virava 'network' (retentável) por causa do `name`.
    it('should classify our fetch-timeout marker as its own non-retryable type (message wins over name=AbortError)', () => {
      const timeoutError = new Error('timeout');
      timeoutError.name = 'AbortError';
      const result = classifyError(timeoutError);

      expect(result.type).toBe('timeout');
      expect(result.type).not.toBe('network');
      expect(result.message).not.toBe('timeout'); // mensagem amigável, não a crua
    });

    // Item 2 do fix-report-2.md (PR #480): o `@supabase/postgrest-js` (usado
    // por TODA leitura/escrita via `.from(...)`) nunca relança o erro do
    // fetch — não há `.throwOnError()` em lugar nenhum do repo — ele
    // converte a rejeição num objeto plano ANTES de resolver a promise,
    // dentro do seu `.then()` interno. Por isso NÃO é `instanceof Error`, e
    // os ramos acima (que dependem disso) não pegam. A forma abaixo foi
    // confirmada rodando o pacote REALMENTE instalado (não suposta) com um
    // fetch falso que rejeita como fetchComTimeout.ts rejeita — ver
    // fix-report-2.md para as duas saídas do experimento.
    it('should classify the postgrest-js-converted shape of our timeout as timeout, in Portuguese', () => {
      const errorConvertidoPeloPostgrestJs = {
        message: 'AbortError: timeout',
        details: 'AbortError: timeout\n    at ...',
        hint: 'Request was aborted (timeout or manual cancellation)',
        code: '',
      };
      const result = classifyError(errorConvertidoPeloPostgrestJs);

      expect(result.type).toBe('timeout');
      expect(result.message).toBe(
        'A operação demorou muito e foi cancelada. Tente novamente.',
      );
    });

    // Guarda a distinção também nessa forma: um cancelamento do CHAMADOR
    // passando pelo mesmo caminho do postgrest-js gera a mesma mensagem
    // prefixada, mas nunca com o sufixo exato ':' + 'timeout' — não pode
    // virar 'timeout' (não-retentável) por acidente de prefixo.
    it('should NOT classify a caller AbortError converted by postgrest-js as timeout', () => {
      const cancelamentoDoChamador = {
        message: 'AbortError: The operation was aborted.',
        details: '',
        hint: 'Request was aborted (timeout or manual cancellation)',
        code: '',
      };
      const result = classifyError(cancelamentoDoChamador);

      expect(result.type).not.toBe('timeout');
    });
  });

  describe('isPostgrestAbortShape', () => {
    // Extraído de classifyError no fix-report-3.md (PR #480, item 1), pra
    // useGestaoRotas reconhecer um cancelamento sem duplicar a checagem de
    // forma. Precisa reconhecer AMBOS os sufixos (o nosso timeout E um
    // cancelamento genérico do chamador) — a distinção entre os dois é
    // trabalho de `classifyError`, não desta função.
    it('reconhece o objeto convertido pelo postgrest-js para o NOSSO timeout', () => {
      expect(
        isPostgrestAbortShape({
          message: 'AbortError: timeout',
          details: '',
          hint: '',
          code: '',
        }),
      ).toBe(true);
    });

    it('reconhece o objeto convertido pelo postgrest-js para um cancelamento do CHAMADOR', () => {
      expect(
        isPostgrestAbortShape({
          message: 'AbortError: The operation was aborted.',
          details: '',
          hint: '',
          code: '',
        }),
      ).toBe(true);
    });

    // Guarda de negativo: não é só "tem a palavra AbortError em algum
    // lugar" — o prefixo tem que estar no INÍCIO de `.message` (é isso que
    // `${fetchError.name}: ${fetchError.message}` produz).
    it('não reconhece um erro comum do postgrest (sem o prefixo)', () => {
      expect(
        isPostgrestAbortShape({ code: 'PGRST301', message: 'invalid token' }),
      ).toBe(false);
    });

    // Um `Error` de verdade com `name: 'AbortError'` (storage-js, ou fetch
    // cru fora do supabase-js) tem outra FORMA — não passa por aqui.
    // `classifyError` trata esse caso num branch dedicado (instanceof
    // Error && message === 'timeout'); esta função só reconhece o objeto
    // plano do postgrest-js.
    it('não reconhece um Error de verdade (forma do storage-js, não do postgrest-js)', () => {
      const erro = new Error('timeout');
      erro.name = 'AbortError';
      expect(isPostgrestAbortShape(erro)).toBe(false);
    });

    it('não reconhece null, undefined ou valores primitivos', () => {
      expect(isPostgrestAbortShape(null)).toBe(false);
      expect(isPostgrestAbortShape(undefined)).toBe(false);
      expect(isPostgrestAbortShape('AbortError: timeout')).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const queryFn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(queryFn);

      expect(result).toBe('success');
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on non-retryable errors', async () => {
      // Mesma correção de fixture do teste de classifyError acima: PGRST301 é
      // um código de auth real, sem 'JWT' na mensagem.
      const authError = { code: 'PGRST301', message: 'invalid token' };
      const queryFn = jest.fn().mockRejectedValue(authError);

      await expect(withRetry(queryFn)).rejects.toEqual(authError);
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    // RISCO NOVO introduzido pelo fetchComTimeout: antes, um fetch pendurado
    // nunca rejeitava, então isto não podia acontecer. Agora um timeout
    // aborta e classifyError precisa continuar tratando isso como
    // NÃO-retentável — createIncidente (queries/incidentes.ts) é um INSERT, e
    // o abort mata o cliente, não a transação: se o servidor gravou e a
    // resposta não voltou, repetir duplicaria o incidente.
    it('should NOT retry our own fetch-timeout marker (would duplicate a non-idempotent INSERT)', async () => {
      const timeoutError = new Error('timeout');
      const queryFn = jest.fn().mockRejectedValue(timeoutError);

      await expect(withRetry(queryFn)).rejects.toThrow('timeout');
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors and eventually succeed', async () => {
      const networkError = { message: 'network error' };
      const queryFn = jest
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('success');

      // Use minimal delays for testing
      const result = await withRetry(queryFn, {
        maxAttempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 1,
      });

      expect(result).toBe('success');
      expect(queryFn).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should throw after max attempts', async () => {
      const networkError = { message: 'network error' };
      const queryFn = jest.fn().mockRejectedValue(networkError);

      await expect(
        withRetry(queryFn, { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 }),
      ).rejects.toEqual(networkError);
      expect(queryFn).toHaveBeenCalledTimes(2);
    }, 10000);
  });

  describe('safeQuery', () => {
    it('should return success result on success', async () => {
      const queryFn = jest.fn().mockResolvedValue({ id: 1, name: 'Test' });

      const result = await safeQuery(queryFn);

      expect(result).toEqual({
        success: true,
        data: { id: 1, name: 'Test' },
      });
    });

    it('should return error result on failure', async () => {
      const queryFn = jest.fn().mockRejectedValue(new Error('Query failed'));

      const result = await safeQuery(queryFn);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('unknown');
        expect(result.error.message).toBe('Query failed');
      }
    });

    it('should classify error type correctly', async () => {
      const queryFn = jest.fn().mockRejectedValue({ message: 'network error' });

      const result = await safeQuery(queryFn);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('network');
      }
    });
  });

  describe('buildCacheKey', () => {
    it('should build key from namespace and parts', () => {
      const key = buildCacheKey('rotas', 'abc123', 'list');
      expect(key).toBe('rotas:abc123:list');
    });

    it('should handle numeric parts', () => {
      const key = buildCacheKey('paradas', 'rota123', 50);
      expect(key).toBe('paradas:rota123:50');
    });

    it('should filter out undefined parts', () => {
      const key = buildCacheKey('users', undefined, 'abc', undefined, 'def');
      expect(key).toBe('users:abc:def');
    });

    it('should return only namespace if no parts', () => {
      const key = buildCacheKey('namespace');
      expect(key).toBe('namespace');
    });

    it('should handle all undefined parts', () => {
      const key = buildCacheKey('namespace', undefined, undefined);
      expect(key).toBe('namespace');
    });
  });
});
