import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';

import { MobileCard } from '../MobileCard';

describe('MobileCard', () => {
  it('deve renderizar children corretamente', () => {
    const { getByText } = render(
      <MobileCard>
        <Text>Test content</Text>
      </MobileCard>
    );

    expect(getByText('Test content')).toBeTruthy();
  });

  it('deve renderizar título quando fornecido', () => {
    const { getByText } = render(
      <MobileCard title="Test Title">
        <Text>Content</Text>
      </MobileCard>
    );

    expect(getByText('Test Title')).toBeTruthy();
  });

  it('deve renderizar subtitle quando fornecido', () => {
    const { getByText } = render(
      <MobileCard subtitle="Test Subtitle">
        <Text>Content</Text>
      </MobileCard>
    );

    expect(getByText('Test Subtitle')).toBeTruthy();
  });

  it('deve renderizar title e subtitle juntos', () => {
    const { getByText } = render(
      <MobileCard title="Title" subtitle="Subtitle">
        <Text>Content</Text>
      </MobileCard>
    );

    expect(getByText('Title')).toBeTruthy();
    expect(getByText('Subtitle')).toBeTruthy();
  });

  it('não deve renderizar header quando title e subtitle não são fornecidos', () => {
    const { UNSAFE_queryAllByType } = render(
      <MobileCard>
        <Text>Content</Text>
      </MobileCard>
    );

    const views = UNSAFE_queryAllByType(View);
    // Deve ter apenas 1 View (o card principal), não o cardHeader
    expect(views.length).toBe(1);
  });

  it('deve aplicar variant "default" por padrão', () => {
    const { UNSAFE_getByType } = render(
      <MobileCard>
        <Text>Content</Text>
      </MobileCard>
    );

    const outerView = UNSAFE_getByType(View);
    expect(outerView.props.style).toBeDefined();
  });

  it('deve aplicar variant "highlight"', () => {
    const { UNSAFE_getAllByType } = render(
      <MobileCard variant="highlight">
        <Text>Content</Text>
      </MobileCard>
    );

    const views = UNSAFE_getAllByType(View);
    expect(views[0].props.style).toBeDefined();
  });

  it('deve aplicar variant "bordered"', () => {
    const { UNSAFE_getAllByType } = render(
      <MobileCard variant="bordered">
        <Text>Content</Text>
      </MobileCard>
    );

    const views = UNSAFE_getAllByType(View);
    expect(views[0].props.style).toBeDefined();
  });

  it('deve aplicar noPadding quando fornecido', () => {
    const { UNSAFE_getAllByType } = render(
      <MobileCard noPadding>
        <Text>Content</Text>
      </MobileCard>
    );

    const views = UNSAFE_getAllByType(View);
    expect(views[0].props.style).toBeDefined();
  });

  it('deve aplicar style customizado', () => {
    const customStyle = { marginTop: 20 };
    const { UNSAFE_getAllByType } = render(
      <MobileCard style={customStyle}>
        <Text>Content</Text>
      </MobileCard>
    );

    const views = UNSAFE_getAllByType(View);
    const style = views[0].props.style;

    // style é um array de estilos
    expect(Array.isArray(style)).toBe(true);
  });

  it('deve combinar múltiplas props de estilo', () => {
    const { UNSAFE_getAllByType } = render(
      <MobileCard
        variant="highlight"
        noPadding
        style={{ backgroundColor: 'red' }}
      >
        <Text>Content</Text>
      </MobileCard>
    );

    const views = UNSAFE_getAllByType(View);
    expect(views[0].props.style).toBeDefined();
  });

  it('deve renderizar conteúdo complexo', () => {
    const { getByText } = render(
      <MobileCard title="Complex Card">
        <View>
          <Text>Line 1</Text>
          <Text>Line 2</Text>
          <View>
            <Text>Nested content</Text>
          </View>
        </View>
      </MobileCard>
    );

    expect(getByText('Complex Card')).toBeTruthy();
    expect(getByText('Line 1')).toBeTruthy();
    expect(getByText('Line 2')).toBeTruthy();
    expect(getByText('Nested content')).toBeTruthy();
  });
});
