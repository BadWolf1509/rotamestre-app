/**
 * Perfil na abertura do app (app/index.tsx). Com Wi-Fi sem internet, a busca
 * do perfil esperava o DNS do Android desistir (4–8 s) antes de seguir pelo
 * perfil conhecido. Com perfil conhecido guardado, a busca ganha prazo curto
 * e, com a queda de rede já observada, nem sai. Sem perfil conhecido, nada
 * muda: espera a resposta como antes (não há para onde cair).
 */
import type { Usuario } from '@/types/usuario';

import { buscarPerfilNaAbertura } from '../perfilNaAbertura';

const CONHECIDO = { id: 'm1', papel: 'motorista' } as unknown as Usuario;
const FRESCO = {
  id: 'm1',
  papel: 'motorista',
  nome: 'Fresco',
} as unknown as Usuario;

const nunca = () => new Promise<Usuario | null>(() => undefined);

describe('buscarPerfilNaAbertura', () => {
  it('servidor responde no prazo: vale o perfil do servidor', async () => {
    await expect(
      buscarPerfilNaAbertura('m1', {
        buscar: async () => FRESCO,
        lerConhecido: async () => CONHECIDO,
        redeCaida: () => false,
        prazoMs: 50,
      }),
    ).resolves.toEqual({ origem: 'servidor', usuario: FRESCO });
  });

  it('com perfil conhecido, a busca que não responde no prazo cai nele', async () => {
    const inicio = Date.now();
    await expect(
      buscarPerfilNaAbertura('m1', {
        buscar: nunca,
        lerConhecido: async () => CONHECIDO,
        redeCaida: () => false,
        prazoMs: 30,
      }),
    ).resolves.toEqual({ origem: 'conhecido', usuario: CONHECIDO });
    expect(Date.now() - inicio).toBeLessThan(1000);
  });

  it('com a queda de rede já observada, nem consulta', async () => {
    const buscar = jest.fn(nunca);
    await expect(
      buscarPerfilNaAbertura('m1', {
        buscar,
        lerConhecido: async () => CONHECIDO,
        redeCaida: () => true,
        prazoMs: 30,
      }),
    ).resolves.toEqual({ origem: 'conhecido', usuario: CONHECIDO });
    expect(buscar).not.toHaveBeenCalled();
  });

  it('SEM perfil conhecido: sem prazo, espera a resposta como antes', async () => {
    const resposta = new Promise<Usuario | null>((r) =>
      setTimeout(() => r(FRESCO), 80),
    );
    await expect(
      buscarPerfilNaAbertura('m1', {
        buscar: () => resposta,
        lerConhecido: async () => null,
        redeCaida: () => true,
        prazoMs: 10,
      }),
    ).resolves.toEqual({ origem: 'servidor', usuario: FRESCO });
  });

  it('a falha da busca segue para quem chama (ela decide pelo tipo da falha)', async () => {
    const erro = new Error('42501');
    await expect(
      buscarPerfilNaAbertura('m1', {
        buscar: async () => {
          throw erro;
        },
        lerConhecido: async () => CONHECIDO,
        redeCaida: () => false,
        prazoMs: 50,
      }),
    ).rejects.toBe(erro);
  });
});
