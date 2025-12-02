import { useMemo } from 'react';
import { ImageBackground, Platform } from 'react-native';

import { StyleSheet } from '@/utils/styles';

// Static import for the background image
// Use public path for web in production (Vercel), local path for development
const loginBackgroundImage = Platform.OS === 'web' && process.env.NODE_ENV === 'production'
  ? { uri: '/assets/marketing/login-background.png' }
  : require('../../../assets/marketing/login-background.png');

export type AuthBrandPanelProps = Record<string, never>;

export function AuthBrandPanel(_props: AuthBrandPanelProps) {
  const styles = useMemo(() => createStyles(), []);

  return (
    <ImageBackground
      source={loginBackgroundImage}
      style={styles.container}
      imageStyle={styles.image}
      resizeMode="cover"
    >
      {/* A imagem já contém todo o conteúdo visual (logo, textos, estatísticas) */}
    </ImageBackground>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    image: {
      // Posicionar imagem à esquerda (conteúdo importante fica visível)
      resizeMode: 'cover',
      position: 'absolute',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
    },
  });
