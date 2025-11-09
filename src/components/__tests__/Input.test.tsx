import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { Input } from '../Input';

describe('Input Component', () => {
  describe('Renderização Básica', () => {
    it('deve renderizar input simples', () => {
      const { getByPlaceholderText } = render(
        <Input placeholder="Digite aqui" />
      );

      expect(getByPlaceholderText('Digite aqui')).toBeTruthy();
    });

    it('deve renderizar com label', () => {
      const { getByText } = render(
        <Input label="Nome" placeholder="Digite seu nome" />
      );

      expect(getByText('Nome')).toBeTruthy();
    });

    it('deve renderizar com label obrigatório (*)', () => {
      const { getByText } = render(
        <Input label="Email" required placeholder="seu@email.com" />
      );

      // Verifica se o asterisco vermelho de obrigatório está presente
      expect(getByText('*')).toBeTruthy();
    });

    it('deve renderizar com helperText', () => {
      const { getByText } = render(
        <Input
          label="CPF"
          helperText="Apenas números"
          placeholder="000.000.000-00"
        />
      );

      expect(getByText('Apenas números')).toBeTruthy();
    });

    it('deve renderizar mensagem de erro', () => {
      const { getByText } = render(
        <Input
          label="Senha"
          error="Senha deve ter no mínimo 6 caracteres"
          placeholder="Digite sua senha"
        />
      );

      expect(getByText('Senha deve ter no mínimo 6 caracteres')).toBeTruthy();
    });

    it('deve priorizar erro sobre helperText', () => {
      const { getByText, queryByText } = render(
        <Input
          label="Senha"
          helperText="Digite uma senha forte"
          error="Senha inválida"
          placeholder="Digite sua senha"
        />
      );

      expect(getByText('Senha inválida')).toBeTruthy();
      expect(queryByText('Digite uma senha forte')).toBeNull();
    });
  });

  describe('Tamanhos', () => {
    it('deve renderizar com size small', () => {
      const { getByPlaceholderText } = render(
        <Input size="small" placeholder="Small input" />
      );

      expect(getByPlaceholderText('Small input')).toBeTruthy();
    });

    it('deve renderizar com size medium (padrão)', () => {
      const { getByPlaceholderText } = render(
        <Input placeholder="Medium input" />
      );

      expect(getByPlaceholderText('Medium input')).toBeTruthy();
    });

    it('deve renderizar com size large', () => {
      const { getByPlaceholderText } = render(
        <Input size="large" placeholder="Large input" />
      );

      expect(getByPlaceholderText('Large input')).toBeTruthy();
    });
  });

  describe('Ícones', () => {
    it('deve renderizar com leftIcon', () => {
      const { UNSAFE_getByType } = render(
        <Input leftIcon="search-outline" placeholder="Buscar" />
      );

      const icons = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icons).toBeTruthy();
    });

    it('deve renderizar com rightIcon', () => {
      const { UNSAFE_getByType } = render(
        <Input rightIcon="eye-outline" placeholder="Senha" />
      );

      const icons = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      expect(icons).toBeTruthy();
    });

    it('deve chamar onRightIconPress quando ícone direito for clicado', () => {
      const mockPress = jest.fn();
      const { UNSAFE_getByType } = render(
        <Input
          rightIcon="eye-outline"
          onRightIconPress={mockPress}
          placeholder="Senha"
        />
      );

      const icon = UNSAFE_getByType(require('@expo/vector-icons').Ionicons);
      fireEvent.press(icon);

      expect(mockPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Interação', () => {
    it('deve chamar onChangeText ao digitar', () => {
      const mockChange = jest.fn();
      const { getByPlaceholderText } = render(
        <Input
          placeholder="Digite algo"
          onChangeText={mockChange}
        />
      );

      fireEvent.changeText(getByPlaceholderText('Digite algo'), 'Novo texto');

      expect(mockChange).toHaveBeenCalledWith('Novo texto');
    });

    it('deve aceitar value controlado', () => {
      const { getByDisplayValue } = render(
        <Input
          value="Valor inicial"
          placeholder="Digite"
        />
      );

      expect(getByDisplayValue('Valor inicial')).toBeTruthy();
    });

    it('deve aceitar editable=false (desabilitado)', () => {
      const { getByPlaceholderText } = render(
        <Input
          placeholder="Desabilitado"
          editable={false}
        />
      );

      const input = getByPlaceholderText('Desabilitado');
      expect(input.props.editable).toBe(false);
    });
  });

  describe('Props do TextInput', () => {
    it('deve aceitar secureTextEntry', () => {
      const { getByPlaceholderText } = render(
        <Input
          placeholder="Senha"
          secureTextEntry
        />
      );

      const input = getByPlaceholderText('Senha');
      expect(input.props.secureTextEntry).toBe(true);
    });

    it('deve aceitar keyboardType', () => {
      const { getByPlaceholderText } = render(
        <Input
          placeholder="Email"
          keyboardType="email-address"
        />
      );

      const input = getByPlaceholderText('Email');
      expect(input.props.keyboardType).toBe('email-address');
    });

    it('deve aceitar autoCapitalize', () => {
      const { getByPlaceholderText } = render(
        <Input
          placeholder="Nome"
          autoCapitalize="words"
        />
      );

      const input = getByPlaceholderText('Nome');
      expect(input.props.autoCapitalize).toBe('words');
    });

    it('deve aceitar maxLength', () => {
      const { getByPlaceholderText } = render(
        <Input
          placeholder="CPF"
          maxLength={11}
        />
      );

      const input = getByPlaceholderText('CPF');
      expect(input.props.maxLength).toBe(11);
    });

    it('deve aceitar multiline', () => {
      const { getByPlaceholderText } = render(
        <Input
          placeholder="Observações"
          multiline
        />
      );

      const input = getByPlaceholderText('Observações');
      expect(input.props.multiline).toBe(true);
    });
  });

  describe('Estilos Customizados', () => {
    it('deve aceitar containerStyle customizado', () => {
      const customContainerStyle = { marginTop: 20 };
      const { getByPlaceholderText } = render(
        <Input
          placeholder="Input"
          containerStyle={customContainerStyle}
        />
      );

      expect(getByPlaceholderText('Input')).toBeTruthy();
    });

    it('deve aceitar style customizado no TextInput', () => {
      const customStyle = { fontSize: 18 };
      const { getByPlaceholderText } = render(
        <Input
          placeholder="Input"
          style={customStyle}
        />
      );

      expect(getByPlaceholderText('Input')).toBeTruthy();
    });
  });
});
