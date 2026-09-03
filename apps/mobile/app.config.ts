import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'NEXUS',
  slug: 'nexus',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'nexus',
  userInterfaceStyle: 'dark',


  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.nexus.privateapp',
    buildNumber: '1',
    infoPlist: {
      CFBundleDisplayName: 'NEXUS',
      NSCameraUsageDescription: 'NEXUS needs camera access to take photos and video calls.',
      NSMicrophoneUsageDescription: 'NEXUS needs microphone access for voice messages and calls.',
      NSPhotoLibraryUsageDescription: 'NEXUS needs photo library access to share images.',
      NSCalendarsUsageDescription: 'NEXUS does not use calendar data.',
      UIBackgroundModes: ['audio', 'voip', 'fetch', 'remote-notification'],
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
      },
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0a0f',
    },
    package: 'com.nexus.privateapp',
    versionCode: 1,
    permissions: [
      'CAMERA',
      'RECORD_AUDIO',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'ACCESS_NETWORK_STATE',
      'INTERNET',
      'MODIFY_AUDIO_SETTINGS',
      'VIBRATE',
      'DETECT_SCREEN_CAPTURE',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        data: [
          {
            scheme: 'nexus',
            host: 'invite',
            pathPrefix: '/',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],

  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#0a0a0f',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#0a0a0f',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Allow NEXUS to access your camera for photos and video calls.',
        microphonePermission: 'Allow NEXUS to access your microphone for voice messages and calls.',
        recordAudioAndroid: true,
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Allow NEXUS to access your microphone for voice messages and calls.',
        recordAudioAndroid: true,
        enableBackgroundPlayback: true,
      },
    ],
    [
      'expo-dev-client',
      {
        launchMode: 'most-recent',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow NEXUS to access your photos for sharing.',
        cameraPermission: 'Allow NEXUS to take photos for sharing.',
      },
    ],
    [
      'expo-secure-store',
      {},
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'fd449122-f892-438c-9fee-2aa9c0970b4a',
    },
  },
});
