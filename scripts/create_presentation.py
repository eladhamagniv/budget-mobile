"""
Screenshots each slide of budget-presentation.html with Playwright,
then assembles them into a .pptx file.

Run: python scripts/create_presentation.py
"""

import sys, os, shutil, asyncio, tempfile
from pathlib import Path
from playwright.async_api import async_playwright
from pptx import Presentation
from pptx.util import Inches, Pt

# ── Paths ─────────────────────────────────────────────────────────────────────
HTML_SRC   = r'C:\Users\elads\Desktop\budget-presentation.html'
OUT_PPTX   = r'C:\Users\elads\OneDrive\Desktop\budget_presentation_v3.pptx'
SHOT_DIR   = Path(tempfile.mkdtemp(prefix='pptx_shots_'))

# Slide dimensions (pixels — must match the CSS viewport 1920×1080)
VW, VH = 1920, 1080

# ── New security slides HTML to inject ────────────────────────────────────────
NEW_SLIDES_HTML = """
  <!-- ══════════ SLIDE — ADVANCED SECURITY ══════════ -->
  <div class="slide" id="slide-sec-adv">
    <div class="slide-header">
      <div class="slide-label">אבטחה מתקדמת</div>
      <h2>הצפנה ברמת WhatsApp — <span class="gold-text">Forward Secrecy מלא</span></h2>
    </div>

    <div class="security-grid" style="grid-template-columns:repeat(3,1fr);max-width:960px;gap:16px;">

      <div class="sec-card">
        <div class="sec-icon-wrap">🔐</div>
        <div>
          <h3>E2E Encryption — ECDH P-256</h3>
          <p>כל הודעת צ'אט מוצפנת מקצה לקצה עם ECDH + HKDF-SHA-256 + AES-256-GCM. אפילו אנחנו לא יכולים לקרוא את ההודעות.</p>
        </div>
      </div>

      <div class="sec-card">
        <div class="sec-icon-wrap">⚡</div>
        <div>
          <h3>Forward Secrecy — מפתח חד-פעמי</h3>
          <p>לכל הודעה נוצר Ephemeral Key Pair חדש שנמחק מיד. גם אם המפתח הארוך-טווח נגנב — ההודעות הישנות מוגנות לחלוטין.</p>
        </div>
      </div>

      <div class="sec-card">
        <div class="sec-icon-wrap">🔑</div>
        <div>
          <h3>Android Keystore — חומרה</h3>
          <p>המפתח הפרטי מאוחסן ב-Android Keystore המגובה בחומרה. לא ניתן לחלץ אותו — אפילו עם גישת root למכשיר.</p>
        </div>
      </div>

      <div class="sec-card">
        <div class="sec-icon-wrap">🛡️</div>
        <div>
          <h3>Root Detection — 5 בדיקות</h3>
          <p>בדיקות Native: build-tags, su binaries, אפליקציות root ידועות, system props מסוכנים, /system writable. גישה חסומה על מכשירים פרוצים.</p>
        </div>
      </div>

      <div class="sec-card">
        <div class="sec-icon-wrap">🌐</div>
        <div>
          <h3>Network Security Config</h3>
          <p>רק אישורי CA ממערכת מותרים — ללא User CAs, ללא cleartext traffic. HTTPS בלבד. מניעת מתקפות Man-in-the-Middle.</p>
        </div>
      </div>

      <div class="sec-card">
        <div class="sec-icon-wrap">🔒</div>
        <div>
          <h3>ProGuard + R8 Obfuscation</h3>
          <p>כל קוד האפליקציה עובר obfuscation ו-shrinking בגרסת release. allowBackup=false. מניעת הנדסה לאחור.</p>
        </div>
      </div>

    </div>

    <div class="security-banner" style="max-width:960px;margin-top:16px;">
      <span style="font-size:24px;">⚡</span>
      <div>
        <strong>אותה רמת הצפנה כמו WhatsApp:</strong>
        Ephemeral ECDH P-256 · AES-256-GCM · HKDF-SHA-256 · Forward Secrecy · Android Keystore Hardware-Backed
      </div>
    </div>
  </div>

  <!-- ══════════ SLIDE — E2EE PROTOCOL ══════════ -->
  <div class="slide" id="slide-e2ee">
    <div class="slide-header">
      <div class="slide-label">פרוטוקול הצפנה</div>
      <h2>איך ההצפנה עובדת — <span class="gold-text">צעד אחר צעד</span></h2>
    </div>

    <div style="display:flex;gap:28px;width:100%;max-width:960px;align-items:flex-start;">

      <!-- Protocol steps -->
      <div style="flex:1.3;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">

          <div class="sec-card" style="flex-direction:column;gap:10px;padding:20px 18px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--gold-dim),var(--gold));color:var(--bg-deep);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;">1</div>
              <strong style="color:var(--gold-light);font-size:0.9rem;">יצירת Ephemeral Key</strong>
            </div>
            <p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin:0;">Alice מייצרת EC P-256 Key Pair חדש לגמרי לכל הודעה בנפרד</p>
          </div>

          <div class="sec-card" style="flex-direction:column;gap:10px;padding:20px 18px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--gold-dim),var(--gold));color:var(--bg-deep);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;">2</div>
              <strong style="color:var(--gold-light);font-size:0.9rem;">ECDH Key Exchange</strong>
            </div>
            <p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin:0;">shared_secret = ECDH(eph_priv, Bob_long_term_pub)</p>
          </div>

          <div class="sec-card" style="flex-direction:column;gap:10px;padding:20px 18px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--gold-dim),var(--gold));color:var(--bg-deep);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;">3</div>
              <strong style="color:var(--gold-light);font-size:0.9rem;">HKDF Key Derivation</strong>
            </div>
            <p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin:0;">aes_key = HKDF-SHA-256(shared_secret, info="budget-mobile-v2")</p>
          </div>

          <div class="sec-card" style="flex-direction:column;gap:10px;padding:20px 18px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--gold-dim),var(--gold));color:var(--bg-deep);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;">4</div>
              <strong style="color:var(--gold-light);font-size:0.9rem;">AES-256-GCM Encrypt</strong>
            </div>
            <p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin:0;">ciphertext = AES-256-GCM(aes_key, random_iv, plaintext)</p>
          </div>

          <div class="sec-card" style="flex-direction:column;gap:10px;padding:20px 18px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--gold-dim),var(--gold));color:var(--bg-deep);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;">5</div>
              <strong style="color:var(--gold-light);font-size:0.9rem;">Wire Format</strong>
            </div>
            <p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin:0;">[0x02 | ephPub(65B) | wrappedKey(40B) | iv(12B) | ciphertext]</p>
          </div>

          <div class="sec-card" style="flex-direction:column;gap:10px;padding:20px 18px;background:rgba(201,168,76,0.08);border-color:rgba(201,168,76,0.4);">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:30px;height:30px;border-radius:50%;background:var(--gold);color:var(--bg-deep);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;">6</div>
              <strong style="color:var(--gold);font-size:0.9rem;">מחיקת המפתח ✓</strong>
            </div>
            <p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin:0;">ephA_priv נמחק — Forward Secrecy בתוקף מכאן ואילך לנצח</p>
          </div>

        </div>
      </div>

      <!-- Right side: comparison + key storage -->
      <div style="flex:1;display:flex;flex-direction:column;gap:16px;">

        <div style="background:rgba(26,122,74,0.1);border:1px solid rgba(26,122,74,0.35);border-radius:14px;padding:20px 18px;">
          <div style="font-size:0.9rem;font-weight:800;color:#4ade80;margin-bottom:10px;">✅ WhatsApp — Signal Protocol</div>
          <div style="font-size:0.78rem;color:var(--text-secondary);line-height:1.6;">Ephemeral ECDH · AES-256-GCM · Forward Secrecy · Double Ratchet</div>
        </div>

        <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.35);border-radius:14px;padding:20px 18px;">
          <div style="font-size:0.9rem;font-weight:800;color:var(--gold-light);margin-bottom:10px;">✅ מטבע הבזק — אותו פרוטוקול</div>
          <div style="font-size:0.78rem;color:var(--text-secondary);line-height:1.6;">Ephemeral ECDH P-256 · AES-256-GCM · Forward Secrecy · AES-KW Sender Copy</div>
        </div>

        <div class="sec-card" style="flex-direction:column;gap:12px;padding:20px 18px;">
          <div style="font-size:0.9rem;font-weight:800;color:var(--gold-light);">🔑 אחסון מפתחות</div>
          <div style="font-size:0.78rem;color:var(--text-secondary);line-height:1.8;">
            מפתח פרטי → Android Keystore (חומרה)<br>
            מפתח ציבורי → Firestore (TLS מוצפן)<br>
            Sessions → expo-secure-store
          </div>
        </div>

      </div>
    </div>
  </div>
"""

# ── Build modified HTML with new slides injected ──────────────────────────────
def build_modified_html():
    src = Path(HTML_SRC).read_text(encoding='utf-8')
    # Inject new slides right before </div> that closes #presentation
    # The marker is the last occurrence of the closing navigation div
    insert_marker = '<!-- Navigation -->'
    idx = src.find(insert_marker)
    if idx == -1:
        raise RuntimeError('Could not find injection marker in HTML')
    modified = src[:idx] + NEW_SLIDES_HTML + '\n' + src[idx:]
    tmp = SHOT_DIR / 'presentation_modified.html'
    tmp.write_text(modified, encoding='utf-8')
    return tmp


# ── Screenshot all slides ─────────────────────────────────────────────────────
async def screenshot_slides(html_path: Path) -> list[Path]:
    shots = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={'width': VW, 'height': VH})
        await page.goto(html_path.as_uri(), wait_until='networkidle')
        # Wait for fonts/animations to settle
        await page.wait_for_timeout(600)

        # Count slides
        total = await page.evaluate("document.querySelectorAll('.slide').length")
        print(f'  Found {total} slides')

        for i in range(total):
            # Navigate to slide i
            await page.evaluate(f"goTo({i})")
            await page.wait_for_timeout(400)  # let transition finish

            path = SHOT_DIR / f'slide_{i+1:02d}.png'
            await page.screenshot(path=str(path), clip={'x': 0, 'y': 0, 'width': VW, 'height': VH})
            shots.append(path)
            print(f'  Screenshot {i+1}/{total}: {path.name}')

        await browser.close()
    return shots


# ── Build PPTX from screenshots ───────────────────────────────────────────────
def build_pptx(shots: list[Path], out: str):
    prs = Presentation()
    prs.slide_width  = Inches(VW / 96)   # 1920px @ 96dpi = 20"
    prs.slide_height = Inches(VH  / 96)  # 1080px @ 96dpi = 11.25"
    blank = prs.slide_layouts[6]

    for shot in shots:
        slide = prs.slides.add_slide(blank)
        slide.shapes.add_picture(
            str(shot),
            left=0, top=0,
            width=prs.slide_width,
            height=prs.slide_height,
        )
    prs.save(out)
    print(f'\n  Saved: {out}')


# ── Main ──────────────────────────────────────────────────────────────────────
async def main():
    print('Building modified HTML ...')
    html = build_modified_html()

    print('Screenshotting slides ...')
    shots = await screenshot_slides(html)

    print('Assembling PPTX ...')
    build_pptx(shots, OUT_PPTX)

    # Cleanup temp dir
    shutil.rmtree(SHOT_DIR, ignore_errors=True)


asyncio.run(main())
