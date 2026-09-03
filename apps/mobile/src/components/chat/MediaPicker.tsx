import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

interface MediaPickerProps {
  visible: boolean;
  onSend: (uri: string) => void;
  onCancel: () => void;
}

export function MediaPicker({ visible, onSend, onCancel }: MediaPickerProps) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  if (!visible) return null;

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      setPreviewUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      setPreviewUri(result.assets[0].uri);
    }
  };

  const handleSend = async () => {
    if (!previewUri) return;
    setIsSending(true);
    try {
      onSend(previewUri);
      setPreviewUri(null);
    } catch {
      Alert.alert('Error', 'Failed to send image');
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    setPreviewUri(null);
    onCancel();
  };

  // Preview mode
  if (previewUri) {
    return (
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={() => setPreviewUri(null)} style={styles.previewAction}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            <Text style={styles.previewActionText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.previewTitle}>Preview</Text>
          <TouchableOpacity
            onPress={handleSend}
            disabled={isSending}
            style={[styles.sendPreviewBtn, isSending && styles.sendPreviewBtnDisabled]}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <Ionicons name="send" size={20} color={Colors.textPrimary} />
            )}
          </TouchableOpacity>
        </View>
        <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
      </Animated.View>
    );
  }

  // Selection mode
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.container}>
      <View style={styles.optionsRow}>
        <TouchableOpacity style={styles.optionBtn} onPress={takePhoto} activeOpacity={0.7}>
          <View style={styles.optionIcon}>
            <Ionicons name="camera" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.optionText}>Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionBtn} onPress={pickFromGallery} activeOpacity={0.7}>
          <View style={styles.optionIcon}>
            <Ionicons name="images" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.optionText}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionBtn} onPress={handleCancel} activeOpacity={0.7}>
          <View style={[styles.optionIcon, { backgroundColor: Colors.errorMuted }]}>
            <Ionicons name="close" size={28} color={Colors.error} />
          </View>
          <Text style={[styles.optionText, { color: Colors.error }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  optionBtn: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  previewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewActionText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
  },
  previewTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  sendPreviewBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendPreviewBtnDisabled: {
    opacity: 0.5,
  },
  previewImage: {
    flex: 1,
    margin: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
});
