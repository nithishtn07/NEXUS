import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '../../constants/theme';

interface VoiceMessagePlayerProps {
  uri: string;
  duration: number;
  isOwn: boolean;
}

export function VoiceMessagePlayer({ uri, duration, isOwn }: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status) {
      setPosition(Math.floor(status.currentTime || 0));
      setIsPlaying(status.playing);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  }, [status]);

  useEffect(() => {
    return () => {
      player.release();
    };
  }, []);

  const togglePlayback = async () => {
    if (isPlaying) {
      player.pause();
    } else {
      if (position >= duration && position > 0) {
        player.seekTo(0);
        player.play();
      } else {
        player.play();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={togglePlayback} style={styles.playBtn} activeOpacity={0.7}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={18}
          color={isOwn ? Colors.textPrimary : Colors.accent}
        />
      </TouchableOpacity>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(progress * 100, 100)}%` },
              isOwn ? styles.progressOwn : styles.progressOther,
            ]}
          />
        </View>
        <Text style={styles.timeText}>
          {formatTime(position)} / {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 180,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
    gap: 4,
  },
  progressBar: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  progressOwn: {
    backgroundColor: Colors.accentLight,
  },
  progressOther: {
    backgroundColor: Colors.accent,
  },
  timeText: {
    fontSize: FontSize.xs - 1,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
});
