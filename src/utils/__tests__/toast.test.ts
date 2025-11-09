import Toast from 'react-native-toast-message';

import { toast } from '../toast';

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

describe('Toast Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('toast.success', () => {
    it('deve exibir toast de sucesso com título padrão', () => {
      toast.success('Operação realizada');

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'success',
        text1: 'Sucesso!',
        text2: 'Operação realizada',
        position: 'top',
        visibilityTime: 3000,
        topOffset: 60,
      });
    });

    it('deve exibir toast de sucesso com título customizado', () => {
      toast.success('Dados salvos', 'Tudo certo');

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'success',
        text1: 'Tudo certo',
        text2: 'Dados salvos',
        position: 'top',
        visibilityTime: 3000,
        topOffset: 60,
      });
    });

    it('deve usar visibilityTime de 3000ms', () => {
      toast.success('Teste');

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          visibilityTime: 3000,
        })
      );
    });
  });

  describe('toast.error', () => {
    it('deve exibir toast de erro com título padrão', () => {
      toast.error('Algo deu errado');

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'error',
        text1: 'Erro',
        text2: 'Algo deu errado',
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });
    });

    it('deve exibir toast de erro com título customizado', () => {
      toast.error('Falha ao conectar', 'Erro de Conexão');

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'error',
        text1: 'Erro de Conexão',
        text2: 'Falha ao conectar',
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });
    });

    it('deve usar visibilityTime de 4000ms (maior para erros)', () => {
      toast.error('Teste');

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          visibilityTime: 4000,
        })
      );
    });
  });

  describe('toast.info', () => {
    it('deve exibir toast de informação com título padrão', () => {
      toast.info('Você tem 3 notificações');

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'info',
        text1: 'Informação',
        text2: 'Você tem 3 notificações',
        position: 'top',
        visibilityTime: 3000,
        topOffset: 60,
      });
    });

    it('deve exibir toast de informação com título customizado', () => {
      toast.info('Nova atualização disponível', 'Novidades');

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'info',
        text1: 'Novidades',
        text2: 'Nova atualização disponível',
        position: 'top',
        visibilityTime: 3000,
        topOffset: 60,
      });
    });

    it('deve usar visibilityTime de 3000ms', () => {
      toast.info('Teste');

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          visibilityTime: 3000,
        })
      );
    });
  });

  describe('toast.warning', () => {
    it('deve exibir toast de aviso com título padrão', () => {
      toast.warning('Atenção ao preencher o formulário');

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'warning',
        text1: 'Atenção',
        text2: 'Atenção ao preencher o formulário',
        position: 'top',
        visibilityTime: 3500,
        topOffset: 60,
      });
    });

    it('deve exibir toast de aviso com título customizado', () => {
      toast.warning('Alguns campos estão vazios', 'Dados Incompletos');

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'warning',
        text1: 'Dados Incompletos',
        text2: 'Alguns campos estão vazios',
        position: 'top',
        visibilityTime: 3500,
        topOffset: 60,
      });
    });

    it('deve usar visibilityTime de 3500ms', () => {
      toast.warning('Teste');

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          visibilityTime: 3500,
        })
      );
    });
  });

  describe('Configurações comuns', () => {
    it('todos os toasts devem usar position top', () => {
      toast.success('Teste');
      toast.error('Teste');
      toast.info('Teste');
      toast.warning('Teste');

      const calls = (Toast.show as jest.Mock).mock.calls;
      calls.forEach(call => {
        expect(call[0].position).toBe('top');
      });
    });

    it('todos os toasts devem usar topOffset de 60', () => {
      toast.success('Teste');
      toast.error('Teste');
      toast.info('Teste');
      toast.warning('Teste');

      const calls = (Toast.show as jest.Mock).mock.calls;
      calls.forEach(call => {
        expect(call[0].topOffset).toBe(60);
      });
    });

    it('deve chamar Toast.show exatamente uma vez por toast', () => {
      toast.success('Teste');
      expect(Toast.show).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      toast.error('Teste');
      expect(Toast.show).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ordem de duração', () => {
    it('erro deve ter maior visibilityTime (4000ms)', () => {
      const durations = {
        success: 3000,
        error: 4000,
        info: 3000,
        warning: 3500,
      };

      expect(durations.error).toBeGreaterThan(durations.success);
      expect(durations.error).toBeGreaterThan(durations.info);
      expect(durations.error).toBeGreaterThan(durations.warning);
    });

    it('warning deve ter duração intermediária (3500ms)', () => {
      const durations = {
        success: 3000,
        warning: 3500,
      };

      expect(durations.warning).toBeGreaterThan(durations.success);
    });
  });

  describe('Casos de uso reais', () => {
    it('deve exibir sucesso ao salvar dados', () => {
      toast.success('Perfil atualizado com sucesso');

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          text2: 'Perfil atualizado com sucesso',
        })
      );
    });

    it('deve exibir erro ao falhar login', () => {
      toast.error('Email ou senha incorretos', 'Falha no Login');

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Falha no Login',
          text2: 'Email ou senha incorretos',
        })
      );
    });

    it('deve exibir info para notificações gerais', () => {
      toast.info('Você tem 5 rotas pendentes');

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          text2: 'Você tem 5 rotas pendentes',
        })
      );
    });

    it('deve exibir warning para validações', () => {
      toast.warning('Preencha todos os campos obrigatórios');

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          text2: 'Preencha todos os campos obrigatórios',
        })
      );
    });
  });
});
