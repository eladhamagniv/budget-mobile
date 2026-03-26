import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { AppNotification } from '../context/NotificationContext';
import { USERS, UserEntry } from '../config/users';
import { T } from '../theme';

type MockUser = UserEntry;

const ROLE_LABEL: Record<string, string> = {
  kazin: 'קצין תקציבים', samaog: 'סמאו"ג', maog: 'מאו"ג',
  machat_900: 'מח"ט 900', samachat_900: 'סמח"ט 900',
  kas_900: 'קה"ס 900', klach_646: 'קלח"ק 646',
  klach_179: 'קלח"ק 179', klach_11: 'קלח"ק 11',
  smfaked: 'סמפ"ד', admin: 'מנהל',
};

function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const letter = name.trim().slice(-1); // last char (RTL — usually first visible)
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue},45%,28%)` }]}>
      <Text style={[av.letter, { fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: '#fff', fontWeight: '700' },
});

// ── User list row ─────────────────────────────────────────────────────────────
function UserRow({ u, last, unread, onPress }: {
  u: MockUser; last: AppNotification | null; unread: number; onPress: () => void;
}) {
  const time = last
    ? new Date(last.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : '';
  return (
    <TouchableOpacity style={r.row} onPress={onPress} activeOpacity={0.75}>
      <View style={r.left}>
        {unread > 0
          ? <View style={r.badge}><Text style={r.badgeText}>{unread}</Text></View>
          : <View style={r.badgeEmpty} />}
        <Text style={r.time}>{time}</Text>
      </View>
      <View style={r.mid}>
        <Text style={r.lastMsg} numberOfLines={1}>
          {last ? last.message : <Text style={r.noMsg}>אין הודעות עדיין</Text>}
        </Text>
        <Text style={r.role}>{ROLE_LABEL[u.role] ?? u.role}</Text>
        <Text style={r.name}>{u.displayName}</Text>
      </View>
      <Avatar name={u.displayName} />
    </TouchableOpacity>
  );
}
const r = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  mid:  { flex: 1 },
  name: { color: T.text, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  role: { color: T.textMuted, fontSize: 11, textAlign: 'right', marginTop: 1 },
  lastMsg: { color: T.textSec, fontSize: 12, textAlign: 'right', marginTop: 3 },
  noMsg: { color: T.textMuted, fontStyle: 'italic' } as any,
  left: { alignItems: 'center', gap: 4, minWidth: 36 },
  time: { color: T.textMuted, fontSize: 10 },
  badge: { backgroundColor: T.gold, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: T.bg, fontSize: 11, fontWeight: '800' },
  badgeEmpty: { width: 20, height: 20 },
});

// ── Chat bubble ───────────────────────────────────────────────────────────────
function Bubble({ notif, isMe }: { notif: AppNotification; isMe: boolean }) {
  const time = new Date(notif.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[b.wrap, isMe ? b.wrapMe : b.wrapThem]}>
      <View style={[b.bubble, isMe ? b.bubbleMe : b.bubbleThem]}>
        <Text style={[b.text, isMe ? b.textMe : b.textThem]}>{notif.message}</Text>
        <View style={b.metaRow}>
          {isMe && (
            <Text style={[b.ticks, notif.read ? b.ticksSeen : b.ticksSent]}>
              {notif.read ? '✓✓' : '✓'}
            </Text>
          )}
          <Text style={[b.time, isMe ? b.timeMe : b.timeThem]}>{time}</Text>
        </View>
      </View>
    </View>
  );
}
const b = StyleSheet.create({
  wrap:     { paddingHorizontal: 12, marginVertical: 3 },
  wrapMe:   { alignItems: 'flex-end' },
  wrapThem: { alignItems: 'flex-start' },
  bubble:   { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMe:   { backgroundColor: T.gold, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border, borderBottomLeftRadius: 4 },
  text:   { fontSize: 14, lineHeight: 20, textAlign: 'right' },
  textMe: { color: T.bg, fontWeight: '500' },
  textThem: { color: T.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  ticks:   { fontSize: 11 },
  ticksSent: { color: T.bg + '99' },
  ticksSeen: { color: T.bg },
  time:   { fontSize: 10, textAlign: 'right' },
  timeMe: { color: T.bg + 'bb' },
  timeThem: { color: T.textMuted },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export function NotificationsScreen() {
  const { user } = useAuth();
  const { push, getConversation, getUnreadFrom, getLastMessage, markConversationSeen, lastActivity } = useNotifications();

  const [chatWith, setChatWith] = useState<MockUser | null>(null);
  const [search, setSearch] = useState('');
  const [messageText, setMessageText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const otherUsers = useMemo(
    () => (user ? USERS.filter(u => u.username !== user.username) : []),
    [user?.username],
  );

  // Re-sorts whenever any message arrives (lastActivity bumps on every push/receive)
  const filteredUsers = useMemo(() => {
    if (!user) return [];
    const q = search.trim();
    const list = q
      ? otherUsers.filter(u =>
          u.displayName.includes(q) ||
          u.username.toLowerCase().includes(q.toLowerCase()) ||
          (ROLE_LABEL[u.role] ?? '').includes(q),
        )
      : otherUsers;
    return [...list].sort((a, b) => {
      const la = getLastMessage(user.username, a.username);
      const lb = getLastMessage(user.username, b.username);
      if (!la && !lb) return 0;
      if (!la) return 1;
      if (!lb) return -1;
      return lb.timestamp.localeCompare(la.timestamp);
    });
  }, [search, lastActivity, otherUsers]);

  // Mark as seen whenever new messages arrive while chat is open
  useEffect(() => {
    if (chatWith && user) markConversationSeen(chatWith.username, user.username);
  }, [lastActivity, chatWith?.username]);

  if (!user) return null;

  const conversation = chatWith
    ? getConversation(user.username, chatWith.username)
    : [];

  const openChat = (u: MockUser) => {
    setChatWith(u);
    markConversationSeen(u.username, user.username);
  };

  const sendMessage = () => {
    if (!messageText.trim() || !chatWith) return;
    push(chatWith.username, user.displayName, messageText.trim(), user.username);
    setMessageText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Chat view ────────────────────────────────────────────────────────────────
  if (chatWith) {
    return (
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Chat header */}
        <View style={s.chatHeader}>
          <TouchableOpacity style={s.backBtn} onPress={() => setChatWith(null)} activeOpacity={0.7}>
            <Text style={s.backText}>→ חזרה</Text>
          </TouchableOpacity>
          <View style={s.chatHeaderInfo}>
            <Text style={s.chatHeaderName}>{chatWith.displayName}</Text>
            <Text style={s.chatHeaderRole}>{ROLE_LABEL[chatWith.role] ?? chatWith.role}</Text>
          </View>
          <Avatar name={chatWith.displayName} size={34} />
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={s.messagesScroll}
          contentContainerStyle={s.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {conversation.length === 0 ? (
            <Text style={s.noMessages}>אין הודעות עדיין — שלח הודעה ראשונה</Text>
          ) : (
            conversation.map(n => (
              <Bubble key={n.id} notif={n} isMe={n.fromUserId === user.username} />
            ))
          )}
        </ScrollView>

        {/* Input */}
        <View style={s.inputRow}>
          <TouchableOpacity style={s.sendBtn} onPressIn={sendMessage} activeOpacity={0.85}>
            <Text style={s.sendBtnText}>➤</Text>
          </TouchableOpacity>
          <TextInput
            style={s.input}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="כתוב הודעה..."
            placeholderTextColor={T.textMuted}
            textAlign="right"
            multiline
            onSubmitEditing={sendMessage}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── User list view ───────────────────────────────────────────────────────────
  return (
    <View style={s.flex}>
      <View style={s.searchBar}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="חפש שם, תפקיד..."
          placeholderTextColor={T.textMuted}
          textAlign="right"
        />
      </View>
      <ScrollView style={s.flex} keyboardShouldPersistTaps="handled">
        {filteredUsers.map(u => (
          <UserRow
            key={u.username}
            u={u}
            last={getLastMessage(user.username, u.username)}
            unread={getUnreadFrom(user.username, u.username)}
            onPress={() => openChat(u)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.bg },

  searchBar: {
    backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: {
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    borderRadius: T.r, paddingHorizontal: 12, paddingVertical: 9,
    color: T.text, fontSize: 14,
  },

  chatHeader: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
    backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { color: T.text, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  chatHeaderRole: { color: T.textMuted, fontSize: 11, textAlign: 'right', marginTop: 1 },
  backBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: T.surface2, borderRadius: T.r, borderWidth: 1, borderColor: T.border },
  backText: { color: T.gold, fontSize: 12, fontWeight: '700' },

  messagesScroll: { flex: 1 },
  messagesContent: { paddingVertical: 12, paddingBottom: 20 },
  noMessages: { color: T.textMuted, textAlign: 'center', marginTop: 60, fontSize: 13 },

  inputRow: {
    flexDirection: 'row-reverse', gap: 8, alignItems: 'flex-end',
    backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  input: {
    flex: 1, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    color: T.text, fontSize: 14, maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: T.gold, borderRadius: 22,
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnText: { color: T.bg, fontWeight: '800', fontSize: 18, marginLeft: -2 },
});
