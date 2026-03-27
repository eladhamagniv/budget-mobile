/**
 * exportService.ts
 *
 * Generates a PDF from request data and opens the native share sheet.
 * Data never leaves the device unless the user explicitly chooses a destination.
 *
 * Uses:
 *  - expo-print  → converts HTML → PDF file in app cache
 *  - expo-sharing → opens native share sheet (save to Files, WhatsApp, email, etc.)
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { PurchaseRequest } from '../types';

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  'אושר':     { label: 'אושר',       bg: '#d1fae5', color: '#065f46' },
  'נדחה':     { label: 'נדחה',       bg: '#fee2e2', color: '#991b1b' },
  'ממתין':    { label: 'ממתין קצין', bg: '#fef3c7', color: '#92400e' },
  'ממתין_קס': { label: 'ממתין קס',   bg: '#ede9fe', color: '#5b21b6' },
};

const fmt      = (n: number) => `${(n ?? 0).toLocaleString('he-IL')} ₪`;
const fmtDate  = (iso: string) => new Date(iso).toLocaleDateString('he-IL');
const esc      = (s: string) =>
  String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export async function exportRequestsPdf(
  requests: PurchaseRequest[],
  title: string = 'דו"ח בקשות',
): Promise<void> {
  // Sort latest → oldest
  const sorted = [...requests].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  const now          = new Date();
  const approved     = sorted.filter(r => r.status === 'אושר');
  const rejected     = sorted.filter(r => r.status === 'נדחה');
  const pending      = sorted.filter(r => r.status === 'ממתין' || r.status === 'ממתין_קס');
  const approvedTotal = approved.reduce((s, r) => s + (r.amount ?? 0), 0);

  const rows = sorted.map(r => {
    const sc       = STATUS_MAP[r.status] ?? { label: r.status, bg: '#f3f4f6', color: '#374151' };
    const rowBg    = r.status === 'אושר' ? '#f0fdf4'
                   : r.status === 'נדחה' ? '#fff5f5'
                   : '#fffbeb';
    const resolved = r.resolvedAt ? fmtDate(r.resolvedAt) : '—';
    const reason   = esc(r.kazinReason ?? r.kasReason ?? '');

    return `
      <tr style="background:${rowBg}">
        <td>${fmtDate(r.submittedAt)}</td>
        <td>${resolved}</td>
        <td>${esc(r.unitName ?? r.unitId)}<br/><span style="color:#6b7280;font-size:10px">${esc(r.requestorName ?? '')}</span></td>
        <td style="max-width:180px">${esc(r.description ?? '—')}</td>
        <td><span style="background:#e8f0fe;color:#1a56db;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">${esc(r.category)}</span></td>
        <td style="font-weight:700;text-align:left;direction:ltr;white-space:nowrap">${fmt(r.amount)}</td>
        <td><span style="background:${sc.bg};color:${sc.color};border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;white-space:nowrap">${sc.label}</span></td>
        <td style="color:#6b7280;font-size:10px">${esc(r.asmacha ?? '—')}</td>
        <td style="color:#9ca3af;font-size:10px;font-style:italic;max-width:140px">${reason}</td>
      </tr>`;
  }).join('');

  const html = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      direction: rtl;
      font-family: Arial, sans-serif;
      font-size: 12px;
      color: #1a1a2e;
      padding: 24px;
    }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%);
      color: #FFD700;
      padding: 20px 24px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .header h1 { font-size: 20px; font-weight: 700; }
    .header .sub { color: #b0b8c8; font-size: 11px; margin-top: 4px; }

    /* ── Stats ── */
    .stats {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .stat {
      flex: 1;
      min-width: 100px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      text-align: center;
    }
    .stat-val { font-size: 18px; font-weight: 800; color: #0f3460; display: block; }
    .stat-label { font-size: 10px; color: #64748b; margin-top: 2px; }
    .stat.approved .stat-val { color: #065f46; }
    .stat.rejected .stat-val { color: #991b1b; }
    .stat.pending  .stat-val { color: #92400e; }
    .stat.money    .stat-val { color: #1e40af; font-size: 14px; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead th {
      background: #f1f5f9;
      padding: 8px 10px;
      text-align: right;
      font-weight: 700;
      color: #475569;
      border-bottom: 2px solid #cbd5e1;
      white-space: nowrap;
    }
    tbody td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }

    /* ── Total row ── */
    .total-row td {
      background: #f1f5f9;
      font-weight: 700;
      border-top: 2px solid #cbd5e1;
      padding: 8px 10px;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 20px;
      text-align: center;
      color: #94a3b8;
      font-size: 10px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="sub">מערכת ניהול תקציב — אוגדה 99</div>
    <h1>${esc(title)}</h1>
    <div class="sub">הופק: ${now.toLocaleDateString('he-IL')} • ${now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div>
  </div>

  <!-- Stats -->
  <div class="stats">
    <div class="stat">
      <span class="stat-val">${sorted.length}</span>
      <div class="stat-label">סה"כ בקשות</div>
    </div>
    <div class="stat approved">
      <span class="stat-val">${approved.length}</span>
      <div class="stat-label">אושרו ✓</div>
    </div>
    <div class="stat rejected">
      <span class="stat-val">${rejected.length}</span>
      <div class="stat-label">נדחו ✗</div>
    </div>
    <div class="stat pending">
      <span class="stat-val">${pending.length}</span>
      <div class="stat-label">ממתינות</div>
    </div>
    <div class="stat money">
      <span class="stat-val">${fmt(approvedTotal)}</span>
      <div class="stat-label">סה"כ אושר</div>
    </div>
  </div>

  <!-- Table -->
  <table>
    <thead>
      <tr>
        <th>הגשה</th>
        <th>טיפול</th>
        <th>יחידה / מגיש</th>
        <th>תיאור</th>
        <th>קטגוריה</th>
        <th>סכום</th>
        <th>סטטוס</th>
        <th>אסמכתא</th>
        <th>הערה</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="5" style="text-align:right">סה"כ מאושר</td>
        <td style="text-align:left;direction:ltr">${fmt(approvedTotal)}</td>
        <td colspan="3"></td>
      </tr>
    </tbody>
  </table>

  <!-- Footer -->
  <div class="footer">
    מטבע הבזק • מערכת ניהול תקציב אוגדה 99 • סודי
  </div>

</body>
</html>`;

  // Generate PDF in app cache (never written to public storage)
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  // Open native share sheet — user decides where it goes
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('שיתוף קבצים אינו זמין במכשיר זה');

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  });
}
