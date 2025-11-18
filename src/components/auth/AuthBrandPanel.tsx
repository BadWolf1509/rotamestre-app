import { useMemo } from 'react';
import { ImageBackground } from 'react-native';

import { StyleSheet, Theme, useUnistyles } from '@/utils/styles';

// Static import for the background image
import loginBackgroundImage from '@assets/marketing/login-background.png';

export type AuthBrandPanelProps = Record<string, never>;

export function AuthBrandPanel({}: AuthBrandPanelProps) {
  const { theme } = useUnistyles();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <ImageBackground
      source={loginBackgroundImage}
      style={styles.container}
      resizeMode="cover"
    >
      {/* A imagem já contém todo o conteúdo visual (logo, textos, estatísticas) */}
    </ImageBackground>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
  });
