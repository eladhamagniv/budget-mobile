import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../theme';

interface Props {
  onSuccess: () => void;
  onFallback: () => void; // called when biometrics unavailable → force logout/re-login
  username: string;
}

export function BiometricScreen({ onSuccess, onFallback, username }: Props) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error' | 'unavailable'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    checkAndPrompt();
  }, []);

  function startPulse() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }

  async function checkAndPrompt() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled  = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      // Device has no biometric or none enrolled — fall back (force re-login)
      setStatus('unavailable');
      return;
    }
    promptBiometric();
  }

  async function promptBiometric() {
    setStatus('scanning');
    setErrorMsg('');
    startPulse();

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'אמת זהות כדי להמשיך',
      cancelLabel: 'ביטול',
      fallbackLabel: '',          // hide fallback PIN — we force biometric only
      disableDeviceFallback: true, // biometric only, no device PIN fallback
    });

    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);

    if (result.success) {
      setStatus('idle');
      onSuccess();
    } else {
      setStatus('error');
      if (result.error === 'user_cancel') {
        setErrorMsg('יש לאמת טביעת אצבע כדי להמשיך');
      } else if (result.error === 'lockout' || result.error === 'lockout_permanent') {
        setErrorMsg('הגישה לטביעת אצבע נחסמה. הפעל מחדש את המכשיר ונסה שוב');
      } else {
        setErrorMsg('אימות נכשל. נסה שוב');
      }
    }
  }

  return (
    <Animated.View style={[s.container, { opacity: fadeAnim }]}>
      <View style={s.inner}>
        <Text style={s.title}>מטבע הבזק</Text>
        <View style={s.titleLine} />
        <Text style={s.subtitle}>אימות טביעת אצבע נדרש</Text>

        {status === 'unavailable' ? (
          <>
            <View style={s.unavailableBox}>
              <Ionicons name="warning-outline" size={32} color="#F59E0B" />
              <Text style={s.unavailableText}>
                טביעת אצבע אינה זמינה במכשיר זה.{'\n'}
                יש להגדיר טביעת אצבע בהגדרות המכשיר ולנסות שוב.
              </Text>
            </View>
            <TouchableOpacity style={s.retryBtn} onPress={onFallback} activeOpacity={0.85}>
              <Text style={s.retryText}>חזרה להתחברות</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={status !== 'scanning' ? promptBiometric : undefined}
            >
              <Animated.View style={[s.fingerprintRing, { transform: [{ scale: pulseAnim }] }]}>
                <View style={s.fingerprintInner}>
                  {status === 'scanning' ? (
                    <ActivityIndicator size="large" color={T.gold} />
                  ) : (
                    <Ionicons
                      name="finger-print-outline"
                      size={56}
                      color={status === 'error' ? T.danger : T.gold}
                    />
                  )}
                </View>
              </Animated.View>
            </TouchableOpacity>

            <Text style={s.hint}>
              {status === 'scanning'
                ? 'סורק...'
                : status === 'error'
                ? 'הקש כדי לנסות שוב'
                : 'הקש על סמל טביעת האצבע'}
            </Text>

            {status === 'error' && errorMsg ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {status === 'error' && (
              <TouchableOpacity style={s.retryBtn} onPress={promptBiometric} activeOpacity={0.85}>
                <Ionicons name="finger-print-outline" size={18} color={T.bg} style={{ marginRight: 6 }} />
                <Text style={s.retryText}>נסה שוב</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    width: '85%',
    alignItems: 'center',
  },
  title: {
    color: T.gold,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
  },
  titleLine: {
    width: 40,
    height: 2,
    backgroundColor: T.gold,
    borderRadius: 2,
    opacity: 0.6,
    marginBottom: 10,
  },
  subtitle: {
    color: T.textMuted,
    fontSize: 14,
    letterSpacing: 0.5,
    marginBottom: 48,
    textAlign: 'center',
  },
  fingerprintRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: T.gold + '44',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  fingerprintInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    color: T.textSec,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: T.dangerBg,
    borderWidth: 1,
    borderColor: T.danger,
    borderRadius: T.r,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: T.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  unavailableBox: {
    backgroundColor: '#1a1700',
    borderWidth: 1,
    borderColor: '#F59E0B44',
    borderRadius: T.r,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  unavailableText: {
    color: '#F59E0B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: T.gold,
    borderRadius: T.r,
    paddingVertical: 13,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  retryText: {
    color: T.bg,
    fontSize: 15,
    fontWeight: '700',
  },
});
