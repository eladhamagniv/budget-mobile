import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Animated, FlatList,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { USERS } from '../config/users';
import { T } from '../theme';

export function LoginScreen() {
  const { login, loading, error, lockoutSeconds } = useAuth();
  const [query, setQuery]         = useState('');
  const [selected, setSelected]   = useState<{ username: string; displayName: string } | null>(null);
  const [password, setPassword]   = useState('');
  const [showDrop, setShowDrop]   = useState(false);
  const [showPass, setShowPass]   = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(formAnim,   { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const anim = (val: Animated.Value, dy = 24) => ({
    opacity: val,
    transform: [{ translateY: val.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
  });

  const suggestions = query.trim().length > 0
    ? USERS.filter(u =>
        u.displayName.includes(query) ||
        u.username.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  const handleSelect = (u: typeof USERS[0]) => {
    setSelected({ username: u.username, displayName: u.displayName });
    setQuery(u.displayName);
    setShowDrop(false);
  };

  const isLocked = lockoutSeconds > 0;

  const handleLogin = () => {
    if (isLocked) return;
    const uname = selected?.username ?? query.trim();
    if (!uname || !password) return;
    login(uname, password);
  };

  const lockoutLabel = () => {
    if (lockoutSeconds >= 3600) {
      const h = Math.ceil(lockoutSeconds / 3600);
      return `חשבון נעול ל-${h} שעות`;
    }
    if (lockoutSeconds >= 60) {
      const m = Math.ceil(lockoutSeconds / 60);
      return `חשבון נעול ל-${m} דקות`;
    }
    return `חשבון נעול ל-${lockoutSeconds} שניות`;
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        <Animated.View style={[s.header, anim(headerAnim, -20)]}>
          <Text style={s.title}>מטבע הבזק</Text>
          <View style={s.titleUnderline} />
          <Text style={s.subtitle}>מערכת ניהול תקציב · אוגדה 99</Text>
        </Animated.View>

        <Animated.View style={[s.card, anim(formAnim)]}>
          <Text style={s.cardTitle}>כניסה למערכת</Text>

          <Text style={s.label}>שם משתמש</Text>
          <View>
            <TextInput
              style={s.input}
              value={query}
              onChangeText={v => { setQuery(v); setSelected(null); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)}
              placeholder="חפש שם או שם משתמש..."
              placeholderTextColor={T.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="right"
              editable={!isLocked}
            />
            {showDrop && suggestions.length > 0 && (
              <View style={s.dropdown}>
                {suggestions.map(u => (
                  <TouchableOpacity
                    key={u.username}
                    style={s.dropItem}
                    onPress={() => handleSelect(u)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.dropName}>{u.displayName}</Text>
                    <Text style={s.dropUsername}>{u.username}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <Text style={s.label}>סיסמה</Text>
          <View style={s.passwordRow}>
            <TextInput
              style={[s.input, s.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="הכנס סיסמה..."
              placeholderTextColor={T.textMuted}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="right"
              onFocus={() => setShowDrop(false)}
              editable={!isLocked}
            />
            <TouchableOpacity
              style={s.eyeBtn}
              onPress={() => setShowPass(v => !v)}
              activeOpacity={0.7}
            >
              <Text style={s.eyeIcon}>{showPass ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          {isLocked ? (
            <View style={s.lockBox}>
              <Text style={s.lockIcon}>🔒</Text>
              <Text style={s.lockText}>{lockoutLabel()}</Text>
            </View>
          ) : error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.loginBtn, (loading || isLocked) && s.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading || isLocked}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={T.bg} />
              : <Text style={s.loginBtnText}>{isLocked ? '🔒 נעול' : 'כניסה'}</Text>
            }
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, backgroundColor: T.bg },
  content:   { padding: T.pad, paddingBottom: 60 },

  header:         { alignItems: 'center', marginTop: 52, marginBottom: 32 },
  title:          { color: T.gold, fontSize: 32, fontWeight: '800', letterSpacing: 2 },
  titleUnderline: { width: 48, height: 2, backgroundColor: T.gold, borderRadius: 2, marginTop: 8, marginBottom: 10, opacity: 0.6 },
  subtitle:       { color: T.textMuted, fontSize: 13, letterSpacing: 0.5 },

  card: {
    backgroundColor: T.surface,
    borderRadius: T.r2,
    padding: 22,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 28,
  },
  cardTitle: { color: T.text, fontSize: 16, fontWeight: '700', textAlign: 'right', marginBottom: 18 },

  label: { color: T.textSec, fontSize: 12, fontWeight: '600', textAlign: 'right', marginBottom: 7, letterSpacing: 0.3 },
  input: {
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.r,
    paddingVertical: 13,
    paddingHorizontal: 14,
    color: T.text,
    fontSize: 15,
    marginBottom: 16,
    writingDirection: 'rtl',
  },

  passwordRow:  { flexDirection: 'row-reverse', alignItems: 'center' },
  passwordInput: { flex: 1, marginRight: 0 },
  eyeBtn:       { paddingHorizontal: 10, paddingBottom: 16 },
  eyeIcon:      { fontSize: 18 },

  dropdown: {
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.r,
    marginTop: -12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  dropName:    { color: T.text, fontSize: 14, fontWeight: '600' },
  dropUsername: { color: T.textMuted, fontSize: 11 },

  errorBox: {
    backgroundColor: T.dangerBg,
    borderWidth: 1,
    borderColor: T.danger,
    borderRadius: T.r,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { color: T.danger, fontSize: 13, textAlign: 'right' },

  lockBox: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: T.r,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  lockIcon: { fontSize: 18 },
  lockText: { color: '#f59e0b', fontSize: 13, fontWeight: '700', textAlign: 'right', flex: 1 },

  loginBtn:         { backgroundColor: T.gold, borderRadius: T.r, paddingVertical: 15, alignItems: 'center', marginTop: 2 },
  loginBtnDisabled: { opacity: 0.55 },
  loginBtnText:     { color: T.bg, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
});
