import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { EmptyState } from '../EmptyState';

describe('EmptyState Component', () => {
  describe('Renderização Básica', () => {
    it('deve renderizar com título', () => {
      const { getByText } = render(
        <EmptyState title="Nenhuma rota encontrada" />
      );

      expect(getByText('Nenhuma rota encontrada')).toBeTruthy();
    });

    it('deve renderizar com título e descrição', () => {
      const { getByText } = render(
        <EmptyState
          title="Nenhuma rota encontrada"
          description="Crie sua primeira rota para começar"
        />
      );

      expect(getByText('Nenhuma rota encontrada')).toBeTruthy();
      expect(getByText('Crie sua primeira rota para começar')).toBeTruthy();
    });

    it('deve renderizar sem descrição', () => {
      const { getByText } = render(
        <EmptyState title="Lista vazia" />
      );

      expect(getByText('Lista vazia')).toBeTruthy();
    });
  });

  describe('Ícone', () => {
    it('deve renderizar com ícone padrão', () => {
      const { UNSAFE_getByType } = render(
        <EmptyState title="Vazio" />
      );

      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon).toBeTruthy();
      expect(icon.props.name).toBe('file-tray-outline');
    });

    it('deve renderizar com ícone customizado', () => {
      const { UNSAFE_getByType } = render(
        <EmptyState title="Nada encontrado" icon="search-outline" />
      );

      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon).toBeTruthy();
      expect(icon.props.name).toBe('search-outline');
    });

    it('deve renderizar ícone de erro', () => {
      const { UNSAFE_getByType } = render(
        <EmptyState
          title="Erro ao carregar"
          icon="alert-circle-outline"
        />
      );

      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon.props.name).toBe('alert-circle-outline');
    });
  });

  describe('Botão de Ação', () => {
    it('deve renderizar botão de ação quando fornecido', () => {
      const { getByText } = render(
        <EmptyState
          title="Lista vazia"
          actionLabel="Adicionar Item"
          onActionPress={jest.fn()}
        />
      );

      expect(getByText('Adicionar Item')).toBeTruthy();
    });

    it('não deve renderizar botão sem actionLabel', () => {
      const { queryByText } = render(
        <EmptyState
          title="Lista vazia"
          onActionPress={jest.fn()}
        />
      );

      // Sem actionLabel, botão não deve aparecer
      expect(queryByText('Adicionar')).toBeNull();
    });

    it('não deve renderizar botão sem onActionPress', () => {
      const { queryByText } = render(
        <EmptyState
          title="Lista vazia"
          actionLabel="Adicionar Item"
        />
      );

      // Sem onActionPress, botão não deve aparecer
      expect(queryByText('Adicionar Item')).toBeNull();
    });

    it('deve chamar onActionPress ao clicar no botão', () => {
      const mockAction = jest.fn();
      const { getByText } = render(
        <EmptyState
          title="Lista vazia"
          actionLabel="Criar Nova"
          onActionPress={mockAction}
        />
      );

      fireEvent.press(getByText('Criar Nova'));
      expect(mockAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Casos de Uso Comuns', () => {
    it('deve renderizar empty state de lista vazia', () => {
      const { getByText } = render(
        <EmptyState
          icon="calendar-outline"
          title="Sem rotas para hoje"
          description="Não há rotas programadas para hoje"
        />
      );

      expect(getByText('Sem rotas para hoje')).toBeTruthy();
      expect(getByText('Não há rotas programadas para hoje')).toBeTruthy();
    });

    it('deve renderizar empty state de busca', () => {
      const { getByText } = render(
        <EmptyState
          icon="search-outline"
          title="Nenhum resultado encontrado"
          description="Tente usar outros termos de busca"
        />
      );

      expect(getByText('Nenhum resultado encontrado')).toBeTruthy();
      expect(getByText('Tente usar outros termos de busca')).toBeTruthy();
    });

    it('deve renderizar empty state de erro com ação', () => {
      const mockRetry = jest.fn();
      const { getByText } = render(
        <EmptyState
          icon="alert-circle-outline"
          title="Erro ao carregar dados"
          description="Ocorreu um erro. Tente novamente."
          actionLabel="Tentar Novamente"
          onActionPress={mockRetry}
        />
      );

      expect(getByText('Erro ao carregar dados')).toBeTruthy();
      expect(getByText('Ocorreu um erro. Tente novamente.')).toBeTruthy();

      fireEvent.press(getByText('Tentar Novamente'));
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar empty state com call to action', () => {
      const mockAdd = jest.fn();
      const { getByText } = render(
        <EmptyState
          icon="add-circle-outline"
          title="Nenhum motorista cadastrado"
          description="Adicione motoristas para gerenciar suas rotas"
          actionLabel="Adicionar Motorista"
          onActionPress={mockAdd}
        />
      );

      expect(getByText('Nenhum motorista cadastrado')).toBeTruthy();
      fireEvent.press(getByText('Adicionar Motorista'));
      expect(mockAdd).toHaveBeenCalled();
    });
  });

  describe('Estilos Customizados', () => {
    it('deve aceitar style customizado', () => {
      const customStyle = { backgroundColor: 'red' };
      const { getByText } = render(
        <EmptyState
          title="Teste"
          style={customStyle}
        />
      );

      expect(getByText('Teste')).toBeTruthy();
    });
  });

  describe('Combinações de Props', () => {
    it('deve renderizar todos os elementos juntos', () => {
      const mockAction = jest.fn();
      const { getByText, UNSAFE_getByType } = render(
        <EmptyState
          icon="information-circle-outline"
          title="Título Completo"
          description="Descrição detalhada"
          actionLabel="Ação Principal"
          onActionPress={mockAction}
        />
      );

      expect(getByText('Título Completo')).toBeTruthy();
      expect(getByText('Descrição detalhada')).toBeTruthy();
      expect(getByText('Ação Principal')).toBeTruthy();

      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icon.props.name).toBe('information-circle-outline');
    });
  });
});
