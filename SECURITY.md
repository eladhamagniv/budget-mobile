# Security Documentation — מטבע הבזק v1.7

> **Audience:** System administrators, security reviewers, and developers.
> This document covers every security control in the app, what it does, why it exists,
> and what happens when an attacker targets it.

---

## Table of Contents

1. [Authentication & Identity](#1-authentication--identity)
2. [Session Management](#2-session-management)
3. [Biometric Gate](#3-biometric-gate)
4. [Brute-Force Lockout](#4-brute-force-lockout)
5. [End-to-End Encrypted Messaging](#5-end-to-end-encrypted-messaging)
6. [Secure Token Storage](#6-secure-token-storage)
7. [Network Security](#7-network-security)
8. [Device Integrity Checks](#8-device-integrity-checks)
9. [Anti-Tampering & Anti-Debugging](#9-anti-tampering--anti-debugging)
10. [Build Hardening](#10-build-hardening)
11. [Firestore Security Rules](#11-firestore-security-rules)
12. [PDF Export Feature](#12-pdf-export-feature)
13. [Attacker Scenario Playbook](#13-attacker-scenario-playbook)

---

## 1. Authentication & Identity

### 1.1 Device-Bound Password Derivation (v3)

**What it is:**
The password a user types (e.g. `R$Gy6u522R5mJ#`) is never sent directly to Firebase.
Instead, the app runs it through a derivation function that produces a 64-character hex string unique to *that user on that physical device*.

**How it works:**
```
salt       = username + ":" + deviceKey + ":idf.budget.v3"
hash_0     = SHA-256( salt + ":" + rawPassword )
hash_1     = SHA-256( hash_1 + ":" + salt )
...
hash_199   = SHA-256( hash_198 + ":" + salt )   ← this is the Firebase password
```

- **deviceKey** — a 256-bit random value generated once per user per device, stored in the Android Keystore (hardware-backed). It never leaves the device.
- **200 rounds** — multiplies the cost of any brute-force attack by 200×.
- **Username salt** — even if two users share the same raw password, their Firebase passwords are completely different.

**What if an attacker steals the Firebase password hash?**
They have a 64-character hex string derived from 200 rounds of SHA-256 mixed with a device-bound secret key. Without the physical device (to read the deviceKey from the hardware keystore), the hash cannot be reversed or re-computed — even if the attacker knows the user's raw password. The stolen hash is useless.

**What if an attacker steals the raw password?**
Without the deviceKey (which lives in hardware on the victim's phone), they still cannot compute the Firebase password and cannot log in on any other device.

---

### 1.2 Self-Migration: v1 → v3

**What it is:**
Users who were created before v3 existed had a simpler password scheme: `"1" + rawPassword`.
On their first login after upgrading to v1.7, the app automatically upgrades them to v3 — no manual steps required.

**How it works:**
1. User logs in on a new/upgraded device.
2. App detects no deviceKey in SecureStore for this user.
3. App signs in with the old v1 password to Firebase.
4. App generates a new 256-bit deviceKey, stores it in the Keystore.
5. App calls `updatePassword()` to replace the old Firebase password with the new v3 hash.
6. All future logins use v3.

**What if an attacker intercepts the migration?**
The migration only runs once, over HTTPS (Firebase SDK enforces TLS 1.3). There is no window for a replay attack. After migration, the v1 password is invalidated in Firebase — it no longer works.

---

### 1.3 Admin Password Reset

**What it is:**
If a user loses their phone (and therefore their deviceKey), an admin runs `scripts/resetUserPassword.js` to reset their Firebase password back to the v1 scheme. The user then installs the app on a new device and self-migrates to v3 again automatically.

**What if an attacker gets the reset script?**
The script requires `scripts/serviceAccountKey.json` — a Firebase Admin SDK private key that is never committed to git and lives only on the admin's secured machine. Without it, the script does nothing.

---

## 2. Session Management

**What it is:**
After a successful login, a session token is written to SecureStore containing the user's profile and an expiry timestamp 7 days in the future. On app launch, the token is read and validated.

**How it works:**
- Storage key: `auth_session_v3` in SecureStore (hardware-backed encrypted storage).
- Expiry: `Date.now() + 7 × 24 × 60 × 60 × 1000` milliseconds.
- If the app is open when the session expires, a `setTimeout` fires and logs the user out automatically.
- On logout, the session token is deleted from SecureStore.

**What if an attacker copies the session token off the device?**
SecureStore on Android is backed by the Android Keystore, which ties encryption keys to the device hardware. The encrypted blob cannot be decrypted on any other device — copying the raw bytes is useless without the hardware key.

**What if the device is offline for 7 days?**
The session expires based on local time, not a server check. The user is logged out and must re-authenticate with their password + fingerprint.

---

## 3. Biometric Gate

**What it is:**
Every time the app is opened (cold start), even if a valid 7-day session exists, the user must verify their fingerprint before the main app is shown.

**How it works:**
- On cold start: `biometricUnlocked = false` (in-memory only, resets every launch).
- `AppNavigator` shows `BiometricScreen` whenever `user` exists but `biometricUnlocked` is false.
- `BiometricScreen` calls the OS biometric API (`expo-local-authentication`).
- The OS reads the fingerprint from the phone's Trusted Execution Environment (TEE) / Secure Enclave.
- The app receives only `{ success: true/false }` — no fingerprint data ever enters the app.
- On success: `biometricUnlocked = true`, main app shown.
- Device PIN fallback is **disabled** — biometric only.

**After password login:**
The biometric gate is automatically satisfied because the user just proved their identity with full credentials. No second prompt.

**If biometrics are not enrolled on the device:**
The user is forced back to the login screen. The app will not open without either a password login or a successful fingerprint.

**What if an attacker has the phone but no enrolled fingerprint?**
They cannot pass the biometric gate. They are redirected to the login screen, where they face the brute-force lockout (see §4). With no fingerprint enrolled, the device is effectively useless for accessing the app.

**What if an attacker uses a silicone fingerprint mold?**
Modern Android phones use capacitive or ultrasonic sensors that detect liveness (pulse, 3D depth). A flat mold fails. This is enforced by the phone hardware — outside the app's control — and is the same protection used by mobile banking apps.

**What if an attacker bypasses the biometric prompt with a screen-reader exploit?**
The biometric API runs inside the OS's trusted UI. No app-level code can intercept or fake its result. A bypass would require a kernel-level exploit — at which point the device itself is compromised (detected by §8).

---

## 4. Brute-Force Lockout

**What it is:**
Failed login attempts trigger a progressive lockout that survives app restarts.

**Schedule:**
| Attempts | Lockout Duration |
|----------|-----------------|
| 1–4      | No lockout, remaining attempts shown |
| 5–9      | 5 minutes |
| 10–14    | 30 minutes |
| 15+      | 24 hours |

**How it works:**
- Lockout state is stored in `login_lockout_v1` in SecureStore (survives app kill and reboot).
- On each failed attempt, the counter increments and a `lockedUntil` timestamp is written.
- On app launch, the lockout is restored and a live countdown timer is shown in the UI.
- On successful login, the lockout counter is cleared.

**What if an attacker reinstalls the app to reset the counter?**
On Android, reinstalling the app clears SecureStore. However, the lockout is also enforced server-side by Firebase: Firebase Auth has its own rate-limiting (`auth/too-many-requests`) that is IP- and UID-based and cannot be reset by reinstalling.

**What if an attacker writes a script to try 1000 passwords per minute?**
- Client-side: blocked after 5 attempts for 5 minutes.
- Server-side: Firebase throttles and blocks the account independently.
- Each attempt also requires computing 200 rounds of SHA-256 on the derived password — this is computationally expensive for automated scripts.

---

## 5. End-to-End Encrypted Messaging

**What it is:**
All messages (notifications/chat) sent between users are encrypted before leaving the device and can only be decrypted by the intended recipient. Not even the server (Firebase) can read the content.

**Protocol (WhatsApp/Signal-level forward secrecy):**

**Encryption (sender → recipient):**
1. Generate a fresh ephemeral EC P-256 key pair `(eph_priv, eph_pub)` — exists only for this one message.
2. `shared_secret = ECDH(eph_priv, recipient_long_term_pub)`
3. `aes_key = HKDF-SHA-256(shared_secret, info="budget-mobile-v2-message")`
4. `ciphertext = AES-256-GCM(aes_key, random_iv, plaintext)`
5. Also wrap `aes_key` for the sender using `ECDH(eph_priv, sender_long_term_pub) → HKDF → AES-KW` (so the sender can re-read their sent messages).
6. `eph_priv` is discarded immediately — **it never touches persistent storage**.
7. Stored in Firestore: `[version(1) | eph_pub(65) | wrapped_key_for_sender(40) | iv(12) | ciphertext]`

**Decryption (recipient):**
1. Parse wire format to extract `eph_pub`, `iv`, `ciphertext`.
2. `shared_secret = ECDH(recipient_long_term_priv, eph_pub)` — same result as step 2 above.
3. Re-derive `aes_key`, decrypt.

**Long-term key storage:**
- **Private key** → `expo-secure-store` (Android Keystore hardware encryption). Never leaves the device.
- **Public key** → Firestore `users/{username}.publicKey` (readable by all authenticated users, public by design).

**What is Forward Secrecy?**
Even if an attacker steals your private key today, they cannot decrypt any message sent before that moment. Each message used a unique ephemeral key that no longer exists — there is nothing to steal retroactively.

**What if Firebase is breached and all messages are downloaded?**
Every message is an opaque encrypted blob. Without the recipient's private key (which lives in the phone's hardware keystore and never touches Firebase), the content is unreadable. The attacker gets encrypted noise.

**What if an attacker steals the victim's phone and extracts the private key from SecureStore?**
They would also need to pass the biometric gate (§3) and know the password. If they somehow extract the key from the Keystore directly, they can decrypt messages going forward — but messages sent before the key extraction remain secure (forward secrecy). They would also need to decrypt the AES-KW wrapped key for each historical message using the now-deleted ephemeral private key, which is impossible.

**What if an attacker performs a man-in-the-middle on Firestore to swap public keys?**
Firestore is accessed over TLS 1.3. A MITM attack requires either breaking TLS (computationally infeasible) or installing a rogue CA certificate on the device. Installing a rogue CA is blocked by the network security config (see §7).

---

## 6. Secure Token Storage

### 6.1 Firebase Auth Tokens in Android Keystore

**What it is:**
Firebase auth tokens (JWTs) are normally stored in plain AsyncStorage — an unencrypted SQLite database readable by anyone with root access. This app replaces AsyncStorage with a custom `SecureStorageAdapter` that stores everything in `expo-secure-store` (Android Keystore / iOS Secure Enclave).

**What it does:**
- All Firebase session tokens are encrypted at the hardware level.
- Large values are chunked into 1800-byte pieces to comply with iOS Keychain size limits.
- Firebase key strings containing special characters (colons, brackets) are sanitized to alphanumeric before storage.

**What if an attacker has root access and reads AsyncStorage?**
There is no AsyncStorage. Firebase tokens live in the hardware-encrypted Keystore — readable only by this app on this device. Root access alone is not enough to extract Keystore-protected values (it requires exploiting the TEE itself, which is a separate hardware boundary).

### 6.2 Device Keys, Session, and ECDH Keys

All secrets follow the same pattern — stored in `expo-secure-store` backed by the Android Keystore:

| Key | Contents |
|-----|----------|
| `device_key_{username}` | 256-bit random, used in password derivation |
| `auth_session_v3` | User profile + expiry timestamp |
| `ecdh_keypair_v2` | ECDH P-256 private + public key (JWK) |
| `login_lockout_v1` | Brute-force attempt counter |

---

## 7. Network Security

### 7.1 HTTPS Only — No Cleartext Traffic

**What it is:**
`android:networkSecurityConfig` is set to `cleartextTrafficPermitted="false"`. The app will refuse to make any HTTP connection — only HTTPS is allowed.

**What if an attacker sets up a HTTP downgrade proxy?**
The Android network stack rejects the connection at the OS level before any data is sent. This is not a code-level check that can be patched — it is enforced by the OS certificate pinning infrastructure.

### 7.2 User-Installed CA Certificates Blocked

**What it is:**
The network security config trusts only **system** CA certificates, not user-installed ones. This prevents the most common mobile interception attack: installing a rogue CA (e.g. Burp Suite, Charles Proxy) to decrypt TLS traffic.

**What if an attacker installs their own CA certificate on the device?**
All Firebase and API calls will fail with a TLS handshake error. The attacker sees nothing. This works even on a fully rooted device with a custom certificate installed.

**Debug builds** allow user CAs so developers can use proxies during development. This exception is stripped from release builds.

---

## 8. Device Integrity Checks

On every app launch, before showing any content, the app runs a full device integrity scan. If any check fails, a "גישה נדחתה" (Access Denied) screen is shown and the app does not load.

### 8.1 Root Detection (5 checks)

| Check | What it detects |
|-------|----------------|
| Build tags | Rooted ROMs built with `test-keys` instead of `release-keys` |
| su binaries | Presence of `su` at 10+ known paths (`/system/bin/su`, `/sbin/su`, etc.) |
| Root apps | 12 known root managers (Magisk, SuperSU, KingRoot, etc.) via PackageManager |
| Dangerous props | `ro.debuggable=1` or `ro.secure=0` — set on unlocked bootloaders |
| Writable /system | Attempts to create a file in `/system/` — fails on stock ROMs |

**What if an attacker uses Magisk Hide to conceal root?**
Magisk Hide renames packages and removes the su binary from scans. However, the `test-keys` build tag and dangerous props checks survive most Magisk Hide configurations. Additionally, the tamper detection (§9) detects the Frida tools that attackers typically use alongside Magisk.

### 8.2 Emulator Detection (scoring system)

Scores 5 hardware/build indicators. If **3 or more** match, the device is classified as an emulator and access is denied.

| Indicator | Examples |
|-----------|---------|
| FINGERPRINT | starts with `generic`, contains `vbox`, `test-keys`, `sdk_gphone` |
| MODEL | contains `emulator`, `android sdk`, `sdk` |
| MANUFACTURER | `genymotion`, `unknown` |
| HARDWARE | contains `goldfish`, `ranchu`, `vbox` |
| PRODUCT | `sdk`, contains `emulator`, `sdk_gphone` |

Using a scoring system (3/5 threshold) avoids false positives on real devices with unusual build strings.

**What if an attacker modifies emulator build props to evade detection?**
They would need to fake at least 3 of the 5 indicators correctly. Even if they succeed, they still face all other security layers — the device-bound password is tied to the Keystore (which emulators simulate poorly), and biometric is not available on most emulators.

---

## 9. Anti-Tampering & Anti-Debugging

### 9.1 Frida Detection

Frida is the most commonly used tool to hook into running apps, intercept function calls, and dump memory. Three independent checks:

| Check | Method |
|-------|--------|
| Files on disk | Scans 6 known Frida server/agent paths in `/data/local/tmp/` and `/system/` |
| `/proc/self/maps` | Reads the process memory map and looks for `frida`, `gadget`, `linjector` |

**What if an attacker renames the Frida server binary?**
The `/proc/self/maps` check catches Frida's gadget regardless of the binary name, because the injected library appears in the process's own memory map.

### 9.2 Xposed Framework Detection

Xposed hooks into every method call at the Dalvik/ART level. Two checks:

1. **Stack trace check** — throws a controlled exception and scans each frame for `de.robv.android.xposed` or `com.saurik.substrate` class names.
2. **Package check** — scans for Xposed Installer, EdXposed Manager, LSPosed Manager via PackageManager.

**What if an attacker uses LSPosed's "whitelist" mode to hide from package checks?**
The stack trace check is independent of package visibility. If Xposed is hooking methods, its classes appear in the call stack and are detected.

### 9.3 Hooking Framework Detection (Cydia Substrate / RootCloak)

Checks both files on disk (`/system/lib/libsubstrate.so`) and packages (`com.saurik.substrate`, `com.devadvance.rootcloak`, etc.).

### 9.4 Debugger Kill Switch

**What it is:**
`MainActivity.onCreate()` calls `Debug.isDebuggerConnected()` at the very first line of execution. If a debugger is attached, the process is killed immediately with `Process.killProcess()`.

**What if an attacker attaches a debugger after launch?**
`RootDetectionModule.isTampered()` also calls `Debug.isDebuggerConnected()` and is invoked on every app launch as part of the integrity check. Attaching mid-session would be caught on the next check.

**What if an attacker uses a non-standard debugger (e.g. IDA Pro, Frida without a process attachment)?**
Frida-without-debugger is caught by the Frida file and maps checks. IDA Pro remote debug uses standard ptrace/JDWP, which sets the debugger-connected flag.

---

## 10. Build Hardening

### 10.1 ProGuard + R8 Obfuscation

**What it is:**
Release builds run through R8 (Google's code shrinker + obfuscator). All class names, method names, and field names are renamed to single letters. Dead code is removed. The result is a compact binary that is very difficult to reverse-engineer.

**What if an attacker decompiles the APK with jadx or apktool?**
They see obfuscated code like `a.b.c()` with no meaningful names. Reconstructing the original logic requires significant manual effort. Combined with Hermes (the JS engine), the JavaScript bundle is pre-compiled to bytecode — not readable source code.

### 10.2 FLAG_SECURE

**What it is:**
`WindowManager.LayoutParams.FLAG_SECURE` is set in `MainActivity`. This flag:
- Prevents screenshots and screen recordings of the app.
- Prevents the app from appearing in the Recent Apps thumbnail.
- Blocks screen-capture apps and casting tools.

**What if an attacker uses `adb shell screencap`?**
FLAG_SECURE blocks ADB screen capture in release builds. The captured image is black.

### 10.3 `allowBackup="false"`

**What it is:**
`android:allowBackup="false"` in `AndroidManifest.xml` prevents Android's automatic backup system from copying app data to Google Drive or to a computer via `adb backup`.

**What if an attacker runs `adb backup il.idf.budget`?**
The backup is empty. No session tokens, no SecureStore data, no app files are included.

### 10.4 Production Keystore Signing

**What it is:**
Release builds are signed with a private 2048-bit RSA key in `budget-release.keystore`. The key password and keystore are never committed to git.

**Why it matters:**
Android verifies the APK signature on every install and update. An attacker cannot distribute a modified version of this app through any channel without the private key, because Android will reject an APK signed with a different key as a different app.

---

## 11. Firestore Security Rules

Every read and write to the database is governed by server-side rules that Firebase enforces even if the app is bypassed entirely.

| Collection | Read | Write | Notes |
|------------|------|-------|-------|
| `users` | Any authenticated user | Own document only | Needed so users can fetch each other's public keys for E2EE |
| `notifications` (chat) | Sender or recipient only | Sender only, `read=false` enforced | Recipients can only flip `read → true`; delete never allowed |
| `units` | Any authenticated user | Admins only | |
| `requests` | Any authenticated user | Own request creation; approvers can update | Requestor ID must match authenticated user |
| `workPlans` | Any authenticated user | Admins or own unit | Ownership enforced server-side |
| `profits` | Any authenticated user | Admins only | |

**Role claims** (`username`, `role`, `unitId`) are set as Firebase custom claims by the admin migration script and are verified server-side — a user cannot elevate their own role by modifying client-side state.

**What if an attacker crafts a raw Firestore API request to read another user's messages?**
The `notifications` rule checks `resource.data.toUserId == myUsername()` server-side. A request from a different user ID is rejected with `PERMISSION_DENIED` before any data is returned.

**What if an attacker tries to approve their own budget request?**
Only roles in the `canApproveRequests()` list can update requests. `smfaked` (regular soldier) is not in that list. The server rejects the write.

---

## 12. PDF Export Feature

Added in v1.7. Allows authorized users to export request data as a PDF directly from the בקשות screen.

### 12.1 How It Works

1. User taps **ייצוא PDF** at the bottom of the בקשות screen.
2. `expo-print` renders a Hebrew/RTL HTML template to a PDF file.
3. The PDF is written to the **app's private cache directory** — inaccessible to other apps.
4. `expo-sharing` opens the native Android share sheet.
5. The user decides where the file goes: save to device Files, send via WhatsApp, email, print, etc.
6. The cached PDF is automatically cleaned up by the OS when storage pressure requires it.

### 12.2 What the PDF Contains

- Generation timestamp (date + time, Israel timezone)
- Summary stats: total requests, approved / rejected / pending counts, total approved amount
- Full request table sorted **latest → oldest**, including: submission date, resolution date, unit, requestor name, description, category, amount, color-coded status badge, asmacha reference number, approval/rejection reason

### 12.3 Role-Based Export Scope

The export is gated by the same role logic as the screen itself — users only export what they are allowed to see:

| Role | Export scope |
|------|-------------|
| kazin / samaog / maog | All requests from all units, all statuses |
| kas_900 / klach_* | All requests for their brigade, all statuses |
| smfaked | Only their own unit's requests |

### 12.4 Security Analysis

#### What this feature does NOT introduce
- **No new network requests.** The PDF is generated entirely on-device from data already loaded in memory. No data is sent to any server.
- **No new permissions.** `expo-print` and `expo-sharing` use existing storage and intent permissions already declared in the manifest.
- **No new attack surface on Firebase, Firestore, or Auth.** The feature is purely local.
- **No bypass of role-based access.** The export data is filtered by the same `visibleUnitIds` logic that controls what the user sees on screen — a smfaked user cannot export other units' data.

#### Storage: private cache, not public storage
The PDF is written to the app's private cache (`getCacheDir()` equivalent), not to external/shared storage. Other apps cannot read it. The share sheet is the only way it leaves the cache — and only if the user initiates it.

#### FLAG_SECURE and the share sheet
`FLAG_SECURE` (§10.2) prevents screenshots of the app. The share sheet itself is an OS-level UI outside the app's window — it is not subject to FLAG_SECURE. This is expected and correct behavior: the user explicitly chose to share, so the OS handling the share intent is appropriate.

#### What the share sheet means for security
Once the user taps a destination (e.g. WhatsApp, email), the security of the data is governed by that destination app and its transport. This is **user-initiated disclosure** — identical in nature to a user manually typing data into WhatsApp. The app cannot and should not prevent authorized users from sharing data they are permitted to see.

#### Sensitive field handling
- Requestor names, unit names, descriptions, and amounts are included — these are fields the requesting user already has access to.
- **Chat messages are not included.** The PDF only contains request/approval workflow data from `RequestsContext`, which has no connection to the E2EE messaging system.
- No authentication tokens, device keys, or encryption keys are ever included.

#### What if an attacker intercepts the PDF in transit?
If the user sends the PDF via an insecure channel, the data in that PDF is readable. This is not a vulnerability in the app — it is the user's choice. The app's role is to ensure the right user exports the right data, which is enforced. Transport security is the responsibility of the chosen destination.

#### What if an attacker taps ייצוא PDF while the legitimate user's session is active?
They would need to have already passed:
1. Biometric gate (§3) — fingerprint required on every cold start
2. The app's role-based UI — they see only what their authenticated role permits
3. 7-day session expiry (§2)

If they are on the device while a session is active (Scenario 2 in the playbook), exporting data is no more dangerous than reading data on screen — they already have visual access to the same information.

### 12.5 Overall Security Verdict

| Dimension | Assessment |
|-----------|-----------|
| New network attack surface | None |
| New credential exposure risk | None |
| Bypass of existing access controls | None — inherits role filtering |
| Data written to public storage | No — private cache only |
| Data leaves device automatically | No — requires explicit user action |
| Impact on E2EE chat | None — completely separate |
| Impact on Firebase Auth | None |
| Impact on existing security layers | None |

**Conclusion:** The PDF export feature introduces zero new attack surface to the app's backend or authentication system. The only new consideration is user-initiated data disclosure via the share sheet, which is by design and consistent with the user's authorized access level.

---

## 13. Attacker Scenario Playbook

This section answers "what happens if..." for realistic attack scenarios.

---

### Scenario 1: Phone Stolen (Locked)

**Attacker has:** A locked phone.
**What they can access:** Nothing. The app requires fingerprint to open (§3).
**Outcome:** Zero access.

---

### Scenario 2: Phone Stolen (Unlocked, Attacker Opens App)

**Attacker has:** An unlocked phone with the app running or recently backgrounded.
**What they can access:** The app session is valid, but on next cold start (app killed + reopened) the biometric gate triggers (§3).
**If the session is currently active in foreground:** The attacker can browse the app until they navigate away or the app is backgrounded and killed.
**Mitigation:** An admin can sign out the user's session remotely by revoking their Firebase token. Session expires in 7 days maximum.

---

### Scenario 3: Rooted Phone

**Attacker has:** A rooted device and the user's raw password.
**What they face:**
1. Root detection (§8.1) blocks the app at launch with a "גישה נדחתה" screen.
2. Even if they bypass this (e.g. Magisk Hide), the device key in SecureStore requires the Keystore, which is hardware-isolated. Extracting it requires a TEE exploit.
3. Even with the device key, they still need to pass biometric (§3).
**Outcome:** App is blocked. Data in Firestore requires the private key, which they cannot extract without a TEE exploit.

---

### Scenario 4: Man-in-the-Middle Attack (Coffee Shop WiFi)

**Attacker has:** Control of the network, a rogue AP, a Burp Suite proxy with a custom CA installed on the device.
**What they face:**
- Network security config (§7.2) blocks user-installed CA certificates. TLS handshake fails.
- Even with a valid CA, all message content is E2EE (§5) — the Firebase server only stores encrypted blobs.
**Outcome:** No data is readable. The app refuses to connect through the rogue proxy.

---

### Scenario 5: Firebase Database Breach

**Attacker has:** Full read access to Firestore (e.g. misconfigured rules, insider threat).
**What they find:**
- Chat messages: encrypted blobs — unreadable without the recipient's private key (which lives on their phone).
- User profiles: role, unit, display name, public encryption keys (public by design).
- Budget data: readable (it is not E2EE — budget figures are business data, not personal communications).
**Outcome:** Communications are secure. Budget data would be exposed if the database is fully breached — this is an accepted trade-off since budget data must be readable by multiple authorized users.

---

### Scenario 6: APK Reverse Engineering

**Attacker has:** The APK file downloaded from GitHub releases.
**What they find:**
- ProGuard-obfuscated bytecode (§10.1) — class/method names replaced with single letters.
- Pre-compiled Hermes bytecode for the JS bundle — not readable JavaScript.
- No hardcoded secrets: Firebase config contains only public identifiers (API key is scoped to the app's SHA-1 by Firebase App Check — useless to a different app).
- No hardcoded passwords or encryption keys.
**Outcome:** Reverse engineering is possible with enough effort, but yields no secrets. Security does not rely on keeping the code secret (defense in depth).

---

### Scenario 7: Brute-Force Password Attack

**Attacker has:** The username and is attempting automated password guessing.
**What they face:**
1. Client lockout after 5 attempts (§4) — but attacker can reinstall.
2. Firebase server-side rate limiting after repeated failures — cannot be reset by reinstalling.
3. Each password attempt requires computing `200 × SHA-256` iterations — slows automated attacks significantly.
4. 14-character passwords with mixed upper/lower/digits/symbols → ~10^25 possible values — brute force is infeasible even at 10 billion guesses per second.
**Outcome:** Brute force is computationally infeasible. A correct guess in 200 attempts is a 1 in 5×10^22 probability per session.

---

### Scenario 8: Frida/Dynamic Instrumentation Attack

**Attacker has:** A rooted phone with Frida installed, attempting to hook into the app at runtime.
**What they face:**
1. Root detection (§8.1) fires first — app won't even load.
2. If they evade root detection, Frida file checks (§9.1) detect the Frida server binary.
3. If they rename the binary, the `/proc/self/maps` scan detects the injected gadget in memory.
4. The debugger kill switch (§9.4) fires if they attach a debugger.
**Outcome:** Multiple independent layers make dynamic instrumentation very difficult. Getting past all of them simultaneously requires advanced TEE exploitation, at which point the device hardware itself is compromised.

---

### Scenario 9: Replay Attack on Messages

**Attacker has:** A captured Firestore message payload (the encrypted blob).
**What they attempt:** Re-sending the same encrypted payload to a different conversation.
**What stops it:**
- Each message is encrypted with a fresh random ephemeral key and a fresh random 12-byte IV.
- AES-256-GCM is authenticated encryption — the ciphertext is bound to the specific key/IV pair. Decrypting with a different key produces an authentication failure, not garbage output.
- The Firestore rules reject writes that don't pass the schema checks (required fields, sender identity).
**Outcome:** Replay is impossible. The payload is cryptographically bound to the specific sender/recipient/key combination.

---

### Scenario 10: Insider Threat (Admin Account Compromised)

**Attacker has:** Access to an admin-role account (`kazin`, `samaog`, or `maog`).
**What they can do:**
- Read all budget data, approve/reject requests, modify unit budgets.
- Send messages as the compromised user.
- Run `resetUserPassword.js` if they also have the `serviceAccountKey.json`.
**What they cannot do:**
- Read other users' chat messages (E2EE — messages are encrypted to specific recipients).
- Create new user accounts (requires Firebase Admin SDK and the service account key).
**Mitigation:** Admin accounts should be protected with the same device-bound passwords. If compromise is suspected, revoke the Firebase token and rotate the user's password via the admin script.

---

### Scenario 11: Attacker Intercepts an Exported PDF

**Attacker has:** Access to a channel through which an authorized user sent a PDF export (e.g. monitors a WhatsApp group, intercepts an email).
**What they find:** A formatted PDF containing request data scoped to what the exporting user was authorized to see.
**What they cannot find:** Chat messages, passwords, session tokens, encryption keys, or any data outside the exporting user's role scope.
**Assessment:** This is user-initiated disclosure, not an app vulnerability. The app enforces who can export what — what users do with data they are authorized to access is an operational policy matter, not a technical security control that the app can or should prevent.

---

*Last updated: v1.7 — 2026-03-27*
