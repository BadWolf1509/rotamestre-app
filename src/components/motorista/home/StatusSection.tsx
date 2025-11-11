import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import { useUnistyles } from '@/utils/styles';

interface StatusSectionProps {
  userName?: string;
}

export function StatusSection({ userName = 'Motorista' }: StatusSectionProps) {
  const { theme } = useUnistyles();
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [networkType, setNetworkType] = useState('');
  const [gpsActive, setGpsActive] = useState(false);

  useEffect(() => {
    // Battery status
    Battery.getBatteryLevelAsync().then(level => {
      setBatteryLevel(Math.round(level * 100));
    });

    const batterySubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      setBatteryLevel(Math.round(batteryLevel * 100));
    });

    // Network status
    Network.getNetworkStateAsync().then(state => {
      if (state.type === Network.NetworkStateType.WIFI) {
        setNetworkType('WiFi');
      } else if (state.type === Network.NetworkStateType.CELLULAR) {
        setNetworkType('4G');
      } else {
        setNetworkType('Offline');
      }
    });

    // GPS status
    Location.getProviderStatusAsync().then(status => {
      setGpsActive(status.locationServicesEnabled && status.gpsAvailable);
    });

    return () => {
      batterySubscription?.remove();
    };
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getWeatherEmoji = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 18) return '☀️';
    return '🌙';
  };

  const getBatteryIcon = () => {
    if (batteryLevel > 75) return 'battery-full';
    if (batteryLevel > 50) return 'battery-half';
    if (batteryLevel > 25) return 'battery-dead';
    return 'battery-outline';
  };

  const getBatteryColor = () => {
    if (batteryLevel > 50) return theme.colors.success;
    if (batteryLevel > 25) return theme.colors.warning;
    return theme.colors.error;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        {getGreeting()}, {userName.split(' ')[0]}! {getWeatherEmoji()}
      </Text>

      <View style={styles.indicators}>
        {/* GPS Status */}
        <View style={styles.indicator}>
          <Ionicons
            name="location"
            size={16}
            color={gpsActive ? theme.colors.success : theme.colors.warning}
          />
          <Text style={[
            styles.indicatorText,
            { color: gpsActive ? theme.colors.success : theme.colors.warning }
          ]}>
            GPS
          </Text>
        </View>

        {/* Battery Status */}
        <View style={styles.indicator}>
          <Ionicons
            name={getBatteryIcon() as any}
            size={16}
            color={getBatteryColor()}
          />
          <Text style={[styles.indicatorText, { color: getBatteryColor() }]}>
            {batteryLevel}%
          </Text>
        </View>

        {/* Network Status */}
        <View style={styles.indicator}>
          <Ionicons
            name={networkType === 'WiFi' ? 'wifi' : networkType === '4G' ? 'cellular' : 'cellular-outline'}
            size={16}
            color={networkType === 'Offline' ? theme.colors.error : theme.colors.text}
          />
          <Text style={styles.indicatorText}>
            {networkType}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  indicators: {
    flexDirection: 'row',
    gap: 16,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  indicatorText: {
    fontSize: 12,
    color: '#6b7280',
  },
});