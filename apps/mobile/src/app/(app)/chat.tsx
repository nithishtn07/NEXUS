import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useAuthStore, useChatStore, socketManager } from '../../lib/store';
import { api } from '../../lib/api';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../constants/theme';
import { MediaPicker } from '../../components/chat/MediaPicker';
import { VoiceRecorder } from '../../components/chat/VoiceRecorder';
import { ImageViewer } from '../../components/chat/ImageViewer';
import { CallScreen } from '../../components/call/CallScreen';
import { useCallStore } from '../../lib/callStore';
import { useWebRTC } from '../../hooks/useWebRTC';

// ---- Message Bubble Component ----
function MessageBubble({
  message,
  isOwn,
  onLongPress,
}: {
  message: any;
  isOwn: boolean;
  onLongPress: (msg: any) => void;
}) {
  const isDeleted = !!message.deletedAt;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      style={[styles.messageWrapper, isOwn ? styles.ownWrapper : styles.otherWrapper]}
    >
      <TouchableOpacity
        style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble]}
        onLongPress={() => onLongPress(message)}
        activeOpacity={0.8}
        disabled={isDeleted}
      >
        {message.replyTo && (
          <View style={styles.replyContainer}>
            <Text style={styles.replyAuthor}>
              {message.replyTo.sender?.displayName}
            </Text>
            <Text style={styles.replyContent} numberOfLines={2}>
              {message.replyTo.content || 'Media'}
            </Text>
          </View>
        )}

        {isDeleted ? (
          <Text style={styles.deletedText}>Message deleted</Text>
        ) : (
          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
            {message.content}
          </Text>
        )}

        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {message.editedAt && (
            <Text style={styles.editedBadge}>edited</Text>
          )}
          {isOwn && (
            <Ionicons
              name={getMessageStatusIcon(message.status)}
              size={12}
              color={message.status === 'read' ? Colors.accent : Colors.textTertiary}
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Reactions */}
      {message.reactions && message.reactions.length > 0 && (
        <View style={[styles.reactionsContainer, isOwn && styles.ownReactions]}>
          {message.reactions.map((reaction: any, index: number) => (
            <TouchableOpacity
              key={index}
              style={styles.reactionBubble}
              onPress={() => {
                socketManager.addReaction(message.id, reaction.reaction);
              }}
            >
              <Text style={styles.reactionText}>
                {reaction.reaction} {reaction.count}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

function getMessageStatusIcon(status: string): 'checkmark' | 'checkmark-done' | 'time-outline' | 'sync-outline' {
  switch (status) {
    case 'sending':
      return 'time-outline';
    case 'sent':
      return 'checkmark';
    case 'delivered':
      return 'checkmark-done';
    case 'read':
      return 'checkmark-done';
    default:
      return 'checkmark';
  }
}

// ---- Main Chat Screen ----
export default function ChatScreen() {
  const { user } = useAuthStore();
  const {
    activeConversation,
    messages,
    loadMessages,
    addMessage,
    isLoadingMessages,
    hasMoreMessages,
    typingUsers,
    partnerOnline,
    connectionStatus,
  } = useChatStore();

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Call state
  const { call, startCall, receiveCall, acceptCall, endCall: endCallStore } = useCallStore();
  const webrtc = useWebRTC();

  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.id);
      socketManager.joinConversation(activeConversation.id);
    }

    return () => {
      if (activeConversation) {
        socketManager.leaveConversation(activeConversation.id);
      }
    };
  }, [activeConversation]);

  // Auto-scroll to top when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [messages.length]);

  // ---- Image Send ----
  const handleSendImage = async (uri: string) => {
    if (!activeConversation) return;
    setShowMediaPicker(false);
    setIsSending(true);

    try {
      // Upload image first
      const uploadRes = await api.uploadAttachment(activeConversation.id, uri);
      if (!uploadRes.success) throw new Error('Upload failed');

      // Send message with attachment
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      socketManager.sendMessage({
        conversationId: activeConversation.id,
        content: '',
        type: 'image',
        tempId,
      });
    } catch {
      Alert.alert('Error', 'Failed to send image');
    } finally {
      setIsSending(false);
    }
  };

  // ---- Voice Message Send ----
  const handleSendVoice = async (uri: string, duration: number) => {
    if (!activeConversation) return;
    setShowVoiceRecorder(false);
    setIsSending(true);

    try {
      const uploadRes = await api.uploadAudio(activeConversation.id, uri, duration);
      if (!uploadRes.success) throw new Error('Upload failed');

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      socketManager.sendMessage({
        conversationId: activeConversation.id,
        content: `${Math.round(duration)}s`,
        type: 'voice',
        tempId,
      });
    } catch {
      Alert.alert('Error', 'Failed to send voice message');
    } finally {
      setIsSending(false);
    }
  };

  // ---- Call Functions ----
  const handleStartCall = async (callType: 'voice' | 'video') => {
    if (!activeConversation) return;
    try {
      const res = await api.createCall(activeConversation.id, callType);
      if (res.success) {
        startCall({
          callId: res.data.id,
          conversationId: activeConversation.id,
          callType,
          callerId: user?.id || '',
          callerName: user?.displayName || '',
        });
        socketManager.emitCallInvite(
          activeConversation.id,
          callType,
          res.data.id,
          user?.displayName || '',
        );
        await webrtc.initializeCall(activeConversation.id, res.data.id, callType);
      }
    } catch {
      Alert.alert('Error', 'Failed to start call');
    }
  };

  const handleAcceptCall = async () => {
    if (!call) return;
    try {
      await api.answerCall(call.id);
      acceptCall();
      socketManager.emitCallAccept(call.conversationId, call.id);
      await webrtc.acceptCall(call.conversationId, call.id, call.callType);
    } catch {
      Alert.alert('Error', 'Failed to accept call');
    }
  };

  const handleDeclineCall = async () => {
    if (!call) return;
    try {
      await api.declineCall(call.id);
      socketManager.emitCallDecline(call.conversationId, call.id);
      webrtc.cleanup();
      endCallStore();
    } catch {
      endCallStore();
    }
  };

  const handleEndCall = async () => {
    if (!call) return;
    try {
      await api.endCall(call.id);
      webrtc.endCall(call.conversationId, call.id);
      endCallStore();
    } catch {
      webrtc.cleanup();
      endCallStore();
    }
  };

  // ---- Socket.IO Call Listeners ----
  useEffect(() => {
    const unsubs = [
      socketManager.onCallRinging((data) => {
        receiveCall({
          callId: data.callId,
          conversationId: data.conversationId,
          callType: data.callType,
          callerId: data.callerId,
          callerName: data.callerName,
        });
      }),
      socketManager.onCallAccepted(() => {
        useCallStore.getState().setCallState('active');
      }),
      socketManager.onCallDeclined(() => {
        webrtc.cleanup();
        endCallStore();
      }),
      socketManager.onCallCancelled(() => {
        webrtc.cleanup();
        endCallStore();
      }),
      socketManager.onCallEnded(() => {
        webrtc.cleanup();
        endCallStore();
      }),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || !activeConversation || isSending) return;

    const content = inputText.trim();
    setInputText('');
    setIsSending(true);

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Optimistic add
    addMessage({
      id: tempId,
      tempId,
      conversationId: activeConversation.id,
      senderId: user?.id || '',
      content,
      type: 'text',
      status: 'sending',
      replyToId: null,
      replyTo: null,
      reactions: [],
      readBy: [],
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      sender: {
        id: user?.id || '',
        username: user?.username || '',
        displayName: user?.displayName || '',
        avatarUrl: user?.avatarUrl || null,
      },
    } as any);

    // Send via Socket.IO
    socketManager.sendMessage({
      conversationId: activeConversation.id,
      content,
      type: 'text',
      tempId,
    });

    setIsSending(false);
  };

  const handleTypingStart = () => {
    if (activeConversation) {
      socketManager.sendTypingStart(activeConversation.id);
    }

    // Auto-stop typing after 3 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (activeConversation) {
        socketManager.sendTypingStop(activeConversation.id);
      }
    }, 3000);
  };

  const handleTypingStop = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (activeConversation) {
      socketManager.sendTypingStop(activeConversation.id);
    }
  };

  const handleLongPress = (message: any) => {
    if (message.senderId !== user?.id || message.deletedAt) return;

    Alert.alert('Message', 'Choose an action', [
      {
        text: 'Edit',
        onPress: () => {
          setInputText(message.content || '');
          setSelectedMessage(message);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteMessage(message.id);
            socketManager.sendMessage({
              conversationId: activeConversation?.id || '',
              content: '',
              type: 'text',
              tempId: `del-${Date.now()}`,
            });
          } catch {
            // Handle error
          }
        },
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const handleLoadMore = () => {
    if (hasMoreMessages && !isLoadingMessages && activeConversation) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        loadMessages(activeConversation.id, lastMessage.id);
      }
    }
  };

  // Get typing indicator text
  const typingText = Array.from(typingUsers.entries()).length > 0 ? 'typing...' : null;

  const renderMessage = ({ item }: { item: any }) => (
    <MessageBubble
      message={item}
      isOwn={item.senderId === user?.id}
      onLongPress={handleLongPress}
    />
  );

  if (!activeConversation) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>No Conversation</Text>
        <Text style={styles.emptySubtitle}>
          Start a conversation from the Home tab
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Chat Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <View style={styles.headerAvatar}>
          <Ionicons name="person" size={20} color={Colors.accent} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>
            {activeConversation.otherUser?.displayName || 'Unknown'}
          </Text>
          <Text style={styles.headerStatus}>
            {partnerOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => handleStartCall('voice')}
            activeOpacity={0.7}
          >
            <Ionicons name="call" size={18} color={Colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => handleStartCall('video')}
            activeOpacity={0.7}
          >
            <Ionicons name="videocam" size={18} color={Colors.accent} />
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.headerOnlineDot,
            { backgroundColor: partnerOnline ? Colors.online : Colors.offline },
          ]}
        />
      </Animated.View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messagesList}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoadingMessages ? (
            <ActivityIndicator
              size="small"
              color={Colors.accent}
              style={styles.loadingMore}
            />
          ) : null
        }
        ListEmptyComponent={
          !isLoadingMessages ? (
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyMessagesText}>
                No messages yet. Say hello!
              </Text>
            </View>
          ) : null
        }
      />

      {/* Typing Indicator */}
      {typingText && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.typingContainer}>
          <Text style={styles.typingText}>{typingText}</Text>
        </Animated.View>
      )}

      {/* Connection Status */}
      {connectionStatus !== 'connected' && (
        <View style={[styles.statusBar, { backgroundColor: connectionStatus === 'reconnecting' ? Colors.connecting : Colors.error }]}>
          <Text style={styles.statusText}>
            {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline - messages will be sent when connected'}
          </Text>
        </View>
      )}

      {/* Media Picker */}
      <MediaPicker
        visible={showMediaPicker}
        onSend={handleSendImage}
        onCancel={() => setShowMediaPicker(false)}
      />

      {/* Voice Recorder */}
      <VoiceRecorder
        visible={showVoiceRecorder}
        onSend={handleSendVoice}
        onCancel={() => setShowVoiceRecorder(false)}
      />

      {/* Input */}
      {!showMediaPicker && !showVoiceRecorder && (
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => setShowMediaPicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle" size={26} color={Colors.accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => setShowVoiceRecorder(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="mic" size={22} color={Colors.accent} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={(text) => {
              setInputText(text);
              if (text.length > 0) {
                handleTypingStart();
              } else {
                handleTypingStop();
              }
            }}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={5000}
            editable={connectionStatus !== 'offline'}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
            activeOpacity={0.8}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() ? Colors.textPrimary : Colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Image Viewer */}
      <ImageViewer
        visible={!!viewingImage}
        uri={viewingImage || ''}
        onClose={() => setViewingImage(null)}
      />

      {/* Call Screen */}
      <CallScreen
        visible={!!call}
        call={call}
        localStream={webrtc.localStream}
        remoteStream={webrtc.remoteStream}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
        onEnd={handleEndCall}
        onToggleMute={webrtc.toggleMute}
        onToggleSpeaker={webrtc.toggleSpeaker}
        onToggleCamera={webrtc.toggleCamera}
        onSwitchCamera={webrtc.switchCamera}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  headerName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  headerStatus: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: Spacing.sm,
  },
  messagesList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  messageWrapper: {
    marginVertical: Spacing.xs,
    maxWidth: '80%',
  },
  ownWrapper: {
    alignSelf: 'flex-end',
  },
  otherWrapper: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  ownBubble: {
    backgroundColor: Colors.messageOwn,
    borderBottomRightRadius: BorderRadius.sm,
  },
  otherBubble: {
    backgroundColor: Colors.messageOther,
    borderBottomLeftRadius: BorderRadius.sm,
    borderWidth: 0.5,
    borderColor: Colors.borderSubtle,
  },
  replyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
  },
  replyAuthor: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.accent,
  },
  replyContent: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  messageText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  ownMessageText: {
    color: Colors.messageOwnText,
  },
  deletedText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: Spacing.xs,
    gap: 4,
  },
  messageTime: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  editedBadge: {
    fontSize: FontSize.xs - 1,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.xs,
    gap: 4,
  },
  ownReactions: {
    justifyContent: 'flex-end',
  },
  reactionBubble: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  reactionText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  typingContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  typingText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  statusBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  statusText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    maxHeight: 120,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  mediaBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    ...Shadows.sm,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.surfaceElevated,
  },
  loadingMore: {
    paddingVertical: Spacing.lg,
  },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyMessagesText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
});
