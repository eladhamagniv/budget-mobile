/**
 * Admin tool: resets a user's Firebase Auth password back to the v1 scheme
 * ('1' + PIN) so the app can self-migrate them again on their next login.
 *
 * When to use:
 *   - User loses their phone (device key is lost → v3 password uncomputable)
 *   - User reinstalls the app (SecureStore is wiped → device key is gone)
 *   - Any situation where the user is locked out
 *
 * What happens after reset:
 *   1. Admin runs this script with the username and current PIN.
 *   2. User installs app on new device and logs in normally with their PIN.
 *   3. App detects no device_key_v1 in SecureStore → runs self-migration:
 *      signs in with v1 password → generates new device key → upgrades to v3.
 *   4. Done — no manual steps needed for the user.
 *
 * Prerequisites:
 *   scripts/serviceAccountKey.json (Firebase Admin SDK key — never commit this)
 *
 * Usage:
 *   node scripts/resetUserPassword.js <username> <raw-password>
 *
 * Example:
 *   node scripts/resetUserPassword.js yakov "R$Gy6u522R5mJ#"
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const auth = admin.auth();

const EMAIL_DOMAIN = 'idf.budget';

async function resetPassword(username, pin) {
  if (!username || !pin) {
    console.error('Usage: node scripts/resetUserPassword.js <username> <5-digit-PIN>');
    process.exit(1);
  }

  const email = `${username.toLowerCase()}@${EMAIL_DOMAIN}`;
  const v1Password = '1' + pin;

  try {
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: v1Password });
    console.log(`✓ Reset password for ${email} to v1 scheme.`);
    console.log(`  User must log in on their (new) device — app will self-migrate to v3 automatically.`);
  } catch (err) {
    console.error(`✗ Failed to reset ${email}:`, err.message);
    process.exit(1);
  }

  process.exit(0);
}

const [,, username, pin] = process.argv;
resetPassword(username, pin);
