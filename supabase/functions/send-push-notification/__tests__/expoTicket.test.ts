// Respostas no formato REAL do serviço da Expo (POST /--/api/v2/push/send).
// Para UMA mensagem (corpo objeto, que é o que a função manda) a Expo devolve
// `data` como OBJETO; só para lista de mensagens `data` é lista. Até 10/2026 a
// função lia `data[0]` — indefinido no caso real —, e todo push saía `failed`.
import {
  extrairTicket,
  mascararToken,
  resumoDoTicket,
  tokenDeveSerLimpo,
} from '../expoTicket';

const TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

const sucessoObjeto = {
  data: { status: 'ok', id: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX' },
};

const sucessoLista = {
  data: [{ status: 'ok', id: 'YYYYYYYY-YYYY-YYYY-YYYY-YYYYYYYYYYYY' }],
};

const deviceNotRegistered = {
  data: {
    status: 'error',
    message: `"${TOKEN}" is not a registered push notification recipient`,
    details: { error: 'DeviceNotRegistered', expoPushToken: TOKEN },
  },
};

const invalidCredentials = {
  data: {
    status: 'error',
    message:
      "Unable to retrieve the FCM server key for the recipient's app. Make sure you have provided a server key as directed by the Expo FCM documentation.",
    details: { error: 'InvalidCredentials', fault: 'developer' },
  },
};

// Erro do pedido inteiro (não chega a gerar ticket): vem em `errors`.
const erroDoPedido = {
  errors: [
    {
      code: 'VALIDATION_ERROR',
      message: '"to" must be a string or an array of strings.',
    },
  ],
};

describe('extrairTicket', () => {
  it('lê o ticket quando `data` é objeto (envio único, o caso real)', () => {
    const t = extrairTicket(sucessoObjeto);
    expect(t.status).toBe('ok');
    expect(t.id).toBe(sucessoObjeto.data.id);
  });

  it('lê o primeiro ticket quando `data` é lista', () => {
    const t = extrairTicket(sucessoLista);
    expect(t.status).toBe('ok');
    expect(t.id).toBe(sucessoLista.data[0].id);
  });

  it('devolve o erro DeviceNotRegistered com details.error', () => {
    const t = extrairTicket(deviceNotRegistered);
    expect(t.status).toBe('error');
    expect(t.details?.error).toBe('DeviceNotRegistered');
    expect(t.message).toContain('not a registered');
  });

  it('devolve o erro InvalidCredentials', () => {
    const t = extrairTicket(invalidCredentials);
    expect(t.status).toBe('error');
    expect(t.details?.error).toBe('InvalidCredentials');
  });

  it('transforma erro do pedido inteiro em ticket de erro com mensagem', () => {
    const t = extrairTicket(erroDoPedido);
    expect(t.status).toBe('error');
    expect(t.message).toBe('"to" must be a string or an array of strings.');
    expect(t.details?.error).toBe('VALIDATION_ERROR');
  });

  it('não quebra com resposta sem forma conhecida e nunca a dá como sucesso', () => {
    for (const r of [
      null,
      undefined,
      'oops',
      {},
      { data: [] },
      { data: null },
    ]) {
      const t = extrairTicket(r);
      expect(t.status).toBe('error');
      expect(t.message).toBeTruthy();
    }
  });
});

describe('tokenDeveSerLimpo', () => {
  it('limpa só no DeviceNotRegistered (app desinstalado / token morto)', () => {
    expect(tokenDeveSerLimpo(extrairTicket(deviceNotRegistered))).toBe(true);
  });

  it('não limpa em erro de credencial: a culpa é nossa, não do aparelho', () => {
    expect(tokenDeveSerLimpo(extrairTicket(invalidCredentials))).toBe(false);
  });

  it('não limpa em sucesso nem em erro do pedido', () => {
    expect(tokenDeveSerLimpo(extrairTicket(sucessoObjeto))).toBe(false);
    expect(tokenDeveSerLimpo(extrairTicket(erroDoPedido))).toBe(false);
  });
});

describe('mascararToken', () => {
  it('mostra só os 6 últimos caracteres', () => {
    expect(mascararToken(TOKEN)).toBe('…xxxxx]');
    expect(mascararToken(TOKEN)).not.toContain('ExponentPushToken');
  });

  it('não vaza token curto inteiro e aceita ausência', () => {
    expect(mascararToken('abc')).toBe('…');
    expect(mascararToken(null)).toBe('(sem token)');
  });
});

describe('resumoDoTicket', () => {
  it('leva status, id e código de erro, nunca a mensagem (que traz o token)', () => {
    const r = resumoDoTicket(extrairTicket(deviceNotRegistered));
    expect(r).toEqual({
      status: 'error',
      id: null,
      erro: 'DeviceNotRegistered',
    });
    expect(JSON.stringify(r)).not.toContain('ExponentPushToken');
  });

  it('em sucesso leva o id do ticket', () => {
    expect(resumoDoTicket(extrairTicket(sucessoObjeto))).toEqual({
      status: 'ok',
      id: sucessoObjeto.data.id,
      erro: null,
    });
  });
});
