import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../../lib/store';
import { api } from '../../lib/api';
import { router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

export default function SettingsScreen() {
  const { user, updateSettings, logout } = useAuthStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await api.getSessions();
      if (response.success) {
        setSessions(response.data);
      }
    } catch {
      // Handle silently
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setIsLoggingOut(true);
          await logout();
          router.replace('/auth' as any);
        },
      },
    ]);
  };

  const handleLogoutAll = async () => {
    Alert.alert(
      'Logout All Devices',
      'This will logout all devices except the current one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout All',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.logoutAll();
              loadSessions();
              Alert.alert('Success', 'Logged out from all other devices');
            } catch {
              Alert.alert('Error', 'Failed to logout from all devices');
            }
          },
        },
      ],
    );
  };

  const handleRevokeSession = async (sessionId: string) => {
    Alert.alert('Revoke Session', 'Are you sure you want to revoke this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.revokeSession(sessionId);
            loadSessions();
          } catch {
            Alert.alert('Error', 'Failed to revoke session');
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'This action is irreversible. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteAccount();
              await logout();
              router.replace('/auth' as any);
            } catch {
              Alert.alert('Error', 'Failed to delete account');
            }
          },
        },
      ],
    );
  };

  const settings = user?.settings || {
    pushNotifications: true,
    messageNotifications: true,
    soundEnabled: true,
    vibrationEnabled: true,
    showOnlineStatus: true,
    showLastSeen: true,
    showReadReceipts: true,
    theme: 'dark',
    reducedMotion: false,
  };

  const handleToggle = async (key: string, value: boolean | string) => {
    try {
      await updateSettings({ [key]: value });
    } catch {
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </Animated.View>

      {/* Account Section */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => router.push('/(app)/profile')}
        >
          <Ionicons name="person-outline" size={20} color={Colors.accent} />
          <Text style={styles.settingText}>Profile</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.warning} />
          <Text style={[styles.settingText, { color: Colors.warning }]}>Logout</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow} onPress={handleLogoutAll}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={[styles.settingText, { color: Colors.error }]}>
            Logout All Devices
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Notifications Section */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

        <View style={styles.settingRow}>
          <Ionicons name="notifications-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.settingText}>Push Notifications</Text>
          <Switch
            value={settings.pushNotifications}
            onValueChange={(v) => handleToggle('pushNotifications', v)}
            trackColor={{ false: Colors.surfaceOverlay, true: Colors.accentMuted }}
            thumbColor={settings.pushNotifications ? Colors.accent : Colors.textTertiary}
          />
        </View>

        <View style={styles.settingRow}>
          <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.settingText}>Message Notifications</Text>
          <Switch
            value={settings.messageNotifications}
            onValueChange={(v) => handleToggle('messageNotifications', v)}
            trackColor={{ false: Colors.surfaceOverlay, true: Colors.accentMuted }}
            thumbColor={settings.messageNotifications ? Colors.accent : Colors.textTertiary}
          />
        </View>

        <View style={styles.settingRow}>
          <Ionicons name="volume-high-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.settingText}>Sound</Text>
          <Switch
            value={settings.soundEnabled}
            onValueChange={(v) => handleToggle('soundEnabled', v)}
            trackColor={{ false: Colors.surfaceOverlay, true: Colors.accentMuted }}
            thumbColor={settings.soundEnabled ? Colors.accent : Colors.textTertiary}
          />
        </View>

        <View style={styles.settingRow}>
          <Ionicons name="phone-portrait-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.settingText}>Vibration</Text>
          <Switch
            value={settings.vibrationEnabled}
            onValueChange={(v) => handleToggle('vibrationEnabled', v)}
            trackColor={{ false: Colors.surfaceOverlay, true: Colors.accentMuted }}
            thumbColor={settings.vibrationEnabled ? Colors.accent : Colors.textTertiary}
          />
        </View>
      </Animated.View>

      {/* Privacy Section */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <Text style={styles.sectionTitle}>PRIVACY</Text>

        <View style={styles.settingRow}>
          <Ionicons name="radio-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.settingText}>Online Status</Text>
          <Switch
            value={settings.showOnlineStatus}
            onValueChange={(v) => handleToggle('showOnlineStatus', v)}
            trackColor={{ false: Colors.surfaceOverlay, true: Colors.accentMuted }}
            thumbColor={settings.showOnlineStatus ? Colors.accent : Colors.textTertiary}
          />
        </View>

        <View style={styles.settingRow}>
          <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.settingText}>Last Seen</Text>
          <Switch
            value={settings.showLastSeen}
            onValueChange={(v) => handleToggle('showLastSeen', v)}
            trackColor={{ false: Colors.surfaceOverlay, true: Colors.accentMuted }}
            thumbColor={settings.showLastSeen ? Colors.accent : Colors.textTertiary}
          />
        </View>

        <View style={styles.settingRow}>
          <Ionicons name="checkmark-done-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.settingText}>Read Receipts</Text>
          <Switch
            value={settings.showReadReceipts}
            onValueChange={(v) => handleToggle('showReadReceipts', v)}
            trackColor={{ false: Colors.surfaceOverlay, true: Colors.accentMuted }}
            thumbColor={settings.showReadReceipts ? Colors.accent : Colors.textTertiary}
          />
        </View>
      </Animated.View>

      {/* Appearance Section */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)}>
        <Text style={styles.sectionTitle}>APPEARANCE</Text>

        <View style={styles.settingRow}>
          <Ionicons name="moon-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.settingText}>Dark Mode</Text>
          <Switch
            value={settings.theme === 'dark'}
            onValueChange={(v) => handleToggle('theme', v ? 'dark' : 'light')}
            trackColor={{ false: Colors.surfaceOverlay, true: Colors.accentMuted }}
            thumbColor={settings.theme === 'dark' ? Colors.accent : Colors.textTertiary}
          />
        </View>

        <View style={styles.settingRow}>
          <Ionicons name="finger-print-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.settingText}>Reduced Motion</Text>
          <Switch
            value={settings.reducedMotion}
            onValueChange={(v) => handleToggle('reducedMotion', v)}
            trackColor={{ false: Colors.surfaceOverlay, true: Colors.accentMuted }}
            thumbColor={settings.reducedMotion ? Colors.accent : Colors.textTertiary}
          />
        </View>
      </Animated.View>

      {/* Security Section */}
      <Animated.View entering={FadeInDown.delay(500).duration(400)}>
        <Text style={styles.sectionTitle}>SECURITY</Text>

        <Text style={styles.subSectionTitle}>Active Sessions</Text>
        {isLoadingSessions ? (
          <ActivityIndicator size="small" color={Colors.accent} style={{ padding: 16 }} />
        ) : (
          sessions.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionInfo}>
                <Ionicons
                  name={session.platform === 'ios' ? 'logo-apple' : 'logo-android'}
                  size={18}
                  color={Colors.textSecondary}
                />
                <View style={styles.sessionDetails}>
                  <Text style={styles.sessionName}>
                    {session.deviceName || 'Unknown Device'}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    {session.isCurrent ? 'Current device' : session.platform}
                    {' • '}
                    {new Date(session.lastSeenAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              {!session.isCurrent && (
                <TouchableOpacity
                  onPress={() => handleRevokeSession(session.id)}
                  style={styles.revokeButton}
                >
                  <Text style={styles.revokeText}>Revoke</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </Animated.View>

      {/* Danger Zone */}
      <Animated.View entering={FadeInDown.delay(600).duration(400)}>
        <Text style={[styles.sectionTitle, { color: Colors.error }]}>DANGER ZONE</Text>

        <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={20} color={Colors.error} />
          <Text style={styles.dangerText}>Delete Account</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* App Info */}
      <Animated.View entering={FadeInDown.delay(700).duration(400)} style={styles.appInfo}>
        <Text style={styles.appName}>NEXUS</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
        <Text style={styles.appTagline}>Private communication. Nothing more.</Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    marginBottom: Spacing.xxl,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 2,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  subSectionTitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  settingText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginLeft: Spacing.md,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  sessionName: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  sessionMeta: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  revokeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.errorMuted,
    borderRadius: BorderRadius.sm,
  },
  revokeText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    fontWeight: '500',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorMuted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  dangerText: {
    fontSize: FontSize.md,
    color: Colors.error,
    fontWeight: '500',
    marginLeft: Spacing.md,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: Spacing.xxxl,
    paddingVertical: Spacing.xxl,
  },
  appName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 4,
  },
  appVersion: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  appTagline: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
