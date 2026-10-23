/**
 * Incidentes do gestor filtrados pela LOJA DA ROTA, não pelos motoristas
 * da loja. Antes: motorista que atende duas lojas levava para a loja A os
 * incidentes das rotas da loja B. Incidente sem rota continua pelo vínculo
 * do motorista com a loja (não tem outra loja para olhar).
 *
 * Banco falso que aplica os filtros de verdade (`consultaFalsa`).
 */
import { renderHook, waitFor } from '@testing-library/react-native';

import { tabelasFalsas } from '@/__tests__/helpers/consultaFalsa';
import { defaultTheme } from '@/utils/styles.base';

import { useIncidentesGestor } from '../useIncidentesGestor';

jest.mock(
  '@/lib/supabase',
  () => require('@/__tests__/helpers/consultaFalsa').moduloConsultaFalsa,
);
jest.mock('../useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', unidades: { nome: 'Loja A' } } }),
}));
jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'loja-a', loading: false }),
}));
// Funções estáveis entre renders, como no hook real (senão o fetch, que
// depende de showToast, rodaria em laço).
const mockToast = {
  toast: { visible: false, message: '', type: 'success' },
  showToast: jest.fn(),
  hideToast: jest.fn(),
};
jest.mock('../useToast', () => ({ useToast: () => mockToast }));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

function incidente(
  id: string,
  motorista: string,
  rota: { id: string; data: string; unidade_id: string } | null,
  created_at: string,
) {
  return {
    id,
    categoria: 'outro',
    descricao: id,
    endereco: null,
    status: 'aberto',
    foto_url: null,
    created_at,
    observacoes_gestao: null,
    motorista_id: motorista,
    rota_id: rota?.id ?? null,
    motorista: { nome: motorista },
    rota,
    parada: null,
  };
}

beforeEach(() => {
  tabelasFalsas.usuario_unidades = [
    {
      usuario_id: 'ana',
      unidade_id: 'loja-a',
      papel: 'motorista',
      ativo: true,
    },
    {
      usuario_id: 'ana',
      unidade_id: 'loja-b',
      papel: 'motorista',
      ativo: true,
    },
  ];
  tabelasFalsas.incidentes = [
    incidente(
      'da-loja-a',
      'ana',
      { id: 'r1', data: '2026-10-20', unidade_id: 'loja-a' },
      '2026-10-20T10:00:00Z',
    ),
    incidente(
      'da-loja-b',
      'ana',
      { id: 'r2', data: '2026-10-21', unidade_id: 'loja-b' },
      '2026-10-21T10:00:00Z',
    ),
    incidente('sem-rota', 'ana', null, '2026-10-22T10:00:00Z'),
  ];
});

describe('useIncidentesGestor — recorte pela loja', () => {
  it('mostra os da rota desta loja e os sem rota; não os da rota de outra loja', async () => {
    const { result } = renderHook(() =>
      useIncidentesGestor(defaultTheme as never),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.incidentes.map((i) => i.id)).toEqual([
      'sem-rota',
      'da-loja-a',
    ]);
  });
});
