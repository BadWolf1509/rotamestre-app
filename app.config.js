const { version } = require('./package.json');

module.exports = ({ config }) => {
  return {
    ...config,
    name: "Rota Mestre",
    slug: "rotamestre",
    version, // Lê automaticamente do package.json
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "rotamestre",
    description: "Sistema inteligente de gestão e rastreamento de rotas de entrega em tempo real. Otimize suas entregas, acompanhe motoristas e melhore a eficiência logística da sua empresa.",
    // EAS Update configuration for OTA updates
    updates: {
      url: "https://u.expo.dev/1ea74080-a787-46db-abbf-d303d1b7a9d4"
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
        projectId: "1ea74080-a787-46db-abbf-d303d1b7a9d4"
      }
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "br.tec.rotamestre",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "O RotaMestre precisa acessar sua localização para mostrar sua posição no mapa e calcular rotas.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "O RotaMestre precisa acessar sua localização em segundo plano para rastrear o progresso da entrega e permitir que o gestor acompanhe a rota em tempo real.",
        // Habilitar background location no iOS
        UIBackgroundModes: ["location", "fetch"],
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#284093"
      },
      icon: "./assets/icon.png",
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "br.tec.rotamestre",
      versionCode: 3005, // Incrementar +1 a cada build (3001, 3002, 3003...)
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
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""
        }
      }
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
      orientation: "portrait",
      startUrl: "/",
      lang: "pt-BR"
    },
    plugins: [
      "expo-router",
      "expo-asset",
      "expo-font",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "O RotaMestre precisa acessar sua localização para rastrear entregas.",
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true
        }
      ]
      // ❌ NÃO adicionar react-native-maps aqui - não tem plugin!
      // As configurações estão em ios.config.googleMapsApiKey e android.config.googleMaps.apiKey
    ]
  };
};

