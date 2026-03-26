"""
Screenshots each slide of budget-presentation.html with Playwright,
then assembles them into a .pptx file.

Run: python scripts/create_presentation.py
"""

import sys, shutil, asyncio, tempfile
from pathlib import Path
from playwright.async_api import async_playwright
from pptx import Presentation
from pptx.util import Inches

# ── Paths ─────────────────────────────────────────────────────────────────────
HTML_SRC = r'C:\Users\elads\Desktop\budget-presentation.html'
OUT_PPTX = r'C:\Users\elads\OneDrive\Desktop\budget_presentation_v4.pptx'
SHOT_DIR = Path(tempfile.mkdtemp(prefix='pptx_shots_'))

# Slide viewport (must match the CSS fullscreen layout)
VW, VH = 1920, 1080

# ── E2EE protocol slide to inject after the security slide ────────────────────
NEW_SLIDES_HTML = """
  <!-- ══════════ SLIDE — E2EE PROTOCOL ══════════ -->
  <div class="slide" id="slide-e2ee">
    <div class="slide-header">
      <div class="slide-label">פרוטוקול הצפנה</div>
      <h2>איך ההצפנה עובדת — <span class="gold-text">צעד אחר צעד</span></h2>
    </div>

    <div style="display:flex;gap:28px;width:100%;max-width:960px;align-items:flex-start;">

      <!-- Protocol steps (left) -->
      <div style="flex:1.3;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">

          <div class="sec-card" style="flex-direction:column;gap:10px;padding:20px 18px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--gold-dim),var(--gold));color:var(--bg-deep);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;">1</div>
              <strong style="color:var(--gold-light);font-size:0.9rem;">יצירת Ephemeral Key</strong>
            </div>
            <p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin:0;">נוצר EC P-256 Key Pair חדש לגמרי לכל הודעה בנפרד</p>
          </div>

          <div class="sec-card" style="flex-direction:column;gap:10px;padding:20px 18px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--gold-dim),var(--gold));color:var(--bg-deep);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;">2</div>
              <strong style="color:var(--gold-light);font-size:0.9rem;">ECDH Key Exchange</strong>
            </div>
            <p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin:0;">shared_secret = ECDH(eph_priv, recipient_long_term_pub)</p>
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
            מפתח פרטי &#x2192; Android Keystore (חומרה)<br>
            מפתח ציבורי &#x2192; Firestore (TLS מוצפן)<br>
            Sessions &#x2192; expo-secure-store
          </div>
        </div>

      </div>
    </div>
  </div>
"""


# ── Build modified HTML with E2EE slide injected ──────────────────────────────
def build_modified_html():
    src = Path(HTML_SRC).read_text(encoding='utf-8')
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
        await page.wait_for_timeout(600)

        total = await page.evaluate("document.querySelectorAll('.slide').length")
        print(f'  Found {total} slides')

        for i in range(total):
            await page.evaluate(f"goTo({i})")
            await page.wait_for_timeout(400)
            path = SHOT_DIR / f'slide_{i+1:02d}.png'
            await page.screenshot(path=str(path), clip={'x': 0, 'y': 0, 'width': VW, 'height': VH})
            shots.append(path)
            print(f'  Screenshot {i+1}/{total}: {path.name}')

        await browser.close()
    return shots


# ── Build PPTX from screenshots ───────────────────────────────────────────────
def build_pptx(shots: list[Path], out: str):
    prs = Presentation()
    prs.slide_width  = Inches(VW / 96)
    prs.slide_height = Inches(VH / 96)
    blank = prs.slide_layouts[6]
    for shot in shots:
        slide = prs.slides.add_slide(blank)
        slide.shapes.add_picture(
            str(shot), left=0, top=0,
            width=prs.slide_width, height=prs.slide_height,
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
    shutil.rmtree(SHOT_DIR, ignore_errors=True)


asyncio.run(main())
