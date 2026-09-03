import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { Colors } from '../../constants/theme';
import { NexusLogo } from '../../components/ui/NexusLogo';

export default function AuthIndex() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  async function checkSetupStatus() {
    try {
      // Try to validate if any user exists by checking health
      await api.instance.get('/health');
      // If we get here, server is up. Navigate to login.
      // The login screen will handle setup if needed.
      router.replace('/auth/login');
    } catch {
      // Server might be down
      router.replace('/auth/login');
    } finally {
      setChecking(false);
    }
  }

  return (
    <View style={styles.container}>
      <NexusLogo size={64} animated={false} />
      <ActivityIndicator
        size="small"
        color={Colors.accent}
        style={styles.loader}
      />
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
  loader: {
    marginTop: 24,
  },
});
