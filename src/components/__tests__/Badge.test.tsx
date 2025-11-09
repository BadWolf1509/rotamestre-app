import { render } from '@testing-library/react-native';
import React from 'react';

import { Badge } from '../Badge';

describe('Badge Component', () => {
  describe('Status e Labels', () => {
    it('deve renderizar badge com status pendente', () => {
      const { getByText } = render(<Badge status="pendente" />);
      expect(getByText('Pendente')).toBeTruthy();
    });

    it('deve renderizar badge com status em_andamento', () => {
      const { getByText } = render(<Badge status="em_andamento" />);
      expect(getByText('Em Andamento')).toBeTruthy();
    });

    it('deve renderizar badge com status concluida', () => {
      const { getByText } = render(<Badge status="concluida" />);
      expect(getByText('Concluída')).toBeTruthy();
    });

    it('deve renderizar badge com status cancelada', () => {
      const { getByText } = render(<Badge status="cancelada" />);
      expect(getByText('Cancelada')).toBeTruthy();
    });

    it('deve renderizar com label customizado', () => {
      const { getByText } = render(
        <Badge status="concluida" label="Finalizado" />
      );
      expect(getByText('Finalizado')).toBeTruthy();
    });

    it('deve priorizar label customizado sobre label padrão', () => {
      const { getByText, queryByText } = render(
        <Badge status="pendente" label="Aguardando" />
      );
      expect(getByText('Aguardando')).toBeTruthy();
      expect(queryByText('Pendente')).toBeNull();
    });
  });

  describe('Tamanhos', () => {
    it('deve renderizar com size small', () => {
      const { getByText } = render(<Badge status="pendente" size="small" />);
      expect(getByText('Pendente')).toBeTruthy();
    });

    it('deve renderizar com size medium (padrão)', () => {
      const { getByText } = render(<Badge status="pendente" />);
      expect(getByText('Pendente')).toBeTruthy();
    });

    it('deve renderizar com size large', () => {
      const { getByText } = render(<Badge status="pendente" size="large" />);
      expect(getByText('Pendente')).toBeTruthy();
    });
  });

  describe('Variantes', () => {
    it('deve renderizar com variant filled (padrão)', () => {
      const { getByText } = render(<Badge status="concluida" />);
      expect(getByText('Concluída')).toBeTruthy();
    });

    it('deve renderizar com variant outlined', () => {
      const { getByText } = render(
        <Badge status="concluida" variant="outlined" />
      );
      expect(getByText('Concluída')).toBeTruthy();
    });
  });

  describe('Estilos Customizados', () => {
    it('deve aceitar style customizado', () => {
      const customStyle = { marginLeft: 8 };
      const { getByText } = render(
        <Badge status="em_andamento" style={customStyle} />
      );
      expect(getByText('Em Andamento')).toBeTruthy();
    });
  });

  describe('Combinações de Props', () => {
    it('deve renderizar badge pequeno outlined', () => {
      const { getByText } = render(
        <Badge status="cancelada" size="small" variant="outlined" />
      );
      expect(getByText('Cancelada')).toBeTruthy();
    });

    it('deve renderizar badge grande filled com label customizado', () => {
      const { getByText } = render(
        <Badge status="concluida" size="large" label="Completo" />
      );
      expect(getByText('Completo')).toBeTruthy();
    });

    it('deve renderizar badge outlined com label customizado', () => {
      const { getByText } = render(
        <Badge
          status="em_andamento"
          variant="outlined"
          label="Processando"
        />
      );
      expect(getByText('Processando')).toBeTruthy();
    });
  });
});
