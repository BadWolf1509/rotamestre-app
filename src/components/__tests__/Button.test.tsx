import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { ActivityIndicator } from 'react-native';

import { Button } from '../Button';


describe('Button', () => {
  it('deve renderizar título corretamente', () => {
    const { getByText } = render(<Button title="Clique Aqui" onPress={() => { }} />);
    expect(getByText('Clique Aqui')).toBeTruthy();
  });

  it('deve chamar onPress quando pressionado', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Pressionar" onPress={onPress} />);

    fireEvent.press(getByText('Pressionar'));
    expect(onPress).toHaveBeenCalled();
  });

  it('não deve chamar onPress quando disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Disabled" onPress={onPress} disabled />);

    fireEvent.press(getByText('Disabled'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('deve mostrar loading indicator quando loading=true', () => {
    const { UNSAFE_getByType } = render(<Button title="Carregando" onPress={() => { }} loading />);
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('não deve chamar onPress quando loading', () => {
    const onPress = jest.fn();
    const { UNSAFE_getByType } = render(<Button title="Loading" onPress={onPress} loading />);

    const { TouchableOpacity } = require('react-native');
    const touchable = UNSAFE_getByType(TouchableOpacity);

    expect(touchable.props.disabled).toBe(true);
  });

  it('deve renderizar ícone se fornecido', () => {
    // Ionicons pode precisar de mock se não estiver configurado globalmente
    // Assumindo que renderiza sem quebrar, verificamos se o ícone está lá
    // Como é difícil testar ícone por texto, podemos checar snapshot ou se não quebra
    const { toJSON } = render(<Button title="Icon" onPress={() => { }} icon="add" />);
    expect(toJSON()).toMatchSnapshot();
  });
});
