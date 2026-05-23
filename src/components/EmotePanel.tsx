import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { COLORS, EMOTES } from '../utils/constants';

interface EmotePanelProps {
  visible: boolean;
  onClose: () => void;
  onSelectEmote: (emote: string) => void;
}

export default function EmotePanel({ visible, onClose, onSelectEmote }: EmotePanelProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.panel}>
          <View style={styles.handle} />
          <Text style={styles.title}>Send Emote</Text>
          <View style={styles.grid}>
            {EMOTES.map((emote) => (
              <TouchableOpacity
                key={emote}
                style={styles.emoteBtn}
                onPress={() => onSelectEmote(emote)}
                activeOpacity={0.7}
              >
                <Text style={styles.emoteText}>{emote}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  emoteBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emoteText: { fontSize: 30 },
});
