/**
 * Regra única do que o gestor pode fazer com a rota, conforme a situação.
 * Os dois cabeçalhos (desktop e celular/tablet) leem daqui.
 */
import { permissoesRota } from '../permissoesRota';

describe('permissoesRota', () => {
  it.each([
    [
      'pendente',
      {
        cancelar: true,
        reativar: false,
        trocarMotorista: true,
        adicionarParada: true,
        reordenar: true,
      },
    ],
    [
      'em_andamento',
      {
        cancelar: true,
        reativar: false,
        trocarMotorista: false,
        adicionarParada: true,
        reordenar: true,
      },
    ],
    [
      'concluida',
      {
        cancelar: false,
        reativar: false,
        trocarMotorista: false,
        adicionarParada: false,
        reordenar: false,
      },
    ],
    [
      'cancelada',
      {
        cancelar: false,
        reativar: false,
        trocarMotorista: false,
        adicionarParada: false,
        reordenar: false,
      },
    ],
    [
      'nao_executada',
      {
        cancelar: false,
        reativar: true,
        trocarMotorista: false,
        adicionarParada: false,
        reordenar: false,
      },
    ],
    // Mesma regra que estava inline no cabeçalho: sem situação conhecida, só
    // "cancelar" passa (a escrita no banco é condicionada à situação viva).
    [
      undefined,
      {
        cancelar: true,
        reativar: false,
        trocarMotorista: false,
        adicionarParada: false,
        reordenar: false,
      },
    ],
  ])('status %s', (status, esperado) => {
    expect(permissoesRota(status)).toEqual(esperado);
  });
});
