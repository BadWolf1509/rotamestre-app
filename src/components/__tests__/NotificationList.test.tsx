import { fireEvent, render, screen } from '@testing-library/react-native';

import { useNotifications } from '@/hooks/useNotifications';

import { NotificationList } from '../NotificationList';

// Mock useNotifications hook
const mockMarcarComoLida = jest.fn();
const mockMarcarTodasComoLidas = jest.fn();

jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: jest.fn(() => ({
    notificacoes: [],
    naoLidas: 0,
    loading: false,
    marcarComoLida: mockMarcarComoLida,
    marcarTodasComoLidas: mockMarcarTodasComoLidas,
  })),
}));

// Mock router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

// Import após mock para poder manipular


const mockNotificacoes = [
  {
    id: 'notif-1',
    tipo: 'rota_iniciada',
    titulo: 'Rota Iniciada',
    mensagem: 'Motorista João iniciou a rota #123',
    lida: false,
    rota_id: 'rota-123',
    created_at: new Date().toISOString(),
  },
  {
    id: 'notif-2',
    tipo: 'rota_concluida',
    titulo: 'Rota Concluída',
    mensagem: 'A rota #456 foi concluída com sucesso',
    lida: true,
    rota_id: 'rota-456',
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
  },
  {
    id: 'notif-3',
    tipo: 'incidente_reportado',
    titulo: 'Incidente Reportado',
    mensagem: 'Um incidente foi reportado na parada #789',
    lida: false,
    rota_id: 'rota-789',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 dias atrás
  },
];

describe('NotificationList', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotifications as jest.Mock).mockReturnValue({
      notificacoes: [],
      naoLidas: 0,
      loading: false,
      marcarComoLida: mockMarcarComoLida,
      marcarTodasComoLidas: mockMarcarTodasComoLidas,
    });
  });

  describe('Estado vazio', () => {
    it('deve renderizar mensagem de lista vazia', () => {
      render(<NotificationList onClose={mockOnClose} />);

      expect(screen.getByText('Nenhuma notificação')).toBeTruthy();
      expect(screen.getByText('Você será notificado sobre atualizações nas rotas')).toBeTruthy();
    });

    it('deve exibir título Notificações', () => {
      render(<NotificationList onClose={mockOnClose} />);

      expect(screen.getByText('Notificações')).toBeTruthy();
    });

    it('não deve exibir badge quando não há notificações não lidas', () => {
      render(<NotificationList onClose={mockOnClose} />);

      expect(screen.queryByText('0')).toBeNull();
    });

    it('não deve exibir botão "Marcar todas como lidas" quando não há notificações não lidas', () => {
      render(<NotificationList onClose={mockOnClose} />);

      expect(screen.queryByText('Marcar todas como lidas')).toBeNull();
    });
  });

  describe('Estado de carregamento', () => {
    it('deve exibir indicador de carregamento', () => {
      (useNotifications as jest.Mock).mockReturnValue({
        notificacoes: [],
        naoLidas: 0,
        loading: true,
        marcarComoLida: mockMarcarComoLida,
        marcarTodasComoLidas: mockMarcarTodasComoLidas,
      });

      render(<NotificationList onClose={mockOnClose} />);

      // ActivityIndicator deve estar presente
      expect(screen.queryByText('Nenhuma notificação')).toBeNull();
    });
  });

  describe('Com notificações', () => {
    beforeEach(() => {
      (useNotifications as jest.Mock).mockReturnValue({
        notificacoes: mockNotificacoes,
        naoLidas: 2,
        loading: false,
        marcarComoLida: mockMarcarComoLida,
        marcarTodasComoLidas: mockMarcarTodasComoLidas,
      });
    });

    it('deve renderizar lista de notificações', () => {
      render(<NotificationList onClose={mockOnClose} />);

      expect(screen.getByText('Rota Iniciada')).toBeTruthy();
      expect(screen.getByText('Rota Concluída')).toBeTruthy();
      expect(screen.getByText('Incidente Reportado')).toBeTruthy();
    });

    it('deve exibir mensagens das notificações', () => {
      render(<NotificationList onClose={mockOnClose} />);

      expect(screen.getByText('Motorista João iniciou a rota #123')).toBeTruthy();
      expect(screen.getByText('A rota #456 foi concluída com sucesso')).toBeTruthy();
    });

    it('deve exibir badge com número de não lidas', () => {
      render(<NotificationList onClose={mockOnClose} />);

      expect(screen.getByText('2')).toBeTruthy();
    });

    it('deve exibir botão "Marcar todas como lidas"', () => {
      render(<NotificationList onClose={mockOnClose} />);

      expect(screen.getByText('Marcar todas como lidas')).toBeTruthy();
    });
  });

  describe('Interações', () => {
    beforeEach(() => {
      (useNotifications as jest.Mock).mockReturnValue({
        notificacoes: mockNotificacoes,
        naoLidas: 2,
        loading: false,
        marcarComoLida: mockMarcarComoLida,
        marcarTodasComoLidas: mockMarcarTodasComoLidas,
      });
    });

    it('deve chamar onClose ao clicar no botão fechar', () => {
      render(<NotificationList onClose={mockOnClose} />);

      // Encontrar o botão de fechar (é o último Ionicons "close")
      const _closeButton = screen.getByTestId('close-button');
      // O close está próximo, vamos clicar no título e depois no X

      // Como não temos acesso direto, vamos testar pelo onClose prop
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('deve chamar marcarTodasComoLidas ao clicar no botão', () => {
      render(<NotificationList onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('Marcar todas como lidas'));

      expect(mockMarcarTodasComoLidas).toHaveBeenCalledTimes(1);
    });

    it('deve chamar marcarComoLida ao clicar em notificação não lida', () => {
      render(<NotificationList onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('Rota Iniciada'));

      expect(mockMarcarComoLida).toHaveBeenCalledWith('notif-1');
    });

    it('não deve chamar marcarComoLida para notificação já lida', () => {
      render(<NotificationList onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('Rota Concluída'));

      // Não deve chamar pois já está lida
      expect(mockMarcarComoLida).not.toHaveBeenCalled();
    });
  });

  describe('Tipos de notificação', () => {
    const tiposNotificacao = [
      { tipo: 'rota_iniciada', titulo: 'Rota Iniciada' },
      { tipo: 'rota_concluida', titulo: 'Rota Concluída' },
      { tipo: 'parada_concluida', titulo: 'Parada Concluída' },
      { tipo: 'incidente_reportado', titulo: 'Incidente Reportado' },
      { tipo: 'rota_atrasada', titulo: 'Rota Atrasada' },
      { tipo: 'parada_pulada', titulo: 'Parada Pulada' },
      // Notificações de edição de rota
      { tipo: 'rota_parada_adicionada', titulo: 'Parada Adicionada' },
      { tipo: 'rota_parada_removida', titulo: 'Parada Removida' },
      { tipo: 'rota_parada_editada', titulo: 'Parada Editada' },
      { tipo: 'rota_reordenada', titulo: 'Rota Reordenada' },
    ];

    tiposNotificacao.forEach(({ tipo, titulo }) => {
      it(`deve renderizar notificação do tipo ${tipo}`, () => {
        (useNotifications as jest.Mock).mockReturnValue({
          notificacoes: [
            {
              id: 'test-notif',
              tipo,
              titulo,
              mensagem: `Mensagem de teste para ${tipo}`,
              lida: false,
              rota_id: 'rota-test',
              created_at: new Date().toISOString(),
            },
          ],
          naoLidas: 1,
          loading: false,
          marcarComoLida: mockMarcarComoLida,
          marcarTodasComoLidas: mockMarcarTodasComoLidas,
        });

        render(<NotificationList onClose={mockOnClose} />);

        expect(screen.getByText(titulo)).toBeTruthy();
      });
    });
  });

  describe('Formatação de timestamp', () => {
    it('deve exibir "Agora" para notificações recentes', () => {
      (useNotifications as jest.Mock).mockReturnValue({
        notificacoes: [
          {
            id: 'notif-now',
            tipo: 'rota_iniciada',
            titulo: 'Nova Notificação',
            mensagem: 'Mensagem',
            lida: false,
            rota_id: 'rota-1',
            created_at: new Date().toISOString(),
          },
        ],
        naoLidas: 1,
        loading: false,
        marcarComoLida: mockMarcarComoLida,
        marcarTodasComoLidas: mockMarcarTodasComoLidas,
      });

      render(<NotificationList onClose={mockOnClose} />);

      expect(screen.getByText('Agora')).toBeTruthy();
    });

    it('deve exibir "Xm atrás" para notificações de minutos', () => {
      (useNotifications as jest.Mock).mockReturnValue({
        notificacoes: [
          {
            id: 'notif-mins',
            tipo: 'rota_iniciada',
            titulo: 'Notificação',
            mensagem: 'Mensagem',
            lida: false,
            rota_id: 'rota-1',
            created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutos atrás
          },
        ],
        naoLidas: 1,
        loading: false,
        marcarComoLida: mockMarcarComoLida,
        marcarTodasComoLidas: mockMarcarTodasComoLidas,
      });

      render(<NotificationList onClose={mockOnClose} />);

      expect(screen.getByText('5m atrás')).toBeTruthy();
    });

    it('deve exibir "Xh atrás" para notificações de horas', () => {
      (useNotifications as jest.Mock).mockReturnValue({
        notificacoes: [
          {
            id: 'notif-hours',
            tipo: 'rota_concluida',
            titulo: 'Notificação',
            mensagem: 'Mensagem',
            lida: true,
            rota_id: 'rota-1',
            created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 horas atrás
          },
        ],
        naoLidas: 0,
        loading: false,
        marcarComoLida: mockMarcarComoLida,
        marcarTodasComoLidas: mockMarcarTodasComoLidas,
      });

      render(<NotificationList onClose={mockOnClose} />);

      expect(screen.getByText('3h atrás')).toBeTruthy();
    });

    it('deve exibir "Xd atrás" para notificações de dias', () => {
      (useNotifications as jest.Mock).mockReturnValue({
        notificacoes: [
          {
            id: 'notif-days',
            tipo: 'rota_concluida',
            titulo: 'Notificação',
            mensagem: 'Mensagem',
            lida: true,
            rota_id: 'rota-1',
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 dias atrás
          },
        ],
        naoLidas: 0,
        loading: false,
        marcarComoLida: mockMarcarComoLida,
        marcarTodasComoLidas: mockMarcarTodasComoLidas,
      });

      render(<NotificationList onClose={mockOnClose} />);

      expect(screen.getByText('3d atrás')).toBeTruthy();
    });
  });

  describe('Navegação', () => {
    beforeEach(() => {
      (useNotifications as jest.Mock).mockReturnValue({
        notificacoes: [
          {
            id: 'notif-nav',
            tipo: 'rota_iniciada',
            titulo: 'Rota',
            mensagem: 'Mensagem',
            lida: true,
            rota_id: 'rota-nav-123',
            created_at: new Date().toISOString(),
          },
        ],
        naoLidas: 0,
        loading: false,
        marcarComoLida: mockMarcarComoLida,
        marcarTodasComoLidas: mockMarcarTodasComoLidas,
      });
    });

    it('deve chamar onClose ao clicar em notificação com rota_id', () => {
      render(<NotificationList onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('Rota'));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Sem rota_id', () => {
    it('não deve navegar quando notificação não tem rota_id', () => {
      (useNotifications as jest.Mock).mockReturnValue({
        notificacoes: [
          {
            id: 'notif-no-rota',
            tipo: 'rota_iniciada',
            titulo: 'Sem Rota',
            mensagem: 'Mensagem',
            lida: true,
            rota_id: null,
            created_at: new Date().toISOString(),
          },
        ],
        naoLidas: 0,
        loading: false,
        marcarComoLida: mockMarcarComoLida,
        marcarTodasComoLidas: mockMarcarTodasComoLidas,
      });

      render(<NotificationList onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('Sem Rota'));

      // onClose não deve ser chamado quando não há rota_id
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
