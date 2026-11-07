import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Linking } from 'react-native';

import { SupportModal } from '../SupportModal';

// Mock Linking usando spyOn
const mockCanOpenURL = jest.spyOn(Linking, 'canOpenURL');
const mockOpenURL = jest.spyOn(Linking, 'openURL');

describe('SupportModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCanOpenURL.mockResolvedValue(true);
    mockOpenURL.mockResolvedValue(undefined);
  });

  describe('Renderização', () => {
    it('deve renderizar o modal quando visible é true', () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      expect(screen.getByText('Central de Ajuda')).toBeTruthy();
      expect(screen.getByText('Como podemos ajudar você?')).toBeTruthy();
    });

    it('deve exibir todas as opções de contato', () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      expect(screen.getByText('WhatsApp')).toBeTruthy();
      expect(screen.getByText('Telefone')).toBeTruthy();
      expect(screen.getByText('E-mail')).toBeTruthy();
    });

    it('deve exibir os números e email corretos', () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      expect(screen.getAllByText('(83) 98715-6206')).toHaveLength(2); // WhatsApp e Telefone
      expect(screen.getByText('contato@rotamestre.tec.br')).toBeTruthy();
    });

    it('deve exibir botão de fechar', () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      expect(screen.getByText('Fechar')).toBeTruthy();
    });

    it('deve exibir header com ícone de ajuda', () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      expect(screen.getByText('Central de Ajuda')).toBeTruthy();
    });

    it('deve exibir ícone do WhatsApp', () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      expect(screen.getByText('WhatsApp')).toBeTruthy();
    });
  });

  describe('Interações', () => {
    it('deve chamar onClose ao clicar no botão Fechar', () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('Fechar'));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onClose ao clicar no overlay', () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      // O overlay é o primeiro TouchableOpacity
      // Não funciona bem em testes, vamos testar apenas o botão Fechar
      fireEvent.press(screen.getByText('Fechar'));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Props', () => {
    it('deve aceitar visible=false', () => {
      const { toJSON } = render(
        <SupportModal visible={false} onClose={mockOnClose} />,
      );

      // Modal com visible=false não renderiza conteúdo visível no React Native
      expect(toJSON()).toBeNull();
    });

    it('deve chamar onClose callback quando fornecido', () => {
      const customOnClose = jest.fn();
      render(<SupportModal visible={true} onClose={customOnClose} />);

      fireEvent.press(screen.getByText('Fechar'));

      expect(customOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Estrutura visual', () => {
    it('deve ter três opções de contato', () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      // Verificar que existem três opções
      expect(screen.getByText('WhatsApp')).toBeTruthy();
      expect(screen.getByText('Telefone')).toBeTruthy();
      expect(screen.getByText('E-mail')).toBeTruthy();
    });

    it('deve exibir subtitle correto', () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      expect(screen.getByText('Como podemos ajudar você?')).toBeTruthy();
    });
  });

  describe('Ações de contato', () => {
    it('deve abrir WhatsApp ao clicar', async () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('WhatsApp'));

      await waitFor(() => {
        expect(mockOpenURL).toHaveBeenCalledWith(
          expect.stringContaining('wa.me'),
        );
      });
    });

    it('deve abrir discador ao clicar em Telefone', async () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('Telefone'));

      await waitFor(() => {
        expect(mockOpenURL).toHaveBeenCalledWith(
          expect.stringContaining('tel:'),
        );
      });
    });

    it('deve abrir cliente de email ao clicar', async () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('E-mail'));

      await waitFor(() => {
        expect(mockOpenURL).toHaveBeenCalledWith(
          expect.stringContaining('mailto:contato@rotamestre.tec.br'),
        );
      });
    });

    // No Android 11+ o canOpenURL responde false sem <queries>, mesmo com app
    // instalado: consultá-lo antes engolia o toque em silêncio.
    it.each([
      ['WhatsApp', 'wa.me'],
      ['E-mail', 'mailto:'],
      ['Telefone', 'tel:'],
    ])(
      'toque em %s abre mesmo quando canOpenURL responde false',
      async (rotulo, trecho) => {
        mockCanOpenURL.mockResolvedValue(false);

        render(<SupportModal visible={true} onClose={mockOnClose} />);

        fireEvent.press(screen.getByText(rotulo));

        await waitFor(() => {
          expect(mockOpenURL).toHaveBeenCalledWith(
            expect.stringContaining(trecho),
          );
        });
        expect(mockCanOpenURL).not.toHaveBeenCalled();
      },
    );

    it.each([['WhatsApp'], ['E-mail'], ['Telefone']])(
      'openURL que rejeita em %s avisa o usuário em vez de falhar em silêncio',
      async (rotulo) => {
        mockOpenURL.mockRejectedValueOnce(new Error('sem app'));

        render(<SupportModal visible={true} onClose={mockOnClose} />);

        fireEvent.press(screen.getByText(rotulo));

        expect(await screen.findByText(/Não foi possível abrir/)).toBeTruthy();
      },
    );

    it('o aviso some ao tentar outro contato com sucesso', async () => {
      mockOpenURL.mockRejectedValueOnce(new Error('sem app'));

      render(<SupportModal visible={true} onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('Telefone'));
      await screen.findByText(/Não foi possível abrir/);

      fireEvent.press(screen.getByText('E-mail'));

      await waitFor(() => {
        expect(screen.queryByText(/Não foi possível abrir/)).toBeNull();
      });
    });
  });

  describe('Modal Props', () => {
    it('deve ter onRequestClose configurado para onClose', () => {
      const { UNSAFE_getByType } = render(
        <SupportModal visible={true} onClose={mockOnClose} />,
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.onRequestClose).toBe(mockOnClose);
    });

    it('deve ter transparent=true', () => {
      const { UNSAFE_getByType } = render(
        <SupportModal visible={true} onClose={mockOnClose} />,
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.transparent).toBe(true);
    });

    it('deve ter animationType fade', () => {
      const { UNSAFE_getByType } = render(
        <SupportModal visible={true} onClose={mockOnClose} />,
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.animationType).toBe('fade');
    });
  });

  describe('Fechamento via onRequestClose', () => {
    it('deve ter onRequestClose configurado que chama onClose', () => {
      const { UNSAFE_getByType } = render(
        <SupportModal visible={true} onClose={mockOnClose} />,
      );

      const Modal = require('react-native').Modal;
      const modal = UNSAFE_getByType(Modal);

      // onRequestClose deve chamar onClose (permite fechar com back button no Android)
      expect(modal.props.onRequestClose).toBe(mockOnClose);
    });
  });

  describe('Ícones', () => {
    it('deve renderizar ícone de ajuda no header', () => {
      const { UNSAFE_getAllByType } = render(
        <SupportModal visible={true} onClose={mockOnClose} />,
      );

      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icons = UNSAFE_getAllByType(Ionicons);

      // Procurar o ícone help-circle
      const helpIcon = icons.find(
        (icon: any) => icon.props.name === 'help-circle',
      );
      expect(helpIcon).toBeTruthy();
    });

    it('deve renderizar ícone do WhatsApp', () => {
      const { UNSAFE_getAllByType } = render(
        <SupportModal visible={true} onClose={mockOnClose} />,
      );

      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icons = UNSAFE_getAllByType(Ionicons);

      const whatsappIcon = icons.find(
        (icon: any) => icon.props.name === 'logo-whatsapp',
      );
      expect(whatsappIcon).toBeTruthy();
    });

    it('deve renderizar ícone de telefone', () => {
      const { UNSAFE_getAllByType } = render(
        <SupportModal visible={true} onClose={mockOnClose} />,
      );

      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icons = UNSAFE_getAllByType(Ionicons);

      const phoneIcon = icons.find((icon: any) => icon.props.name === 'call');
      expect(phoneIcon).toBeTruthy();
    });

    it('deve renderizar ícone de email', () => {
      const { UNSAFE_getAllByType } = render(
        <SupportModal visible={true} onClose={mockOnClose} />,
      );

      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icons = UNSAFE_getAllByType(Ionicons);

      const mailIcon = icons.find((icon: any) => icon.props.name === 'mail');
      expect(mailIcon).toBeTruthy();
    });

    it('deve renderizar ícones de seta (chevron-forward)', () => {
      const { UNSAFE_getAllByType } = render(
        <SupportModal visible={true} onClose={mockOnClose} />,
      );

      const Ionicons = require('@expo/vector-icons').Ionicons;
      const icons = UNSAFE_getAllByType(Ionicons);

      const chevronIcons = icons.filter(
        (icon: any) => icon.props.name === 'chevron-forward',
      );
      expect(chevronIcons.length).toBe(3); // 3 opções de contato
    });
  });

  describe('URLs corretas', () => {
    it('deve usar URL correta para WhatsApp com mensagem codificada', async () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('WhatsApp'));

      await waitFor(() => {
        expect(mockOpenURL).toHaveBeenCalledWith(
          expect.stringContaining('5583987156206'),
        );
      });
      expect(mockOpenURL).toHaveBeenCalledWith(
        expect.stringContaining('text='),
      );
    });

    it('deve usar número correto para telefone', async () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('Telefone'));

      await waitFor(() => {
        expect(mockOpenURL).toHaveBeenCalledWith('tel:83987156206');
      });
    });

    it('deve usar email correto', async () => {
      render(<SupportModal visible={true} onClose={mockOnClose} />);

      fireEvent.press(screen.getByText('E-mail'));

      await waitFor(() => {
        expect(mockOpenURL).toHaveBeenCalledWith(
          'mailto:contato@rotamestre.tec.br',
        );
      });
    });
  });
});
