import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface AvatarEditableProps {
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
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

  /**
   * Cor de fundo customizada (para placeholder)
   */
  backgroundColor?: string;

  /**
   * Callback ao clicar para editar
   */
  onPress?: () => void;

  /**
   * Estado de loading durante upload
   */
  uploading?: boolean;

  /**
   * Desabilitar edição
   */
  disabled?: boolean;

  /**
   * Mostrar badge de edição
   */
  showEditBadge?: boolean;
}

/**
 * Componente Avatar editável
 * Mostra foto do usuário com opção de editar
 */
export function AvatarEditable({
  name,
  imageUrl,
  size = 'lg',
  backgroundColor,
  onPress,
  uploading = false,
  disabled = false,
  showEditBadge = true,
}: AvatarEditableProps) {
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
    sm: 40,
    md: 56,
    lg: 80,
    xl: 100,
    xxl: 120,
  };

  const fontSizeMap = {
    sm: 14,
    md: 20,
    lg: 32,
    xl: 40,
    xxl: 48,
  };

  const badgeSizeMap = {
    sm: 20,
    md: 24,
    lg: 32,
    xl: 36,
    xxl: 40,
  };

  const iconSizeMap = {
    sm: 10,
    md: 12,
    lg: 16,
    xl: 18,
    xxl: 20,
  };

  const avatarSize = sizeMap[size];
  const fontSize = fontSizeMap[size];
  const badgeSize = badgeSizeMap[size];
  const iconSize = iconSizeMap[size];
  const bgColor = backgroundColor || theme.colors.primary;

  const isDisabled = disabled || uploading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled || !onPress}
      activeOpacity={0.8}
      style={styles.container}
    >
      <View
        style={[
          styles.avatarContainer,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
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
          <View
            style={[
              styles.placeholder,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: bgColor,
              },
            ]}
          >
            <Text
              style={[
                styles.initials,
                { fontSize },
              ]}
            >
              {initials}
            </Text>
          </View>
        )}

        {/* Overlay de loading */}
        {uploading && (
          <View
            style={[
              styles.overlay,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
              },
            ]}
          >
            <ActivityIndicator size="small" color={theme.colors.white} />
          </View>
        )}
      </View>

      {/* Badge de edição */}
      {showEditBadge && onPress && !uploading && (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
            },
          ]}
        >
          <Ionicons
            name="camera"
            size={iconSize}
            color={theme.colors.white}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    position: 'relative',
    alignSelf: 'center',
  },
  avatarContainer: {
    overflow: 'hidden',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: withOpacity(theme.colors.black, 0.5),
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.secondary,
    borderWidth: 3,
    borderColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
