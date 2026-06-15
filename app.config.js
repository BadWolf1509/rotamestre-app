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
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
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
      predictiveBackGestureEnabled: false,
      package: "br.tec.rotamestre",
      versionCode: resolvedAndroidVersionCode, // From package.json
      // Firebase Cloud Messaging para Push Notifications
      googleServicesFile: "./google-services.json",
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
          locationAlwaysAndWhenInUsePermission: "O RotaMestre precisa acessar sua localização para rastrear entregas.",
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true
        }
      ],
      "expo-sharing"
      // MapLibre usa plugin oficial para ajustes nativos (gradle/podfile)
    ]
  };
};

