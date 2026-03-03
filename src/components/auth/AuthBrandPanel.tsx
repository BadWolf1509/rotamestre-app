import { memo } from 'react';
import { ImageBackground, Platform } from 'react-native';

import { StyleSheet } from '@/utils/styles';

// Web production uses static path; dev/native uses require()
const loginBackgroundImage = Platform.OS === 'web' && process.env.NODE_ENV === 'production'
  ? { uri: '/assets/marketing/login-background.png' }
  : require('../../../assets/marketing/login-background.png');

// Fix: RN Web's ImageBackground renders <img> with objectFit: fill by default.
// The resizeMode="cover" prop doesn't propagate to the inner img tag's computed style.
// This CSS injection forces objectFit: cover on the brand panel image.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'brand-panel-image-fix';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      [aria-label="RotaMestre — Sistema de Otimização e Gestão de Rotas"] img {
        object-fit: cover !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
}

export type AuthBrandPanelProps = Record<string, never>;

export const AuthBrandPanel = memo(function AuthBrandPanel(_props: AuthBrandPanelProps) {
  return (
    <ImageBackground
      source={loginBackgroundImage}
      style={styles.container}
      imageStyle={styles.image}
      resizeMode="cover"
      accessibilityLabel="RotaMestre — Sistema de Otimização e Gestão de Rotas"
      accessible={true}
    />
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  image: {
    resizeMode: 'cover',
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
});
