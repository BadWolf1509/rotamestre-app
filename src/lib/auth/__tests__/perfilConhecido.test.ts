import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Usuario } from '@/types/usuario';

import {
  apagarPerfilConhecido,
  CHAVE_PERFIL_CONHECIDO,
  gravarPerfilConhecido,
  lerPerfilConhecido,
} from '../perfilConhecido';

const memoria = new Map<string, string>();

beforeEach(() => {
  memoria.clear();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (k: string) => memoria.get(k) ?? null,
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (k: string, v: string) => {
      memoria.set(k, v);
    },
  );
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(
    async (k: string) => {
      memoria.delete(k);
    },
  );
});

const motorista = {
  id: 'motorista-1',
  nome: 'Maria',
  papel: 'motorista',
  ativo: true,
} as Usuario;

describe('perfil conhecido (stale-if-error)', () => {
  it('devolve o perfil gravado para o mesmo usuário', async () => {
    await gravarPerfilConhecido(motorista);
    await expect(lerPerfilConhecido('motorista-1')).resolves.toEqual(motorista);
  });

  it('não deixa o perfil de outra conta responder', async () => {
    await gravarPerfilConhecido(motorista);
    await expect(lerPerfilConhecido('outra-conta')).resolves.toBeNull();
  });

  it('não expira com o tempo (o uso é justamente quando o cache venceu)', async () => {
    const agora = jest.spyOn(Date, 'now').mockReturnValue(0);
    await gravarPerfilConhecido(motorista);
    agora.mockReturnValue(30 * 24 * 60 * 60 * 1000);
    await expect(lerPerfilConhecido('motorista-1')).resolves.toEqual(motorista);
    agora.mockRestore();
  });

  it('apagar só remove se o perfil guardado for daquele usuário', async () => {
    await gravarPerfilConhecido(motorista);
    await apagarPerfilConhecido('outra-conta');
    expect(memoria.has(CHAVE_PERFIL_CONHECIDO)).toBe(true);
    await apagarPerfilConhecido('motorista-1');
    expect(memoria.has(CHAVE_PERFIL_CONHECIDO)).toBe(false);
  });

  it('armazenamento quebrado vira "sem perfil conhecido", sem lançar', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('disco'));
    await expect(lerPerfilConhecido('motorista-1')).resolves.toBeNull();
    memoria.set(CHAVE_PERFIL_CONHECIDO, '{json quebrado');
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (k: string) => memoria.get(k) ?? null,
    );
    await expect(lerPerfilConhecido('motorista-1')).resolves.toBeNull();
  });
});
