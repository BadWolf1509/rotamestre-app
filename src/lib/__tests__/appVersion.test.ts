/**
 * Tests for appVersion.ts
 * Utilitário centralizado para informações de versão do app
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

import {
  getAppVersion,
  getBuildNumber,
  getPlatformName,
  getVersionInfo,
  getVersionString,
  getFullVersionString,
} from '../appVersion';

// Mock package.json
jest.mock('../../../package.json', () => ({
  version: '1.5.0',
}), { virtual: true });

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.4.0',
    android: { versionCode: 3005 },
    ios: { buildNumber: '150' },
    runtimeVersion: '1.0.0',
  },
}));

describe('appVersion', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
  });

  describe('getAppVersion', () => {
    it('should return version from package.json', () => {
      const version = getAppVersion();

      expect(version).toBe('1.5.0');
    });
  });

  describe('getBuildNumber', () => {
    it('should return android versionCode on Android', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

      const buildNumber = getBuildNumber();

      expect(buildNumber).toBe('3005');
    });

    it('should return ios buildNumber on iOS', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      const buildNumber = getBuildNumber();

      expect(buildNumber).toBe('150');
    });

    it('should return 0.0.0 on web', () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const buildNumber = getBuildNumber();

      expect(buildNumber).toBe('0.0.0');
    });
  });

  describe('getPlatformName', () => {
    it('should return iOS for ios platform', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      expect(getPlatformName()).toBe('iOS');
    });

    it('should return Android for android platform', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

      expect(getPlatformName()).toBe('Android');
    });

    it('should return Web for web platform', () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      expect(getPlatformName()).toBe('Web');
    });

    it('should return platform name for unknown platforms', () => {
      Object.defineProperty(Platform, 'OS', { value: 'windows', writable: true });

      expect(getPlatformName()).toBe('windows');
    });
  });

  describe('getVersionInfo', () => {
    it('should return complete version info object', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

      const info = getVersionInfo();

      expect(info.version).toBe('1.5.0');
      expect(info.buildNumber).toBe('3005');
      expect(info.platform).toBe('Android');
      expect(info.runtimeVersion).toBe('1.0.0');
    });
  });

  describe('getVersionString', () => {
    it('should return formatted version string', () => {
      const versionString = getVersionString();

      expect(versionString).toBe('Versão 1.5.0');
    });
  });

  describe('getFullVersionString', () => {
    it('should return full version string for Android', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });

      const fullString = getFullVersionString();

      expect(fullString).toBe('1.5.0 (3005) - Android');
    });

    it('should return full version string for iOS', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

      const fullString = getFullVersionString();

      expect(fullString).toBe('1.5.0 (150) - iOS');
    });

    it('should return full version string for Web', () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

      const fullString = getFullVersionString();

      expect(fullString).toBe('1.5.0 (0.0.0) - Web');
    });
  });
});
