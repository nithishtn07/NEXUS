import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, Spacing, FontSize } from '../../constants/theme';

interface VoiceRecorderProps {
  visible: boolean;
  onSend: (uri: string, duration: number) => void;
  onCancel: () => void;
}

type RecorderState = 'idle' | 'recording' | 'preview' | 'sending';

export function VoiceRecorder({ visible, onSend, onCancel }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const player = useAudioPlayer(recordingUri);
  const playerStatus = useAudioPlayerStatus(player);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveAnim = useSharedValue(0);

  useEffect(() => {
    if (state === 'recording') {
      waveAnim.value = withRepeat(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      waveAnim.value = 0;
    }
  }, [state, waveAnim]);

  // Sync playback position from player status
  useEffect(() => {
    if (playerStatus && state === 'preview') {
      setPlaybackPosition(Math.floor(playerStatus.currentTime || 0));
      setIsPlaying(playerStatus.playing);
      if (playerStatus.didJustFinish) {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    }
  }, [playerStatus, state]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      if (recorderState.isRecording) {
        await audioRecorder.stop();
      }
    } catch {}
    try {
      if (recordingUri) {
        player.release();
      }
    } catch {}
  }, [recorderState.isRecording, audioRecorder, recordingUri, player]);

  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Microphone access is needed to record voice messages.');
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setDuration(0);
      setRecordingUri(null);
      setState('recording');

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording) return;

    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      await setAudioModeAsync({ allowsRecording: false });

      if (uri) {
        setRecordingUri(uri);
        setState('preview');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setState('idle');
    }
  };

  const cancelRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      if (recorderState.isRecording) {
        await audioRecorder.stop();
      }
    } catch {}

    try {
      if (recordingUri) {
        player.release();
      }
    } catch {}

    await setAudioModeAsync({ allowsRecording: false });
    setDuration(0);
    setPlaybackPosition(0);
    setIsPlaying(false);
    setRecordingUri(null);
    setState('idle');
    onCancel();
  };

  const togglePlayback = async () => {
    if (!recordingUri) return;

    if (isPlaying) {
      player.pause();
    } else {
      if (playbackPosition >= duration && playbackPosition > 0) {
        player.seekTo(0);
        player.play();
      } else {
        player.play();
      }
    }
  };

  const sendVoice = async () => {
    if (!recordingUri) return;

    setState('sending');
    try {
      onSend(recordingUri, duration);
    } catch {
      Alert.alert('Error', 'Failed to send voice message');
    } finally {
      try { player.release(); } catch {}
      setRecordingUri(null);
      setState('idle');
      setDuration(0);
      setPlaybackPosition(0);
      setIsPlaying(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const waveStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + waveAnim.value * 0.7,
    transform: [{ scaleY: 0.5 + waveAnim.value * 0.5 }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={styles.container}
    >
      {state === 'recording' && (
        <View style={styles.recordingContent}>
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingTime}>{formatTime(duration)}</Text>
          </View>

          <Animated.View style={[styles.waveform, waveStyle]}>
            {Array.from({ length: 30 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: 4 + Math.sin(i * 0.5 + Date.now() * 0.003) * 12,
                    opacity: 0.4 + Math.random() * 0.6,
                  },
                ]}
              />
            ))}
          </Animated.View>

          <View style={styles.controls}>
            <TouchableOpacity onPress={cancelRecording} style={styles.controlBtn}>
              <Ionicons name="trash" size={22} color={Colors.error} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={stopRecording}
              style={styles.stopBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="stop" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>

            <View style={{ width: 44 }} />
          </View>
        </View>
      )}

      {state === 'preview' && (
        <View style={styles.previewContent}>
          <View style={styles.previewTimer}>
            <Text style={styles.previewTime}>
              {formatTime(playbackPosition)} / {formatTime(duration)}
            </Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity onPress={cancelRecording} style={styles.controlBtn}>
              <Ionicons name="trash" size={22} color={Colors.error} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={togglePlayback}
              style={[styles.controlBtn, styles.playBtn]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={28}
                color={Colors.textPrimary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={sendVoice}
              style={[styles.controlBtn, styles.sendBtn]}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {state === 'sending' && (
        <View style={styles.sendingContent}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.sendingText}>Sending...</Text>
        </View>
      )}

      {state === 'idle' && (
        <TouchableOpacity
          onPress={startRecording}
          style={styles.recordBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="mic" size={24} color={Colors.accent} />
          <Text style={styles.recordBtnText}>Hold to record</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  recordingContent: {
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  recordingTime: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 32,
    marginBottom: Spacing.lg,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.accent,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentMuted,
  },
  sendBtn: {
    backgroundColor: Colors.accent,
  },
  stopBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    alignItems: 'center',
  },
  previewTimer: {
    marginBottom: Spacing.lg,
  },
  previewTime: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  sendingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  sendingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  recordBtnText: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontWeight: '500',
  },
});
