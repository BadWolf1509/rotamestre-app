import { fireEvent, render, screen } from '@testing-library/react-native';

import { RouteControlPanel } from '../RouteControlPanel';

describe('RouteControlPanel', () => {
  const mockHandlers = {
    onReatribuir: jest.fn(),
    onCancelar: jest.fn(),
    onAddParada: jest.fn(),
    onEditar: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização por status', () => {
    it('deve exibir todas as ações quando status é pendente', () => {
      render(
        <RouteControlPanel
          rotaId="rota-123"
          status="pendente"
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Editar Rota')).toBeTruthy();
      expect(screen.getByText('Adicionar Parada')).toBeTruthy();
      expect(screen.getByText('Reatribuir Motorista')).toBeTruthy();
      expect(screen.getByText('Cancelar Rota')).toBeTruthy();
    });

    it('deve exibir ações limitadas quando status é em_andamento', () => {
      render(
        <RouteControlPanel
          rotaId="rota-123"
          status="em_andamento"
          {...mockHandlers}
        />
      );

      // Editar não deve aparecer
      expect(screen.queryByText('Editar Rota')).toBeNull();
      // Outras ações devem aparecer
      expect(screen.getByText('Adicionar Parada')).toBeTruthy();
      expect(screen.getByText('Reatribuir Motorista')).toBeTruthy();
      expect(screen.getByText('Cancelar Rota')).toBeTruthy();
    });

    it('deve retornar null quando status é concluida', () => {
      const { toJSON } = render(
        <RouteControlPanel
          rotaId="rota-123"
          status="concluida"
          {...mockHandlers}
        />
      );

      expect(toJSON()).toBeNull();
    });

    it('deve retornar null quando status é cancelada', () => {
      const { toJSON } = render(
        <RouteControlPanel
          rotaId="rota-123"
          status="cancelada"
          {...mockHandlers}
        />
      );

      expect(toJSON()).toBeNull();
    });
  });

  describe('Status Info', () => {
    it('deve exibir status label correto para pendente', () => {
      render(
        <RouteControlPanel
          rotaId="rota-123"
          status="pendente"
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Aguardando início')).toBeTruthy();
    });

    it('deve exibir status label correto para em_andamento', () => {
      render(
        <RouteControlPanel
          rotaId="rota-123"
          status="em_andamento"
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Em andamento')).toBeTruthy();
    });

    it('deve exibir título Ações Rápidas', () => {
      render(
        <RouteControlPanel
          rotaId="rota-123"
          status="pendente"
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Ações Rápidas')).toBeTruthy();
    });
  });

  describe('Interações', () => {
    it('deve chamar onEditar ao clicar em Editar Rota', () => {
      render(
        <RouteControlPanel
          rotaId="rota-123"
          status="pendente"
          {...mockHandlers}
        />
      );

      fireEvent.press(screen.getByText('Editar Rota'));

      expect(mockHandlers.onEditar).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onAddParada ao clicar em Adicionar Parada', () => {
      render(
        <RouteControlPanel
          rotaId="rota-123"
          status="pendente"
          {...mockHandlers}
        />
      );

      fireEvent.press(screen.getByText('Adicionar Parada'));

      expect(mockHandlers.onAddParada).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onReatribuir ao clicar em Reatribuir Motorista', () => {
      render(
        <RouteControlPanel
          rotaId="rota-123"
          status="pendente"
          {...mockHandlers}
        />
      );

      fireEvent.press(screen.getByText('Reatribuir Motorista'));

      expect(mockHandlers.onReatribuir).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onCancelar ao clicar em Cancelar Rota', () => {
      render(
        <RouteControlPanel
          rotaId="rota-123"
          status="pendente"
          {...mockHandlers}
        />
      );

      fireEvent.press(screen.getByText('Cancelar Rota'));

      expect(mockHandlers.onCancelar).toHaveBeenCalledTimes(1);
    });
  });

  describe('Handlers opcionais', () => {
    it('deve funcionar sem handlers passados', () => {
      render(
        <RouteControlPanel
          rotaId="rota-123"
          status="pendente"
        />
      );

      // Não deve dar erro ao renderizar
      expect(screen.getByText('Editar Rota')).toBeTruthy();
    });

    it('deve não dar erro ao clicar sem handler definido', () => {
      render(
        <RouteControlPanel
          rotaId="rota-123"
          status="pendente"
        />
      );

      // Não deve dar erro ao clicar
      expect(() => fireEvent.press(screen.getByText('Editar Rota'))).not.toThrow();
    });
  });

  describe('Status desconhecido', () => {
    it('deve retornar null para status desconhecido (sem ações visíveis)', () => {
      const { toJSON } = render(
        <RouteControlPanel
          rotaId="rota-123"
          status="custom_status"
          {...mockHandlers}
        />
      );

      // Status desconhecido não tem ações visíveis, então retorna null
      expect(toJSON()).toBeNull();
    });
  });
});
