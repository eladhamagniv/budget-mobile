import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, Animated,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useRequests } from '../context/RequestsContext';
import { useBudget } from '../context/BudgetContext';
import { useShiaim } from '../context/ShiaimContext';
import { useWorkPlan } from '../context/WorkPlanContext';
import { useNotifications } from '../context/NotificationContext';
import { PurchaseRequest } from '../types';
import { REQUEST_CATEGORIES } from '../config/constants';
import { T } from '../theme';
import { useScreenAnimation } from '../hooks/useScreenAnimation';

const fmt = (n: number) => `${n.toLocaleString('he-IL')} ₪`;

const HATIVA_TO_KAS_ROLE: Record<string, string> = {
  hativa_900: 'kas_900',
  hativa_646: 'klach_646',
  hativa_179: 'klach_179',
  hativa_11:  'klach_11',
};
const ROLE_TO_HATIVA: Record<string, string> = {
  kas_900: 'hativa_900', klach_646: 'hativa_646',
  klach_179: 'hativa_179', klach_11: 'hativa_11',
};

const STATUS_COLOR: Record<string, string> = {
  ממתין:    T.warning,
  ממתין_קס: '#a78bfa',
  אושר:     T.success,
  נדחה:     T.danger,
};
const STATUS_LABEL: Record<string, string> = {
  ממתין: 'ממתין לאישור', ממתין_קס: 'ממתין לאישור', אושר: 'אושר', נדחה: 'נדחה',
};

const HATIVA_TO_MACHAT_ROLE: Record<string, string> = {
  hativa_900: 'machat_900',
};

// ── Resolve Modal (for kazin and kas) ────────────────────────────────────────
function ResolveModal({ req, isKas, onClose, onApprove, onReject }: {
  req: PurchaseRequest; isKas: boolean;
  onClose: () => void;
  onApprove: (asmacha: string, reason: string) => void;
  onReject: (reason: string) => void;
}) {
  const [asmacha, setAsmacha] = useState('');
  const [reason, setReason]   = useState('');
  const [mode, setMode]       = useState<'choose' | 'approve' | 'reject'>('choose');

  return (
    <Modal visible transparent animationType="slide">
      <View style={ms.overlay}>
        <View style={ms.card}>
          <View style={ms.handle} />
          <Text style={ms.title}>{req.unitName}</Text>
          <Text style={ms.category}>{req.category}</Text>
          <Text style={ms.desc}>{req.description}</Text>
          <Text style={ms.amount}>{fmt(req.amount)}</Text>

          {mode === 'choose' && (
            <View style={ms.chooseBtns}>
              <TouchableOpacity style={ms.approveBtn} onPress={() => setMode('approve')} activeOpacity={0.85}>
                <Text style={ms.approveBtnText}>אישור</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ms.rejectBtn} onPress={() => setMode('reject')} activeOpacity={0.85}>
                <Text style={ms.rejectBtnText}>דחייה</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'approve' && (
            <>
              {!isKas && (
                <>
                  <Text style={ms.label}>אסמכתא</Text>
                  <TextInput style={ms.input} value={asmacha} onChangeText={setAsmacha}
                    placeholder="מספר אסמכתא" placeholderTextColor={T.textMuted} textAlign="right" />
                </>
              )}
              <Text style={ms.label}>הערה (אופציונלי)</Text>
              <TextInput style={ms.input} value={reason} onChangeText={setReason}
                placeholder="הערה..." placeholderTextColor={T.textMuted} textAlign="right" />
              <View style={ms.chooseBtns}>
                <TouchableOpacity style={ms.approveBtn} onPress={() => onApprove(asmacha, reason)} activeOpacity={0.85}>
                  <Text style={ms.approveBtnText}>אשר</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ms.cancelBtn} onPress={() => setMode('choose')} activeOpacity={0.85}>
                  <Text style={ms.cancelText}>חזור</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {mode === 'reject' && (
            <>
              <Text style={ms.label}>סיבת דחייה</Text>
              <TextInput style={ms.input} value={reason} onChangeText={setReason}
                placeholder="סיבה..." placeholderTextColor={T.textMuted} textAlign="right" />
              <View style={ms.chooseBtns}>
                <TouchableOpacity style={ms.rejectBtn} onPress={() => onReject(reason)} activeOpacity={0.85}>
                  <Text style={ms.rejectBtnText}>דחה</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ms.cancelBtn} onPress={() => setMode('choose')} activeOpacity={0.85}>
                  <Text style={ms.cancelText}>חזור</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <TouchableOpacity style={ms.closeBtn} onPress={onClose}>
            <Text style={ms.closeBtnText}>סגור</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Request card ──────────────────────────────────────────────────────────────
function ReqCard({ req, showUnit, onPress, index = 0 }: {
  req: PurchaseRequest; showUnit: boolean; onPress?: () => void; index?: number;
}) {
  const anim  = useScreenAnimation(index * 40);
  const color = STATUS_COLOR[req.status] ?? T.textSec;
  return (
    <Animated.View style={anim}>
      <TouchableOpacity
        style={[s.reqCard, onPress && s.reqCardTappable]}
        onPress={onPress}
        activeOpacity={onPress ? 0.75 : 1}
      >
        <View style={s.reqTop}>
          <View style={[s.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
            <Text style={[s.badgeText, { color }]}>{STATUS_LABEL[req.status] ?? req.status}</Text>
          </View>
          <Text style={s.reqAmount}>{fmt(req.amount)}</Text>
          <Text style={s.reqCat}>{req.category}</Text>
          {showUnit && <Text style={s.reqUnit}>{req.unitName}</Text>}
        </View>
        <Text style={s.reqDesc}>{req.description}</Text>
        {req.kasReason   ? <Text style={s.reqReason}>הערת קה"ס: {req.kasReason}</Text>   : null}
        {req.kazinReason ? <Text style={s.reqReason}>הערת קצין: {req.kazinReason}</Text> : null}
        {req.asmacha     ? <Text style={s.reqAsmacha}>אסמכתא: {req.asmacha}</Text>       : null}
        <Text style={s.reqDate}>{new Date(req.submittedAt).toLocaleDateString('he-IL')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Category picker ───────────────────────────────────────────────────────────
function CatPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={s.picker} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[s.pickerText, !value && { color: T.textMuted }]}>{value || 'בחר קטגוריה'}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide">
        <View style={ps.overlay}>
          <View style={ps.sheet}>
            <View style={ps.handle} />
            <View style={ps.titleRow}>
              <Text style={ps.title}>בחר קטגוריה</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={ps.closeX}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {(REQUEST_CATEGORIES as readonly string[]).map(cat => (
                <TouchableOpacity key={cat} style={ps.item} onPress={() => { onChange(cat); setOpen(false); }} activeOpacity={0.75}>
                  <View style={[ps.itemDot, value === cat && ps.itemDotActive]} />
                  <Text style={[ps.itemText, value === cat && ps.itemSelected]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={ps.closeBtn} onPress={() => setOpen(false)}>
              <Text style={ps.closeBtnText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function RequestsScreen() {
  const { user }    = useAuth();
  const { requests, submitRequest, kasApproveRequest, kasRejectRequest, approveRequest, rejectRequest } = useRequests();
  const { units, addShimush } = useBudget();
  const { shiaim }  = useShiaim();
  const { isComplete } = useWorkPlan();
  const { push, pushToRole } = useNotifications();
  const role = user?.role;
  const anim = useScreenAnimation();

  const [category,    setCategory]    = useState('');
  const [description, setDescription] = useState('');
  const [amount,      setAmount]      = useState('');
  const [gamash,      setGamash]      = useState('');
  const [simul,       setSimul]       = useState('');
  const [orderId,     setOrderId]     = useState('');
  const [formError,   setFormError]   = useState('');
  const [resolving,   setResolving]   = useState<PurchaseRequest | null>(null);

  const myUnit = useMemo(() => units.find(u => u.id === user?.unitId), [units, user]);
  const myRequests = useMemo(() => requests.filter(r => r.unitId === user?.unitId), [requests, user]);

  // ── smfaked: submit new request ─────────────────────────────────────────────
  const handleSubmit = () => {
    if (!category)           { setFormError('יש לבחור קטגוריה'); return; }
    if (!description.trim()) { setFormError('יש להזין תיאור');   return; }
    const amt = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (isNaN(amt) || amt <= 0) { setFormError('יש להזין סכום חיובי'); return; }

    // Check שיאים for this category
    const hativaId = myUnit?.parent ?? '';
    const shiaimEntry = shiaim.find(e => e.hativaId === hativaId && e.category === category);
    if (shiaimEntry) {
      const yitara = shiaimEntry.masegeret - shiaimEntry.shimush;
      if (yitara < amt) {
        setFormError(`אין מספיק שיאים בקטגוריה "${category}" — יתרה: ${fmt(yitara)}`);
        return;
      }
    }

    // מרק"ט validation
    if (category === 'מרק"ט') {
      if (!gamash.trim()) { setFormError('יש להזין מספר גמ"ש'); return; }
      if (!simul.trim())  { setFormError('יש להזין סימול');     return; }
    }

    setFormError('');
    const unitName = myUnit?.name ?? user!.unitId!;
    submitRequest(
      user!.unitId!, unitName,
      user!.username, user!.displayName,
      hativaId, category, description.trim(), amt,
      category === 'מרק"ט' ? { gamashNumber: gamash.trim(), simul: simul.trim(), orderId: orderId.trim() } : undefined,
    );

    // Notify kas/klach or kazin
    const kasRole = HATIVA_TO_KAS_ROLE[hativaId];
    if (kasRole) {
      pushToRole(kasRole, user!.displayName, `התקבלה בקשה לתקצוב מ-${unitName} — ${category} ${fmt(amt)}`);
    } else {
      // mifaog → straight to kazin
      pushToRole('kazin', user!.displayName, `התקבלה בקשה לתקצוב מ-${unitName} — ${category} ${fmt(amt)}`);
    }

    setCategory(''); setDescription(''); setAmount(''); setGamash(''); setSimul(''); setOrderId('');
    Alert.alert('נשלח', 'הבקשה נשלחה לאישור');
  };

  // ── kas/klach: approve/reject ────────────────────────────────────────────────
  const handleKasApprove = (req: PurchaseRequest, reason: string) => {
    kasApproveRequest(req.id, reason);
    // Notify kazin
    pushToRole('kazin', user!.displayName, `בקשת תקצוב מ-${req.unitName} אושרה ע"י קה"ס — ${req.category} ${fmt(req.amount)}`);
    pushToRole('samaog', user!.displayName, `בקשת תקצוב מ-${req.unitName} אושרה ע"י קה"ס — ${req.category} ${fmt(req.amount)}`);
    // Notify requestor
    push(req.requestorId, user!.displayName, `הבקשה שלך ל${req.category} אושרה ע"י קה"ס ועוברת לקצין תקציבים`);
    setResolving(null);
  };

  const handleKasReject = (req: PurchaseRequest, reason: string) => {
    kasRejectRequest(req.id, reason);
    push(req.requestorId, user!.displayName, `הבקשה שלך ל${req.category} נדחתה ע"י קה"ס${reason ? ` — ${reason}` : ''}`);
    setResolving(null);
  };

  // ── kazin: approve/reject ────────────────────────────────────────────────────
  const handleKazinApprove = (req: PurchaseRequest, asmacha: string, reason: string) => {
    approveRequest(req.id, asmacha, reason);
    addShimush(req.unitId, req.amount);
    push(req.requestorId, user!.displayName, `בקשת התקצוב שלך אושרה ע"י ${user!.displayName} — ${req.category} ${fmt(req.amount)}`);
    const machatRole = HATIVA_TO_MACHAT_ROLE[req.hativaId];
    if (machatRole) {
      pushToRole(machatRole, user!.displayName, `בקשת תקצוב אושרה — ${req.unitName} ${req.category} ${fmt(req.amount)}`);
    }
    setResolving(null);
  };

  const handleKazinReject = (req: PurchaseRequest, reason: string) => {
    rejectRequest(req.id, reason);
    push(req.requestorId, user!.displayName, `בקשת התקצוב שלך נדחתה ע"י ${user!.displayName}${reason ? ` — ${reason}` : ''}`);
    setResolving(null);
  };

  // ── smfaked view ─────────────────────────────────────────────────────────────
  if (role === 'smfaked') {
    const planDone = myUnit ? isComplete(user!.unitId!, myUnit.masegeret) : false;
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Animated.View style={anim}>
          {!planDone && (
            <View style={s.blockBanner}>
              <Text style={s.blockBannerText}>⚠ תוכנית העבודה אינה מלאה — לא ניתן לשלוח בקשות עד להשלמת ההקצאה</Text>
            </View>
          )}

          <View style={s.formCard}>
            <Text style={s.formTitle}>הגשת בקשה חדשה</Text>
            <Text style={s.label}>קטגוריה</Text>
            <CatPicker value={category} onChange={v => { setCategory(v); setGamash(''); setSimul(''); setOrderId(''); }} />

            {category === 'מרק"ט' && (
              <>
                <Text style={s.label}>מספר גמ"ש</Text>
                <TextInput style={s.input} value={gamash} onChangeText={setGamash}
                  placeholder="G2026XXX" placeholderTextColor={T.textMuted} textAlign="right" />
                <Text style={s.label}>סימול</Text>
                <TextInput style={s.input} value={simul} onChangeText={setSimul}
                  placeholder="קוד סימול" placeholderTextColor={T.textMuted} keyboardType="numeric" textAlign="right" />
                <Text style={s.label}>מזהה הזמנה (אופציונלי)</Text>
                <TextInput style={s.input} value={orderId} onChangeText={setOrderId}
                  placeholder="מספר הזמנה" placeholderTextColor={T.textMuted} textAlign="right" />
              </>
            )}

            <Text style={s.label}>תיאור</Text>
            <View style={s.warningBox}>
              <Text style={s.warningText}>אין לכתוב מידע מסווג</Text>
            </View>
            <TextInput
              style={[s.input, { minHeight: 72 }]}
              value={description} onChangeText={setDescription}
              placeholder="תיאור הרכש..." placeholderTextColor={T.textMuted}
              textAlign="right" multiline
            />
            <Text style={s.label}>סכום (₪)</Text>
            <TextInput
              style={s.input} value={amount} onChangeText={setAmount}
              placeholder="0" placeholderTextColor={T.textMuted}
              keyboardType="numeric" textAlign="right"
            />
            {formError ? <Text style={s.errorText}>{formError}</Text> : null}
            <TouchableOpacity
              style={[s.submitBtn]}
              onPress={handleSubmit} activeOpacity={0.85}
            >
              <Text style={s.submitBtnText}>שלח בקשה</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.sectionTitle}>הבקשות שלי ({myRequests.length})</Text>
          {myRequests.length === 0
            ? <Text style={s.empty}>אין בקשות עדיין</Text>
            : myRequests.map((r, i) => <ReqCard key={r.id} req={r} showUnit={false} index={i} />)
          }
        </Animated.View>
      </ScrollView>
    );
  }

  // ── kas / klach: approve pending requests for their hativa ──────────────────
  const myHativa = ROLE_TO_HATIVA[role ?? ''];
  if (myHativa) {
    const pending = requests.filter(r => r.status === 'ממתין_קס' && r.hativaId === myHativa);
    const done    = requests.filter(r => r.status !== 'ממתין_קס' && r.hativaId === myHativa);
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Animated.View style={anim}>
          {pending.length > 0 && (
            <>
              <View style={s.sectionRow}>
                <View style={s.sectionAccent} />
                <Text style={s.sectionTitle}>ממתינות לאישורך</Text>
                <View style={s.countBadge}><Text style={s.countBadgeText}>{pending.length}</Text></View>
              </View>
              {pending.map((r, i) => (
                <ReqCard key={r.id} req={r} showUnit onPress={() => setResolving(r)} index={i} />
              ))}
            </>
          )}
          {pending.length === 0 && <Text style={s.empty}>אין בקשות ממתינות</Text>}

          {done.length > 0 && (
            <>
              <View style={[s.sectionRow, { marginTop: 16 }]}>
                <View style={s.sectionAccent} />
                <Text style={s.sectionTitle}>היסטוריה</Text>
              </View>
              {done.map((r, i) => <ReqCard key={r.id} req={r} showUnit index={i} />)}
            </>
          )}

          {resolving && (
            <ResolveModal
              req={resolving} isKas
              onClose={() => setResolving(null)}
              onApprove={(_, reason) => handleKasApprove(resolving, reason)}
              onReject={reason => handleKasReject(resolving, reason)}
            />
          )}
        </Animated.View>
      </ScrollView>
    );
  }

  // ── kazin / samaog / maog view ───────────────────────────────────────────────
  if (role === 'kazin' || role === 'samaog' || role === 'maog') {
    const pendingRequests = requests.filter(r => r.status === 'ממתין');
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Animated.View style={anim}>
          {pendingRequests.length > 0 && (
            <>
              <View style={s.sectionRow}>
                <View style={s.sectionAccent} />
                <Text style={s.sectionTitle}>ממתינות לאישור</Text>
                <View style={s.countBadge}><Text style={s.countBadgeText}>{pendingRequests.length}</Text></View>
              </View>
              {pendingRequests.map((r, i) => (
                <ReqCard key={r.id} req={r} showUnit
                  onPress={role === 'kazin' ? () => setResolving(r) : undefined}
                  index={i}
                />
              ))}
            </>
          )}

          <View style={[s.sectionRow, { marginTop: 16 }]}>
            <View style={s.sectionAccent} />
            <Text style={s.sectionTitle}>כל הבקשות</Text>
          </View>
          {requests.length === 0
            ? <Text style={s.empty}>אין בקשות</Text>
            : requests.map((r, i) => (
                <ReqCard key={r.id} req={r} showUnit
                  onPress={(r.status === 'ממתין' && role === 'kazin') ? () => setResolving(r) : undefined}
                  index={i}
                />
              ))
          }

          {resolving && (
            <ResolveModal
              req={resolving} isKas={false}
              onClose={() => setResolving(null)}
              onApprove={(asmacha, reason) => handleKazinApprove(resolving, asmacha, reason)}
              onReject={reason => handleKazinReject(resolving, reason)}
            />
          )}
        </Animated.View>
      </ScrollView>
    );
  }

  return <View style={s.center}><Text style={{ color: T.textMuted }}>אין גישה</Text></View>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content:   { padding: T.pad, paddingBottom: 40 },
  center:    { flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' },

  blockBanner: {
    backgroundColor: T.dangerBg, borderRadius: T.r, padding: 12,
    borderWidth: 1, borderColor: T.danger + '55', marginBottom: 14,
  },
  blockBannerText: { color: T.danger, fontSize: 12, textAlign: 'right', fontWeight: '600' },

  sectionRow:    { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionAccent: { width: 3, height: 14, backgroundColor: T.gold, borderRadius: 2 },
  sectionTitle:  { color: T.textSec, fontSize: 13, fontWeight: '700' },
  countBadge:    { backgroundColor: T.gold, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText:{ color: T.bg, fontSize: 11, fontWeight: '800' },
  empty:         { color: T.textMuted, textAlign: 'center', marginVertical: 20 },

  formCard: {
    backgroundColor: T.surface, borderRadius: T.r2,
    padding: 18, borderWidth: 1, borderColor: T.border, marginBottom: 24,
  },
  formTitle: { color: T.gold, fontSize: 15, fontWeight: '700', textAlign: 'right', marginBottom: 14 },
  label:     { color: T.textSec, fontSize: 12, fontWeight: '600', textAlign: 'right', marginBottom: 6 },
  input: {
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    borderRadius: T.r, padding: 11, color: T.text, fontSize: 14,
    marginBottom: 14, writingDirection: 'rtl',
  },
  picker:     { backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, borderRadius: T.r, padding: 11, marginBottom: 14 },
  pickerText: { color: T.text, fontSize: 14, textAlign: 'right' },
  warningBox: { backgroundColor: T.dangerBg, borderRadius: T.r, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: T.danger + '55' },
  warningText:{ color: T.danger, fontSize: 12, textAlign: 'right', fontWeight: '600' },
  errorText:  { color: T.danger, fontSize: 12, textAlign: 'right', marginBottom: 10 },
  submitBtn:  { backgroundColor: T.gold, borderRadius: T.r, paddingVertical: 13, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: T.border },
  submitBtnText: { color: T.bg, fontWeight: '800', fontSize: 14 },

  reqCard:        { backgroundColor: T.surface, borderRadius: T.r2, padding: 14, borderWidth: 1, borderColor: T.border, marginBottom: 10 },
  reqCardTappable:{ borderColor: T.borderMid },
  reqTop:    { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  reqUnit:   { color: T.gold, fontSize: 12, fontWeight: '600' },
  reqCat:    { color: T.textSec, fontSize: 12 },
  reqAmount: { color: T.text, fontSize: 13, fontWeight: '700' },
  badge:     { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  reqDesc:   { color: T.textSec, fontSize: 13, textAlign: 'right', marginBottom: 5 },
  reqReason: { color: T.textMuted, fontSize: 12, textAlign: 'right', marginBottom: 2 },
  reqAsmacha:{ color: T.gold, fontSize: 12, textAlign: 'right', marginBottom: 2 },
  reqDate:   { color: T.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4 },
});

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  card: { backgroundColor: T.surface, borderTopLeftRadius: T.r2, borderTopRightRadius: T.r2, padding: 22, paddingBottom: 36, borderTopWidth: 1, borderColor: T.border },
  handle:   { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  title:    { color: T.gold, fontSize: 16, fontWeight: '700', textAlign: 'right', marginBottom: 2 },
  category: { color: T.textSec, fontSize: 13, textAlign: 'right', marginBottom: 8 },
  desc:     { color: T.text, fontSize: 14, textAlign: 'right', marginBottom: 4 },
  amount:   { color: T.success, fontSize: 18, fontWeight: '800', textAlign: 'right', marginBottom: 18 },
  chooseBtns: { flexDirection: 'row-reverse', gap: 10, marginBottom: 12 },
  approveBtn: { flex: 1, backgroundColor: T.successBg, borderWidth: 1, borderColor: T.success + '55', borderRadius: T.r, padding: 13, alignItems: 'center' },
  approveBtnText: { color: T.success, fontWeight: '700', fontSize: 14 },
  rejectBtn:  { flex: 1, backgroundColor: T.dangerBg, borderWidth: 1, borderColor: T.danger + '55', borderRadius: T.r, padding: 13, alignItems: 'center' },
  rejectBtnText:  { color: T.danger, fontWeight: '700', fontSize: 14 },
  cancelBtn:  { backgroundColor: T.surface2, borderRadius: T.r, padding: 13, paddingHorizontal: 18, alignItems: 'center' },
  cancelText: { color: T.textSec, fontSize: 13 },
  label:  { color: T.textSec, fontSize: 12, fontWeight: '600', textAlign: 'right', marginBottom: 6 },
  input:  { backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, borderRadius: T.r, padding: 11, color: T.text, fontSize: 14, marginBottom: 12, writingDirection: 'rtl' },
  closeBtn:     { marginTop: 6, alignItems: 'center', paddingVertical: 8 },
  closeBtnText: { color: T.textMuted, fontSize: 13 },
});

const ps = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: T.surface, borderTopLeftRadius: T.r2, borderTopRightRadius: T.r2, padding: 18, maxHeight: '72%', flex: 1 },
  handle:  { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  titleRow:{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title:   { color: T.gold, fontSize: 16, fontWeight: '700' },
  closeX:  { color: T.textMuted, fontSize: 18, fontWeight: '700', paddingHorizontal: 4 },
  item:    { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: T.border },
  itemDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.border },
  itemDotActive: { backgroundColor: T.gold },
  itemText:    { color: T.text, fontSize: 14 },
  itemSelected:{ color: T.gold, fontWeight: '700' },
  closeBtn:    { marginTop: 12, backgroundColor: T.surface2, borderRadius: T.r, padding: 13, alignItems: 'center' },
  closeBtnText:{ color: T.textSec, fontSize: 14 },
});
