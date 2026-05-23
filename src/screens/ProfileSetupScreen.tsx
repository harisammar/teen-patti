import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../hooks/useAuth';
import { COLORS, AVATARS } from '../utils/constants';

export default function ProfileSetupScreen() {
  const { completeProfileSetup, signOut } = useAuth();

  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }
    setNameError('');
    setSaving(true);
    try {
      if (photoUri) {
        try {
          await completeProfileSetup(trimmed, selectedAvatar, photoUri);
        } catch (uploadErr) {
          // Photo upload failed — save profile without photo so user isn't blocked
          await completeProfileSetup(trimmed, selectedAvatar, undefined);
          Alert.alert(
            'Photo not saved',
            'Your profile was saved but the photo upload failed. You can try adding a photo later from Profile settings.',
          );
        }
      } else {
        await completeProfileSetup(trimmed, selectedAvatar, undefined);
      }
      // AppNavigator automatically routes to Home once profileComplete = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save profile.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <LinearGradient colors={['#0d2b1a', '#1a4a2e', '#0d2b1a']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.cardSymbols}>♠ ♥ ♦ ♣</Text>
              <Text style={styles.title}>Welcome!</Text>
              <Text style={styles.subtitle}>Set up your profile before playing</Text>
            </View>

            {/* Photo + Avatar display */}
            <View style={styles.avatarSection}>
              {/* Profile photo (if chosen) or emoji avatar */}
              <View style={styles.avatarRing}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.profilePhoto} />
                ) : (
                  <Text style={styles.avatarEmoji}>{selectedAvatar}</Text>
                )}
                <TouchableOpacity style={styles.cameraBtn} onPress={pickPhoto}>
                  <Text style={styles.cameraBtnIcon}>📷</Text>
                </TouchableOpacity>
              </View>

              {/* Photo picker row */}
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoPickerBtn} onPress={pickPhoto}>
                  <Text style={styles.photoPickerText}>
                    {photoUri ? '✓ Photo selected — tap to change' : 'Add profile photo (optional)'}
                  </Text>
                </TouchableOpacity>
                {photoUri && (
                  <TouchableOpacity onPress={() => setPhotoUri(null)} style={styles.removePhotoBtn}>
                    <Text style={styles.removePhotoText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Form card */}
            <View style={styles.card}>
              {/* Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  style={[styles.input, nameError ? styles.inputError : null]}
                  value={name}
                  onChangeText={(t) => { setName(t); setNameError(''); }}
                  placeholder="What should others call you?"
                  placeholderTextColor={COLORS.textMuted}
                  autoCorrect={false}
                  autoCapitalize="words"
                  maxLength={24}
                />
                {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
              </View>

              {/* Emoji Avatar picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Choose Avatar</Text>
                <View style={styles.avatarGrid}>
                  {AVATARS.map((avatar) => (
                    <TouchableOpacity
                      key={avatar}
                      style={[
                        styles.avatarBtn,
                        selectedAvatar === avatar && !photoUri && styles.avatarBtnSelected,
                      ]}
                      onPress={() => setSelectedAvatar(avatar)}
                    >
                      <Text style={styles.avatarBtnEmoji}>{avatar}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {photoUri && (
                  <Text style={styles.avatarNote}>
                    Profile photo takes priority. Avatar used as fallback.
                  </Text>
                )}
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.background} />
                ) : (
                  <Text style={styles.saveBtnText}>Let's Play! ♠</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Sign out escape hatch */}
            <TouchableOpacity style={styles.cancelLink} onPress={() => signOut()}>
              <Text style={styles.cancelLinkText}>Sign out</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: { alignItems: 'center', marginBottom: 24 },
  cardSymbols: {
    fontSize: 26,
    color: COLORS.gold,
    letterSpacing: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Avatar section
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.tableGreen,
    borderWidth: 3,
    borderColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profilePhoto: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  avatarEmoji: { fontSize: 56 },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  cameraBtnIcon: { fontSize: 15 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoPickerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  photoPickerText: { color: COLORS.textSecondary, fontSize: 13 },
  removePhotoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  removePhotoText: { color: COLORS.textMuted, fontSize: 13 },

  // Form
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldGroup: { marginBottom: 20 },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: COLORS.white,
    fontSize: 16,
  },
  inputError: { borderColor: COLORS.danger },
  errorText: { color: COLORS.danger, fontSize: 12, marginTop: 4 },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.inputBg,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBtnSelected: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.tableGreen,
  },
  avatarBtnEmoji: { fontSize: 26 },
  avatarNote: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },
  saveBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cancelLink: { alignItems: 'center', marginTop: 20 },
  cancelLinkText: { color: COLORS.textMuted, fontSize: 14 },
});
