import type { Usuario } from '@/types/usuario';

import {
  _reiniciarAberturaPeloPerfilConhecido,
  encerrarAberturaPeloPerfilConhecido,
  marcarAberturaPeloPerfilConhecido,
  perfilDaAberturaPara,
} from '../aberturaPeloPerfilConhecido';

const perfil = { id: 'm1', papel: 'motorista' } as Usuario;

beforeEach(() => _reiniciarAberturaPeloPerfilConhecido());

describe('aberturaPeloPerfilConhecido', () => {
  it('sem marca, não há perfil da abertura', () => {
    expect(perfilDaAberturaPara('m1')).toBeNull();
  });

  it('devolve o perfil marcado só para a própria conta', () => {
    marcarAberturaPeloPerfilConhecido(perfil);
    expect(perfilDaAberturaPara('m1')).toBe(perfil);
    expect(perfilDaAberturaPara('outra')).toBeNull();
  });

  it('encerrar da própria conta apaga; de outra conta, não', () => {
    marcarAberturaPeloPerfilConhecido(perfil);
    encerrarAberturaPeloPerfilConhecido('outra');
    expect(perfilDaAberturaPara('m1')).toBe(perfil);
    encerrarAberturaPeloPerfilConhecido('m1');
    expect(perfilDaAberturaPara('m1')).toBeNull();
  });

  it('encerrar sem conta (logout) apaga qualquer marca', () => {
    marcarAberturaPeloPerfilConhecido(perfil);
    encerrarAberturaPeloPerfilConhecido();
    expect(perfilDaAberturaPara('m1')).toBeNull();
  });
});
