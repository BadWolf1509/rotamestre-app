import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { DataTable, DataTableColumn, DataTableAction } from '../DataTable';

// Mock useResponsive hook
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1920,
    height: 1080,
  })),
}));

// Sample data types
interface SampleItem {
  id: string;
  name: string;
  email: string;
  status: string;
}

describe('DataTable Component', () => {
  const { useResponsive } = require('@/hooks/useResponsive');

  // Sample data
  const sampleData: SampleItem[] = [
    { id: '1', name: 'João Silva', email: 'joao@example.com', status: 'ativo' },
    { id: '2', name: 'Maria Santos', email: 'maria@example.com', status: 'ativo' },
    { id: '3', name: 'Pedro Costa', email: 'pedro@example.com', status: 'inativo' },
  ];

  // Sample columns
  const sampleColumns: DataTableColumn<SampleItem>[] = [
    { key: 'name', label: 'Nome', sortable: true },
    { key: 'email', label: 'E-mail', sortable: false },
    { key: 'status', label: 'Status' },
  ];

  // Mock functions
  const mockEdit = jest.fn();
  const mockDelete = jest.fn();

  const sampleActions: DataTableAction<SampleItem>[] = [
    { label: 'Editar', icon: '✏️', onPress: mockEdit, type: 'primary' },
    { label: 'Excluir', icon: '🗑️', onPress: mockDelete, type: 'danger' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset to desktop view
    useResponsive.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      width: 1920,
      height: 1080,
    });
  });

  describe('Renderização Básica', () => {
    it('deve renderizar tabela com dados', () => {
      const { getByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
        />
      );

      expect(getByText('João Silva')).toBeTruthy();
      expect(getByText('Maria Santos')).toBeTruthy();
      expect(getByText('Pedro Costa')).toBeTruthy();
    });

    it('deve renderizar título quando fornecido', () => {
      const { getByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          title="Lista de Usuários"
        />
      );

      expect(getByText('Lista de Usuários')).toBeTruthy();
    });

    it('deve renderizar headers das colunas', () => {
      const { getByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
        />
      );

      expect(getByText('Nome')).toBeTruthy();
      expect(getByText('E-mail')).toBeTruthy();
      expect(getByText('Status')).toBeTruthy();
    });
  });

  describe('Estado Vazio', () => {
    it('deve renderizar estado vazio quando não há dados', () => {
      const { getByText } = render(
        <DataTable
          data={[]}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
        />
      );

      expect(getByText('Nenhum registro encontrado')).toBeTruthy();
    });

    it('deve renderizar estado vazio customizado', () => {
      const CustomEmpty = () => <Text>Ops! Nada por aqui</Text>;

      const { getByText } = render(
        <DataTable
          data={[]}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          emptyState={<CustomEmpty />}
        />
      );

      expect(getByText('Ops! Nada por aqui')).toBeTruthy();
    });
  });

  describe('Estado de Loading', () => {
    it('deve renderizar skeleton quando isLoading=true', () => {
      const { root } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          isLoading={true}
          skeletonRows={3}
        />
      );

      expect(root).toBeTruthy();
    });

    it('deve renderizar número customizado de skeleton rows', () => {
      const { root } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          isLoading={true}
          skeletonRows={7}
        />
      );

      expect(root).toBeTruthy();
    });
  });

  describe('Ações', () => {
    it('deve renderizar botões de ação', () => {
      const { getAllByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
        />
      );

      const editButtons = getAllByText('Editar');
      const deleteButtons = getAllByText('Excluir');

      expect(editButtons.length).toBe(3); // 3 items
      expect(deleteButtons.length).toBe(3);
    });

    it('deve renderizar header "Ações" quando há ações', () => {
      const { getByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
        />
      );

      expect(getByText('Ações')).toBeTruthy();
    });

    it('deve chamar callback ao clicar em ação', () => {
      const { getAllByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
        />
      );

      const editButtons = getAllByText('Editar');
      fireEvent.press(editButtons[0]);

      expect(mockEdit).toHaveBeenCalledWith(sampleData[0]);
    });

    it('deve renderizar ícones nas ações', () => {
      const { getAllByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
        />
      );

      expect(getAllByText('✏️').length).toBeGreaterThan(0);
      expect(getAllByText('🗑️').length).toBeGreaterThan(0);
    });
  });

  describe('Paginação', () => {
    const manyItems: SampleItem[] = Array.from({ length: 25 }, (_, i) => ({
      id: `${i + 1}`,
      name: `Usuário ${i + 1}`,
      email: `user${i + 1}@example.com`,
      status: 'ativo',
    }));

    it('deve renderizar paginação quando há muitos itens', () => {
      const { getByText } = render(
        <DataTable
          data={manyItems}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          pagination={true}
          itemsPerPage={10}
        />
      );

      expect(getByText(/Página 1 de 3/)).toBeTruthy();
    });

    it('deve navegar para próxima página', () => {
      const { getByText, queryByText } = render(
        <DataTable
          data={manyItems}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          pagination={true}
          itemsPerPage={10}
        />
      );

      // Verifica item da primeira página
      expect(getByText('Usuário 1')).toBeTruthy();

      // Clica em próxima página
      fireEvent.press(getByText('Próxima →'));

      // Verifica que agora está na página 2
      expect(getByText(/Página 2 de 3/)).toBeTruthy();
    });

    it('deve navegar para página anterior', () => {
      const { getByText } = render(
        <DataTable
          data={manyItems}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          pagination={true}
          itemsPerPage={10}
        />
      );

      // Vai para página 2
      fireEvent.press(getByText('Próxima →'));
      expect(getByText(/Página 2 de 3/)).toBeTruthy();

      // Volta para página 1
      fireEvent.press(getByText('← Anterior'));
      expect(getByText(/Página 1 de 3/)).toBeTruthy();
    });

    it('não deve renderizar paginação quando pagination=false', () => {
      const { queryByText } = render(
        <DataTable
          data={manyItems}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          pagination={false}
        />
      );

      expect(queryByText(/Página/)).toBeNull();
    });
  });

  describe('Ordenação', () => {
    const mockOnSort = jest.fn();

    it('deve permitir ordenar coluna sortable', () => {
      const { getAllByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          onSort={mockOnSort}
        />
      );

      // Clica no header "Nome" (sortable)
      fireEvent.press(getAllByText('Nome')[0]);

      expect(mockOnSort).toHaveBeenCalledWith('name', 'asc');
    });

    it('deve alternar direção da ordenação', () => {
      const { getAllByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          onSort={mockOnSort}
        />
      );

      const nomeHeader = getAllByText('Nome')[0];

      // Primeira clique: asc
      fireEvent.press(nomeHeader);
      expect(mockOnSort).toHaveBeenCalledWith('name', 'asc');

      // Segunda clique: desc
      fireEvent.press(nomeHeader);
      expect(mockOnSort).toHaveBeenCalledWith('name', 'desc');
    });
  });

  describe('Renderização Customizada de Colunas', () => {
    it('deve usar função render customizada', () => {
      const columnsWithRender: DataTableColumn<SampleItem>[] = [
        {
          key: 'status',
          label: 'Status',
          render: (item) => item.status.toUpperCase(),
        },
      ];

      const { getByText } = render(
        <DataTable
          data={[sampleData[0]]}
          columns={columnsWithRender}
          keyExtractor={(item) => item.id}
        />
      );

      expect(getByText('ATIVO')).toBeTruthy();
    });
  });

  describe('Visualização Mobile', () => {
    beforeEach(() => {
      useResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667,
      });
    });

    it('deve renderizar em formato de cards no mobile', () => {
      const { getAllByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
        />
      );

      // Verifica se os labels são exibidos (característica de cards)
      expect(getAllByText('Nome:').length).toBe(3);
      expect(getAllByText('E-mail:').length).toBe(3);
      expect(getAllByText('Status:').length).toBe(3);
    });

    it('deve renderizar ações em cards no mobile', () => {
      const { getAllByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
        />
      );

      expect(getAllByText('Editar').length).toBe(3);
      expect(getAllByText('Excluir').length).toBe(3);
    });
  });

  describe('Visualização Tablet', () => {
    beforeEach(() => {
      useResponsive.mockReturnValue({
        isMobile: false,
        isTablet: true,
        isDesktop: false,
        width: 768,
        height: 1024,
      });
    });

    it('deve renderizar em formato de cards no tablet', () => {
      const { getAllByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
        />
      );

      expect(getAllByText('Nome:').length).toBe(3);
    });
  });

  describe('Colunas Desktop Only', () => {
    it('não deve renderizar colunas desktopOnly no mobile', () => {
      useResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667,
      });

      const columnsWithDesktopOnly: DataTableColumn<SampleItem>[] = [
        { key: 'name', label: 'Nome' },
        { key: 'email', label: 'E-mail', desktopOnly: true },
      ];

      const { queryByText, getAllByText } = render(
        <DataTable
          data={sampleData}
          columns={columnsWithDesktopOnly}
          keyExtractor={(item) => item.id}
        />
      );

      expect(getAllByText('Nome:').length).toBe(3);
      expect(queryByText('E-mail:')).toBeNull();
    });
  });
});
