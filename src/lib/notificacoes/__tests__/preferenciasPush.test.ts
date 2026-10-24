/**
 * Preferências de push no banco (Migration 47), com cópia e pendência no
 * aparelho. O banco é um dublê em memória de `preferencias_notificacao`
 * (select por usuario_id + upsert), e o AsyncStorage, um mapa — o que se
 * testa é: grava e relê, a falta de rede não perde a escolha, e o valor
 * antigo do AsyncStorage migra uma vez.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import type { PreferenciasNotificacao } from '@/types/notifications';

import {
  CHAVES_LEGADAS,
  PREFERENCIAS_PADRAO,
  lerPreferenciasLocais,
  salvarPreferencias,
  sincronizarPreferencias,
} from '../preferenciasPush';

jest.mock('@/lib/semRede', () => ({
  semRedeConfirmada: jest.fn(async () => false),
}));
const { semRedeConfirmada } = jest.requireMock('@/lib/semRede') as {
  semRedeConfirmada: jest.Mock;
};

type Linha = PreferenciasNotificacao & { usuario_id: string };

let banco: Map<string, Linha>;
let disco: Map<string, string>;
let falhaSelect: { message: string } | null;
let falhaUpsert: { message: string } | null;
let upserts: Array<Record<string, unknown>>;

function ligarDubles() {
  (supabase.from as jest.Mock).mockImplementation((tabela: string) => {
    if (tabela !== 'preferencias_notificacao') {
      throw new Error(`tabela inesperada: ${tabela}`);
    }
    return {
      select: () => ({
        eq: (_col: string, uid: string) => ({
          maybeSingle: async () =>
            falhaSelect
              ? { data: null, error: falhaSelect }
              : { data: banco.get(uid) ?? null, error: null },
        }),
      }),
      upsert: async (
        valores: Linha & { atualizado_em?: string },
        opcoes: { onConflict: string },
      ) => {
        upserts.push({ ...valores, onConflict: opcoes.onConflict });
        if (falhaUpsert) return { error: falhaUpsert };
        const { atualizado_em: _ignorado, ...linha } = valores;
        banco.set(valores.usuario_id, linha);
        return { error: null };
      },
    };
  });
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (k: string) => disco.get(k) ?? null,
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (k: string, v: string) => {
      disco.set(k, v);
    },
  );
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(
    async (k: string) => {
      disco.delete(k);
    },
  );
}

const linha = (
  uid: string,
  p: Partial<PreferenciasNotificacao> = {},
): Linha => ({ usuario_id: uid, ...PREFERENCIAS_PADRAO, ...p });

beforeEach(() => {
  jest.clearAllMocks();
  banco = new Map();
  disco = new Map();
  falhaSelect = null;
  falhaUpsert = null;
  upserts = [];
  semRedeConfirmada.mockResolvedValue(false);
  const { logger } = require('@/lib/logger');
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
  ligarDubles();
});

describe('salvarPreferencias', () => {
  it('grava no banco por upsert e a releitura devolve o gravado', async () => {
    const nova = { ...PREFERENCIAS_PADRAO, rotas: false };

    await expect(salvarPreferencias('u1', nova)).resolves.toEqual({
      sincronizado: true,
    });

    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      usuario_id: 'u1',
      ...nova,
      onConflict: 'usuario_id',
    });
    expect(typeof upserts[0].atualizado_em).toBe('string');

    // relê do banco, sem cópia no aparelho
    disco.clear();
    await expect(sincronizarPreferencias('u1')).resolves.toEqual({
      preferencias: nova,
      origem: 'servidor',
    });
  });

  it('falha do servidor: guarda a escolha e a pendência, sem lançar', async () => {
    falhaUpsert = { message: 'Failed to fetch' };
    const nova = { ...PREFERENCIAS_PADRAO, push_ativo: false };

    await expect(salvarPreferencias('u1', nova)).resolves.toEqual({
      sincronizado: false,
    });

    await expect(lerPreferenciasLocais('u1')).resolves.toEqual(nova);
  });

  it('sem rede confirmada: nem tenta o servidor', async () => {
    semRedeConfirmada.mockResolvedValue(true);

    await expect(
      salvarPreferencias('u1', { ...PREFERENCIAS_PADRAO, rotas: false }),
    ).resolves.toEqual({ sincronizado: false });
    expect(upserts).toHaveLength(0);
  });

  it('AsyncStorage quebrado não derruba o salvamento', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('cheio'));

    await expect(
      salvarPreferencias('u1', { ...PREFERENCIAS_PADRAO, rotas: false }),
    ).resolves.toEqual({ sincronizado: true });
  });
});

describe('sincronizarPreferencias', () => {
  it('a pendência sobe na volta da rede, antes da leitura', async () => {
    falhaUpsert = { message: 'offline' };
    const nova = { ...PREFERENCIAS_PADRAO, incidentes: false };
    await salvarPreferencias('u1', nova);
    expect(banco.size).toBe(0);

    falhaUpsert = null;
    await expect(sincronizarPreferencias('u1')).resolves.toEqual({
      preferencias: nova,
      origem: 'servidor',
    });
    expect(banco.get('u1')).toEqual(linha('u1', { incidentes: false }));

    // pendência resolvida: a próxima não sobe de novo
    upserts = [];
    await sincronizarPreferencias('u1');
    expect(upserts).toHaveLength(0);
  });

  it('escolha offline não é desfeita pela linha antiga do servidor', async () => {
    banco.set('u1', linha('u1', { rotas: true }));
    falhaUpsert = { message: 'offline' };
    await salvarPreferencias('u1', { ...PREFERENCIAS_PADRAO, rotas: false });

    falhaUpsert = null;
    await expect(sincronizarPreferencias('u1')).resolves.toEqual({
      preferencias: { ...PREFERENCIAS_PADRAO, rotas: false },
      origem: 'servidor',
    });
    expect(banco.get('u1')).toEqual(linha('u1', { rotas: false }));
  });

  it('servidor fora: devolve a cópia do aparelho', async () => {
    banco.set('u1', linha('u1', { rotas: false }));
    await sincronizarPreferencias('u1');

    falhaSelect = { message: 'Failed to fetch' };
    await expect(sincronizarPreferencias('u1')).resolves.toEqual({
      preferencias: { ...PREFERENCIAS_PADRAO, rotas: false },
      origem: 'aparelho',
    });
  });

  it('sem linha, sem cópia e sem valor antigo: tudo ligado, e não cria linha', async () => {
    await expect(sincronizarPreferencias('u1')).resolves.toEqual({
      preferencias: PREFERENCIAS_PADRAO,
      origem: 'padrao',
    });
    expect(upserts).toHaveLength(0);
  });

  it('valor antigo do motorista migra uma vez para o banco', async () => {
    disco.set(CHAVES_LEGADAS.push_ativo[0], 'false');

    await expect(sincronizarPreferencias('u1')).resolves.toEqual({
      preferencias: { ...PREFERENCIAS_PADRAO, push_ativo: false },
      origem: 'servidor',
    });
    expect(banco.get('u1')).toEqual(linha('u1', { push_ativo: false }));
    expect(disco.has(CHAVES_LEGADAS.push_ativo[0])).toBe(false);

    // segunda vez: nada a migrar
    upserts = [];
    await sincronizarPreferencias('u1');
    expect(upserts).toHaveLength(0);
  });

  it('valores antigos do gestor migram, cada um para a sua coluna', async () => {
    disco.set('@rotamestre:gestor:notifications_enabled', 'true');
    disco.set('@rotamestre:gestor:incident_alerts', 'false');
    disco.set('@rotamestre:gestor:route_updates', 'true');
    disco.set('@rotamestre:gestor:daily_summary', 'false');

    await sincronizarPreferencias('g1');

    expect(banco.get('g1')).toEqual(
      linha('g1', { incidentes: false, resumo_diario: false }),
    );
    expect(
      [...disco.keys()].filter((k) => k.includes('@rotamestre:gestor:')),
    ).toEqual([]);
  });

  it('migração sem rede: o valor antigo vira pendência e sobe depois', async () => {
    disco.set(CHAVES_LEGADAS.push_ativo[0], 'false');
    falhaUpsert = { message: 'offline' };

    await expect(sincronizarPreferencias('u1')).resolves.toEqual({
      preferencias: { ...PREFERENCIAS_PADRAO, push_ativo: false },
      origem: 'aparelho',
    });
    expect(disco.has(CHAVES_LEGADAS.push_ativo[0])).toBe(false);

    falhaUpsert = null;
    await sincronizarPreferencias('u1');
    expect(banco.get('u1')).toEqual(linha('u1', { push_ativo: false }));
  });

  it('com linha no banco, o valor antigo não sobrescreve (e é descartado)', async () => {
    banco.set('u1', linha('u1', { push_ativo: true }));
    disco.set(CHAVES_LEGADAS.push_ativo[0], 'false');

    await expect(sincronizarPreferencias('u1')).resolves.toEqual({
      preferencias: PREFERENCIAS_PADRAO,
      origem: 'servidor',
    });
    expect(upserts).toHaveLength(0);
    expect(disco.has(CHAVES_LEGADAS.push_ativo[0])).toBe(false);
  });

  it('a cópia de uma conta não vale para outra', async () => {
    falhaUpsert = { message: 'offline' };
    await salvarPreferencias('u1', { ...PREFERENCIAS_PADRAO, rotas: false });

    await expect(lerPreferenciasLocais('u2')).resolves.toBeNull();
  });
});
