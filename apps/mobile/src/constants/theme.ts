// ============================================
// NEXUS Design System
// Premium, dark, futuristic, minimal
// ============================================

export const Colors = {
  // Core
  background: '#0a0a0f',
  surface: '#12121a',
  surfaceElevated: '#1a1a24',
  surfaceOverlay: '#22222e',

  // Borders
  border: '#2a2a35',
  borderSubtle: '#1e1e28',
  borderFocus: '#4a4a5a',

  // Text
  textPrimary: '#f0f0f5',
  textSecondary: '#8888a0',
  textTertiary: '#5a5a70',
  textInverse: '#0a0a0f',

  // Accent
  accent: '#6366f1',
  accentLight: '#818cf8',
  accentDark: '#4f46e5',
  accentMuted: 'rgba(99, 102, 241, 0.15)',

  // Status
  online: '#22c55e',
  offline: '#6b7280',
  connecting: '#eab308',
  error: '#ef4444',
  errorMuted: 'rgba(239, 68, 68, 0.15)',
  success: '#22c55e',
  successMuted: 'rgba(34, 197, 94, 0.15)',
  warning: '#eab308',

  // Message bubbles
  messageOwn: '#1e1b4b',
  messageOwnText: '#f0f0f5',
  messageOther: '#1a1a24',
  messageOtherText: '#f0f0f5',

  // Glass effect
  glass: 'rgba(255, 255, 255, 0.03)',
  glassBorder: 'rgba(255, 255, 255, 0.06)',
  glassOverlay: 'rgba(0, 0, 0, 0.3)',

  // Skeleton loading
  skeleton: '#1a1a24',
  skeletonHighlight: '#22222e',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  full: 999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  hero: 36,
} as const;

export const FontFamily = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  mono: 'SpaceMono-Regular',
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  glow: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

export const Animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: {
    damping: 15,
    stiffness: 150,
  },
} as const;
