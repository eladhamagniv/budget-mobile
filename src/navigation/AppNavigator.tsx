import React, { useRef, useState, useEffect, useMemo } from 'react';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Image as RNImage, I18nManager, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, ClipPath, Path, Image as SvgImage } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { UserProfile } from '../types';
import { T } from '../theme';
import { LoginScreen } from '../screens/LoginScreen';
import { BiometricScreen } from '../screens/BiometricScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { RequestsScreen } from '../screens/RequestsScreen';
import { MyBudgetScreen } from '../screens/MyBudgetScreen';
import { SetMasegeretScreen } from '../screens/SetMasegeretScreen';
import { ShiaimScreen } from '../screens/ShiaimScreen';
import { ProfitsScreen } from '../screens/ProfitsScreen';
import { WorkPlanScreen } from '../screens/WorkPlanScreen';
import { ProfitReportScreen } from '../screens/ProfitReportScreen';
import { BudgetViewScreen } from '../screens/BudgetViewScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { AdminScreen } from '../screens/AdminScreen';
import { MasheqScreen } from '../screens/MasheqScreen';
import { WisutimScreen } from '../screens/WisutimScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { AIInsightsScreen } from '../screens/AIInsightsScreen';
import { UnitUsageScreen } from '../screens/UnitUsageScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HATIVA_ICONS: Record<string, any> = {
  hativa_900: require('../../assets/hativot/hativa_900.png'),
  hativa_646: require('../../assets/hativot/hativa_646.png'),
  hativa_179: require('../../assets/hativot/hativa_179.png'),
  hativa_11:  require('../../assets/hativot/hativa_11.png'),
  ugda:       require('../../assets/hativot/ugda.png'),
};

function getHativaId(user: UserProfile): string | null {
  const { role, unitId } = user;
  if (role === 'kazin' || role === 'admin') return 'ugda';
  if (role === 'machat_900' || role === 'samachat_900' || role === 'kas_900') return 'hativa_900';
  if (role === 'klach_646') return 'hativa_646';
  if (role === 'klach_179') return 'hativa_179';
  if (role === 'klach_11')  return 'hativa_11';
  if (role === 'smfaked' && unitId && !unitId.startsWith('mifaog_')) return 'hativa_900';
  return null;
}

// Shield-shaped icon using SVG ClipPath.
// The image is zoomed 30% inside the SVG so the screenshot's white border
// is pushed outside the clip region — only the shield's black outline shows.
//
// Path follows a classic heraldic shield in a 44×50 viewport:
//   flat top → straight sides → quadratic curve meeting at bottom point
const SHIELD_PATH = 'M4 3 L40 3 L40 30 Q40 47 22 47 Q4 47 4 30 Z';

// Zoom factor: image rendered 30% larger, centered, to crop out white borders
const ZOOM = 1.30;
const W = 44, H = 50;
const IW = W * ZOOM;   // ~57
const IH = H * ZOOM;   // ~65
const IX = -(IW - W) / 2;  // ~-6.5
const IY = -(IH - H) / 2;  // ~-7.5

function ShieldIcon({ source, id }: { source: any; id: string }) {
  const asset = RNImage.resolveAssetSource(source);
  const uri = asset?.uri ?? '';
  const clipId = `sc_${id}`;
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={SHIELD_PATH} />
        </ClipPath>
      </Defs>
      <SvgImage
        href={uri}
        x={IX} y={IY} width={IW} height={IH}
        clipPath={`url(#${clipId})`}
        preserveAspectRatio="xMidYMid meet"
      />
    </Svg>
  );
}

interface Page { title: string; component: React.ComponentType<any>; }

function SwipeNavigator({ pages, hativaIcon, hativaId, notifTrigger }: { pages: Page[]; hativaIcon: any | null; hativaId: string | null; notifTrigger?: number }) {
  const scrollRef = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(0);
  const { logout } = useAuth();

  const goTo = (i: number) => {
    const x = I18nManager.isRTL ? (pages.length - 1 - i) * SCREEN_WIDTH : i * SCREEN_WIDTH;
    scrollRef.current?.scrollTo({ x, animated: true });
    setCurrent(i);
  };

  // Jump to notifications page (index 1) whenever a notification is tapped
  useEffect(() => {
    if (notifTrigger) goTo(1);
  }, [notifTrigger]);

  // Memoize page views — only re-created when pages array changes (login/logout),
  // NOT on every setCurrent call. This prevents heavy screens from re-rendering
  // just because the header title changed.
  const pageViews = useMemo(() =>
    pages.map((page, i) => {
      const Comp = page.component;
      return (
        <View key={i} style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <Comp />
        </View>
      );
    }),
    [pages],
  );

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.75}>
          <Text style={s.logoutText}>יציאה</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{pages[current].title}</Text>
        {hativaIcon && hativaId
          ? <ShieldIcon source={hativaIcon} id={hativaId} />
          : <View style={s.headerSpacer} />
        }
      </View>

      {/* Swipeable pages */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={e => {
          const raw = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          const page = I18nManager.isRTL ? pages.length - 1 - raw : raw;
          if (page !== current) setCurrent(page);
        }}
        style={s.pager}
        contentContainerStyle={{ flexGrow: 0 }}
      >
        {pageViews}
      </ScrollView>

      {/* Tab buttons */}
      <View style={s.dotsRow}>
        {pages.map((page, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => goTo(i)}
            activeOpacity={0.7}
            style={i === current ? s.dotActive : s.dot}
          >
            {i === current && <Text style={s.dotLabel}>{page.title}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

export function AppNavigator() {
  const { user, loading, biometricUnlocked, unlockBiometric, logout } = useAuth();
  const { unreadCount, subscribeToFirestore, requestPermission } = useNotifications();
  const [notifJump, setNotifJump] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    requestPermission();
    const unsub = subscribeToFirestore(user.username);
    return unsub;
  }, [user?.username]);

  // Tap on system notification → jump to chat page
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      setNotifJump(Date.now()); // use timestamp so every tap triggers the effect
    });
    return () => sub.remove();
  }, []);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#F59E0B" />
    </View>
  );

  if (!user) {
    return (
      <NavigationContainer>
        <LoginScreen />
      </NavigationContainer>
    );
  }

  // Session is valid but biometric hasn't been verified this launch yet.
  // This gate triggers on every cold start when there is an active session.
  if (!biometricUnlocked) {
    return (
      <BiometricScreen
        username={user.username}
        onSuccess={unlockBiometric}
        onFallback={logout} // biometrics unavailable → force re-login
      />
    );
  }

  const role = user.role;
  const unread = unreadCount(user.username);
  const notifTitle = unread > 0 ? `התראות (${unread})` : 'התראות';

  const KAZIN_MAOG: Page[] = [
    { title: 'לוח בקרה', component: DashboardScreen    },
    { title: notifTitle, component: NotificationsScreen },
    { title: 'בקשות',    component: RequestsScreen     },
    { title: 'מסגרות',   component: SetMasegeretScreen },
    { title: 'שיאים',    component: ShiaimScreen       },
    { title: 'תוכנית',   component: WorkPlanScreen     },
    { title: 'משק',      component: MasheqScreen       },
    { title: 'וויסותים', component: WisutimScreen      },
    { title: 'רווחים',   component: ProfitsScreen      },
    { title: 'תובנות',   component: AIInsightsScreen   },
    { title: 'שימושים',  component: UnitUsageScreen    },
  ];

  const pages: Page[] =
    (role === 'kazin' || role === 'samaog' || role === 'maog') ? KAZIN_MAOG :
    (role === 'machat_900' || role === 'samachat_900') ? [
      { title: 'חטיבה 900', component: BudgetViewScreen  },
      { title: notifTitle,  component: NotificationsScreen },
      { title: 'תוכנית',    component: WorkPlanScreen    },
      { title: 'היסטוריה',  component: HistoryScreen     },
      { title: 'שימושים',   component: UnitUsageScreen   },
    ] :
    role === 'kas_900' ? [
      { title: 'תצוגת תקציב', component: BudgetViewScreen  },
      { title: notifTitle,    component: NotificationsScreen },
      { title: 'בקשות',       component: RequestsScreen    },
      { title: 'תוכנית',      component: WorkPlanScreen    },
      { title: 'היסטוריה',    component: HistoryScreen     },
      { title: 'שימושים',     component: UnitUsageScreen   },
    ] :
    (role === 'klach_646' || role === 'klach_179' || role === 'klach_11') ? [
      { title: 'קופת מפקד', component: BudgetViewScreen  },
      { title: notifTitle,  component: NotificationsScreen },
      { title: 'בקשות',     component: RequestsScreen    },
      { title: 'תוכנית',    component: WorkPlanScreen    },
      { title: 'היסטוריה',  component: HistoryScreen     },
      { title: 'שימושים',   component: UnitUsageScreen   },
    ] :
    role === 'smfaked' ? [
      { title: 'התקציב שלי', component: MyBudgetScreen     },
      { title: notifTitle,   component: NotificationsScreen },
      { title: 'בקשות',      component: RequestsScreen     },
      { title: 'תוכנית',     component: WorkPlanScreen     },
      { title: 'היסטוריה',   component: HistoryScreen      },
      { title: 'רווחים',     component: ProfitReportScreen },
      { title: 'שימושים',    component: UnitUsageScreen    },
    ] :
    [
      { title: 'ניהול מערכת', component: AdminScreen        },
      { title: notifTitle,    component: NotificationsScreen },
      { title: 'שימושים',     component: UnitUsageScreen    },
    ];

  const hativaId = getHativaId(user);
  const hativaIcon = hativaId ? HATIVA_ICONS[hativaId] ?? null : null;

  return (
    <NavigationContainer>
      <SwipeNavigator pages={pages} hativaIcon={hativaIcon} hativaId={hativaId} notifTrigger={notifJump} />
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: {
    backgroundColor: T.surface,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: T.text, fontSize: 17, fontWeight: '700', textAlign: 'center', flex: 1 },
  headerSpacer: { width: 44 },
  logoutBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: T.danger + '22', borderWidth: 1, borderColor: T.danger + '55' },
  logoutText: { color: T.danger, fontSize: 12, fontWeight: '700' },

  pager: { flex: 1 },

  dotsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.surface,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
    flexWrap: 'wrap',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.border,
  },
  dotActive: {
    height: 28,
    borderRadius: 14,
    backgroundColor: T.gold,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotLabel: { color: T.bg, fontSize: 12, fontWeight: '700' },
});
