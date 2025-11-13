import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

import { useRouteStatus } from '@/context/RouteStatusContext';

interface WidgetData {
  status: 'no_route' | 'pending' | 'active' | 'completed';
  currentStop?: {
    id: string;
    address: string;
    ordem: number;
    latitude: number;
    longitude: number;
  };
  totalStops: number;
  completedStops: number;
  stats?: {
    duration: string;
    distance: string;
  };
  lastUpdate: string;
}

class AndroidWidgetModule {
  private nativeModule: any;

  constructor() {
    if (Platform.OS === 'android' && NativeModules.RotaMestreWidget) {
      this.nativeModule = NativeModules.RotaMestreWidget;
    }
  }

  /**
   * Check if widget is available on this platform
   */
  isAvailable(): boolean {
    return Platform.OS === 'android' && this.nativeModule !== undefined;
  }

  /**
   * Update widget with new route data
   */
  async updateWidget(data: WidgetData): Promise<void> {
    if (!this.isAvailable()) {
      console.log('Android widget not available on this platform');
      return;
    }

    try {
      // Format data for widget
      const widgetData = {
        status: data.status,
        currentStop: data.currentStop,
        totalStops: data.totalStops,
        completedStops: data.completedStops,
        stats: data.stats,
        lastUpdate: this.formatTime(new Date()),
      };

      // Send to native module
      await this.nativeModule.updateWidgetData(JSON.stringify(widgetData));
    } catch (error) {
      console.error('Error updating Android widget:', error);
    }
  }

  /**
   * Request widget refresh
   */
  async refreshWidget(): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      await this.nativeModule.refreshWidget();
    } catch (error) {
      console.error('Error refreshing widget:', error);
    }
  }

  /**
   * Check if widget is installed on home screen
   */
  async isWidgetInstalled(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      return await this.nativeModule.isWidgetInstalled();
    } catch (error) {
      console.error('Error checking widget status:', error);
      return false;
    }
  }

  /**
   * Request user to add widget to home screen
   */
  async requestAddWidget(): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      await this.nativeModule.requestAddWidget();
    } catch (error) {
      console.error('Error requesting widget addition:', error);
    }
  }

  /**
   * Format time for widget display
   */
  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `Atualizado ${hours}:${minutes}`;
  }
}

// Export singleton instance
const AndroidWidget = new AndroidWidgetModule();
export default AndroidWidget;

export function useAndroidWidget() {
  const {
    routeStatus,
    route,
    paradas,
    currentStop,
    progress,
  } = useRouteStatus();

  useEffect(() => {
    // Update widget when route data changes
    if (AndroidWidget.isAvailable()) {
      const updateWidget = async () => {
        const widgetData: WidgetData = {
          status: mapRouteStatus(routeStatus),
          currentStop: currentStop ? {
            id: currentStop.id,
            address: currentStop.endereco,
            ordem: currentStop.ordem,
            latitude: currentStop.latitude,
            longitude: currentStop.longitude,
          } : undefined,
          totalStops: progress.total,
          completedStops: progress.completed,
          stats: route && routeStatus === 'completed' ? {
            duration: calculateDuration(route),
            distance: `${route.distancia_total || 0} km`,
          } : undefined,
          lastUpdate: new Date().toISOString(),
        };

        await AndroidWidget.updateWidget(widgetData);
      };

      updateWidget();
    }
  }, [routeStatus, route, paradas, currentStop, progress]);

  return {
    isWidgetAvailable: AndroidWidget.isAvailable(),
    refreshWidget: () => AndroidWidget.refreshWidget(),
    requestAddWidget: () => AndroidWidget.requestAddWidget(),
  };
}

// Helper functions
function mapRouteStatus(status: string): WidgetData['status'] {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'active':
    case 'last-stop':
      return 'active';
    case 'completed':
      return 'completed';
    default:
      return 'no_route';
  }
}

function calculateDuration(route: any): string {
  if (!route.iniciada_em || !route.concluida_em) {
    return '';
  }

  const start = new Date(route.iniciada_em).getTime();
  const end = new Date(route.concluida_em).getTime();
  const duration = end - start;

  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}
