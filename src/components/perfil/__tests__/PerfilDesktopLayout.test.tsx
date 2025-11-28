import { Ionicons } from '@expo/vector-icons';
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { PerfilDesktopLayout } from '../PerfilDesktopLayout';

// Mock useRouter
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('PerfilDesktopLayout', () => {
  const mockUsuario = {
    nome: 'João Silva',
    email: 'joao@example.com',
    telefone: '(11) 98765-4321',
    papel: 'gestor' as const,
    foto_url: null,
    unidades: {
      nome: 'WJX Locações',
    },
  };

  const mockAtividade = {
    ultimoAcesso: '2025-01-15T10:30:00Z',
    dispositivosAtivos: 2,
  };

  const mockOnSelectPhoto = jest.fn();
  const mockOnLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar com props mínimas (apenas usuario)', () => {
      const { getAllByText, getByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      // Nome aparece 2x (sidebar + content), usar getAllByText
      expect(getAllByText('João Silva').length).toBeGreaterThan(0);
      expect(getAllByText('joao@example.com').length).toBeGreaterThan(0);
      expect(getByText('Gestor')).toBeTruthy();
    });

    it('deve renderizar com todos os props', () => {
      const { getAllByText } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          uploadingPhoto={false}
          onSelectPhoto={mockOnSelectPhoto}
          atividade={mockAtividade}
          onLogout={mockOnLogout}
        />
      );

      expect(getAllByText('João Silva').length).toBeGreaterThan(0);
      expect(getAllByText('WJX Locações').length).toBeGreaterThan(0);
    });

    it('deve renderizar estrutura sidebar + content area', () => {
      const { UNSAFE_getAllByType } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      const { View } = require('react-native');
      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });
  });

  describe('Avatar e Foto do Usuário', () => {
    it('deve renderizar placeholder quando foto_url é null', () => {
      const { getByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      // Iniciais do nome (primeiro + último nome) em uppercase - AvatarEditable
      expect(getByText('JS')).toBeTruthy();
    });

    it('deve renderizar imagem quando foto_url existe', () => {
      const usuarioComFoto = {
        ...mockUsuario,
        foto_url: 'https://example.com/foto.jpg',
      };

      const { UNSAFE_getByType } = render(
        <PerfilDesktopLayout usuario={usuarioComFoto} />
      );

      const { Image } = require('react-native');
      const image = UNSAFE_getByType(Image);
      expect(image.props.source.uri).toBe('https://example.com/foto.jpg');
    });

    it('deve chamar onSelectPhoto ao clicar no avatar', () => {
      const { UNSAFE_getAllByType } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          onSelectPhoto={mockOnSelectPhoto}
        />
      );

      const { TouchableOpacity } = require('react-native');
      const avatarButton = UNSAFE_getAllByType(TouchableOpacity)[0]; // Primeiro TouchableOpacity é o avatar

      fireEvent.press(avatarButton);
      expect(mockOnSelectPhoto).toHaveBeenCalledTimes(1);
    });

    it('deve desabilitar avatar quando uploadingPhoto=true', () => {
      const { UNSAFE_getAllByType } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          uploadingPhoto={true}
          onSelectPhoto={mockOnSelectPhoto}
        />
      );

      const { TouchableOpacity } = require('react-native');
      const avatarButton = UNSAFE_getAllByType(TouchableOpacity)[0];

      expect(avatarButton.props.disabled).toBe(true);
    });

    it('deve mostrar ActivityIndicator quando uploadingPhoto=true', () => {
      const { UNSAFE_getByType } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          uploadingPhoto={true}
        />
      );

      const { ActivityIndicator } = require('react-native');
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('deve mostrar ícone de câmera quando uploadingPhoto=false e onSelectPhoto existe', () => {
      const { UNSAFE_getAllByType } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          uploadingPhoto={false}
          onSelectPhoto={mockOnSelectPhoto}
        />
      );

      const icons = UNSAFE_getAllByType(Ionicons);
      const cameraIcon = icons.find(icon => icon.props.name === 'camera');
      expect(cameraIcon).toBeTruthy();
    });
  });

  describe('Informações do Usuário', () => {
    it('deve exibir nome do usuário', () => {
      const { getAllByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      expect(getAllByText('João Silva').length).toBeGreaterThan(0);
    });

    it('deve exibir email do usuário', () => {
      const { getAllByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      expect(getAllByText('joao@example.com').length).toBeGreaterThan(0);
    });

    it('deve exibir badge "Gestor" quando papel=gestor', () => {
      const { getByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      expect(getByText('Gestor')).toBeTruthy();
    });

    it('deve exibir badge "Motorista" quando papel=motorista', () => {
      const usuarioMotorista = { ...mockUsuario, papel: 'motorista' as const };
      const { getByText } = render(
        <PerfilDesktopLayout usuario={usuarioMotorista} />
      );

      expect(getByText('Motorista')).toBeTruthy();
    });

    it('deve exibir nome da unidade quando existe', () => {
      const { getByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      expect(getByText('WJX Locações')).toBeTruthy();
    });

    it('não deve renderizar unitInfo quando unidades.nome não existe', () => {
      const usuarioSemUnidade = { ...mockUsuario, unidades: null };
      const { queryByText } = render(
        <PerfilDesktopLayout usuario={usuarioSemUnidade} />
      );

      expect(queryByText('WJX Locações')).toBeNull();
    });

    it('deve exibir "Usuário" quando nome não fornecido', () => {
      const usuarioSemNome = { ...mockUsuario, nome: null };
      const { getByText } = render(
        <PerfilDesktopLayout usuario={usuarioSemNome} />
      );

      expect(getByText('Usuário')).toBeTruthy();
    });

    it('deve renderizar iniciais do nome padrão quando nome não existe', () => {
      const usuarioSemNome = { ...mockUsuario, nome: null };
      const { getByText } = render(
        <PerfilDesktopLayout usuario={usuarioSemNome} />
      );

      // AvatarEditable recebe "Usuário" como fallback e gera "US"
      expect(getByText('US')).toBeTruthy();
    });
  });

  describe('Quick Actions', () => {
    it('deve renderizar botão "Editar Perfil"', () => {
      const { getByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      expect(getByText('Editar Perfil')).toBeTruthy();
    });

    it('deve navegar para /perfil/editar ao clicar em "Editar Perfil"', () => {
      const { getByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      fireEvent.press(getByText('Editar Perfil'));
      expect(mockPush).toHaveBeenCalledWith('/perfil/editar');
    });

    it('deve renderizar botão "Alterar Senha"', () => {
      const { getByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      expect(getByText('Alterar Senha')).toBeTruthy();
    });

    it('deve navegar para /perfil/trocar-senha ao clicar em "Alterar Senha"', () => {
      const { getByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      fireEvent.press(getByText('Alterar Senha'));
      expect(mockPush).toHaveBeenCalledWith('/perfil/trocar-senha');
    });

    it('deve renderizar botão "Sair" quando onLogout fornecido', () => {
      const { getByText } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          onLogout={mockOnLogout}
        />
      );

      expect(getByText('Sair')).toBeTruthy();
    });

    it('deve chamar onLogout ao clicar em "Sair"', () => {
      const { getByText } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          onLogout={mockOnLogout}
        />
      );

      fireEvent.press(getByText('Sair'));
      expect(mockOnLogout).toHaveBeenCalledTimes(1);
    });

    it('não deve renderizar botão "Sair" quando onLogout não fornecido', () => {
      const { queryByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      expect(queryByText('Sair')).toBeNull();
    });
  });

  describe('Área de Conteúdo - Default (sem children)', () => {
    it('deve renderizar cards de informações quando children não fornecido', () => {
      const { getByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      expect(getByText('Informações Pessoais')).toBeTruthy();
      expect(getByText('Atividade Recente')).toBeTruthy();
    });

    it('deve exibir informações pessoais no card', () => {
      const { getByText, getAllByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      expect(getByText('Nome Completo')).toBeTruthy();
      expect(getAllByText('João Silva').length).toBeGreaterThan(0);
      expect(getByText('Email')).toBeTruthy();
      expect(getAllByText('joao@example.com').length).toBeGreaterThan(0);
      expect(getByText('Telefone')).toBeTruthy();
      expect(getByText('(11) 98765-4321')).toBeTruthy();
    });

    it('deve exibir "Não informado" para campos vazios', () => {
      const usuarioIncompleto = {
        ...mockUsuario,
        telefone: null,
      };
      const { getAllByText } = render(
        <PerfilDesktopLayout usuario={usuarioIncompleto} />
      );

      const naoInformado = getAllByText('Não informado');
      expect(naoInformado.length).toBeGreaterThan(0);
    });

    it('deve exibir atividade recente quando atividade fornecida', () => {
      const { getByText } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          atividade={mockAtividade}
        />
      );

      expect(getByText('Último acesso')).toBeTruthy();
      expect(getByText('Dispositivos ativos')).toBeTruthy();
      expect(getByText('2 dispositivos')).toBeTruthy();
    });

    it('deve formatar data de último acesso corretamente', () => {
      const { getByText } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          atividade={mockAtividade}
        />
      );

      // Verifica que a data foi formatada (formato pt-BR)
      const textoData = getByText(/janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i);
      expect(textoData).toBeTruthy();
    });

    it('deve exibir "Nunca registrado" quando ultimoAcesso é null', () => {
      const atividadeSemAcesso = { ...mockAtividade, ultimoAcesso: null };
      const { getByText } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          atividade={atividadeSemAcesso}
        />
      );

      expect(getByText('Nunca registrado')).toBeTruthy();
    });

    it('deve exibir "Data indisponível" quando ultimoAcesso é inválido', () => {
      const atividadeComDataInvalida = { ...mockAtividade, ultimoAcesso: 'invalid-date' };
      const { getByText } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          atividade={atividadeComDataInvalida}
        />
      );

      expect(getByText('Data indisponível')).toBeTruthy();
    });

    it('deve exibir "1 dispositivo" quando dispositivosAtivos=1', () => {
      const atividadeUmDispositivo = { ...mockAtividade, dispositivosAtivos: 1 };
      const { getByText } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          atividade={atividadeUmDispositivo}
        />
      );

      expect(getByText('1 dispositivo')).toBeTruthy();
    });

    it('deve exibir "N dispositivos" quando dispositivosAtivos > 1', () => {
      const { getByText } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          atividade={mockAtividade}
        />
      );

      expect(getByText('2 dispositivos')).toBeTruthy();
    });

    it('deve exibir "Indisponível" quando dispositivosAtivos é null', () => {
      const atividadeSemDispositivos = { ...mockAtividade, dispositivosAtivos: null };
      const { getByText } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          atividade={atividadeSemDispositivos}
        />
      );

      expect(getByText('Indisponível')).toBeTruthy();
    });
  });

  describe('Área de Conteúdo - Custom (com children)', () => {
    it('deve renderizar children quando fornecido', () => {
      const { View, Text } = require('react-native');
      const { getByText, queryByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario}>
          <View>
            <Text>Custom Content</Text>
          </View>
        </PerfilDesktopLayout>
      );

      expect(getByText('Custom Content')).toBeTruthy();
      // Não deve renderizar cards default
      expect(queryByText('Informações Pessoais')).toBeNull();
    });
  });

  describe('Ícones', () => {
    it('deve renderizar ícones corretos', () => {
      const { UNSAFE_getAllByType } = render(
        <PerfilDesktopLayout
          usuario={mockUsuario}
          onLogout={mockOnLogout}
        />
      );

      const icons = UNSAFE_getAllByType(Ionicons);

      // Verificar que há ícones renderizados
      expect(icons.length).toBeGreaterThan(0);

      // Verificar ícones específicos
      const businessIcon = icons.find(icon => icon.props.name === 'business-outline');
      const personIcon = icons.find(icon => icon.props.name === 'person-outline');
      const lockIcon = icons.find(icon => icon.props.name === 'lock-closed-outline');
      const logoutIcon = icons.find(icon => icon.props.name === 'log-out-outline');

      expect(businessIcon).toBeTruthy();
      expect(personIcon).toBeTruthy();
      expect(lockIcon).toBeTruthy();
      expect(logoutIcon).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('deve renderizar com usuario vazio', () => {
      const { getByText, getAllByText } = render(
        <PerfilDesktopLayout usuario={{}} />
      );

      // Nome default é "Usuário" - pode aparecer mais de uma vez
      expect(getAllByText('Usuário').length).toBeGreaterThan(0);
      // AvatarEditable mostra "US" para "Usuário"
      expect(getByText('US')).toBeTruthy();
    });

    it('deve renderizar sem atividade', () => {
      const { getByText } = render(
        <PerfilDesktopLayout usuario={mockUsuario} />
      );

      expect(getByText('Nunca registrado')).toBeTruthy();
      expect(getByText('Indisponível')).toBeTruthy();
    });

    it('deve renderizar com telefone vazio mostrando "Não informado"', () => {
      const usuarioSemTelefone = { ...mockUsuario, telefone: '' };
      const { getAllByText } = render(
        <PerfilDesktopLayout usuario={usuarioSemTelefone} />
      );

      expect(getAllByText('Não informado').length).toBeGreaterThan(0);
    });
  });
});
