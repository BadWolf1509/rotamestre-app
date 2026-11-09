import {
  render,
  fireEvent,
  renderHook,
  screen,
  within,
} from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import {
  larguraDaColunaDeAcoes,
  larguraMinimaDaTabela,
} from '../data-table/larguras';
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
    {
      id: '2',
      name: 'Maria Santos',
      email: 'maria@example.com',
      status: 'ativo',
    },
    {
      id: '3',
      name: 'Pedro Costa',
      email: 'pedro@example.com',
      status: 'inativo',
    },
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
    {
      label: 'Editar',
      icon: 'pencil-outline',
      onPress: mockEdit,
      type: 'primary',
    },
    {
      label: 'Excluir',
      icon: 'trash-outline',
      onPress: mockDelete,
      type: 'danger',
    },
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
        />,
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
        />,
      );

      expect(getByText('Lista de Usuários')).toBeTruthy();
    });

    it('deve renderizar headers das colunas', () => {
      const { getByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
        />,
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
        />,
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
        />,
      );

      expect(getByText('Ops! Nada por aqui')).toBeTruthy();
    });
  });

  describe('Estado de Loading', () => {
    // Estilos de todas as Views da árvore, achatados.
    const estilosDasViews = () =>
      screen
        .UNSAFE_getAllByType(View)
        .map((v) => StyleSheet.flatten(v.props.style) ?? {});

    it('o skeleton desktop usa a mesma largura das colunas e das ações da tabela', () => {
      render(
        <DataTable
          data={sampleData}
          columns={[
            { key: 'name', label: 'Nome', width: 240 },
            { key: 'status', label: 'Status', width: 150 },
          ]}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
          isLoading
          skeletonRows={2}
        />,
      );

      const estilos = estilosDasViews();
      // Cabeçalho + 2 linhas: 3 células de cada coluna e da coluna de ações.
      expect(
        estilos.filter((e) => e.width === 240 && e.flexGrow === 240),
      ).toHaveLength(3);
      expect(
        estilos.filter((e) => e.width === 150 && e.flexGrow === 150),
      ).toHaveLength(3);
      // 1 botão na linha (130) + menu "⋯" (48), como na tabela carregada.
      const acoes = larguraDaColunaDeAcoes(sampleActions).flexBasis;
      expect(estilos.filter((e) => e.flexBasis === acoes)).toHaveLength(3);
    });

    it('deve renderizar skeleton quando isLoading=true', () => {
      const { root } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          isLoading={true}
          skeletonRows={3}
        />,
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
        />,
      );

      expect(root).toBeTruthy();
    });

    it('deve renderizar skeleton mobile com título quando isLoading=true', () => {
      useResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667,
      });

      const { getByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          isLoading={true}
          skeletonRows={3}
          title="Carregando..."
        />,
      );

      expect(getByText('Carregando...')).toBeTruthy();
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
        />,
      );

      const editButtons = getAllByText('Editar');

      expect(editButtons.length).toBe(3); // 3 items
    });

    it('a ação danger sai da linha e vai para o menu "Mais ações"', () => {
      render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
        />,
      );

      expect(screen.queryByText('Excluir')).toBeNull();
      const menus = screen.getAllByLabelText('Mais ações');
      expect(menus).toHaveLength(3);

      fireEvent.press(menus[1]);
      fireEvent.press(screen.getByRole('menuitem', { name: 'Excluir' }));

      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledWith(sampleData[1]);
    });

    it('sem ação danger não há menu "Mais ações"', () => {
      render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={[sampleActions[0]]}
        />,
      );

      expect(screen.queryByLabelText('Mais ações')).toBeNull();
    });

    it('deve renderizar header "Ações" quando há ações', () => {
      const { getByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
        />,
      );

      expect(getByText('Ações')).toBeTruthy();
    });

    it('o cabeçalho "Ações" alinha à direita, como as células', () => {
      render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
        />,
      );

      // Sobe do texto até a célula: o primeiro ancestral com flexBasis.
      let celula: ReturnType<typeof screen.getByText> | null =
        screen.getByText('Ações');
      while (
        celula &&
        StyleSheet.flatten(celula.props.style)?.flexBasis === undefined
      ) {
        celula = celula.parent;
      }
      expect(StyleSheet.flatten(celula?.props.style).justifyContent).toBe(
        'flex-end',
      );
    });

    it('deve chamar callback ao clicar em ação', () => {
      const { getAllByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
        />,
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
        />,
      );

      // Ionicons são renderizados como elementos React, não como texto
      // Apenas verificamos que as ações foram renderizadas corretamente
      expect(getAllByText('Editar').length).toBeGreaterThan(0);
    });
  });

  describe('Rótulo acessível da linha (desktop)', () => {
    it('coluna com render e chave que não é campo não vira "undefined" no rótulo', () => {
      const colunas: DataTableColumn<SampleItem>[] = [
        { key: 'name', label: 'Nome' },
        {
          key: 'motorista',
          label: 'Motorista',
          render: (item) => <Text>{`Mot. de ${item.name}`}</Text>,
        },
      ];
      render(
        <DataTable
          data={sampleData}
          columns={colunas}
          keyExtractor={(item) => item.id}
        />,
      );

      const linha = screen.getByLabelText(/^Nome: João Silva/);
      expect(linha.props.accessibilityLabel).not.toContain('undefined');
      expect(linha.props.accessibilityLabel).toBe('Nome: João Silva');
    });

    it('usa `rotulo` da coluna quando dado', () => {
      const colunas: DataTableColumn<SampleItem>[] = [
        { key: 'name', label: 'Nome' },
        {
          key: 'motorista',
          label: 'Motorista',
          render: (item) => <Text>{`Mot. de ${item.name}`}</Text>,
          rotulo: (item) => `motorista ${item.name}`,
        },
      ];
      render(
        <DataTable
          data={sampleData}
          columns={colunas}
          keyExtractor={(item) => item.id}
        />,
      );

      expect(
        screen.getByLabelText(
          'Nome: João Silva, Motorista: motorista João Silva',
        ),
      ).toBeTruthy();
    });
  });

  describe('Linha clicável (onRowPress)', () => {
    const rotuloDaLinha = /^Nome: João Silva/;

    it('sem onRowPress a linha não é botão nem Pressable (não vira parada de Tab)', () => {
      render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
        />,
      );

      const linha = screen.getByLabelText(rotuloDaLinha);
      expect(linha.props.accessibilityRole).toBeUndefined();
      expect(linha.props.onClick).toBeUndefined();
      expect(linha.props.onResponderRelease).toBeUndefined();
    });

    it('com onRowPress a linha é grupo (não botão) e só o nome é o botão que abre o detalhe', () => {
      render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          onRowPress={jest.fn()}
        />,
      );

      const linha = screen.getByLabelText(rotuloDaLinha);
      expect(linha.props.accessibilityRole).not.toBe('button');
      expect(linha.props.role).toBe('group');
      const abrir = screen.getByRole('button', {
        name: 'Abrir João Silva',
      });
      expect(abrir.props.accessibilityHint).toBe('Abre o detalhe');
    });

    it('coluna só de avatar (sem texto) não vira o botão do nome: vale a 1ª com texto', () => {
      const colunas: DataTableColumn<SampleItem>[] = [
        { key: 'avatar', label: '', rotulo: () => '', render: () => <View /> },
        { key: 'name', label: 'Nome' },
      ];
      render(
        <DataTable
          data={sampleData}
          columns={colunas}
          keyExtractor={(item) => item.id}
          onRowPress={jest.fn()}
        />,
      );

      expect(screen.getByLabelText('Nome: João Silva')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Abrir João Silva' }),
      ).toBeTruthy();
    });

    it('nenhum botão fica dentro de outro botão (nome, ações e menu da linha)', () => {
      render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={[
            ...sampleActions,
            { label: 'Excluir', type: 'danger', onPress: jest.fn() },
          ]}
          onRowPress={jest.fn()}
        />,
      );

      const botoes = screen.getAllByRole('button');
      expect(botoes.length).toBeGreaterThan(0);
      botoes.forEach((botao) => {
        const internos = within(botao)
          .queryAllByRole('button')
          .filter((interno) => interno !== botao);
        expect(internos).toHaveLength(0);
      });
      // O "Mais ações" segue alcançável pelo leitor de tela.
      expect(screen.getAllByRole('button', { name: 'Mais ações' }).length).toBe(
        sampleData.length,
      );
    });

    it('tocar na linha chama onRowPress(item)', () => {
      const onRowPress = jest.fn();
      render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
          onRowPress={onRowPress}
        />,
      );

      fireEvent.press(screen.getByText('Maria Santos'));

      expect(onRowPress).toHaveBeenCalledTimes(1);
      expect(onRowPress).toHaveBeenCalledWith(sampleData[1]);
    });

    it('tocar numa ação da linha chama só a ação', () => {
      const onRowPress = jest.fn();
      const stopPropagation = jest.fn();
      render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
          onRowPress={onRowPress}
        />,
      );

      fireEvent.press(screen.getAllByText('Editar')[0], { stopPropagation });

      expect(mockEdit).toHaveBeenCalledWith(sampleData[0]);
      expect(onRowPress).not.toHaveBeenCalled();
      // No web, o clique sobe pelo DOM até a linha: a ação o interrompe.
      expect(stopPropagation).toHaveBeenCalledTimes(1);
    });

    it('abrir o menu e escolher a ação danger não chama onRowPress', () => {
      const onRowPress = jest.fn();
      render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
          onRowPress={onRowPress}
        />,
      );

      fireEvent.press(screen.getAllByLabelText('Mais ações')[0]);
      fireEvent.press(screen.getByRole('menuitem', { name: 'Excluir' }));

      expect(mockDelete).toHaveBeenCalledWith(sampleData[0]);
      expect(onRowPress).not.toHaveBeenCalled();
    });

    it('clique no espaço da lista do menu (fora de um item) não chega à linha', () => {
      const onRowPress = jest.fn();
      render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
          onRowPress={onRowPress}
        />,
      );

      fireEvent.press(screen.getAllByLabelText('Mais ações')[0]);
      fireEvent.press(screen.UNSAFE_getByProps({ accessibilityRole: 'menu' }));

      expect(onRowPress).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe('Largura e texto das células (desktop)', () => {
    const colunasComMinimo: DataTableColumn<SampleItem>[] = [
      { key: 'name', label: 'Nome', width: 240, minWidth: 140 },
      { key: 'status', label: 'Status', width: 150 },
    ];

    it('a coluna encolhe até o minWidth dela', () => {
      render(
        <DataTable
          data={sampleData}
          columns={colunasComMinimo}
          keyExtractor={(item) => item.id}
        />,
      );

      let no: ReturnType<typeof screen.getByText> | null =
        screen.getByText('João Silva');
      while (no && StyleSheet.flatten(no.props.style)?.flexGrow === undefined) {
        no = no.parent;
      }
      const estilo = StyleSheet.flatten(no?.props.style);
      expect(estilo.flexShrink).toBe(240);
      expect(estilo.minWidth).toBe(140);
    });

    it('a rolagem horizontal só começa abaixo da soma dos mínimos', () => {
      render(
        <DataTable
          data={sampleData}
          columns={colunasComMinimo}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
        />,
      );

      const rolagem = screen.UNSAFE_getByProps({ horizontal: true });
      const conteudo = StyleSheet.flatten(rolagem.props.contentContainerStyle);
      expect(conteudo.minWidth).toBe(
        larguraMinimaDaTabela(colunasComMinimo, sampleActions),
      );
      expect(conteudo.flexShrink).toBe(1);
    });

    it('ação emMenu sai da linha e vai para o menu "Mais ações"', () => {
      render(
        <DataTable
          data={[sampleData[0]]}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={[
            { label: 'Editar', onPress: mockEdit, type: 'primary' },
            { label: 'Desativar', onPress: mockDelete, emMenu: true },
          ]}
        />,
      );

      expect(screen.queryByText('Desativar')).toBeNull();
      fireEvent.press(screen.getByLabelText('Mais ações'));
      fireEvent.press(screen.getByRole('menuitem', { name: 'Desativar' }));
      expect(mockDelete).toHaveBeenCalledWith(sampleData[0]);
    });

    it('nome de 60 caracteres fica numa linha, com o texto inteiro no accessibilityLabel', () => {
      const nomeLongo =
        'Maximiliano Bartholomeu de Albuquerque Cavalcanti Figueiredo';
      expect(nomeLongo).toHaveLength(60);
      render(
        <DataTable
          data={[{ id: '9', name: nomeLongo, email: 'x@y.z', status: 'ativo' }]}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
        />,
      );

      const texto = screen.getByText(nomeLongo);
      expect(texto.props.numberOfLines).toBe(1);
      expect(texto.props.accessibilityLabel).toBe(nomeLongo);
    });

    it('a coluna cresce na proporção da largura-base (width e flexGrow, sem flexBasis)', () => {
      render(
        <DataTable
          data={sampleData}
          columns={[
            { key: 'name', label: 'Nome', width: 240 },
            { key: 'status', label: 'Status', width: 150 },
          ]}
          keyExtractor={(item) => item.id}
        />,
      );

      // Sobe do texto até a célula: o primeiro ancestral com flexGrow.
      let no: ReturnType<typeof screen.getByText> | null =
        screen.getByText('João Silva');
      while (no && StyleSheet.flatten(no.props.style)?.flexGrow === undefined) {
        no = no.parent;
      }
      const estilo = StyleSheet.flatten(no?.props.style);
      // `width`, não `flexBasis`: dentro do ScrollView horizontal, o
      // max-content do item flex vem do conteúdo, e um nome longo em nowrap
      // alargaria a tabela inteira em vez de ganhar reticências.
      expect(estilo.flexGrow).toBe(240);
      expect(estilo.width).toBe(240);
      expect(estilo.flexBasis).toBeUndefined();
    });

    it('cabeçalho com 13 px em gray600 semibold e célula com 14 px', () => {
      const { result } = renderHook(() => useUnistyles());
      const { theme } = result.current;
      render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
        />,
      );

      const cabecalho = StyleSheet.flatten(
        screen.getByText('Nome').props.style,
      );
      expect(cabecalho.fontSize).toBe(13);
      expect(cabecalho.color).toBe(theme.colors.gray600);
      expect(cabecalho.fontFamily).toBe(theme.typography.fontSansSemiBold);

      const celula = StyleSheet.flatten(
        screen.getByText('João Silva').props.style,
      );
      expect(celula.fontSize).toBe(14);
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
        />,
      );

      expect(getByText(/Página 1 de 3/)).toBeTruthy();
    });

    it('deve navegar para próxima página', () => {
      const { getByText } = render(
        <DataTable
          data={manyItems}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          pagination={true}
          itemsPerPage={10}
        />,
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
        />,
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
        />,
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
        />,
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
        />,
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
          render: (item) => <Text>{item.status.toUpperCase()}</Text>,
        },
      ];

      const { getByText } = render(
        <DataTable
          data={[sampleData[0]]}
          columns={columnsWithRender}
          keyExtractor={(item) => item.id}
        />,
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
        />,
      );

      // Verifica se os labels são exibidos (característica de cards)
      expect(getAllByText('Nome:').length).toBe(3);
      expect(getAllByText('E-mail:').length).toBe(3);
      expect(getAllByText('Status:').length).toBe(3);
    });

    it('coluna de rótulo vazio (avatar) não deixa um ":" solto no card', () => {
      const comAvatar: DataTableColumn<SampleItem>[] = [
        {
          key: 'avatar',
          label: '',
          render: (item) => <Text>{`av-${item.id}`}</Text>,
        },
        ...sampleColumns,
      ];
      const { queryAllByText, getByText } = render(
        <DataTable
          data={sampleData}
          columns={comAvatar}
          keyExtractor={(item) => item.id}
        />,
      );

      expect(queryAllByText(':')).toHaveLength(0);
      // O conteúdo da coluna continua no card, só o rótulo some.
      expect(getByText('av-1')).toBeTruthy();
    });

    it('deve renderizar ações em cards no mobile', () => {
      const { getAllByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
        />,
      );

      expect(getAllByText('Editar').length).toBe(3);
      expect(getAllByText('Excluir').length).toBe(3);
    });

    it('deve chamar callback ao clicar em ação no mobile', () => {
      const { getAllByText } = render(
        <DataTable
          data={sampleData}
          columns={sampleColumns}
          keyExtractor={(item) => item.id}
          actions={sampleActions}
        />,
      );

      const deleteButtons = getAllByText('Excluir');
      fireEvent.press(deleteButtons[1]); // Segunda ação do segundo item

      expect(mockDelete).toHaveBeenCalledWith(sampleData[1]);
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
        />,
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
        />,
      );

      expect(getAllByText('Nome:').length).toBe(3);
      expect(queryByText('E-mail:')).toBeNull();
    });
  });
});
