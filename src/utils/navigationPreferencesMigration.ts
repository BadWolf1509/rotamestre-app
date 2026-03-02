/**
 * Migration helper para unificar preferências de navegação
 *
 * Migra configurações antigas de AsyncStorage para o sistema unificado
 * do LocationTrackingService.
 *
 * Chaves migradas:
 * - @rotamestre:nav_app_preference → preferredNavApp
 * - @rotamestre:sound_enabled → soundAlerts
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "@/lib/logger";
import locationTrackingService from "@/services/locationTracking";

// Chaves antigas que serão migradas
const LEGACY_KEYS = {
  NAV_APP_PREFERENCE: "@rotamestre:nav_app_preference",
  SOUND_ENABLED: "@rotamestre:sound_enabled",
  // Chave de controle para evitar migrações repetidas
  MIGRATION_COMPLETED: "@rotamestre:nav_prefs_migration_v1",
};

// Mapeamento de valores antigos para novos
const NAV_APP_MAP: Record<
  string,
  "waze" | "google_maps" | "apple_maps" | "default"
> = {
  waze: "waze",
  google_maps: "google_maps",
  apple_maps: "apple_maps",
  default: "default",
};

/**
 * Executa a migração de preferências de navegação
 *
 * @returns true se a migração foi executada, false se já havia sido feita
 */
export async function migrateNavigationPreferences(): Promise<boolean> {
  try {
    // Verificar se migração já foi feita
    const migrationCompleted = await AsyncStorage.getItem(
      LEGACY_KEYS.MIGRATION_COMPLETED,
    );
    if (migrationCompleted === "true") {
      logger.info("[NavigationMigration] Migração já executada anteriormente");
      return false;
    }

    logger.info("[NavigationMigration] Iniciando migração de preferências");

    // Buscar valores antigos
    const [navAppValue, soundEnabledValue] = await Promise.all([
      AsyncStorage.getItem(LEGACY_KEYS.NAV_APP_PREFERENCE),
      AsyncStorage.getItem(LEGACY_KEYS.SOUND_ENABLED),
    ]);

    // Preparar objeto de migração
    const migratedPrefs: Record<string, unknown> = {};

    // Migrar preferência de app de navegação
    if (navAppValue) {
      const mappedValue = NAV_APP_MAP[navAppValue];
      if (mappedValue) {
        migratedPrefs.preferredNavApp = mappedValue;
        logger.info(
          `[NavigationMigration] Migrado nav_app_preference: ${navAppValue} → ${mappedValue}`,
        );
      }
    }

    // Migrar preferência de som
    if (soundEnabledValue !== null) {
      migratedPrefs.soundAlerts = soundEnabledValue === "true";
      logger.info(
        `[NavigationMigration] Migrado sound_enabled: ${soundEnabledValue}`,
      );
    }

    // Aplicar preferências migradas se houver alguma
    if (Object.keys(migratedPrefs).length > 0) {
      await locationTrackingService.updateNavigationPreferences(migratedPrefs);
      logger.info("[NavigationMigration] Preferências migradas com sucesso");
    }

    // Remover chaves antigas
    await AsyncStorage.multiRemove([
      LEGACY_KEYS.NAV_APP_PREFERENCE,
      LEGACY_KEYS.SOUND_ENABLED,
    ]);
    logger.info("[NavigationMigration] Chaves antigas removidas");

    // Marcar migração como concluída
    await AsyncStorage.setItem(LEGACY_KEYS.MIGRATION_COMPLETED, "true");
    logger.info("[NavigationMigration] Migração marcada como concluída");

    return true;
  } catch (error) {
    logger.error("[NavigationMigration] Erro durante migração:", error);
    return false;
  }
}

/**
 * Reseta o estado da migração (útil para testes)
 */
export async function resetMigrationState(): Promise<void> {
  await AsyncStorage.removeItem(LEGACY_KEYS.MIGRATION_COMPLETED);
  logger.info("[NavigationMigration] Estado de migração resetado");
}
