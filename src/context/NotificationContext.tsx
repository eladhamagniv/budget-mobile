import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import {
  collection, query, where,
  onSnapshot, setDoc, updateDoc, getDocs, doc, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MOCK_USERS } from './AuthContext';
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
  message: string;
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

  const push = (toUserId: string, fromName: string, message: string, fromUserId = '') => {
    const notif: AppNotification = {
      id: `N-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      toUserId, fromUserId, fromName, message, read: false,
      timestamp: new Date().toISOString(),
    };
    setNotifs(prev => [notif, ...prev]);
    setLastActivity(Date.now());
    setDoc(doc(db, 'notifications', notif.id), notif).catch(() => {});
  };

  const pushToRole = (role: string, fromName: string, message: string, fromUserId = '') => {
    MOCK_USERS.filter(u => u.role === role).forEach(u => push(u.username, fromName, message, fromUserId));
  };

  const applyNotif = (notif: AppNotification, showSysNotif: boolean) => {
    setNotifs(prev => {
      if (prev.find(n => n.id === notif.id)) return prev;
      return [notif, ...prev];
    });
    setLastActivity(Date.now());
    if (showSysNotif) showSystemNotif(notif.fromName, notif.message);
  };

  const updateNotif = (notif: AppNotification) => {
    setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, ...notif } : n));
    setLastActivity(Date.now());
  };

  const subscribeToFirestore = (username: string): Unsubscribe => {
    // ── Received (toUserId === username) ──────────────────────────────────────
    let initReceived = true;
    const unsubReceived = onSnapshot(
      query(collection(db, 'notifications'), where('toUserId', '==', username)),
      (snapshot) => {
        if (initReceived) {
          setNotifs(prev => {
            const ids = new Set(prev.map(n => n.id));
            const fresh = snapshot.docs.map(d => d.data() as AppNotification).filter(n => !ids.has(n.id));
            return [...prev, ...fresh];
          });
          initReceived = false;
          return;
        }
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added')    applyNotif(change.doc.data() as AppNotification, (change.doc.data() as AppNotification).fromUserId !== username);
          if (change.type === 'modified') updateNotif(change.doc.data() as AppNotification);
        });
      }, () => {},
    );

    // ── Sent (fromUserId === username) — chat history + seen updates ──────────
    let initSent = true;
    const unsubSent = onSnapshot(
      query(collection(db, 'notifications'), where('fromUserId', '==', username)),
      (snapshot) => {
        if (initSent) {
          setNotifs(prev => {
            const ids = new Set(prev.map(n => n.id));
            const fresh = snapshot.docs.map(d => d.data() as AppNotification).filter(n => !ids.has(n.id));
            return [...prev, ...fresh];
          });
          initSent = false;
          return;
        }
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added')    applyNotif(change.doc.data() as AppNotification, false);
          if (change.type === 'modified') updateNotif(change.doc.data() as AppNotification); // seen ✓✓
        });
      }, () => {},
    );

    return () => { unsubReceived(); unsubSent(); };
  };

  // Called when recipient opens a chat — marks messages as seen in Firestore
  const markConversationSeen = (fromUserId: string, toUserId: string) => {
    // Update local state immediately
    setNotifs(prev => prev.map(n =>
      n.fromUserId === fromUserId && n.toUserId === toUserId && !n.read
        ? { ...n, read: true }
        : n,
    ));
    // Update Firestore in background so sender's listener gets the modified event
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
