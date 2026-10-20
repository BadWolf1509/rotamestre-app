import { confirmarMotoristaNuncaEntrou } from '../confirmarMotoristaNuncaEntrou';

describe('confirmarMotoristaNuncaEntrou', () => {
  it('segue sem perguntar quando não há motorista', async () => {
    const showConfirm = jest.fn();
    await expect(
      confirmarMotoristaNuncaEntrou(showConfirm, null, 'lancar'),
    ).resolves.toBe(true);
    expect(showConfirm).not.toHaveBeenCalled();
  });

  it('segue sem perguntar quando o motorista já entrou', async () => {
    const showConfirm = jest.fn();
    await expect(
      confirmarMotoristaNuncaEntrou(
        showConfirm,
        { nome: 'Ana', nuncaEntrou: false },
        'lancar',
      ),
    ).resolves.toBe(true);
    expect(showConfirm).not.toHaveBeenCalled();
  });

  it('pergunta com o texto de lançar e devolve a resposta (cancelar = false)', async () => {
    const showConfirm = jest.fn().mockResolvedValue(false);
    await expect(
      confirmarMotoristaNuncaEntrou(
        showConfirm,
        { nome: 'Ana', nuncaEntrou: true },
        'lancar',
      ),
    ).resolves.toBe(false);
    expect(showConfirm).toHaveBeenCalledWith({
      title: 'Motorista nunca entrou no app',
      message:
        'Ana ainda não entrou no RotaMestre e não vai ver esta rota no celular. Confira se ele usa outra conta ou peça que instale o app e faça login.',
      type: 'warning',
      confirmText: 'Lançar mesmo assim',
    });
  });

  it('usa "Trocar mesmo assim" ao trocar motorista', async () => {
    const showConfirm = jest.fn().mockResolvedValue(true);
    await expect(
      confirmarMotoristaNuncaEntrou(
        showConfirm,
        { nome: 'Ana', nuncaEntrou: true },
        'trocar',
      ),
    ).resolves.toBe(true);
    expect(showConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmText: 'Trocar mesmo assim' }),
    );
  });
});
