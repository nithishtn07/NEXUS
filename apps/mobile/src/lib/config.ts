import Constants from 'expo-constants';

const ENV = {
  development: {
    apiUrl: 'http://localhost:3000',
    wsUrl: 'http://localhost:3000',
  },
  staging: {
    apiUrl: 'https://nexus-api-staging.onrender.com',
    wsUrl: 'https://nexus-api-staging.onrender.com',
  },
  production: {
    apiUrl: 'https://nexus-api.onrender.com',
    wsUrl: 'https://nexus-api.onrender.com',
  },
};

function getEnvironment() {
  const releaseChannel = Constants.expoConfig?.extra?.eas?.projectId;
  const env = process.env.EXPO_PUBLIC_ENV || 'development';
  return ENV[env as keyof typeof ENV] || ENV.development;
}

export const config = getEnvironment();

export const APP_NAME = 'NEXUS';
export const APP_TAGLINE = 'Private communication. Nothing more.';
