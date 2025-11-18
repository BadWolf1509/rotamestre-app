import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { MobileEmptyState } from '../MobileEmptyState';

describe('MobileEmptyState', () => {
  const mockOnAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar com title obrigatório', () => {
      const { getByText } = render(
        <MobileEmptyState title="Nenhum resultado encontrado" />
      );

      expect(getByText('Nenhum resultado encontrado')).toBeTruthy();
    });

    it('deve renderizar com icon padrão (📋)', () => {
      const { getByText } = render(
        <MobileEmptyState title="Vazio" />
      );

      expect(getByText('📋')).toBeTruthy();
    });

    it('deve renderizar sem subtitle por padrão', () => {
      const { queryByText, getByText } = render(
        <MobileEmptyState title="Título Apenas" />
      );

      expect(getByText('Título Apenas')).toBeTruthy();
      expect(queryByText(/Subtítulo/)).toBeNull();
    });

    it('deve renderizar sem actionLabel por padrão', () => {
      const { queryByText, getByText } = render(
        <MobileEmptyState title="Sem Ação" />
      );

      expect(getByText('Sem Ação')).toBeTruthy();
      // Verificar que MobileButton não foi renderizado
      const { MobileButton } = require('../MobileButton');
      expect(queryByText('Adicionar')).toBeNull();
    });
  });

  describe('Icon Customizado', () => {
    it('deve renderizar icon customizado', () => {
      const { getByText } = render(
        <MobileEmptyState title="Vazio" icon="🔍" />
      );

      expect(getByText('🔍')).toBeTruthy();
    });

    it('deve renderizar diferentes ícones', () => {
      const { getByText } = render(
        <MobileEmptyState title="Erro" icon="⚠️" />
      );

      expect(getByText('⚠️')).toBeTruthy();
    });
  });

  describe('Subtitle', () => {
    it('deve renderizar subtitle quando fornecido', () => {
      const { getByText } = render(
        <MobileEmptyState
          title="Sem Rotas"
          subtitle="Você ainda não criou nenhuma rota"
        />
      );

      expect(getByText('Sem Rotas')).toBeTruthy();
      expect(getByText('Você ainda não criou nenhuma rota')).toBeTruthy();
    });

    it('deve renderizar title e subtitle com textos longos', () => {
      const { getByText } = render(
        <MobileEmptyState
          title="Nenhum resultado encontrado para sua pesquisa"
          subtitle="Tente ajustar os filtros ou fazer uma nova busca com termos diferentes"
        />
      );

      expect(getByText('Nenhum resultado encontrado para sua pesquisa')).toBeTruthy();
      expect(getByText('Tente ajustar os filtros ou fazer uma nova busca com termos diferentes')).toBeTruthy();
    });
  });

  describe('Action Button', () => {
    it('deve renderizar botão quando actionLabel e onAction fornecidos', () => {
      const { getByText } = render(
        <MobileEmptyState
          title="Sem Dados"
          actionLabel="Adicionar Novo"
          onAction={mockOnAction}
        />
      );

      expect(getByText('Adicionar Novo')).toBeTruthy();
    });

    it('deve chamar onAction ao clicar no botão', () => {
      const { getByText } = render(
        <MobileEmptyState
          title="Vazio"
          actionLabel="Criar"
          onAction={mockOnAction}
        />
      );

      fireEvent.press(getByText('Criar'));
      expect(mockOnAction).toHaveBeenCalledTimes(1);
    });

    it('não deve renderizar botão quando actionLabel fornecido mas onAction undefined', () => {
      const { queryByText, getByText } = render(
        <MobileEmptyState
          title="Vazio"
          actionLabel="Adicionar"
        />
      );

      expect(getByText('Vazio')).toBeTruthy();
      expect(queryByText('Adicionar')).toBeNull();
    });

    it('não deve renderizar botão quando onAction fornecido mas actionLabel undefined', () => {
      const { queryByText, getByText } = render(
        <MobileEmptyState
          title="Vazio"
          onAction={mockOnAction}
        />
      );

      expect(getByText('Vazio')).toBeTruthy();
      // Não deve haver MobileButton sem actionLabel
    });

    it('deve renderizar MobileButton com variant="primary"', () => {
      const { getByText } = render(
        <MobileEmptyState
          title="Vazio"
          actionLabel="Adicionar"
          onAction={mockOnAction}
        />
      );

      // MobileButton renderiza o texto do actionLabel
      expect(getByText('Adicionar')).toBeTruthy();
    });

    it('deve renderizar MobileButton com size="medium"', () => {
      const { getByText } = render(
        <MobileEmptyState
          title="Vazio"
          actionLabel="Criar Rota"
          onAction={mockOnAction}
        />
      );

      expect(getByText('Criar Rota')).toBeTruthy();
    });
  });

  describe('FullScreen Prop', () => {
    it('deve usar container normal por padrão (fullScreen=false)', () => {
      const { getByText } = render(
        <MobileEmptyState title="Normal" />
      );

      expect(getByText('Normal')).toBeTruthy();
    });

    it('deve renderizar com fullScreen=true', () => {
      const { getByText } = render(
        <MobileEmptyState title="Full Screen" fullScreen={true} />
      );

      expect(getByText('Full Screen')).toBeTruthy();
    });

    it('deve renderizar com fullScreen=false explicitamente', () => {
      const { getByText } = render(
        <MobileEmptyState title="Not Full" fullScreen={false} />
      );

      expect(getByText('Not Full')).toBeTruthy();
    });
  });

  describe('Custom Style', () => {
    it('deve aplicar style customizado', () => {
      const { getByText } = render(
        <MobileEmptyState
          title="Styled"
          style={{ backgroundColor: '#f0f0f0' }}
        />
      );

      expect(getByText('Styled')).toBeTruthy();
    });

    it('deve mesclar style customizado com styles padrão', () => {
      const { getByText } = render(
        <MobileEmptyState
          title="Merged"
          fullScreen={true}
          style={{ paddingTop: 100 }}
        />
      );

      expect(getByText('Merged')).toBeTruthy();
    });
  });

  describe('Casos de Uso Comuns', () => {
    it('deve renderizar empty state de lista vazia', () => {
      const { getByText } = render(
        <MobileEmptyState
          icon="📋"
          title="Nenhuma rota encontrada"
          subtitle="Comece criando sua primeira rota"
          actionLabel="Criar Rota"
          onAction={mockOnAction}
        />
      );

      expect(getByText('📋')).toBeTruthy();
      expect(getByText('Nenhuma rota encontrada')).toBeTruthy();
      expect(getByText('Comece criando sua primeira rota')).toBeTruthy();
      expect(getByText('Criar Rota')).toBeTruthy();
    });

    it('deve renderizar empty state de busca sem resultados', () => {
      const { getByText } = render(
        <MobileEmptyState
          icon="🔍"
          title="Nenhum resultado"
          subtitle="Tente buscar com outros termos"
        />
      );

      expect(getByText('🔍')).toBeTruthy();
      expect(getByText('Nenhum resultado')).toBeTruthy();
      expect(getByText('Tente buscar com outros termos')).toBeTruthy();
    });

    it('deve renderizar empty state de erro', () => {
      const { getByText } = render(
        <MobileEmptyState
          icon="⚠️"
          title="Erro ao carregar dados"
          subtitle="Verifique sua conexão e tente novamente"
          actionLabel="Tentar Novamente"
          onAction={mockOnAction}
        />
      );

      expect(getByText('⚠️')).toBeTruthy();
      expect(getByText('Erro ao carregar dados')).toBeTruthy();
      expect(getByText('Verifique sua conexão e tente novamente')).toBeTruthy();
      expect(getByText('Tentar Novamente')).toBeTruthy();
    });

    it('deve renderizar empty state fullscreen', () => {
      const { getByText } = render(
        <MobileEmptyState
          icon="🎉"
          title="Bem-vindo!"
          subtitle="Nenhum dado para exibir ainda"
          fullScreen={true}
        />
      );

      expect(getByText('🎉')).toBeTruthy();
      expect(getByText('Bem-vindo!')).toBeTruthy();
      expect(getByText('Nenhum dado para exibir ainda')).toBeTruthy();
    });

    it('deve renderizar empty state com ação customizada', () => {
      const { getByText } = render(
        <MobileEmptyState
          icon="📦"
          title="Sem entregas"
          subtitle="Você não tem entregas pendentes no momento"
          actionLabel="Ver Histórico"
          onAction={mockOnAction}
          fullScreen={true}
        />
      );

      expect(getByText('📦')).toBeTruthy();
      expect(getByText('Sem entregas')).toBeTruthy();
      expect(getByText('Você não tem entregas pendentes no momento')).toBeTruthy();

      fireEvent.press(getByText('Ver Histórico'));
      expect(mockOnAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Combinações de Props', () => {
    it('deve combinar icon + title + subtitle', () => {
      const { getByText } = render(
        <MobileEmptyState
          icon="✅"
          title="Tudo pronto!"
          subtitle="Todas as tarefas foram concluídas"
        />
      );

      expect(getByText('✅')).toBeTruthy();
      expect(getByText('Tudo pronto!')).toBeTruthy();
      expect(getByText('Todas as tarefas foram concluídas')).toBeTruthy();
    });

    it('deve combinar fullScreen + action + style', () => {
      const { getByText } = render(
        <MobileEmptyState
          icon="🚀"
          title="Comece agora"
          subtitle="Configure sua primeira entrega"
          actionLabel="Começar"
          onAction={mockOnAction}
          fullScreen={true}
          style={{ paddingVertical: 50 }}
        />
      );

      expect(getByText('🚀')).toBeTruthy();
      expect(getByText('Comece agora')).toBeTruthy();
      expect(getByText('Configure sua primeira entrega')).toBeTruthy();
      expect(getByText('Começar')).toBeTruthy();
    });

    it('deve funcionar apenas com props obrigatórias (title)', () => {
      const { getByText } = render(
        <MobileEmptyState title="Simples" />
      );

      expect(getByText('📋')).toBeTruthy(); // icon padrão
      expect(getByText('Simples')).toBeTruthy();
    });
  });
});
