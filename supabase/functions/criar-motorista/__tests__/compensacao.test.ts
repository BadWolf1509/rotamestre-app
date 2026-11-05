import { desfazerContaCriada } from '../compensacao';

describe('desfazerContaCriada', () => {
  it('apaga a conta e devolve true quando o Auth aceita', async () => {
    const deleteUser = jest.fn().mockResolvedValue({ error: null });
    const log = jest.fn();

    await expect(
      desfazerContaCriada({ auth: { admin: { deleteUser } } }, 'u1', log),
    ).resolves.toBe(true);

    expect(deleteUser).toHaveBeenCalledWith('u1');
    expect(log).not.toHaveBeenCalled();
  });

  it('registra e devolve false quando o deleteUser devolve erro (não lança)', async () => {
    const deleteUser = jest
      .fn()
      .mockResolvedValue({ error: { message: 'falhou', status: 500 } });
    const log = jest.fn();

    await expect(
      desfazerContaCriada({ auth: { admin: { deleteUser } } }, 'u1', log),
    ).resolves.toBe(false);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/conta órfã/i);
    // O id vai para o suporte achar a conta; o e-mail não passa por aqui.
    expect(log.mock.calls[0][0]).toContain('u1');
  });

  it('registra e devolve false quando o deleteUser lança', async () => {
    const deleteUser = jest.fn().mockRejectedValue(new Error('rede'));
    const log = jest.fn();

    await expect(
      desfazerContaCriada({ auth: { admin: { deleteUser } } }, 'u1', log),
    ).resolves.toBe(false);

    expect(log).toHaveBeenCalledTimes(1);
  });
});
