import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, FontSize } from '../constants/theme';
import { NexusLogo } from '../components/ui/NexusLogo';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(800)}>
        <NexusLogo size={80} />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(400).duration(600)}>
        <Animated.Text style={styles.title}>NEXUS</Animated.Text>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(600).duration(600)}>
        <Animated.Text style={styles.tagline}>
          Private communication. Nothing more.
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 8,
    marginTop: 24,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 12,
    letterSpacing: 1,
  },
});
