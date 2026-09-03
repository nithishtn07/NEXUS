import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';

interface ConnectionIndicatorProps {
  status: 'connected' | 'reconnecting' | 'offline';
}

export function ConnectionIndicator({ status }: ConnectionIndicatorProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'connected') {
      // Hide after a short delay when connected
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Show when not connected
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [status, opacity]);

  if (status === 'connected') return null;

  const color = status === 'reconnecting' ? Colors.connecting : Colors.error;
  const text = status === 'reconnecting' ? 'Reconnecting...' : 'Offline';

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    zIndex: 100,
    marginTop: 50,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.sm,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
});
