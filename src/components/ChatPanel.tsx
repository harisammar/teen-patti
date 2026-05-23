import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { sendMessage } from '../services/chatService';
import { ChatMessage } from '../types';
import { COLORS } from '../utils/constants';

interface ChatPanelProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
}

export default function ChatPanel({ visible, onClose, roomId }: ChatPanelProps) {
  const { messages } = useGameStore();
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (visible && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, visible]);

  async function handleSend() {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    const msg = text.trim();
    setText('');
    try {
      await sendMessage(roomId, user.uid, user.name, msg);
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isOwn = item.senderId === user?.uid;
    const isSystem = item.type === 'system';
    const isEmote = item.type === 'emote';

    if (isSystem) {
      return (
        <View style={msgStyles.systemRow}>
          <Text style={msgStyles.systemText}>{item.text}</Text>
        </View>
      );
    }

    if (isEmote) {
      return (
        <View style={msgStyles.emoteRow}>
          <Text style={msgStyles.emoteEmoji}>{item.text}</Text>
          <Text style={msgStyles.emoteSender}>{item.senderName}</Text>
        </View>
      );
    }

    return (
      <View style={[msgStyles.messageRow, isOwn && msgStyles.messageRowOwn]}>
        {!isOwn && (
          <Text style={msgStyles.senderName}>{item.senderName}</Text>
        )}
        <View style={[msgStyles.bubble, isOwn && msgStyles.bubbleOwn]}>
          <Text style={[msgStyles.bubbleText, isOwn && msgStyles.bubbleTextOwn]}>
            {item.text}
          </Text>
        </View>
        <Text style={msgStyles.timestamp}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheet}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>💬 Chat</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No messages yet. Say something!</Text>
            }
            showsVerticalScrollIndicator={false}
          />

          {/* Input */}
          <SafeAreaView edges={['bottom']} style={styles.inputArea}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="Type a message..."
                placeholderTextColor={COLORS.textMuted}
                multiline={false}
                maxLength={200}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!text.trim() || sending}
              >
                <Text style={styles.sendBtnText}>↑</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const msgStyles = StyleSheet.create({
  systemRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  systemText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  emoteRow: { alignItems: 'center', paddingVertical: 6 },
  emoteEmoji: { fontSize: 36 },
  emoteSender: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  messageRow: { marginVertical: 3 },
  messageRowOwn: { alignItems: 'flex-end' },
  senderName: { color: COLORS.textMuted, fontSize: 11, marginBottom: 2, marginLeft: 4 },
  bubble: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '80%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bubbleOwn: {
    backgroundColor: COLORS.tableGreen,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 4,
    borderColor: COLORS.gold + '44',
  },
  bubbleText: { color: COLORS.white, fontSize: 14 },
  bubbleTextOwn: { color: COLORS.white },
  timestamp: { color: COLORS.textMuted, fontSize: 10, marginTop: 2, marginHorizontal: 4 },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '70%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { color: COLORS.textMuted, fontSize: 14 },
  messageList: { paddingHorizontal: 16, paddingVertical: 8 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 20, fontSize: 14 },
  inputArea: { borderTopWidth: 1, borderTopColor: COLORS.border },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.white,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: COLORS.background, fontSize: 18, fontWeight: '700' },
});
