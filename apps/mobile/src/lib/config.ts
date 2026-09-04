const DEFAULT_DEV_HOST = '192.168.29.140:3000';
const DEFAULT_PROD_URL = 'https://nexus-api.onrender.com';
const DEFAULT_STAGING_URL = 'https://nexus-api-staging.onrender.com';

const ENV = {
  development: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || `http://${DEFAULT_DEV_HOST}`,
    wsUrl: process.env.EXPO_PUBLIC_WS_URL || `http://${DEFAULT_DEV_HOST}`,
  },
  staging: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || DEFAULT_STAGING_URL,
    wsUrl: process.env.EXPO_PUBLIC_WS_URL || DEFAULT_STAGING_URL,
  },
  production: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || DEFAULT_PROD_URL,
    wsUrl: process.env.EXPO_PUBLIC_WS_URL || DEFAULT_PROD_URL,
  },
};

function getEnvironment() {
  // If explicitly specified via environment variable, respect it
  const explicitEnv = process.env.EXPO_PUBLIC_ENV;
  if (explicitEnv && explicitEnv in ENV) {
    return ENV[explicitEnv as keyof typeof ENV];
  }

  // When running locally with Expo Dev Server / Metro (__DEV__ is true)
  if (__DEV__) {
    return ENV.development;
  }

  // Standalone / release builds (APK, App Bundle) default to production Render backend
  return ENV.production;
}

export const config = getEnvironment();
console.log('[NEXUS Config] Environment initialized:', {
  apiUrl: config.apiUrl,
  wsUrl: config.wsUrl,
  isDev: __DEV__,
});

export const APP_NAME = 'NEXUS';
export const APP_TAGLINE = 'Private communication. Nothing more.';
