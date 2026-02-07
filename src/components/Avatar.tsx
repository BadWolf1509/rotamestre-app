import React from 'react';
import { View, Text, Image } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

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
 * Usa tokens do tema para tamanhos (density-aware)
 */
function AvatarComponent({
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

  // Uses theme.components.avatar tokens for density-aware sizing
  const avatarSize = theme.components.avatar.size[size];

  // Font size proportional to avatar size
  const fontSizeMap = {
    sm: Math.round(avatarSize * 0.375),  // ~12px for 32px avatar
    md: Math.round(avatarSize * 0.333),  // ~16px for 48px avatar
    lg: Math.round(avatarSize * 0.313),  // ~20px for 64px avatar
    xl: Math.round(avatarSize * 0.3),    // ~24px for 80px avatar
  };

  const fontSize = fontSizeMap[size];
  const bgColor = backgroundColor || theme.colors.secondary;

  return (
    <View
      style={[
        styles.container,
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
            styles.initials,
            { fontSize },
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

export const Avatar = React.memo(AvatarComponent);
Avatar.displayName = 'Avatar';

const styles = StyleSheet.create((theme: Theme) => ({
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
}));
