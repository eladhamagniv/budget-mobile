/**
 * SUPERSEDED — do NOT run this script.
 *
 * The v2 password scheme (200-round SHA-256, no device key) has been replaced
 * by the v3 device-bound scheme. The app now self-migrates each user on their
 * first login: it signs in with the v1 password ('1' + PIN), generates a unique
 * 256-bit device key, derives the v3 password, and calls Firebase updatePassword()
 * automatically. No server-side script is needed.
 *
 * For admin password resets (lost device / reinstall), use resetUserPassword.js instead.
 *
 * Original description (archived):
 * One-time migration: upgrades all Firebase Auth passwords from the old
 * '1' + PIN scheme to the new 200-round SHA-256 derived scheme.
 *
 * Prerequisites:
 *   1. scripts/serviceAccountKey.json must exist (Firebase Admin SDK key)
 *   2. npm install --save-dev firebase-admin  (if not already installed)
 *
 * Run:
 *   node scripts/upgradePasswords.js
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const auth = admin.auth();

/**
 * Derives the strong Firebase password from username + PIN.
 * MUST stay in sync with derivePassword() in src/context/AuthContext.tsx.
 */
function derivePassword(username, pin) {
  const salt = `${username.toLowerCase()}:idf.budget.v2`;
  let hash = crypto.createHash('sha256').update(`${salt}:${pin}`).digest('hex');
  for (let i = 1; i < 200; i++) {
    hash = crypto.createHash('sha256').update(`${hash}:${salt}`).digest('hex');
  }
  return hash;
}

// All users with their current 5-digit PINs
const USERS = [
  { username: 'yakov',             password: '48293' },
  { username: 'gideon_eliastam',   password: '73615' },
  { username: 'yoav_bruner',       password: '29481' },
  { username: 'chen_gordo',        password: '47219' },
  { username: 'omer_boker',        password: '63857' },
  { username: 'yoni_hakohen',      password: '36491' },
  { username: 'yontan_arye',       password: '92043' },
  { username: 'yonatan_maier',     password: '58327' },
  { username: 'baruch_benshoham',  password: '15726' },
  { username: 'noam_michael',      password: '72815' },
  { username: 'rotem_priti',       password: '38492' },
  { username: 'yehonatan_didon',   password: '67153' },
  { username: 'daniel_alon',       password: '24876' },
  { username: 'liad_ozihu',        password: '91537' },
  { username: 'eli_grant',         password: '45682' },
  { username: 'maor_markowitz',    password: '73924' },
  { username: 'fadi',              password: '52847' },
  { username: 'ran_mualem',        password: '14729' },
  { username: 'anna_el_toledano',  password: '96314' },
  { username: 'teamor_sarhien',    password: '83651' },
  { username: 'tevel_turkman',     password: '37861' },
  { username: 'ben_hazan',         password: '26947' },
  { username: 'maya_shamesh',      password: '64293' },
  { username: 'oren_levi',         password: '51384' },
  { username: 'aviv_gutnov',       password: '81547' },
  { username: 'amit_shohat',       password: '79236' },
  { username: 'yadid_shmuel',      password: '29634' },
  { username: 'moshe',             password: '43815' },
  { username: 'ofek_zilberman',    password: '94163' },
  { username: 'shmulik_sokolik',   password: '62497' },
  { username: 'yossi_rafael',      password: '47291' },
  { username: 'leroy_shafir',      password: '63847' },
  { username: 'omri_kalfon',       password: '19528' },
];

const EMAIL_DOMAIN = 'idf.budget';

async function upgradeUser(u) {
  const email = `${u.username}@${EMAIL_DOMAIN}`;
  const newPassword = derivePassword(u.username, u.password);

  try {
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: newPassword });
    console.log(`✓ Upgraded: ${email}`);
  } catch (err) {
    console.error(`✗ Failed ${email}:`, err.message);
  }
}

(async () => {
  console.log('Upgrading all Firebase Auth passwords to derived scheme...\n');
  for (const u of USERS) {
    await upgradeUser(u);
  }
  console.log('\nDone. All users now use 200-round SHA-256 derived passwords.');
  console.log('IMPORTANT: Make sure the new app build is distributed before running this,');
  console.log('otherwise users on the old version will be locked out.');
  process.exit(0);
})();
