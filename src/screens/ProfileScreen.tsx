import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  ActionSheetIOS,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../hooks/useAuth';
import { uploadProfilePicture } from '../services/storageService';
import { COLORS, AVATARS } from '../utils/constants';

export default function ProfileScreen() {
  const { user, updateProfile, signOut, isLoading } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name ?? '');
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  if (!user) return null;

  const winRate =
    user.gamesPlayed > 0
      ? Math.round((user.gamesWon / user.gamesPlayed) * 100)
      : 0;

  async function pickAndUploadPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets.length) return;

    setUploadingPhoto(true);
    try {
      const url = await uploadProfilePicture(user.uid, result.assets[0].uri);
      await updateProfile({ photoURL: url });
    } catch {
      Alert.alert('Upload failed', 'Could not upload photo. Make sure Firebase Storage is set up.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function removePhoto() {
    try {
      await updateProfile({ photoURL: undefined });
    } catch {
      Alert.alert('Error', 'Could not remove photo.');
    }
  }

  function handleAvatarPress() {
    if (Platform.OS === 'ios') {
      const options = user.photoURL
        ? ['Change Photo', 'Remove Photo', 'Change Avatar Emoji', 'Cancel']
        : ['Add Profile Photo', 'Change Avatar Emoji', 'Cancel'];
      const destructiveIndex = user.photoURL ? 1 : -1;
      const cancelIndex = user.photoURL ? 3 : 2;

      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex },
        (idx) => {
          if (user.photoURL) {
            if (idx === 0) pickAndUploadPhoto();
            else if (idx === 1) removePhoto();
            else if (idx === 2) { setPickingAvatar(true); }
          } else {
            if (idx === 0) pickAndUploadPhoto();
            else if (idx === 1) { setPickingAvatar(true); }
          }
        },
      );
    } else {
      // Android fallback — just open picker directly
      pickAndUploadPhoto();
    }
  }

  async function handleSaveName() {
    if (newName.trim().length < 2) {
      Alert.alert('Invalid Name', 'Name must be at least 2 characters.');
      return;
    }
    try {
      await updateProfile({ name: newName.trim() });
      setEditingName(false);
    } catch {
      Alert.alert('Error', 'Could not update name.');
    }
  }

  async function handleSelectAvatar(avatar: string) {
    try {
      await updateProfile({ avatar });
      setPickingAvatar(false);
    } catch {
      Alert.alert('Error', 'Could not update avatar.');
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar / photo section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={handleAvatarPress}
            disabled={uploadingPhoto}
          >
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.profilePhoto} />
            ) : (
              <Text style={styles.avatarText}>{user.avatar}</Text>
            )}
            <View style={styles.editAvatarBadge}>
              {uploadingPhoto
                ? <ActivityIndicator size="small" color={COLORS.background} />
                : <Text style={styles.editAvatarIcon}>📷</Text>
              }
            </View>
          </TouchableOpacity>

          {/* Hint under the circle */}
          <Text style={styles.avatarHint}>
            {uploadingPhoto ? 'Uploading…' : 'Tap to change photo or avatar'}
          </Text>

          {/* Emoji avatar picker (shown after tapping "Change Avatar Emoji") */}
          {pickingAvatar && (
            <View style={styles.avatarPicker}>
              {AVATARS.map((avatar) => (
                <TouchableOpacity
                  key={avatar}
                  style={[
                    styles.avatarOption,
                    user.avatar === avatar && styles.avatarOptionSelected,
                  ]}
                  onPress={() => handleSelectAvatar(avatar)}
                >
                  <Text style={styles.avatarOptionText}>{avatar}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.avatarCancelBtn}
                onPress={() => setPickingAvatar(false)}
              >
                <Text style={styles.avatarCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Name */}
          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                maxLength={24}
                placeholder="Your name"
                placeholderTextColor={COLORS.textMuted}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName}>
                {isLoading ? (
                  <ActivityIndicator color={COLORS.background} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setEditingName(false); setNewName(user.name); }}
              >
                <Text style={styles.cancelBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.nameRow} onPress={() => setEditingName(true)}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          )}

          {!!user.email && <Text style={styles.userEmail}>{user.email}</Text>}
          {!!user.phone && <Text style={styles.userEmail}>{user.phone}</Text>}
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard label="Total Points" value={user.totalPoints.toLocaleString()} icon="💰" highlight />
          <StatCard label="Games Played" value={String(user.gamesPlayed)} icon="🃏" />
          <StatCard label="Games Won" value={String(user.gamesWon)} icon="🏆" />
          <StatCard label="Win Rate" value={`${winRate}%`} icon="📈" />
          <StatCard label="Sessions Won" value={String(user.sessionsWon)} icon="🎯" />
          <StatCard label="Biggest Pot" value={user.biggestPot.toLocaleString()} icon="💎" />
        </View>

        {/* Privacy Policy */}
        <TouchableOpacity
          style={styles.privacyBtn}
          onPress={() => Linking.openURL('https://harisammar.github.io/teen-patti/privacy.html')}
          activeOpacity={0.7}
        >
          <Text style={styles.privacyText}>Privacy Policy</Text>
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label, value, icon, highlight,
}: {
  label: string; value: string; icon: string; highlight?: boolean;
}) {
  return (
    <View style={[statStyles.card, highlight && statStyles.cardHighlight]}>
      <Text style={statStyles.icon}>{icon}</Text>
      <Text style={[statStyles.value, highlight && statStyles.valueHighlight]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHighlight: { borderColor: COLORS.gold, backgroundColor: '#1e3a2a' },
  icon: { fontSize: 24, marginBottom: 6 },
  value: { color: COLORS.white, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  valueHighlight: { color: COLORS.gold },
  label: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.tableGreen,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.gold,
    marginBottom: 6,
    overflow: 'hidden',
  },
  profilePhoto: { width: 96, height: 96, borderRadius: 48 },
  avatarText: { fontSize: 50 },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  editAvatarIcon: { fontSize: 13 },
  avatarHint: { color: COLORS.textMuted, fontSize: 12, marginBottom: 10 },

  avatarPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarOptionSelected: { borderColor: COLORS.gold, backgroundColor: COLORS.tableGreen },
  avatarOptionText: { fontSize: 26 },
  avatarCancelBtn: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  avatarCancelText: { color: COLORS.textMuted, fontSize: 13 },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { color: COLORS.white, fontSize: 22, fontWeight: '700' },
  editIcon: { fontSize: 14, opacity: 0.6 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  nameInput: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.white,
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: { color: COLORS.background, fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: { color: COLORS.textMuted, fontSize: 14 },
  userEmail: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  privacyBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
  privacyText: { color: COLORS.textMuted, fontSize: 13, textDecorationLine: 'underline' },
  signOutBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
