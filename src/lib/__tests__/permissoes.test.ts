import { Linking, Platform } from 'react-native';

import {
  abrirConfiguracoesDoApp,
  oferecerSaidaParaConfiguracoes,
  pedirPermissao,
  type CopyDePermissao,
} from '../permissoes';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Linking: { openURL: jest.fn(), openSettings: jest.fn() },
}));

const COPY: CopyDePermissao = {
  titulo: 'Acesso à câmera',
  mensagemNegada: 'Sem acesso à câmera não é possível registrar o comprovante.',
  mensagemBloqueada:
    'O acesso à câmera está bloqueado. Libere em Configurações.',
};

describe('pedirPermissao', () => {
  it('preserva o canAskAgain que os call sites descartavam', async () => {
    const resultado = await pedirPermissao(async () => ({
      status: 'denied',
      canAskAgain: false,
    }));
    expect(resultado).toEqual({ concedida: false, podePerguntarDeNovo: false });
  });

  it('concedida quando o status é granted', async () => {
    const resultado = await pedirPermissao(async () => ({
      status: 'granted',
      canAskAgain: true,
    }));
    expect(resultado.concedida).toBe(true);
  });

  it('trata canAskAgain ausente como "ainda dá para perguntar"', async () => {
    // Vários mocks do repo devolvem só { status }. A mensagem mais branda é a
    // escolha segura: acusar bloqueio que não existe confunde mais.
    const resultado = await pedirPermissao(async () => ({ status: 'denied' }));
    expect(resultado.podePerguntarDeNovo).toBe(true);
  });
});

describe('abrirConfiguracoesDoApp', () => {
  afterEach(() => {
    (Platform as { OS: string }).OS = 'android';
    jest.clearAllMocks();
  });

  it('usa openSettings no Android e avisa que agiu', () => {
    (Platform as { OS: string }).OS = 'android';
    const agiu = abrirConfiguracoesDoApp();
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(agiu).toBe(true);
  });

  it('usa app-settings: no iOS e avisa que agiu', () => {
    (Platform as { OS: string }).OS = 'ios';
    const agiu = abrirConfiguracoesDoApp();
    expect(Linking.openURL).toHaveBeenCalledWith('app-settings:');
    expect(agiu).toBe(true);
  });

  it('não faz nada na web e avisa quem chamou, em vez de um retorno indistinguível de sucesso', () => {
    (Platform as { OS: string }).OS = 'web';
    const agiu = abrirConfiguracoesDoApp();
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(Linking.openSettings).not.toHaveBeenCalled();
    expect(agiu).toBe(false);
  });
});

describe('oferecerSaidaParaConfiguracoes', () => {
  afterEach(() => jest.clearAllMocks());

  it('usa a mensagem branda quando ainda dá para perguntar', async () => {
    const showConfirm = jest.fn().mockResolvedValue(false);
    await oferecerSaidaParaConfiguracoes(
      { concedida: false, podePerguntarDeNovo: true },
      COPY,
      showConfirm,
    );
    expect(showConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: COPY.mensagemNegada }),
    );
  });

  it('usa a mensagem de bloqueio quando não dá mais', async () => {
    const showConfirm = jest.fn().mockResolvedValue(false);
    await oferecerSaidaParaConfiguracoes(
      { concedida: false, podePerguntarDeNovo: false },
      COPY,
      showConfirm,
    );
    expect(showConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: COPY.mensagemBloqueada }),
    );
  });

  it('abre as Configurações quando o motorista confirma', async () => {
    const showConfirm = jest.fn().mockResolvedValue(true);
    await oferecerSaidaParaConfiguracoes(
      { concedida: false, podePerguntarDeNovo: false },
      COPY,
      showConfirm,
    );
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  it('não abre nada quando o motorista cancela', async () => {
    const showConfirm = jest.fn().mockResolvedValue(false);
    await oferecerSaidaParaConfiguracoes(
      { concedida: false, podePerguntarDeNovo: false },
      COPY,
      showConfirm,
    );
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });

  it('não pergunta nada quando a permissão foi concedida', async () => {
    const showConfirm = jest.fn().mockResolvedValue(false);
    await oferecerSaidaParaConfiguracoes(
      { concedida: true, podePerguntarDeNovo: true },
      COPY,
      showConfirm,
    );
    expect(showConfirm).not.toHaveBeenCalled();
  });

  describe('na web', () => {
    afterEach(() => {
      (Platform as { OS: string }).OS = 'android';
      jest.clearAllMocks();
    });

    // IMPORTANTE 2: na web, abrirConfiguracoesDoApp() não faz nada - prometer
    // "Abrir Configurações" num botão que não abre nada é o botão morto que
    // este módulo existe para eliminar. O remédio real (o cadeado do
    // navegador) precisa aparecer na mensagem, e o botão não pode prometer
    // uma ação que este módulo sabe de antemão que não vai acontecer.
    it('não promete "Abrir Configurações" - nomeia o cadeado do navegador na mensagem e não chama Linking mesmo se confirmado', async () => {
      (Platform as { OS: string }).OS = 'web';
      const showConfirm = jest.fn().mockResolvedValue(true);

      await oferecerSaidaParaConfiguracoes(
        { concedida: false, podePerguntarDeNovo: true },
        COPY,
        showConfirm,
      );

      expect(showConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmText: 'Entendi',
          message: expect.stringContaining('cadeado'),
        }),
      );
      expect(showConfirm).not.toHaveBeenCalledWith(
        expect.objectContaining({ confirmText: 'Abrir Configurações' }),
      );
      expect(Linking.openURL).not.toHaveBeenCalled();
      expect(Linking.openSettings).not.toHaveBeenCalled();
    });
  });
});
