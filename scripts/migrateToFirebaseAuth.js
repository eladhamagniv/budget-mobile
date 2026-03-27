/**
 * One-time migration script: creates Firebase Auth users + sets custom claims
 * + seeds Firestore user profiles for all 33 app users.
 *
 * Prerequisites:
 *   1. Download your Firebase service account key:
 *      Firebase Console → Project Settings → Service accounts → Generate new private key
 *      Save as: scripts/serviceAccountKey.json  (NEVER commit this file!)
 *
 *   2. Install firebase-admin (one-time):
 *      npm install --save-dev firebase-admin
 *
 *   3. Run:
 *      node scripts/migrateToFirebaseAuth.js
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

/**
 * NOTE: v3 device-bound passwords cannot be pre-set by this script — the device
 * key is generated on the user's phone and never leaves it. This script sets the
 * v1 password ('1' + rawPassword) as the initial Firebase password. On first login
 * the app automatically self-migrates to v3 (device-bound, 200-round SHA-256).
 */
function derivePasswordV1(rawPassword) {
  return '1' + rawPassword;
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

// ─── User definitions ─────────────────────────────────────────────────────────
// Passwords are kept here ONLY in this migration script, which runs once on the
// admin machine and is never bundled into the app.
const USERS = [
  // ── Admin ──────────────────────────────────────────────────────────────────
  { username: 'yakov',             password: 'R$Gy6u522R5mJ#', displayName: 'יעקוב',               role: 'kazin' },
  { username: 'gideon_eliastam',   password: 'YN5S$Z3jC9@jwc', displayName: 'גדעון אליאסטם',       role: 'samaog' },
  { username: 'yoav_bruner',       password: 'v3Uj@uxU3q8#Px', displayName: 'יואב ברונר',           role: 'maog' },
  // ── חטיבה 900 ──────────────────────────────────────────────────────────────
  { username: 'chen_gordo',        password: '#z2sTJ2698U@Vt', displayName: 'רסן חן גורדו',        role: 'kas_900',   unitId: 'hativa_900' },
  // ── חטיבה 646 ──────────────────────────────────────────────────────────────
  { username: 'omer_boker',        password: 'y2MXZYv!57$Tf8', displayName: 'רסן עומר בוקר',       role: 'klach_646', unitId: 'klach_646' },
  { username: 'yoni_hakohen',      password: 'vbkV#Wc7@5f9JJ', displayName: 'אלמ יוני הכהן',       role: 'klach_646', unitId: 'klach_646' },
  // ── חטיבה 179 ──────────────────────────────────────────────────────────────
  { username: 'yontan_arye',       password: 'CS77!5FmX4$Nfn', displayName: 'רסן יונתן אריה',      role: 'klach_179', unitId: 'klach_179' },
  { username: 'yonatan_maier',     password: 'g9X$4BaA#3Z4Jj', displayName: 'אלמ יונתן מאיר',      role: 'klach_179', unitId: 'klach_179' },
  // ── חטיבה 11 ───────────────────────────────────────────────────────────────
  { username: 'baruch_benshoham',  password: '4feKvd5JY@@8F2', displayName: 'רסן ברוך בן שוהם',   role: 'klach_11',  unitId: 'klach_11' },
  { username: 'noam_michael',      password: '2$E5X#pV7XEf$w', displayName: 'אלמ נועם מיכאל',      role: 'klach_11',  unitId: 'klach_11' },
  // ── גדודים ─────────────────────────────────────────────────────────────────
  { username: 'rotem_priti',       password: 'A4#JK!gwk4qGh8', displayName: 'רסן רותם פריטי',      role: 'smfaked',   unitId: 'gdod_90' },
  { username: 'yehonatan_didon',   password: '3!aCCx2F2bvVN!', displayName: 'רסן יהונתן דידון',    role: 'smfaked',   unitId: 'gdod_92' },
  { username: 'daniel_alon',       password: 'Fmzr$zUF4M9T@8', displayName: 'רסן דניאל אלון',      role: 'smfaked',   unitId: 'gdod_93' },
  { username: 'liad_ozihu',        password: 'UeT@5kc6M72kn#', displayName: 'רסן ליעד עוזיהו',     role: 'smfaked',   unitId: 'gdod_94' },
  { username: 'eli_grant',         password: '5@58rBtt6WP!@g', displayName: 'רסן אלי גרנט',        role: 'smfaked',   unitId: 'gdod_97' },
  { username: 'maor_markowitz',    password: 'c3kpQKSt8D#27#', displayName: 'רסן מאור מרקוביץ',    role: 'smfaked',   unitId: 'bach_900' },
  // ── מיפוג ──────────────────────────────────────────────────────────────────
  { username: 'fadi',              password: 'A@a82Pv5EQaHP!', displayName: 'רסן פאדי',            role: 'smfaked',   unitId: 'mifaog_logistika' },
  { username: 'ran_mualem',        password: '6a7UQp@yz8V#6b', displayName: 'סאל רן מועלם',        role: 'smfaked',   unitId: 'mifaog_logistika' },
  { username: 'anna_el_toledano',  password: '!H4P9CFyah#QT9', displayName: 'רסן אנא-אל טולדנו',   role: 'smfaked',   unitId: 'mifaog_tna' },
  { username: 'teamor_sarhien',    password: '$z@k348ZeF$SQr', displayName: 'סאל תיאמור סארחיין',  role: 'smfaked',   unitId: 'mifaog_tna' },
  { username: 'tevel_turkman',     password: 'qZvM$6@a!5Ps2c', displayName: 'רסן תבל טרוקמן',      role: 'smfaked',   unitId: 'mifaog_tkshuv' },
  { username: 'ben_hazan',         password: '!a3wC7P#9bENrc', displayName: 'סאל בן חזן',          role: 'smfaked',   unitId: 'mifaog_tkshuv' },
  { username: 'maya_shamesh',      password: '4@uy8P7xGQpgX$', displayName: 'רסן מאיה שמש',        role: 'smfaked',   unitId: 'mifaog_masan' },
  { username: 'oren_levi',         password: 'cKgm#3$3e8xLEq', displayName: 'סאל אורן לוי',        role: 'smfaked',   unitId: 'mifaog_masan' },
  { username: 'aviv_gutnov',       password: '81547', displayName: 'סרן אביב גוטנוב',     role: 'smfaked',   unitId: 'mifaog_agam' },
  { username: 'amit_shohat',       password: '79236', displayName: 'סאל עמית שוחט',       role: 'smfaked',   unitId: 'mifaog_agam' },
  { username: 'yadid_shmuel',      password: '#3G@TjD2tv8bMj', displayName: 'רסל ידיד שמואל',      role: 'smfaked',   unitId: 'mifaog_modiin' },
  { username: 'moshe',             password: 'gpA2x@#W5b9JyQ', displayName: 'סאל משה',             role: 'smfaked',   unitId: 'mifaog_modiin' },
  { username: 'ofek_zilberman',    password: 'mf56@#q4UQ87cX', displayName: 'סגן אופק זילברמן',    role: 'smfaked',   unitId: 'mifaog_refua' },
  { username: 'shmulik_sokolik',   password: '6X#yTfZK4H9!fe', displayName: 'סאל שמוליק סוקוליק',  role: 'smfaked',   unitId: 'mifaog_refua' },
  { username: 'yossi_rafael',      password: 'Wf!6$hTMkQ26aK', displayName: 'סאל יוסי רפאל',       role: 'smfaked',   unitId: 'mifaog_handasa' },
  { username: 'leroy_shafir',      password: 'LYjG2pez$98#R#', displayName: 'סאל ליהו שפיר',       role: 'smfaked',   unitId: 'mifaog_siua' },
  { username: 'omri_kalfon',       password: 'w5@hE8CcHG8@4D', displayName: 'סאל עמרי כלפון',      role: 'smfaked',   unitId: 'mifaog_mahane' },
];

const EMAIL_DOMAIN = 'idf.budget';

async function migrateUser(u) {
  const email = `${u.username}@${EMAIL_DOMAIN}`;
  let uid;

  try {
    // Set the v1 password ('1' + rawPassword). On first login the app
    // self-migrates to the device-bound v3 scheme automatically.
    const created = await auth.createUser({
      email,
      password: derivePasswordV1(u.password),
      displayName: u.displayName,
    });
    uid = created.uid;
    console.log(`✓ Created auth user: ${email}`);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      // Already created on a previous run — fetch existing UID
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
      console.log(`~ Auth user already exists: ${email}`);
    } else {
      console.error(`✗ Failed to create ${email}:`, err.message);
      return;
    }
  }

  // Set custom claims — used by Firestore security rules
  const claims = { username: u.username, role: u.role, unitId: u.unitId ?? null };
  await auth.setCustomUserClaims(uid, claims);

  // Seed Firestore profile (merge so we don't overwrite publicKey if already set)
  await db.collection('users').doc(u.username).set(
    {
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      unitId: u.unitId ?? null,
      firebaseUid: uid,
    },
    { merge: true },
  );
  console.log(`  ↳ Profile + custom claims set for ${u.username} (uid: ${uid})`);
}

(async () => {
  console.log('Starting migration...\n');
  for (const u of USERS) {
    await migrateUser(u);
  }
  console.log('\nMigration complete.');
  console.log('\nNext steps:');
  console.log('  1. Deploy Firestore rules:  firebase deploy --only firestore:rules');
  console.log('  2. Build & distribute the new APK.');
  console.log('  3. Each user logs in once — their ECDH key pair is generated on first login.');
  process.exit(0);
})();
