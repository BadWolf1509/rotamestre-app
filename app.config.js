const { version, androidVersionCode } = require('./package.json');

const resolvedAndroidVersionCode = Number(androidVersionCode);
if (!Number.isInteger(resolvedAndroidVersionCode)) {
  throw new Error('androidVersionCode must be an integer in package.json');
}

module.exports = ({ config }) => {
  return {
    ...config,
    name: "Rota Mestre",
    slug: "rotamestre",
    version, // Lê automaticamente do package.json
    orientation: "default", // Permite portrait e landscape (recomendado para Android 16+)
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "rotamestre",
    description: "Sistema inteligente de gestão e rastreamento de rotas de entrega em tempo real. Otimize suas entregas, acompanhe motoristas e melhore a eficiência logística da sua empresa.",
    // EAS Update configuration for OTA updates
    updates: {
      url: "https://u.expo.dev/c6401a59-af97-484a-93b7-c75016bf331d"
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#284093"
    },
    extra: {
      baseUrl: "https://app.rotamestre.tec.br",
      apiUrl: "https://api.rotamestre.tec.br",
      router: {},
      eas: {
        projectId: "c6401a59-af97-484a-93b7-c75016bf331d"
      }
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "br.tec.rotamestre.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "O RotaMestre precisa acessar sua localização para mostrar sua posição no mapa e calcular rotas.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "O RotaMestre precisa acessar sua localização em segundo plano para rastrear o progresso da entrega e permitir que o gestor acompanhe a rota em tempo real.",
        // Habilitar background location no iOS
        UIBackgroundModes: ["location", "fetch"],
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#284093"
      },
      icon: "./assets/icon.png",
      predictiveBackGestureEnabled: false,
      package: "br.tec.rotamestre.app",
      versionCode: resolvedAndroidVersionCode, // From package.json
      // Firebase Cloud Messaging para Push Notifications
      googleServicesFile: "./google-services.json",
      allowBackup: false,
      blockedPermissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"
      ],
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE_LOCATION"
      ]
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
      name: "Rota Mestre - Gestão Inteligente de Entregas",
      shortName: "Rota Mestre",
      description: "Sistema de gestão e rastreamento de rotas de entrega em tempo real. Otimize logística, acompanhe motoristas e melhore eficiência operacional.",
      themeColor: "#284093",
      backgroundColor: "#ffffff",
      display: "standalone",
      orientation: "any", // PWA suporta qualquer orientação
      startUrl: "/",
      lang: "pt-BR"
    },
    experiments: {
      typedRoutes: true,
    },
    plugins: [
      "expo-router",
      "expo-asset",
      "expo-font",
      "expo-splash-screen",
      "expo-status-bar",
      "@react-native-community/datetimepicker",
      "@maplibre/maplibre-react-native",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Durante uma rota ativa, o Rota Mestre usa sua localização mesmo quando o app está fechado para permitir navegação e acompanhamento da entrega pelo gestor.",
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true
        }
      ],
      [
        "expo-audio",
        {
          microphonePermission: false,
          recordAudioAndroid: false
        }
      ],
      [
        "expo-secure-store",
        {
          configureAndroidBackup: true,
          faceIDPermission: false
        }
      ],
      "expo-sharing"
      // MapLibre usa plugin oficial para ajustes nativos (gradle/podfile)
    ]
  };
};

