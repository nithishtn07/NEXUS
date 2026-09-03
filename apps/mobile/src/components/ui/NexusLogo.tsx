import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { Colors } from '../../constants/theme';

interface NexusLogoProps {
  size?: number;
  animated?: boolean;
}

export function NexusLogo({ size = 64, animated = true }: NexusLogoProps) {
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    if (animated) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 20000, easing: Easing.linear }),
        -1,
      );
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    }
  }, [animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: pulse.value }],
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={[styles.svgWrapper, animatedStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="nexusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={Colors.accent} />
              <Stop offset="100%" stopColor={Colors.accentLight} />
            </LinearGradient>
          </Defs>
          {/* Outer hexagonal shape */}
          <Path
            d="M50 5 L90 27.5 L90 72.5 L50 95 L10 72.5 L10 27.5 Z"
            fill="none"
            stroke="url(#nexusGradient)"
            strokeWidth="2"
            opacity="0.8"
          />
          {/* Inner diamond */}
          <Path
            d="M50 20 L80 50 L50 80 L20 50 Z"
            fill="none"
            stroke="url(#nexusGradient)"
            strokeWidth="1.5"
            opacity="0.6"
          />
          {/* Center circle */}
          <Circle cx="50" cy="50" r="12" fill="url(#nexusGradient)" opacity="0.9" />
          {/* Connecting lines */}
          <Path
            d="M50 20 L50 5 M80 50 L90 50 M50 80 L50 95 M20 50 L10 50"
            stroke="url(#nexusGradient)"
            strokeWidth="1"
            opacity="0.4"
          />
          {/* Small accent dots */}
          <Circle cx="50" cy="50" r="4" fill={Colors.textPrimary} opacity="0.9" />
          <Circle cx="50" cy="20" r="2" fill={Colors.accentLight} opacity="0.7" />
          <Circle cx="80" cy="50" r="2" fill={Colors.accentLight} opacity="0.7" />
          <Circle cx="50" cy="80" r="2" fill={Colors.accentLight} opacity="0.7" />
          <Circle cx="20" cy="50" r="2" fill={Colors.accentLight} opacity="0.7" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  svgWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
