"""
Generates the budget presentation as a .pptx file.
Run: python scripts/create_presentation.py
"""

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

DARK_BG = RGBColor(0x11, 0x18, 0x27)
CARD_BG = RGBColor(0x1F, 0x29, 0x37)
GOLD    = RGBColor(0xF5, 0x9E, 0x0B)
WHITE   = RGBColor(0xFF, 0xFF, 0xFF)
GRAY    = RGBColor(0x9C, 0xA3, 0xAF)
GREEN   = RGBColor(0x10, 0xB9, 0x81)
RED     = RGBColor(0xEF, 0x44, 0x44)
BLUE    = RGBColor(0x3B, 0x82, 0xF6)
PURPLE  = RGBColor(0x8B, 0x5C, 0xF6)

SW, SH = 10.0, 5.625

prs = Presentation()
prs.slide_width  = Inches(SW)
prs.slide_height = Inches(SH)
blank = prs.slide_layouts[6]

def slide():
    s = prs.slides.add_slide(blank)
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = DARK_BG
    return s

def box(s, x, y, w, h, fill=None, border=None, bw=Pt(1)):
    sh = s.shapes.add_shape(1, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.fill.solid() if fill else sh.fill.background()
    if fill: sh.fill.fore_color.rgb = fill
    if border:
        sh.line.color.rgb = border
        sh.line.width = bw
    else:
        sh.line.fill.background()
    return sh

def txt(s, t, x, y, w, h, size=14, bold=False, color=WHITE,
        align=PP_ALIGN.LEFT, italic=False):
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = t
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color
    return tb

def divider(s, y):
    b = s.shapes.add_shape(1, Inches(0.4), Inches(y), Inches(9.2), Inches(0.025))
    b.fill.solid(); b.fill.fore_color.rgb = GOLD
    b.line.fill.background()

def card(s, x, y, w, h, title, lines, tc=GOLD, bc=WHITE, ts=14, bs=12):
    box(s, x, y, w, h, fill=CARD_BG, border=GOLD, bw=Pt(0.75))
    txt(s, title, x+0.12, y+0.08, w-0.2, 0.35, size=ts, bold=True, color=tc)
    txt(s, '\n'.join(lines), x+0.12, y+0.44, w-0.2, h-0.55, size=bs, color=bc)

def badge(s, label, x, y, w=1.7, h=0.36, color=GREEN):
    box(s, x, y, w, h, fill=color)
    txt(s, label, x, y, w, h, size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

# ══════════════════════════════════════════════════════════
# SLIDE 1 — Title
# ══════════════════════════════════════════════════════════
s = slide()
box(s, 0, 0, 0.08, SH, fill=GOLD)
txt(s, '\u05de\u05d8\u05d1\u05e2 \u05d4\u05d1\u05d6\u05e7',
    0.35, 0.5, 9.3, 1.1, size=60, bold=True, color=GOLD, align=PP_ALIGN.RIGHT)
txt(s, '\u05de\u05e2\u05e8\u05db\u05ea \u05e0\u05d9\u05d4\u05d5\u05dc \u05ea\u05e7\u05e6\u05d9\u05d1 \u2014 \u05d0\u05d5\u05d2\u05d3\u05d4 99',
    0.35, 1.62, 9.3, 0.65, size=26, color=WHITE, align=PP_ALIGN.RIGHT)
divider(s, 2.45)
txt(s, 'Budget Management System  |  Android Mobile App',
    0.35, 2.62, 9.3, 0.45, size=15, color=GRAY, align=PP_ALIGN.RIGHT, italic=True)
for i, (lbl, col) in enumerate([
    ('React Native', BLUE), ('Firebase', GOLD), ('TypeScript', PURPLE),
    ('Expo SDK 54', GREEN), ('AES-256-GCM', RED),
]):
    badge(s, lbl, 0.35 + i*1.93, 4.82, 1.78, 0.38, col)

# ══════════════════════════════════════════════════════════
# SLIDE 2 — What the app does
# ══════════════════════════════════════════════════════════
s = slide()
box(s, 0, 0, 0.08, SH, fill=GOLD)
txt(s, '\u05de\u05d4 \u05d4\u05de\u05e2\u05e8\u05db\u05ea \u05e2\u05d5\u05e9\u05d4?',
    0.35, 0.18, 9.3, 0.52, size=32, bold=True, color=GOLD, align=PP_ALIGN.RIGHT)
divider(s, 0.82)
for i, (title, lines) in enumerate([
    ('\u05e0\u05d9\u05d4\u05d5\u05dc \u05ea\u05e7\u05e6\u05d9\u05d1', [
        '\u2022 \u05de\u05e1\u05d2\u05e8\u05ea \u05ea\u05e7\u05e6\u05d9\u05d1\u05d9\u05ea \u05dc\u05db\u05dc \u05d9\u05d7\u05d9\u05d3\u05d4',
        '\u2022 \u05de\u05e2\u05e7\u05d1 \u05e9\u05d9\u05de\u05d5\u05e9\u05d9\u05dd \u05d1\u05d6\u05de\u05df \u05d0\u05de\u05ea',
        '\u2022 \u05d9\u05ea\u05e8\u05d4 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea',
        '\u2022 \u05d5\u05d5\u05d9\u05e1\u05d5\u05ea \u05d5\u05e8\u05d5\u05d5\u05d7\u05d9\u05dd',
        '\u2022 \u05e9\u05d9\u05d0\u05d9 \u05ea\u05e7\u05e6\u05d9\u05d1',
    ]),
    ('\u05d1\u05e7\u05e9\u05d5\u05ea \u05e8\u05db\u05e9', [
        '\u2022 \u05d4\u05d2\u05e9\u05ea \u05d1\u05e7\u05e9\u05d4 \u05e2\u05dd \u05ea\u05d9\u05d0\u05d5\u05e8',
        '\u2022 \u05d0\u05d9\u05e9\u05d5\u05e8 \u05e8\u05d1-\u05e9\u05dc\u05d1\u05d9',
        '\u2022 \u05de\u05de\u05ea\u05d9\u05df \u2192 \u05e7\u05e1 \u2192 \u05e7\u05e6\u05d9\u05df',
        '\u2022 \u05de\u05e1\u05e4\u05e8 \u05d0\u05e1\u05de\u05db\u05ea\u05d0',
        '\u2022 \u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d9\u05ea \u05d0\u05d9\u05e9\u05d5\u05e8\u05d9\u05dd',
    ]),
    ('\u05e6\u0027\u05d0\u05d8 \u05de\u05d0\u05d5\u05d1\u05d8\u05d7', [
        '\u2022 \u05d4\u05d5\u05d3\u05e2\u05d5\u05ea 1-\u05e2\u05dc-1',
        '\u2022 \u05e1\u05de\u05e0\u05d9 \u2713 / \u2713\u2713 (\u05e0\u05e7\u05e8\u05d0)',
        '\u2022 \u05d4\u05ea\u05e8\u05d0\u05d5\u05ea \u05de\u05e2\u05e8\u05db\u05ea',
        '\u2022 \u05d4\u05e6\u05e4\u05e0\u05d4 \u05de\u05e7\u05e6\u05d4 \u05dc\u05e7\u05e6\u05d4',
        '\u2022 \u05e9\u05d9\u05d3\u05d5\u05e8 \u05dc\u05e4\u05d9 \u05ea\u05e4\u05e7\u05d9\u05d3',
    ]),
]):
    card(s, 0.35 + i*3.22, 1.05, 3.1, 3.55, title, lines, ts=16, bs=13)
txt(s, '12 \u05ea\u05e4\u05e7\u05d9\u05d3\u05d9\u05dd  |  33 \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd  |  8+ \u05de\u05e1\u05db\u05d9\u05dd',
    0.35, 4.75, 9.3, 0.42, size=14, color=GRAY, align=PP_ALIGN.RIGHT, italic=True)

# ══════════════════════════════════════════════════════════
# SLIDE 3 — Roles
# ══════════════════════════════════════════════════════════
s = slide()
box(s, 0, 0, 0.08, SH, fill=GOLD)
txt(s, '\u05de\u05d1\u05e0\u05d4 \u05d0\u05e8\u05d2\u05d5\u05e0\u05d9 \u05d5\u05ea\u05e4\u05e7\u05d9\u05d3\u05d9\u05dd',
    0.35, 0.18, 9.3, 0.52, size=32, bold=True, color=GOLD, align=PP_ALIGN.RIGHT)
divider(s, 0.82)
for i, (role, desc, col) in enumerate([
    ('\u05e7\u05e6\u05d9\u05df \u05ea\u05e7\u05e6\u05d9\u05d1\u05d9\u05dd / \u05de\u05d0\u05d5"\u05d2 / \u05e1\u05de\u05d0\u05d5"\u05d2',
     '\u05d2\u05d9\u05e9\u05d4 \u05de\u05dc\u05d0\u05d4 \u2014 \u05db\u05dc \u05d4\u05d9\u05d7\u05d9\u05d3\u05d5\u05ea, \u05dc\u05d5\u05d7 \u05d1\u05e7\u05e8\u05d4, \u05d0\u05d9\u05e9\u05d5\u05e8 \u05e1\u05d5\u05e4\u05d9', GOLD),
    ('\u05e7\u05d4"\u05e1 900',
     '\u05ea\u05e7\u05e6\u05d9\u05d1 \u05d7\u05d8\u05d9\u05d1\u05d4 900, \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d1\u05e7\u05e9\u05d5\u05ea', BLUE),
    ('\u05e7\u05dc\u05d7"\u05e7 646 / 179 / 11',
     '\u05e7\u05d5\u05e4\u05ea \u05de\u05e4\u05e7\u05d3, \u05d0\u05d9\u05e9\u05d5\u05e8 \u05d1\u05e7\u05e9\u05d5\u05ea \u05d1\u05d9\u05d7\u05d9\u05d3\u05d4', BLUE),
    ('\u05e1\u05de\u05e4"\u05d3 (\u05de"\u05e4)',
     '\u05d4\u05ea\u05e7\u05e6\u05d9\u05d1 \u05e9\u05dc\u05d9, \u05d4\u05d2\u05e9\u05ea \u05d1\u05e7\u05e9\u05d5\u05ea, \u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4', GREEN),
    ('\u05de\u05d7"\u05d8 / \u05e1\u05de\u05d7"\u05d8 900',
     '\u05ea\u05e6\u05d5\u05d2\u05ea \u05ea\u05e7\u05e6\u05d9\u05d1 \u05d7\u05d8\u05d9\u05d1\u05d4, \u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4', PURPLE),
]):
    yy = 1.02 + i * 0.85
    box(s, 0.35, yy, 0.06, 0.6, fill=col)
    txt(s, role,  0.55, yy+0.05, 4.0, 0.3, size=14, bold=True, color=col)
    txt(s, desc,  0.55, yy+0.35, 9.0, 0.3, size=12, color=GRAY)

# ══════════════════════════════════════════════════════════
# SLIDE 4 — Key screens
# ══════════════════════════════════════════════════════════
s = slide()
box(s, 0, 0, 0.08, SH, fill=GOLD)
txt(s, '\u05de\u05e1\u05db\u05d9\u05dd \u05e2\u05d9\u05e7\u05e8\u05d9\u05d9\u05dd',
    0.35, 0.18, 9.3, 0.52, size=32, bold=True, color=GOLD, align=PP_ALIGN.RIGHT)
divider(s, 0.82)
for i, (name, lines) in enumerate([
    ('\u05dc\u05d5\u05d7 \u05d1\u05e7\u05e8\u05d4',
     ['\u05ea\u05e6\u05d5\u05d2\u05d4 \u05de\u05e8\u05d7\u05d1\u05d9\u05ea \u05d5\u05de\u05e1\u05d5\u05e0\u05e0\u05ea',
      '\u05d2\u05e8\u05e4\u05d9 \u05e2\u05d5\u05d2\u05d4 \u05dc\u05db\u05dc \u05d7\u05d8\u05d9\u05d1\u05d4',
      '\u05de\u05e1\u05e0\u05df \u05dc\u05e4\u05d9 \u05d9\u05d7\u05d9\u05d3\u05d4']),
    ('\u05e6\'"\u05d0\u05d8 / \u05d4\u05ea\u05e8\u05d0\u05d5\u05ea',
     ['\u05de\u05de\u05e9\u05e7 \u05d4\u05d5\u05d3\u05e2\u05d5\u05ea \u05de\u05dc\u05d0',
      '\u05e1\u05de\u05e0\u05d9 \u05e7\u05e8\u05d9\u05d0\u05d4 \u2713\u2713',
      '\u05e7\u05e4\u05d9\u05e6\u05d4 \u05de\u05d4\u05ea\u05e8\u05d0\u05ea \u05de\u05e2\u05e8\u05db\u05ea']),
    ('\u05d1\u05e7\u05e9\u05d5\u05ea \u05e8\u05db\u05e9',
     ['\u05d8\u05d5\u05e4\u05e1 \u05d4\u05d2\u05e9\u05d4 \u05e2\u05dd \u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4',
      '\u05de\u05e1\u05dc\u05d5\u05dc \u05d0\u05d9\u05e9\u05d5\u05e8 \u05de\u05dc\u05d0',
      '\u05de\u05e1\u05e0\u05df \u05dc\u05e4\u05d9 \u05ea\u05e4\u05e7\u05d9\u05d3']),
    ('\u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4',
     ['\u05e4\u05dc\u05d5 3-\u05e9\u05dc\u05d1\u05d9',
      '\u05d7\u05d8\u05d9\u05d1\u05d4 \u2192 \u05d9\u05d7\u05d9\u05d3\u05d4 \u2192 \u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4',
      '\u05e0\u05e2\u05d9\u05dc\u05d4 \u05e9\u05e0\u05ea\u05d9\u05ea']),
    ('\u05de\u05e1\u05d2\u05e8\u05d5\u05ea',
     ['20 \u05de\u05e9\u05d0\u05e7\u05d9\u05dd',
      '\u05e2\u05e8\u05d9\u05db\u05ea \u05e1\u05d8\u05d0\u05d8\u05d5\u05e1',
      '\u05e1\u05d9\u05e0\u05d5\u05df \u05de\u05d4\u05d9\u05e8']),
    ('\u05e9\u05d9\u05de\u05d5\u05e9\u05d9\u05dd',
     ['\u05e9\u05d9\u05de\u05d5\u05e9\u05d9\u05dd \u05de\u05d0\u05d5\u05e9\u05e8\u05d9\u05dd',
      '\u05de\u05d9\u05d5\u05df \u05dc\u05e4\u05d9 \u05d9\u05d7\u05d9\u05d3\u05d4',
      '\u05d2\u05d9\u05e9\u05d4 \u05de\u05d1\u05d5\u05e1\u05e1\u05ea \u05ea\u05e4\u05e7\u05d9\u05d3']),
]):
    col_i = i % 3
    row_i = i // 3
    card(s, 0.35 + col_i*3.22, 1.05 + row_i*1.88, 3.1, 1.72,
         name, lines, ts=14, bs=12)

# ══════════════════════════════════════════════════════════
# SLIDE 5 — Security statement (BIG)
# ══════════════════════════════════════════════════════════
s = slide()
box(s, 0, 0, 0.08, SH, fill=GOLD)

txt(s, '\u05d0\u05d1\u05d8\u05d7\u05d4 \u2014 \u05e8\u05de\u05ea WhatsApp',
    0.35, 0.18, 9.3, 0.52, size=32, bold=True, color=GOLD, align=PP_ALIGN.RIGHT)
divider(s, 0.82)

# Score box centre
box(s, 3.5, 1.05, 3.0, 2.1, fill=CARD_BG, border=GOLD, bw=Pt(2.5))
txt(s, '9 / 10', 3.5, 1.15, 3.0, 1.1,
    size=62, bold=True, color=GOLD, align=PP_ALIGN.CENTER)
txt(s, '\u05e8\u05de\u05ea \u05d0\u05d1\u05d8\u05d7\u05d4 \u05de\u05e8\u05d1\u05d9\u05ea\u05ea',
    3.5, 2.28, 3.0, 0.45, size=14, color=WHITE, align=PP_ALIGN.CENTER)

# 6 security badges below
sec_items = [
    ('Firebase Auth', GOLD),
    ('AES-256-GCM E2E', GREEN),
    ('Forward Secrecy', GREEN),
    ('Firestore Rules', BLUE),
    ('Root Detection', PURPLE),
    ('Network Pinning', BLUE),
]
for i, (lbl, col) in enumerate(sec_items):
    badge(s, lbl, 0.35 + i*1.57, 3.32, 1.48, 0.36, col)

# Two statements at bottom
box(s, 0.35, 3.85, 9.2, 0.52, fill=CARD_BG, border=GREEN, bw=Pt(0.75))
txt(s, '\u05d2\u05dd \u05d0\u05dd \u05de\u05d9\u05e9\u05d4\u05d5 \u05d2\u05d5\u05e0\u05d1 \u05d0\u05ea \u05d4\u05de\u05e4\u05ea\u05d7 \u05d4\u05e4\u05e8\u05d8\u05d9 \u05e9\u05dc\u05da \u05d4\u05d9\u05d5\u05dd \u2014 \u05d4\u05d5\u05d0 \u05dc\u05d0 \u05d9\u05db\u05d5\u05dc \u05dc\u05e4\u05e2\u05e0\u05d7 \u05d0\u05e3 \u05d4\u05d5\u05d3\u05e2\u05d4 \u05e9\u05e0\u05e9\u05dc\u05d7\u05d4 \u05dc\u05e4\u05e0\u05d9 \u05db\u05df. \u05d6\u05d5 Forward Secrecy.',
    0.5, 3.88, 9.0, 0.44, size=12.5, color=GREEN)

box(s, 0.35, 4.48, 9.2, 0.52, fill=CARD_BG, border=BLUE, bw=Pt(0.75))
txt(s, '\u05db\u05dc \u05d4\u05d5\u05d3\u05e2\u05d4 \u05de\u05d5\u05e6\u05e4\u05e0\u05ea \u05dc\u05e4\u05e0\u05d9 \u05e9\u05d4\u05d9\u05d0 \u05e0\u05e9\u05de\u05e8\u05ea \u05d1-Firebase. \u05d0\u05e4\u05d9\u05dc\u05d5 \u05d0\u05dd \u05de\u05d9\u05e9\u05d4\u05d5 \u05e4\u05d5\u05e8\u05e5 \u05d0\u05ea \u05de\u05e1\u05d3 \u05d4\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u2014 \u05d4\u05d5\u05d0 \u05e8\u05d5\u05d0\u05d4 \u05e8\u05e7 \u05e6\u05d9\u05e4\u05e8\u05e0\u05d5\u05ea \u05d1\u05dc\u05ea\u05d9 \u05e7\u05e8\u05d9\u05d0\u05d4.',
    0.5, 4.51, 9.0, 0.44, size=12.5, color=BLUE)

# ══════════════════════════════════════════════════════════
# SLIDE 6 — Security detail: what each layer does
# ══════════════════════════════════════════════════════════
s = slide()
box(s, 0, 0, 0.08, SH, fill=GOLD)
txt(s, '\u05e9\u05db\u05d1\u05d5\u05ea \u05d4\u05d0\u05d1\u05d8\u05d7\u05d4',
    0.35, 0.18, 9.3, 0.52, size=32, bold=True, color=GOLD, align=PP_ALIGN.RIGHT)
divider(s, 0.82)

layers = [
    ('\u05d0\u05d9\u05de\u05d5\u05ea \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd \u2014 Firebase Auth',
     '\u05db\u05dc 33 \u05d4\u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd \u05e8\u05e9\u05d5\u05de\u05d9\u05dd \u05d1-Firebase Auth \u05e9\u05dc Google \u05e2\u05dd Custom Claims (\u05ea\u05e4\u05e7\u05d9\u05d3 + \u05d9\u05d7\u05d9\u05d3\u05d4). \u05d4\u05e1\u05e9\u05df \u05e0\u05e9\u05de\u05e8 \u05d1-Android Keystore.',
     GOLD),
    ('\u05d4\u05e6\u05e4\u05e0\u05ea \u05d4\u05d5\u05d3\u05e2\u05d5\u05ea \u2014 ECDH + HKDF + AES-256-GCM',
     '\u05db\u05dc \u05d4\u05d5\u05d3\u05e2\u05d4 \u05de\u05e9\u05ea\u05de\u05e9\u05ea \u05d1\u05de\u05e4\u05ea\u05d7 \u05d0\u05e4\u05de\u05e8\u05d9 \u05d7\u05d3\u05e9 \u05e9\u05e0\u05d5\u05e6\u05e8 \u05e8\u05e7 \u05dc\u05d0\u05d5\u05ea\u05d4 \u05d4\u05d5\u05d3\u05e2\u05d4 \u05d5\u05e0\u05de\u05d7\u05e7 \u05de\u05d9\u05d3. Forward Secrecy \u2014 \u05d1\u05d3\u05d9\u05d5\u05e7 \u05db\u05de\u05d5 WhatsApp.',
     GREEN),
    ('\u05d7\u05d5\u05e7\u05d9 Firestore \u2014 \u05d2\u05d9\u05e9\u05d4 \u05de\u05d1\u05d5\u05e1\u05e1\u05ea \u05ea\u05e4\u05e7\u05d9\u05d3',
     '\u05db\u05dc \u05e7\u05e8\u05d9\u05d0\u05d4/\u05db\u05ea\u05d9\u05d1\u05d4 \u05dc\u05de\u05e1\u05d3 \u05d4\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05de\u05d5\u05d2\u05d3\u05e8\u05ea \u05d1\u05e9\u05e8\u05ea. \u05d4\u05d5\u05d3\u05e2\u05d4: \u05e8\u05e7 toUserId \u05d5-fromUserId. \u05ea\u05e7\u05e6\u05d9\u05d1: \u05e8\u05e7 admins.',
     BLUE),
    ('\u05d4\u05d2\u05e0\u05ea \u05de\u05db\u05e9\u05d9\u05e8 \u2014 Root + Network + ProGuard',
     '\u05d6\u05d9\u05d4\u05d5\u05d9 \u05de\u05db\u05e9\u05d9\u05e8 \u05e4\u05e8\u05d5\u05e5 (5 \u05d1\u05d3\u05d9\u05e7\u05d5\u05ea), \u05d7\u05e1\u05d9\u05de\u05ea \u05ea\u05e2\u05d5\u05d3\u05d5\u05ea CA \u05e9\u05dc \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd (\u05de\u05e0\u05d9\u05e2\u05ea MITM), \u05e2\u05e8\u05e4\u05d5\u05dc \u05e7\u05d5\u05d3 (ProGuard).',
     PURPLE),
]

for i, (title, desc, col) in enumerate(layers):
    row, ci = divmod(i, 2)
    xx = 0.35 + ci * 4.85
    yy = 1.0 + row * 2.15
    box(s, xx, yy, 4.55, 1.95, fill=CARD_BG, border=col, bw=Pt(1.5))
    box(s, xx, yy, 4.55, 0.38, fill=col)
    txt(s, title, xx+0.12, yy+0.04, 4.3, 0.3, size=13, bold=True, color=DARK_BG)
    txt(s, desc,  xx+0.12, yy+0.48, 4.3, 1.35, size=11.5, color=WHITE)

# ══════════════════════════════════════════════════════════
# SLIDE 7 — Summary
# ══════════════════════════════════════════════════════════
s = slide()
box(s, 0, 0, 0.08, SH, fill=GOLD)
txt(s, '\u05e1\u05d9\u05db\u05d5\u05dd',
    0.35, 0.22, 9.3, 0.6, size=40, bold=True, color=GOLD, align=PP_ALIGN.RIGHT)
divider(s, 0.95)

for i, (icon, title, desc) in enumerate([
    ('\U0001f3d7', '\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4 \u05de\u05dc\u05d0\u05d4',
     '33 \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd, 12 \u05ea\u05e4\u05e7\u05d9\u05d3\u05d9\u05dd, 8+ \u05de\u05e1\u05db\u05d9\u05dd, \u05e0\u05d9\u05d4\u05d5\u05dc \u05ea\u05e7\u05e6\u05d9\u05d1 \u05d0\u05de\u05d9\u05ea\u05d9 \u05dc\u05d0\u05d5\u05d2\u05d3\u05d4 99'),
    ('\U0001f510', '\u05d0\u05d1\u05d8\u05d7\u05d4 \u05de\u05e8\u05de\u05ea WhatsApp',
     'Forward Secrecy, ECDH+HKDF+AES-256-GCM, Firebase Auth, Firestore Rules \u2014 \u05e6\u05d9\u05d5\u05df 9/10'),
    ('\U0001f4f1', '\u05d4\u05d2\u05e0\u05ea \u05de\u05db\u05e9\u05d9\u05e8',
     'Root Detection (\u05d7\u05de\u05e9 \u05d1\u05d3\u05d9\u05e7\u05d5\u05ea), Network Pinning, ProGuard, Android Keystore'),
    ('\u2601', '\u05d4\u05d2\u05e0\u05ea \u05e9\u05e8\u05ea',
     '\u05d7\u05d5\u05e7\u05d9 Firestore \u05e7\u05e4\u05d3\u05e0\u05d9\u05d9\u05dd \u2014 \u05db\u05dc endpoint \u05de\u05d5\u05d2\u05df \u05dc\u05e4\u05d9 \u05ea\u05e4\u05e7\u05d9\u05d3 \u05d5\u05de\u05d6\u05d4\u05d4 \u05de\u05e9\u05ea\u05de\u05e9'),
]):
    yy = 1.12 + i * 0.98
    box(s, 0.35, yy, 9.2, 0.82, fill=CARD_BG, border=GOLD, bw=Pt(0.5))
    txt(s, icon,  0.45, yy+0.15, 0.6, 0.5, size=22)
    txt(s, title, 1.1,  yy+0.06, 3.2, 0.3, size=15, bold=True, color=GOLD)
    txt(s, desc,  1.1,  yy+0.42, 7.8, 0.3, size=12, color=WHITE)

txt(s, '\u05de\u05d8\u05d1\u05e2 \u05d4\u05d1\u05d6\u05e7  |  v1.7  |  \u05d0\u05d5\u05d2\u05d3\u05d4 99',
    0.35, 5.25, 9.3, 0.3, size=12, color=GRAY, align=PP_ALIGN.RIGHT, italic=True)

# ── Save ──────────────────────────────────────────────────
import sys
out = r'C:\Users\elads\OneDrive\Desktop\budget_presentation.pptx'
prs.save(out)
sys.stdout.buffer.write(b'Saved: ' + out.encode() + b'\n')
