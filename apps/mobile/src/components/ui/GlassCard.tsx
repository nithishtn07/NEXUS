import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  animated?: boolean;
}

export function GlassCard({ children, style, animated = true }: GlassCardProps) {
  const Wrapper = animated ? Animated.View : View;
  const entering = animated ? FadeIn.duration(400) : undefined;

  return (
    <Wrapper
      entering={entering}
      style={[styles.card, style]}
    >
      {children}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.lg,
  },
});
