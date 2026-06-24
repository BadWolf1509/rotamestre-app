/**
 * MotoristaAvatar — avatar do motorista na lista do gestor.
 * Resolve foto_url (legacy URL ou path bare) para signed URL via useSignedUrl.
 * Exibe Image quando URL resolvida, ou placeholder com inicial quando null.
 */

import React from 'react';
import { View, Text, Image } from 'react-native';

import { useSignedUrl } from '@/hooks/storage/useSignedUrl';
import { styles } from '@/styles/gestor/motoristas.styles';

interface MotoristaAvatarProps {
  fotoUrl: string | null | undefined;
  nome: string | null | undefined;
}

export function MotoristaAvatar({ fotoUrl, nome }: MotoristaAvatarProps) {
  const { url } = useSignedUrl(fotoUrl);

  return (
    <View style={styles.avatarCell}>
      {url ? (
        <Image source={{ uri: url }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>
            {nome?.charAt(0).toUpperCase() || 'M'}
          </Text>
        </View>
      )}
    </View>
  );
}
