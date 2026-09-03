import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { CallInfo } from '../../lib/callStore';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CallScreenProps {
  visible: boolean;
  call: CallInfo | null;
  localStream: any;
  remoteStream: any;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
}

export function CallScreen({
  visible,
  call,
  localStream,
  remoteStream,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleSpeaker,
  onToggleCamera,
  onSwitchCamera,
}: CallScreenProps) {
  const [duration, setDuration] = useState(0);
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (call?.state === 'active' || call?.state === 'connecting') {
      const timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [call?.state]);

  useEffect(() => {
    if (call?.state === 'outgoing' || call?.state === 'incoming') {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    }
  }, [call?.state, pulseAnim]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!visible || !call) return null;

  const isVideo = call.callType === 'video';
  const callerName = call.callerName || 'Unknown';

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background */}
      <View style={styles.background}>
        <View style={styles.bgGradient} />
      </View>

      {/* Header Info */}
      <View style={styles.headerInfo}>
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Animated.View style={[styles.avatar, pulseStyle]}>
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={32}
              color={Colors.accent}
            />
          </Animated.View>
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(200).duration(400)} style={styles.callerName}>
          {callerName}
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(300).duration(400)} style={styles.callStatus}>
          {call.state === 'outgoing' && 'Calling...'}
          {call.state === 'incoming' && 'Incoming call'}
          {call.state === 'connecting' && 'Connecting...'}
          {call.state === 'active' && formatDuration(duration)}
          {call.state === 'ended' && 'Call ended'}
        </Animated.Text>
      </View>

      {/* Video preview (for video calls) */}
      {isVideo && call.state === 'active' && (
        <View style={styles.videoContainer}>
          {/* Remote video would go here */}
          <View style={styles.remoteVideoPlaceholder}>
            <Ionicons name="videocam" size={48} color={Colors.textTertiary} />
          </View>

          {/* Local video preview (small) */}
          <View style={styles.localVideo}>
            <Ionicons name="person" size={20} color={Colors.textSecondary} />
          </View>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {call.state === 'incoming' && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.incomingControls}>
            <TouchableOpacity
              style={[styles.controlBtn, styles.declineBtn]}
              onPress={onDecline}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={28} color={Colors.textPrimary} style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, styles.acceptBtn]}
              onPress={onAccept}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {(call.state === 'outgoing' || call.state === 'connecting' || call.state === 'active') && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.activeControls}>
            {call.state === 'active' && (
              <View style={styles.activeControlsRow}>
                <TouchableOpacity
                  style={[styles.controlBtn, call.isMuted && styles.controlBtnActive]}
                  onPress={onToggleMute}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={call.isMuted ? 'mic-off' : 'mic'}
                    size={22}
                    color={call.isMuted ? Colors.error : Colors.textPrimary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.controlBtn, call.isSpeakerOn && styles.controlBtnActive]}
                  onPress={onToggleSpeaker}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={call.isSpeakerOn ? 'volume-high' : 'volume-low'}
                    size={22}
                    color={call.isSpeakerOn ? Colors.accent : Colors.textPrimary}
                  />
                </TouchableOpacity>

                {isVideo && (
                  <>
                    <TouchableOpacity
                      style={[styles.controlBtn, !call.isCameraOn && styles.controlBtnActive]}
                      onPress={onToggleCamera}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={call.isCameraOn ? 'videocam' : 'videocam-off'}
                        size={22}
                        color={!call.isCameraOn ? Colors.error : Colors.textPrimary}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.controlBtn}
                      onPress={onSwitchCamera}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera-reverse" size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.controlBtn, styles.endCallBtn]}
              onPress={onEnd}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={28} color={Colors.textPrimary} style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {call.state === 'ended' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.endedControls}>
            <TouchableOpacity style={styles.controlBtn} onPress={onEnd} activeOpacity={0.8}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 2000,
  },
  background: {
    ...StyleSheet.absoluteFill,
  },
  bgGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0a0a1a',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.accent,
    marginBottom: Spacing.xl,
  },
  callerName: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  callStatus: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  videoContainer: {
    flex: 1,
    margin: Spacing.lg,
  },
  remoteVideoPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  localVideo: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    width: 100,
    height: 140,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  controls: {
    paddingBottom: 60,
    paddingHorizontal: Spacing.xxl,
  },
  incomingControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
  },
  activeControls: {
    alignItems: 'center',
    gap: Spacing.xxl,
  },
  activeControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  endedControls: {
    alignItems: 'center',
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  controlBtnActive: {
    backgroundColor: Colors.accentMuted,
    borderColor: Colors.accent,
  },
  acceptBtn: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  declineBtn: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  endCallBtn: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
    width: 70,
    height: 70,
    borderRadius: 35,
  },
});
