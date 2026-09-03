import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAuthStore, useChatStore } from '../../lib/store';
import { api } from '../../lib/api';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';
import { NexusLogo } from '../../components/ui/NexusLogo';
import { ConnectionIndicator } from '../../components/ui/ConnectionIndicator';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { conversations, setConversations, setActiveConversation, connectionStatus } = useChatStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [partner, setPartner] = useState<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    status: string | null;
    lastSeenAt: string | null;
  } | null>(null);
  const [invitationStatus, setInvitationStatus] = useState<{
    spaceFull: boolean;
    hasActiveInvitation: boolean;
    invitationId: string | null;
    expiresAt: string | null;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [conversationsRes, partnerRes] = await Promise.all([
        api.getConversations(),
        api.getPartner(),
      ]);

      if (conversationsRes.success) {
        setConversations(conversationsRes.data);
      }

      if (partnerRes.success) {
        setPartner(partnerRes.data);
      }

      // If owner, check invitation status
      if (user?.role === 'owner') {
        const statusRes = await api.getInvitationStatus();
        if (statusRes.success) {
          setInvitationStatus(statusRes.data);
        }
      }
    } catch {
      // Handle silently
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.role, setConversations]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleCreateInvitation = async () => {
    try {
      const response = await api.createInvitation();
      if (response.success) {
        setCreatedInvitation(response.data.token);
      }
    } catch {
      // Handle error
    }
  };

  const handleOpenChat = (conversation: typeof conversations[0]) => {
    setActiveConversation(conversation);
    router.push('/(app)/chat');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ConnectionIndicator status={connectionStatus} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <NexusLogo size={40} animated={false} />
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hello, {user?.displayName}</Text>
            <Text style={styles.status}>NEXUS • Private Space</Text>
          </View>
        </Animated.View>

        {/* Active Conversation */}
        {conversations.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={styles.sectionTitle}>CONVERSATION</Text>
            <TouchableOpacity
              style={styles.conversationCard}
              onPress={() => handleOpenChat(conversations[0])}
              activeOpacity={0.7}
            >
              <View style={styles.conversationAvatar}>
                <Ionicons name="person" size={24} color={Colors.accent} />
              </View>
              <View style={styles.conversationInfo}>
                <Text style={styles.conversationName}>
                  {conversations[0].otherUser?.displayName || 'Unknown'}
                </Text>
                <Text style={styles.conversationLastMessage} numberOfLines={1}>
                  {conversations[0].lastMessage?.content || 'No messages yet'}
                </Text>
              </View>
              <View style={styles.conversationMeta}>
                <View
                  style={[
                    styles.onlineIndicator,
                    {
                      backgroundColor: partner ? Colors.online : Colors.offline,
                    },
                  ]}
                />
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        ) : partner ? (
          /* No conversation yet but partner exists */
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={styles.sectionTitle}>CONVERSATION</Text>
            <View style={styles.emptyCard}>
              <Ionicons name="chatbubbles-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Start a conversation</Text>
              <Text style={styles.emptySubtitle}>
                {partner.displayName} has joined. Head to the Chat tab to begin messaging.
              </Text>
            </View>
          </Animated.View>
        ) : (
          /* Waiting for second user */
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={styles.sectionTitle}>
              {user?.role === 'owner' ? 'INVITE A USER' : 'WAITING FOR OWNER'}
            </Text>

            {user?.role === 'owner' ? (
              <View style={styles.inviteCard}>
                <Ionicons name="key-outline" size={32} color={Colors.accent} />
                <Text style={styles.inviteTitle}>Invite to NEXUS</Text>
                <Text style={styles.inviteSubtitle}>
                  Generate an invitation token to allow exactly one other person to join your private space.
                </Text>

                {!createdInvitation ? (
                  <TouchableOpacity
                    style={styles.inviteButton}
                    onPress={handleCreateInvitation}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.inviteButtonText}>Generate Invitation</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.tokenContainer}>
                    <Text style={styles.tokenLabel}>Invitation Token:</Text>
                    <Text style={styles.tokenText} numberOfLines={2}>
                      {createdInvitation}
                    </Text>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={() => {
                        // Copy to clipboard would use Clipboard API
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2000);
                      }}
                    >
                      <Text style={styles.copyButtonText}>
                        {copiedToken ? 'Copied!' : 'Copy Token'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {invitationStatus?.hasActiveInvitation && !createdInvitation && (
                  <Text style={styles.inviteNote}>
                    You have an active invitation that expires{' '}
                    {new Date(invitationStatus.expiresAt!).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.inviteCard}>
                <Ionicons name="hourglass-outline" size={32} color={Colors.textTertiary} />
                <Text style={styles.inviteTitle}>Waiting for Invitation</Text>
                <Text style={styles.inviteSubtitle}>
                  The owner needs to generate an invitation token for you. Ask them to share it with you.
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.actions}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(app)/chat')}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbox-outline" size={24} color={Colors.accent} />
              <Text style={styles.actionText}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(app)/profile')}
              activeOpacity={0.7}
            >
              <Ionicons name="person-outline" size={24} color={Colors.accent} />
              <Text style={styles.actionText}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(app)/settings')}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={24} color={Colors.accent} />
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  headerText: {
    marginLeft: Spacing.md,
  },
  greeting: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  status: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 2,
    marginBottom: Spacing.md,
  },
  conversationCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xxl,
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  conversationName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  conversationLastMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  conversationMeta: {
    alignItems: 'center',
    gap: 8,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  inviteCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xxl,
  },
  inviteTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
  },
  inviteSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  inviteButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
  },
  inviteButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  inviteNote: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  tokenContainer: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    width: '100%',
  },
  tokenLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  tokenText: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  copyButton: {
    backgroundColor: Colors.accentMuted,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  copyButtonText: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontWeight: '500',
  },
  actions: {
    marginTop: Spacing.lg,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    fontWeight: '500',
  },
});
