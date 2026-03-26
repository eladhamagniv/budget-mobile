import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useBudget } from '../context/BudgetContext';
import { useRequests } from '../context/RequestsContext';
import { PurchaseRequest } from '../types';
import { T } from '../theme';
import { useScreenAnimation, useItemAnimation } from '../hooks/useScreenAnimation';
import { MOCK_MONTHLY, MONTHLY_LABELS } from '../mock/data';

const fmt = (n: number) => `${n.toLocaleString('he-IL')} ₪`;

const STATUS_COLOR: Record<string, string> = {
  ממתין: T.warning,
  אושר:  T.success,
  נדחה:  T.danger,
};

function RequestCard({ req, index }: { req: PurchaseRequest; index: number }) {
  const anim  = useItemAnimation(index);
  const color = STATUS_COLOR[req.status] ?? T.textSec;
  return (
    <Animated.View style={[s.reqCard, anim]}>
      <View style={s.reqTop}>
        <View style={[s.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
          <Text style={[s.badgeText, { color }]}>{req.status}</Text>
        </View>
        <Text style={s.reqAmount}>{fmt(req.amount)}</Text>
        <Text style={s.reqCategory}>{req.category}</Text>
        <Text style={s.reqDesc} numberOfLines={1}>{req.description}</Text>
      </View>
      {req.kazinReason ? <Text style={s.reqReason}>הערת קצין: {req.kazinReason}</Text> : null}
      <Text style={s.reqDate}>{new Date(req.submittedAt).toLocaleDateString('he-IL')}</Text>
    </Animated.View>
  );
}

const fmt_k2 = (n: number) => n >= 1000 ? `${(n/1000).toFixed(0)}K` : String(n);

function UnitMonthlyChart({ unitId }: { unitId: string }) {
  const data = MOCK_MONTHLY[unitId] ?? [0,0,0,0,0,0];
  const maxVal = Math.max(...data, 1);
  return (
    <View style={mc2.card}>
      <Text style={mc2.title}>שימוש חודשי (אוק׳–מרץ)</Text>
      <View style={mc2.bars}>
        {data.map((v, i) => {
          const h = Math.max(Math.round((v / maxVal) * 80), 4);
          const color = v === 0 ? T.border : T.gold;
          return (
            <View key={i} style={mc2.col}>
              <Text style={mc2.val}>{v > 0 ? fmt_k2(v) : ''}</Text>
              <View style={[mc2.bar, { height: h, backgroundColor: color }]} />
              <Text style={mc2.month}>{MONTHLY_LABELS[i]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const mc2 = StyleSheet.create({
  card:  { backgroundColor: T.surface, borderRadius: T.r2, borderWidth: 1, borderColor: T.border, padding: 16, marginBottom: 18 },
  title: { color: T.gold, fontSize: 13, fontWeight: '700', textAlign: 'right', marginBottom: 14 },
  bars:  { flexDirection: 'row-reverse', alignItems: 'flex-end', height: 110, paddingBottom: 22 },
  col:   { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:   { width: '80%', borderRadius: 3 },
  val:   { color: T.textMuted, fontSize: 8, marginBottom: 2 },
  month: { position: 'absolute', bottom: 0, color: T.textMuted, fontSize: 9 },
});

export function MyBudgetScreen() {
  const { user }    = useAuth();
  const { getUnit } = useBudget();
  const { requests } = useRequests();
  const anim = useScreenAnimation();

  const unitId = user?.unitId ?? '';
  const unit   = getUnit(unitId);

  const myRequests = useMemo(() => requests.filter(r => r.unitId === unitId), [requests, unitId]);

  if (!unit) {
    return (
      <View style={s.center}>
        <Text style={{ color: T.textMuted, fontSize: 15 }}>לא נמצאה יחידה מקושרת לחשבון</Text>
      </View>
    );
  }

  const yitara  = unit.masegeret - unit.shimush;
  const pct     = unit.masegeret > 0 ? Math.min(unit.shimush / unit.masegeret, 1) : 0;
  const barColor = pct > 0.9 ? T.danger : pct > 0.7 ? T.warning : T.success;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Animated.View style={anim}>

        {/* Budget card */}
        <View style={s.budgetCard}>
          <Text style={s.unitName}>{unit.name}</Text>
          <View style={s.statsRow}>
            {[
              { label: 'מסגרת שנתית', val: fmt(unit.masegeret), color: T.gold },
              { label: 'שימוש',        val: fmt(unit.shimush),   color: T.danger },
              { label: 'יתרה',         val: fmt(yitara),         color: T.success },
            ].map((item, i) => (
              <View key={i} style={s.statItem}>
                <Text style={[s.statVal, { color: item.color }]}>{item.val}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: barColor }]} />
          </View>
          <Text style={s.progressLabel}>{Math.round(pct * 100)}% נוצל</Text>
        </View>

        <UnitMonthlyChart unitId={unitId} />

        {/* Requests */}
        <View style={s.sectionRow}>
          <View style={s.sectionAccent} />
          <Text style={s.sectionTitle}>הבקשות שלי</Text>
          {myRequests.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countBadgeText}>{myRequests.length}</Text>
            </View>
          )}
        </View>

        {myRequests.length === 0
          ? <Text style={s.empty}>אין בקשות עדיין</Text>
          : myRequests.map((r, i) => <RequestCard key={r.id} req={r} index={i} />)
        }
      </Animated.View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content:   { padding: T.pad, paddingBottom: 40 },
  center:    { flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' },

  budgetCard: {
    backgroundColor: T.surface, borderRadius: T.r2, borderWidth: 1,
    borderColor: T.border, padding: 20, marginBottom: 22,
  },
  unitName: { color: T.gold, fontSize: 18, fontWeight: '800', textAlign: 'right', marginBottom: 18 },
  statsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 18 },
  statItem: { alignItems: 'center', flex: 1 },
  statVal:  { fontSize: 14, fontWeight: '700' },
  statLabel:{ color: T.textMuted, fontSize: 11, marginTop: 4 },

  progressBg:    { height: 8, backgroundColor: T.surface3, borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 4 },
  progressLabel: { color: T.textMuted, fontSize: 11, textAlign: 'right', marginTop: 6 },

  sectionRow:    { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionAccent: { width: 3, height: 14, backgroundColor: T.gold, borderRadius: 2 },
  sectionTitle:  { color: T.textSec, fontSize: 13, fontWeight: '700' },
  countBadge:    { backgroundColor: T.gold, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText:{ color: T.bg, fontSize: 11, fontWeight: '800' },
  empty:         { color: T.textMuted, textAlign: 'center', marginTop: 24 },

  reqCard: {
    backgroundColor: T.surface, borderRadius: T.r2, padding: 14,
    borderWidth: 1, borderColor: T.border, marginBottom: 10,
  },
  reqTop:      { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 4 },
  reqDesc:     { flex: 1, color: T.text, fontSize: 13, textAlign: 'right' },
  reqCategory: { color: T.textSec, fontSize: 12 },
  reqAmount:   { color: T.gold, fontSize: 13, fontWeight: '700' },
  badge:       { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  badgeText:   { fontSize: 11, fontWeight: '700' },
  reqReason:   { color: T.textMuted, fontSize: 12, textAlign: 'right', marginTop: 4 },
  reqDate:     { color: T.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4 },
});
