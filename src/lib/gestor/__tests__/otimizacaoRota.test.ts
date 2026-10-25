/**
 * Marcar a rota como "otimizada_alterada" quando o gestor mexe nas paradas
 * (adicionar, remover, editar), igual à reordenação já fazia.
 *
 * A escrita é condicionada a `otimizacao_estado = 'otimizada'`: rota sem
 * registro (NULL) ou já marcada não muda, e quem chama não precisa conhecer o
 * estado (que pode estar velho na tela).
 */
import { marcarOtimizacaoAlterada } from '../otimizacaoRota';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const mockLoggerError = jest.fn();
jest.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

/** `.update(v).eq('id', id).eq('otimizacao_estado', 'otimizada').select('id')` */
function cadeiaUpdate(resultado: { data: unknown; error: unknown }) {
  const select = jest.fn().mockResolvedValue(resultado);
  const eqEstado = jest.fn().mockReturnValue({ select });
  const eqId = jest.fn().mockReturnValue({ eq: eqEstado });
  const update = jest.fn().mockReturnValue({ eq: eqId });
  return { update, eqId, eqEstado, select };
}

describe('marcarOtimizacaoAlterada', () => {
  beforeEach(() => jest.clearAllMocks());

  it('troca otimizada por otimizada_alterada, só nessa rota e só se ainda estiver otimizada', async () => {
    const cadeia = cadeiaUpdate({ data: [{ id: 'r1' }], error: null });
    mockFrom.mockReturnValue({ update: cadeia.update });

    const marcou = await marcarOtimizacaoAlterada('r1');

    expect(mockFrom).toHaveBeenCalledWith('rotas');
    expect(cadeia.update).toHaveBeenCalledWith({
      otimizacao_estado: 'otimizada_alterada',
    });
    expect(cadeia.eqId).toHaveBeenCalledWith('id', 'r1');
    expect(cadeia.eqEstado).toHaveBeenCalledWith(
      'otimizacao_estado',
      'otimizada',
    );
    expect(marcou).toBe(true);
  });

  it('rota que não estava otimizada: zero linhas, devolve false e não é erro', async () => {
    const cadeia = cadeiaUpdate({ data: [], error: null });
    mockFrom.mockReturnValue({ update: cadeia.update });

    await expect(marcarOtimizacaoAlterada('r1')).resolves.toBe(false);
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('erro do banco: registra com logger.error (some em produção com warn) e devolve false', async () => {
    const cadeia = cadeiaUpdate({ data: null, error: { message: 'rls' } });
    mockFrom.mockReturnValue({ update: cadeia.update });

    await expect(marcarOtimizacaoAlterada('r1')).resolves.toBe(false);
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
  });

  it('nunca lança: a parada já foi alterada e a marcação é só auditoria', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('queda de rede');
    });

    await expect(marcarOtimizacaoAlterada('r1')).resolves.toBe(false);
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
  });
});
