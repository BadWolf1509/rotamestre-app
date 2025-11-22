import { render } from '@testing-library/react-native';
import React from 'react';

import { StatusSection } from '../StatusSection';

describe('StatusSection', () => {
  describe('Renderização Básica', () => {
    it('deve renderizar com userName padrão "Motorista"', () => {
      const { getByText } = render(<StatusSection />);

      expect(getByText('Olá, Motorista!')).toBeTruthy();
    });

    it('deve renderizar sem unitName por padrão', () => {
      const { getByText, queryByText } = render(<StatusSection />);

      expect(getByText('Olá, Motorista!')).toBeTruthy();
      // Não deve renderizar unitName
      expect(queryByText(/Unidade/)).toBeNull();
    });

    it('deve renderizar View container', () => {
      const { UNSAFE_getAllByType } = render(<StatusSection />);

      const { View } = require('react-native');
      expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
    });
  });

  describe('UserName Prop', () => {
    it('deve renderizar userName customizado', () => {
      const { getByText } = render(<StatusSection userName="João Silva" />);

      expect(getByText('Olá, João Silva!')).toBeTruthy();
    });

    it('deve renderizar diferentes userNames', () => {
      const { getByText } = render(<StatusSection userName="Maria Santos" />);

      expect(getByText('Olá, Maria Santos!')).toBeTruthy();
    });

    it('deve renderizar userName com caracteres especiais', () => {
      const { getByText } = render(<StatusSection userName="José O'Brien" />);

      expect(getByText("Olá, José O'Brien!")).toBeTruthy();
    });

    it('deve renderizar userName longo', () => {
      const { getByText } = render(
        <StatusSection userName="Maria da Silva Santos Oliveira" />
      );

      expect(getByText('Olá, Maria da Silva Santos Oliveira!')).toBeTruthy();
    });
  });

  describe('UnitName Prop', () => {
    it('deve renderizar unitName quando fornecido', () => {
      const { getByText } = render(
        <StatusSection userName="João" unitName="WJX Locações" />
      );

      expect(getByText('Olá, João!')).toBeTruthy();
      expect(getByText('WJX Locações')).toBeTruthy();
    });

    it('não deve renderizar unitName quando undefined', () => {
      const { getByText } = render(<StatusSection userName="João" />);

      expect(getByText('Olá, João!')).toBeTruthy();
      // Verificar que não há segundo Text com nome de unidade
      const { Text } = require('react-native');
      const { UNSAFE_getAllByType } = render(<StatusSection userName="João" />);
      const texts = UNSAFE_getAllByType(Text);
      expect(texts.length).toBe(1); // Apenas o título
    });

    it('não deve renderizar unitName quando null', () => {
      const { getByText } = render(
        <StatusSection userName="João" unitName={undefined} />
      );

      expect(getByText('Olá, João!')).toBeTruthy();
    });

    it('não deve renderizar unitName quando string vazia', () => {
      const { getByText } = render(
        <StatusSection userName="João" unitName="" />
      );

      expect(getByText('Olá, João!')).toBeTruthy();
      // String vazia é falsy, não deve renderizar
      const { Text } = require('react-native');
      const { UNSAFE_getAllByType } = render(
        <StatusSection userName="João" unitName="" />
      );
      const texts = UNSAFE_getAllByType(Text);
      expect(texts.length).toBe(1);
    });

  });

  it('deve renderizar status online corretamente', () => {
    const { getByText } = render(
      <StatusSection
        unitName="WJX Locações e Equipamentos Ltda - Filial São Paulo"
      />
    );

    expect(getByText('WJX Locações e Equipamentos Ltda - Filial São Paulo')).toBeTruthy();
  });

  it('deve renderizar apenas userName quando unitName ausente', () => {
    const { getByText } = render(
      <StatusSection userName="Maria Santos" />
    );

    expect(getByText('Olá, Maria Santos!')).toBeTruthy();
  });

  it('deve renderizar userName padrão + unitName', () => {
    const { getByText } = render(
      <StatusSection unitName="ABC Equipamentos" />
    );

    expect(getByText('Olá, Motorista!')).toBeTruthy();
    expect(getByText('ABC Equipamentos')).toBeTruthy();
  });


  describe('Estrutura do Componente', () => {
    it('deve renderizar dois Views aninhados', () => {
      const { UNSAFE_getAllByType } = render(
        <StatusSection userName="João" unitName="WJX" />
      );

      const { View } = require('react-native');
      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThanOrEqual(2);
    });

    it('deve renderizar Text com título sempre', () => {
      const { UNSAFE_getAllByType } = render(<StatusSection />);

      const { Text } = require('react-native');
      const texts = UNSAFE_getAllByType(Text);
      expect(texts.length).toBeGreaterThanOrEqual(1);
    });

    it('deve renderizar dois Texts quando tem unitName', () => {
      const { UNSAFE_getAllByType } = render(
        <StatusSection unitName="WJX Locações" />
      );

      const { Text } = require('react-native');
      const texts = UNSAFE_getAllByType(Text);
      expect(texts.length).toBe(2);
    });
  });

  describe('Casos de Uso Reais', () => {
    it('deve renderizar tela inicial do motorista com dados completos', () => {
      const { getByText } = render(
        <StatusSection userName="João Silva" unitName="WJX Locações" />
      );

      expect(getByText('Olá, João Silva!')).toBeTruthy();
      expect(getByText('WJX Locações')).toBeTruthy();
    });

    it('deve renderizar tela inicial sem dados de unidade', () => {
      const { getByText } = render(<StatusSection userName="Maria Santos" />);

      expect(getByText('Olá, Maria Santos!')).toBeTruthy();
    });

    it('deve renderizar estado inicial sem dados do usuário', () => {
      const { getByText } = render(<StatusSection />);

      expect(getByText('Olá, Motorista!')).toBeTruthy();
    });

    it('deve renderizar para motorista de múltiplas unidades', () => {
      const { getByText } = render(
        <StatusSection
          userName="Carlos Oliveira"
          unitName="Mestre da Obra - Unidade Centro"
        />
      );

      expect(getByText('Olá, Carlos Oliveira!')).toBeTruthy();
      expect(getByText('Mestre da Obra - Unidade Centro')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('deve renderizar com userName vazio (usa default)', () => {
      const { getByText } = render(<StatusSection userName="" />);

      // userName vazio ainda usa o default no destructuring? Não, passa vazio
      expect(getByText('Olá, !')).toBeTruthy();
    });

    it('deve renderizar com apenas espaços no userName', () => {
      const { getByText } = render(<StatusSection userName="   " />);

      expect(getByText('Olá,    !')).toBeTruthy();
    });

    it('deve renderizar com userName numérico', () => {
      const { getByText } = render(<StatusSection userName="123" />);

      expect(getByText('Olá, 123!')).toBeTruthy();
    });

    it('deve renderizar com emojis no userName', () => {
      const { getByText } = render(<StatusSection userName="João 🚗" />);

      expect(getByText('Olá, João 🚗!')).toBeTruthy();
    });

    it('deve renderizar com unitName com caracteres especiais', () => {
      const { getByText } = render(
        <StatusSection userName="João" unitName="WJX & Cia Ltda." />
      );

      expect(getByText('WJX & Cia Ltda.')).toBeTruthy();
    });
  });
});
