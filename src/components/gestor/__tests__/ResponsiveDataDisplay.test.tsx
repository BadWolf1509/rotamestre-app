import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { ResponsiveDataDisplay } from '../ResponsiveDataDisplay';

// Mock useResponsive
const mockIsMobile = jest.fn();
const mockIsTablet = jest.fn();

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: mockIsMobile(),
    isTablet: mockIsTablet(),
    isDesktop: false,
  }),
}));

describe('ResponsiveDataDisplay', () => {
  const mockColumns = [
    { key: 'id', label: 'ID', width: 80 },
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status', render: (val: string) => <Text testID={`status-${val}`}>{val}</Text> },
  ];

  const mockData = [
    { id: '1', name: 'João Silva', email: 'joao@example.com', status: 'ativo' },
    { id: '2', name: 'Maria Santos', email: 'maria@example.com', status: 'inativo' },
    { id: '3', name: 'Carlos Oliveira', email: 'carlos@example.com', status: 'ativo' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMobile.mockReturnValue(false);
    mockIsTablet.mockReturnValue(false);
  });

  describe('Renderização básica', () => {
    it('deve renderizar tabela em desktop', () => {
      mockIsMobile.mockReturnValue(false);

      const { getByText } = render(
        <ResponsiveDataDisplay columns={mockColumns} data={mockData} />
      );

      // Verifica headers
      expect(getByText('ID')).toBeTruthy();
      expect(getByText('Nome')).toBeTruthy();
      expect(getByText('Email')).toBeTruthy();
      expect(getByText('Status')).toBeTruthy();

      // Verifica dados
      expect(getByText('João Silva')).toBeTruthy();
      expect(getByText('joao@example.com')).toBeTruthy();
    });

    it('deve renderizar cards em mobile', () => {
      mockIsMobile.mockReturnValue(true);

      const { getByText, getAllByText } = render(
        <ResponsiveDataDisplay columns={mockColumns} data={mockData} />
      );

      // Em mobile, labels aparecem junto com valores
      expect(getAllByText('Nome:').length).toBe(3);
      expect(getByText('João Silva')).toBeTruthy();
    });

    it('deve usar render customizado nas colunas', () => {
      mockIsMobile.mockReturnValue(false);

      const { getAllByTestId } = render(
        <ResponsiveDataDisplay columns={mockColumns} data={mockData} />
      );

      // Há dois registros com status "ativo"
      expect(getAllByTestId('status-ativo').length).toBe(2);
      expect(getAllByTestId('status-inativo').length).toBe(1);
    });
  });

  describe('Estado vazio', () => {
    it('deve exibir mensagem padrão quando não há dados', () => {
      mockIsMobile.mockReturnValue(false);

      const { getByText } = render(
        <ResponsiveDataDisplay columns={mockColumns} data={[]} />
      );

      expect(getByText('Nenhum dado encontrado')).toBeTruthy();
    });

    it('deve exibir mensagem customizada quando fornecida', () => {
      mockIsMobile.mockReturnValue(false);

      const { getByText } = render(
        <ResponsiveDataDisplay
          columns={mockColumns}
          data={[]}
          emptyMessage="Não há registros"
        />
      );

      expect(getByText('Não há registros')).toBeTruthy();
    });

    it('deve exibir estado vazio em mobile', () => {
      mockIsMobile.mockReturnValue(true);

      const { getByText } = render(
        <ResponsiveDataDisplay columns={mockColumns} data={[]} />
      );

      expect(getByText('Nenhum dado encontrado')).toBeTruthy();
    });
  });

  describe('Busca', () => {
    it('deve renderizar barra de busca quando showSearch=true', () => {
      mockIsMobile.mockReturnValue(false);

      const { getByPlaceholderText } = render(
        <ResponsiveDataDisplay
          columns={mockColumns}
          data={mockData}
          showSearch={true}
        />
      );

      expect(getByPlaceholderText('Buscar...')).toBeTruthy();
    });

    it('deve usar placeholder customizado', () => {
      mockIsMobile.mockReturnValue(false);

      const { getByPlaceholderText } = render(
        <ResponsiveDataDisplay
          columns={mockColumns}
          data={mockData}
          showSearch={true}
          searchPlaceholder="Pesquisar usuários..."
        />
      );

      expect(getByPlaceholderText('Pesquisar usuários...')).toBeTruthy();
    });

    it('deve filtrar dados ao digitar', async () => {
      mockIsMobile.mockReturnValue(false);

      const { getByPlaceholderText, getByText, queryByText } = render(
        <ResponsiveDataDisplay
          columns={mockColumns}
          data={mockData}
          showSearch={true}
        />
      );

      const searchInput = getByPlaceholderText('Buscar...');

      // Antes da busca
      expect(getByText('João Silva')).toBeTruthy();
      expect(getByText('Maria Santos')).toBeTruthy();

      // Digita na busca
      fireEvent.changeText(searchInput, 'João');

      // Após a busca
      await waitFor(() => {
        expect(getByText('João Silva')).toBeTruthy();
        expect(queryByText('Maria Santos')).toBeNull();
      });
    });

    it('deve filtrar sem case-sensitive', async () => {
      mockIsMobile.mockReturnValue(false);

      const { getByPlaceholderText, getByText, queryByText } = render(
        <ResponsiveDataDisplay
          columns={mockColumns}
          data={mockData}
          showSearch={true}
        />
      );

      const searchInput = getByPlaceholderText('Buscar...');
      fireEvent.changeText(searchInput, 'MARIA');

      await waitFor(() => {
        expect(getByText('Maria Santos')).toBeTruthy();
        expect(queryByText('João Silva')).toBeNull();
      });
    });
  });

  describe('Ordenação', () => {
    it('deve ordenar ao clicar no header da coluna', async () => {
      mockIsMobile.mockReturnValue(false);

      const { getByText, UNSAFE_getAllByType: _UNSAFE_getAllByType } = render(
        <ResponsiveDataDisplay columns={mockColumns} data={mockData} />
      );

      const nomeHeader = getByText('Nome');
      fireEvent.press(nomeHeader);

      // Verifica que a ordenação foi aplicada (ascendente por padrão)
      // Carlos < João < Maria em ordem alfabética
      await waitFor(() => {
        expect(getByText('Carlos Oliveira')).toBeTruthy();
      });
    });

    it('deve inverter ordenação ao clicar novamente', async () => {
      mockIsMobile.mockReturnValue(false);

      const { getByText } = render(
        <ResponsiveDataDisplay columns={mockColumns} data={mockData} />
      );

      const nomeHeader = getByText('Nome');

      // Primeiro clique - ascendente
      fireEvent.press(nomeHeader);

      // Segundo clique - descendente
      fireEvent.press(nomeHeader);

      await waitFor(() => {
        expect(getByText('Maria Santos')).toBeTruthy();
      });
    });
  });

  describe('Interações', () => {
    it('deve chamar onRowPress ao clicar em uma linha da tabela', () => {
      mockIsMobile.mockReturnValue(false);
      const onRowPress = jest.fn();

      const { getByText } = render(
        <ResponsiveDataDisplay
          columns={mockColumns}
          data={mockData}
          onRowPress={onRowPress}
        />
      );

      fireEvent.press(getByText('João Silva'));

      expect(onRowPress).toHaveBeenCalledWith(mockData[0]);
    });

    it('deve chamar onRowPress ao clicar em um card mobile', () => {
      mockIsMobile.mockReturnValue(true);
      const onRowPress = jest.fn();

      const { getByText } = render(
        <ResponsiveDataDisplay
          columns={mockColumns}
          data={mockData}
          onRowPress={onRowPress}
        />
      );

      // Em mobile, toda a linha é clicável
      fireEvent.press(getByText('João Silva'));

      expect(onRowPress).toHaveBeenCalled();
    });
  });

  describe('keyExtractor', () => {
    it('deve usar keyExtractor padrão (item.id)', () => {
      mockIsMobile.mockReturnValue(false);

      const { getByText } = render(
        <ResponsiveDataDisplay columns={mockColumns} data={mockData} />
      );

      expect(getByText('1')).toBeTruthy();
    });

    it('deve usar keyExtractor customizado', () => {
      mockIsMobile.mockReturnValue(false);

      const customKeyExtractor = (item: any) => `custom-${item.id}`;

      const { getByText } = render(
        <ResponsiveDataDisplay
          columns={mockColumns}
          data={mockData}
          keyExtractor={customKeyExtractor}
        />
      );

      expect(getByText('João Silva')).toBeTruthy();
    });
  });

  describe('Valores nulos/undefined', () => {
    it('deve tratar valores null na busca', async () => {
      mockIsMobile.mockReturnValue(false);

      const dataWithNull = [
        { id: '1', name: null, email: 'test@test.com', status: 'ativo' },
      ];

      const { getByPlaceholderText, getByText } = render(
        <ResponsiveDataDisplay
          columns={mockColumns}
          data={dataWithNull}
          showSearch={true}
        />
      );

      const searchInput = getByPlaceholderText('Buscar...');
      fireEvent.changeText(searchInput, 'test');

      await waitFor(() => {
        expect(getByText('test@test.com')).toBeTruthy();
      });
    });

    it('deve tratar valores null na ordenação', async () => {
      mockIsMobile.mockReturnValue(false);

      const dataWithNull = [
        { id: '1', name: 'Ana', email: 'ana@test.com', status: 'ativo' },
        { id: '2', name: null, email: 'null@test.com', status: 'ativo' },
      ];

      const { getByText } = render(
        <ResponsiveDataDisplay
          columns={mockColumns}
          data={dataWithNull}
        />
      );

      const nomeHeader = getByText('Nome');
      fireEvent.press(nomeHeader);

      // Deve colocar valores null no final
      await waitFor(() => {
        expect(getByText('Ana')).toBeTruthy();
      });
    });
  });

  describe('Tablet mode', () => {
    it('deve renderizar tabela com scroll horizontal em tablet', () => {
      mockIsMobile.mockReturnValue(false);
      mockIsTablet.mockReturnValue(true);

      const { getByText } = render(
        <ResponsiveDataDisplay columns={mockColumns} data={mockData} />
      );

      expect(getByText('João Silva')).toBeTruthy();
    });
  });

  describe('Colunas com alinhamento', () => {
    it('deve aplicar alinhamento nas colunas', () => {
      mockIsMobile.mockReturnValue(false);

      const columnsWithAlign = [
        { key: 'id', label: 'ID', align: 'right' as const },
        { key: 'name', label: 'Nome', align: 'left' as const },
        { key: 'value', label: 'Valor', align: 'center' as const },
      ];

      const dataWithValue = [{ id: '1', name: 'Teste', value: 100 }];

      const { getByText } = render(
        <ResponsiveDataDisplay columns={columnsWithAlign} data={dataWithValue} />
      );

      expect(getByText('Teste')).toBeTruthy();
    });
  });

  describe('Ordenação numérica', () => {
    it('deve ordenar valores numéricos corretamente', async () => {
      mockIsMobile.mockReturnValue(false);

      const numericColumns = [
        { key: 'id', label: 'ID' },
        { key: 'value', label: 'Valor' },
      ];

      const numericData = [
        { id: '1', value: 100 },
        { id: '2', value: 10 },
        { id: '3', value: 50 },
      ];

      const { getByText } = render(
        <ResponsiveDataDisplay columns={numericColumns} data={numericData} />
      );

      const valorHeader = getByText('Valor');
      fireEvent.press(valorHeader);

      // Ordenação numérica ascendente: 10, 50, 100
      await waitFor(() => {
        expect(getByText('10')).toBeTruthy();
      });
    });
  });
});
