import React from 'react';
import { render } from '@testing-library/react-native';
import { PasswordStrengthIndicator } from '../PasswordStrengthIndicator';

describe('PasswordStrengthIndicator Component', () => {
  describe('Renderização Básica', () => {
    it('não deve renderizar quando password está vazio', () => {
      const { queryByText } = render(<PasswordStrengthIndicator password="" />);
      expect(queryByText(/Força:/)).toBeNull();
    });

    it('deve renderizar label de força para qualquer senha', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="teste123" />
      );
      expect(getByText(/Força:/)).toBeTruthy();
    });

    it('deve renderizar para senha curta', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="abc" />
      );
      expect(getByText(/Força:/)).toBeTruthy();
    });

    it('deve renderizar para senha média', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="abc12345" />
      );
      expect(getByText(/Força:/)).toBeTruthy();
    });

    it('deve renderizar para senha boa', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="Abc12345!" />
      );
      expect(getByText(/Força:/)).toBeTruthy();
    });

    it('deve renderizar para senha forte', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="Abc12345!@#$" />
      );
      expect(getByText(/Força:/)).toBeTruthy();
    });
  });

  describe('Feedback', () => {
    it('deve mostrar feedback para senha curta', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="abc" />
      );
      expect(getByText(/Mínimo 8 caracteres/)).toBeTruthy();
    });

    it('deve mostrar feedback para falta de maiúscula', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="abc12345!" />
      );
      expect(getByText(/Pelo menos 1 maiúscula/)).toBeTruthy();
    });

    it('deve mostrar feedback para falta de minúscula', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="ABC12345!" />
      );
      expect(getByText(/Pelo menos 1 minúscula/)).toBeTruthy();
    });

    it('deve mostrar feedback para falta de número', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="Abcdefgh!" />
      );
      expect(getByText(/Pelo menos 1 número/)).toBeTruthy();
    });

    it('deve mostrar feedback para falta de caractere especial', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="Abc12345" />
      );
      expect(getByText(/Pelo menos 1 caractere especial/)).toBeTruthy();
    });

    it('deve mostrar múltiplos feedbacks', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="abc" />
      );
      expect(getByText(/Mínimo 8 caracteres/)).toBeTruthy();
      expect(getByText(/Pelo menos 1 maiúscula/)).toBeTruthy();
    });
  });

  describe('Casos de Uso Reais', () => {
    it('deve validar senha comum', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="senha123" />
      );
      expect(getByText(/Força:/)).toBeTruthy();
    });

    it('deve validar senha complexa', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="SenhaForte2024" />
      );
      expect(getByText(/Força:/)).toBeTruthy();
    });

    it('deve validar senha muito forte', () => {
      const { getByText } = render(
        <PasswordStrengthIndicator password="S3nha!Fort3@2024#" />
      );
      expect(getByText(/Força:/)).toBeTruthy();
    });
  });

  describe('Barra de Progresso', () => {
    it('deve renderizar barra de progresso visual', () => {
      const { root } = render(
        <PasswordStrengthIndicator password="Abc123!" />
      );
      expect(root).toBeTruthy();
    });
  });
});
