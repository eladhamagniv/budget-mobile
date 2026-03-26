import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import {
  collection, query, where,
  onSnapshot, setDoc, updateDoc, getDocs, doc, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getUsersByRole } from '../config/users';
import { encryptMessage, decryptMessage } from '../services/cryptoService';
import { UserProfile } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowList: true,
  }),
});

export interface AppNotification {
  id: string;
  toUserId: string;
  fromUserId: string;
  fromName: string;
  message: string;  // plaintext in memory; ciphertext in Firestore
  read: boolean;
  timestamp: string;
}

interface NotifCtxType {
  push: (toUserId: string, fromName: string, message: string, fromUserId?: string) => void;
  pushToRole: (role: string, fromName: string, message: string, fromUserId?: string) => void;
  markRead: (id: string) => void;
  markAllRead: (userId: string) => void;
  myNotifs: (userId: string) => AppNotification[];
  unreadCount: (userId: string) => number;
  getConversation: (meId: string, otherId: string) => AppNotification[];
  getUnreadFrom: (meId: string, otherId: string) => number;
  getLastMessage: (meId: string, otherId: string) => AppNotification | null;
  lastActivity: number;
  markConversationSeen: (fromUserId: string, toUserId: string) => void;
  initForUser: (user: UserProfile) => void;
  subscribeToFirestore: (username: string) => Unsubscribe;
  requestPermission: () => Promise<void>;
}

const NotifCtx = createContext<NotifCtxType | undefined>(undefined);

async function showSystemNotif(fromName: string, message: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: `הודעה מ-${fromName}`, body: message, sound: 'default' },
      trigger: null,
    });
  } catch {}
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [lastActivity, setLastActivity] = useState(0);
  const initializedUsers = useRef<Set<string>>(new Set());
  // Tracks the currently logged-in user for decryption
  const myUserIdRef = useRef<string>('');

  const requestPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Notifications.setNotificationChannelAsync('default', {
        name: 'הודעות מערכת',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    } catch {}
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Decrypts the `message` field of a raw Firestore notification.
   * The "other user" for ECDH key derivation is always the party
   * that is NOT the current user.
   */
  const decryptNotif = async (raw: AppNotification): Promise<AppNotification> => {
    if (!raw.message) return raw;
    try {
      const myId = myUserIdRef.current;
      const isSentByMe = raw.fromUserId === myId;
      const plaintext = await decryptMessage(
        raw.message,
        raw.fromUserId,
        raw.toUserId,
        isSentByMe,
      );
      return { ...raw, message: plaintext };
    } catch {
      return { ...raw, message: '[הודעה מוצפנת]' };
    }
  };

  const applyDecryptedNotif = async (raw: AppNotification, showSysNotif: boolean) => {
    const notif = await decryptNotif(raw);
    setNotifs(prev => {
      if (prev.find(n => n.id === notif.id)) return prev;
      return [notif, ...prev];
    });
    setLastActivity(Date.now());
    if (showSysNotif) showSystemNotif(notif.fromName, notif.message);
  };

  const updateNotif = (raw: AppNotification) => {
    // For seen-mark updates the message field hasn't changed; update read status only
    setNotifs(prev => prev.map(n =>
      n.id === raw.id ? { ...n, read: raw.read } : n,
    ));
    setLastActivity(Date.now());
  };

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Send a message to a single user.
   * The message is encrypted with ECDH before being written to Firestore.
   */
  const push = (toUserId: string, fromName: string, message: string, fromUserId = '') => {
    const notif: AppNotification = {
      id: `N-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      toUserId, fromUserId, fromName, message, read: false,
      timestamp: new Date().toISOString(),
    };
    // Optimistic local update (plaintext in memory)
    setNotifs(prev => [notif, ...prev]);
    setLastActivity(Date.now());

    // Encrypt for recipient, then persist to Firestore
    encryptMessage(message, toUserId, fromUserId)
      .then(ciphertext => {
        const firestoreDoc = { ...notif, message: ciphertext };
        return setDoc(doc(db, 'notifications', notif.id), firestoreDoc);
      })
      .catch(() => {
        // If encryption fails (e.g. recipient has no key yet), still store unencrypted
        // so the message is not silently dropped — but this should not happen in production.
        setDoc(doc(db, 'notifications', notif.id), notif).catch(() => {});
      });
  };

  /**
   * Broadcast a message to all users that hold a given role.
   */
  const pushToRole = (role: string, fromName: string, message: string, fromUserId = '') => {
    getUsersByRole(role).forEach(u => push(u.username, fromName, message, fromUserId));
  };

  /**
   * Subscribe to real-time Firestore updates for `username`.
   * Incoming messages are decrypted before being stored in state.
   */
  const subscribeToFirestore = (username: string): Unsubscribe => {
    myUserIdRef.current = username;

    // ── Received (toUserId === username) ──────────────────────────────────
    let initReceived = true;
    const unsubReceived = onSnapshot(
      query(collection(db, 'notifications'), where('toUserId', '==', username)),
      async (snapshot) => {
        if (initReceived) {
          initReceived = false;
          const rawDocs = snapshot.docs.map(d => d.data() as AppNotification);
          const decrypted = await Promise.all(rawDocs.map(decryptNotif));
          setNotifs(prev => {
            const ids = new Set(prev.map(n => n.id));
            return [...prev, ...decrypted.filter(n => !ids.has(n.id))];
          });
          return;
        }
        snapshot.docChanges().forEach(change => {
          const raw = change.doc.data() as AppNotification;
          if (change.type === 'added') {
            applyDecryptedNotif(raw, raw.fromUserId !== username);
          }
          if (change.type === 'modified') updateNotif(raw);
        });
      }, () => {},
    );

    // ── Sent (fromUserId === username) — chat history + seen updates ──────
    let initSent = true;
    const unsubSent = onSnapshot(
      query(collection(db, 'notifications'), where('fromUserId', '==', username)),
      async (snapshot) => {
        if (initSent) {
          initSent = false;
          const rawDocs = snapshot.docs.map(d => d.data() as AppNotification);
          const decrypted = await Promise.all(rawDocs.map(decryptNotif));
          setNotifs(prev => {
            const ids = new Set(prev.map(n => n.id));
            return [...prev, ...decrypted.filter(n => !ids.has(n.id))];
          });
          return;
        }
        snapshot.docChanges().forEach(change => {
          const raw = change.doc.data() as AppNotification;
          if (change.type === 'added') applyDecryptedNotif(raw, false);
          if (change.type === 'modified') updateNotif(raw); // seen ✓✓ update
        });
      }, () => {},
    );

    return () => { unsubReceived(); unsubSent(); };
  };

  // Called when recipient opens a chat — marks messages as seen in Firestore
  const markConversationSeen = (fromUserId: string, toUserId: string) => {
    setNotifs(prev => prev.map(n =>
      n.fromUserId === fromUserId && n.toUserId === toUserId && !n.read
        ? { ...n, read: true }
        : n,
    ));
    getDocs(query(collection(db, 'notifications'), where('toUserId', '==', toUserId)))
      .then(snap => {
        snap.docs
          .filter(d => d.data().fromUserId === fromUserId && !d.data().read)
          .forEach(d => updateDoc(d.ref, { read: true }).catch(() => {}));
      })
      .catch(() => {});
  };

  const markRead = (id: string) =>
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const markAllRead = (userId: string) =>
    setNotifs(prev => prev.map(n => n.toUserId === userId ? { ...n, read: true } : n));

  const myNotifs = (userId: string) =>
    notifs.filter(n => n.toUserId === userId);

  const unreadCount = (userId: string) =>
    notifs.filter(n => n.toUserId === userId && !n.read).length;

  const getConversation = (meId: string, otherId: string): AppNotification[] =>
    notifs
      .filter(n =>
        (n.toUserId === meId && n.fromUserId === otherId) ||
        (n.toUserId === otherId && n.fromUserId === meId),
      )
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const getUnreadFrom = (meId: string, otherId: string): number =>
    notifs.filter(n => n.toUserId === meId && n.fromUserId === otherId && !n.read).length;

  const getLastMessage = (meId: string, otherId: string): AppNotification | null => {
    const conv = getConversation(meId, otherId);
    return conv[conv.length - 1] ?? null;
  };

  const initForUser = (user: UserProfile) => {
    if (initializedUsers.current.has(user.username)) return;
    initializedUsers.current.add(user.username);
    myUserIdRef.current = user.username;
  };

  return (
    <NotifCtx.Provider value={{
      push, pushToRole, markRead, markAllRead, myNotifs, unreadCount,
      getConversation, getUnreadFrom, getLastMessage, lastActivity,
      markConversationSeen, initForUser, subscribeToFirestore, requestPermission,
    }}>
      {children}
    </NotifCtx.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotifCtx);
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider');
  return ctx;
}
