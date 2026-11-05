/**
 * Touchable - substituto do `TouchableOpacity` sobre o `Pressable` (R-UI-1).
 *
 * POR QUE EXISTE: o `TouchableOpacity` renderiza um `Animated.View`, e o
 * `Animated` ACHATA o array de estilos num objeto único antes de o Unistyles
 * vê-lo. Com 2+ estilos `styles.*` no array, o Unistyles avisa "2 unistyles
 * styles" a cada render e pode não atualizar o estilo com tema/breakpoint
 * mudando em voo. O `Pressable` do Unistyles recebe o array intacto.
 *
 * COMO MIGRAR um `TouchableOpacity`:
 *   - `import { Touchable } from '@/components/Touchable'`;
 *   - troque a tag, mantendo `style={[...]}`, `onPress`, `disabled`,
 *     `activeOpacity`, `testID`, `hitSlop` e os `accessibility*`;
 *   - `style` aceita array com `false`/`null` no meio (é o ponto);
 *   - `activeOpacity` (padrão 0.2, igual ao RN) só vale ENQUANTO pressionado;
 *   - diferenças: a opacidade troca na hora (o TouchableOpacity animava ~150
 *     ms) e `accessibilityRole` é "button" por padrão (passe outro se não for);
 *   - `style` como função NÃO é aceito: use `Pressable` direto nesse caso.
 *   - nos testes, `UNSAFE_getByType(TouchableOpacity)` vira
 *     `UNSAFE_getByType(Touchable)` (ou getByText/getByTestId).
 */

import React from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export interface TouchableProps extends Omit<PressableProps, 'style'> {
  /** Estilo ou array de estilos (falsy no meio é aceito). Não aceita função. */
  style?: StyleProp<ViewStyle>;
  /** Opacidade enquanto pressionado (padrão 0.2, como o TouchableOpacity). */
  activeOpacity?: number;
}

export function Touchable({
  style,
  activeOpacity = 0.2,
  accessibilityRole = 'button',
  children,
  ...props
}: TouchableProps) {
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      {...props}
      style={({ pressed }) => [
        style,
        pressed && activeOpacity !== 1 ? { opacity: activeOpacity } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}
