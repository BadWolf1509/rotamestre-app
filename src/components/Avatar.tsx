import React from 'react';
import { View, Text, Image } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface AvatarProps {
  /**
   * Nome do usuário para gerar iniciais
   */
  name: string;

  /**
   * URL da imagem (opcional)
   */
  imageUrl?: string | null;

  /**
   * Tamanho do avatar
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Cor de fundo customizada
   */
  backgroundColor?: string;
}

/**
 * Componente Avatar reutilizável
 * Mostra foto do usuário ou iniciais se não houver foto
 */
export function Avatar({
  name,
  imageUrl,
  size = 'md',
  backgroundColor
}: AvatarProps) {
  const { theme } = useUnistyles();

  // Gerar iniciais do nome
  const getInitials = (fullName: string): string => {
    if (!fullName) return '?';

    const words = fullName.trim().split(' ').filter(w => w.length > 0);

    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }

    // Primeira letra do primeiro e último nome
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);

  // Definir tamanho baseado no prop
  const sizeMap = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 80,
  };

  const fontSizeMap = {
    sm: theme.typography.xs,
    md: theme.typography.base,
    lg: theme.typography.xl,
    xl: theme.typography['2xl'],
  };

  const avatarSize = sizeMap[size];
  const fontSize = fontSizeMap[size];
  const bgColor = backgroundColor || theme.colors.secondary;

  return (
    <View
      style={[
        styles(theme).container,
        {
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          backgroundColor: bgColor,
        },
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
          }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={[
            styles(theme).initials,
            { fontSize },
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = (theme: any) => StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
    textAlign: 'center',
  },
});
