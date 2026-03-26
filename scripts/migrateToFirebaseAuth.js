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
const serviceAccount = require('./serviceAccountKey.json');

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
  { username: 'yakov',             password: '48293', displayName: 'יעקוב',               role: 'kazin' },
  { username: 'gideon_eliastam',   password: '73615', displayName: 'גדעון אליאסטם',       role: 'samaog' },
  { username: 'yoav_bruner',       password: '29481', displayName: 'יואב ברונר',           role: 'maog' },
  // ── חטיבה 900 ──────────────────────────────────────────────────────────────
  { username: 'chen_gordo',        password: '47219', displayName: 'רסן חן גורדו',        role: 'kas_900',   unitId: 'hativa_900' },
  // ── חטיבה 646 ──────────────────────────────────────────────────────────────
  { username: 'omer_boker',        password: '63857', displayName: 'רסן עומר בוקר',       role: 'klach_646', unitId: 'klach_646' },
  { username: 'yoni_hakohen',      password: '36491', displayName: 'אלמ יוני הכהן',       role: 'klach_646', unitId: 'klach_646' },
  // ── חטיבה 179 ──────────────────────────────────────────────────────────────
  { username: 'yontan_arye',       password: '92043', displayName: 'רסן יונתן אריה',      role: 'klach_179', unitId: 'klach_179' },
  { username: 'yonatan_maier',     password: '58327', displayName: 'אלמ יונתן מאיר',      role: 'klach_179', unitId: 'klach_179' },
  // ── חטיבה 11 ───────────────────────────────────────────────────────────────
  { username: 'baruch_benshoham',  password: '15726', displayName: 'רסן ברוך בן שוהם',   role: 'klach_11',  unitId: 'klach_11' },
  { username: 'noam_michael',      password: '72815', displayName: 'אלמ נועם מיכאל',      role: 'klach_11',  unitId: 'klach_11' },
  // ── גדודים ─────────────────────────────────────────────────────────────────
  { username: 'rotem_priti',       password: '38492', displayName: 'רסן רותם פריטי',      role: 'smfaked',   unitId: 'gdod_90' },
  { username: 'yehonatan_didon',   password: '67153', displayName: 'רסן יהונתן דידון',    role: 'smfaked',   unitId: 'gdod_92' },
  { username: 'daniel_alon',       password: '24876', displayName: 'רסן דניאל אלון',      role: 'smfaked',   unitId: 'gdod_93' },
  { username: 'liad_ozihu',        password: '91537', displayName: 'רסן ליעד עוזיהו',     role: 'smfaked',   unitId: 'gdod_94' },
  { username: 'eli_grant',         password: '45682', displayName: 'רסן אלי גרנט',        role: 'smfaked',   unitId: 'gdod_97' },
  { username: 'maor_markowitz',    password: '73924', displayName: 'רסן מאור מרקוביץ',    role: 'smfaked',   unitId: 'bach_900' },
  // ── מיפוג ──────────────────────────────────────────────────────────────────
  { username: 'fadi',              password: '52847', displayName: 'רסן פאדי',            role: 'smfaked',   unitId: 'mifaog_logistika' },
  { username: 'ran_mualem',        password: '14729', displayName: 'סאל רן מועלם',        role: 'smfaked',   unitId: 'mifaog_logistika' },
  { username: 'anna_el_toledano',  password: '96314', displayName: 'רסן אנא-אל טולדנו',   role: 'smfaked',   unitId: 'mifaog_tna' },
  { username: 'teamor_sarhien',    password: '83651', displayName: 'סאל תיאמור סארחיין',  role: 'smfaked',   unitId: 'mifaog_tna' },
  { username: 'tevel_turkman',     password: '37861', displayName: 'רסן תבל טרוקמן',      role: 'smfaked',   unitId: 'mifaog_tkshuv' },
  { username: 'ben_hazan',         password: '26947', displayName: 'סאל בן חזן',          role: 'smfaked',   unitId: 'mifaog_tkshuv' },
  { username: 'maya_shamesh',      password: '64293', displayName: 'רסן מאיה שמש',        role: 'smfaked',   unitId: 'mifaog_masan' },
  { username: 'oren_levi',         password: '51384', displayName: 'סאל אורן לוי',        role: 'smfaked',   unitId: 'mifaog_masan' },
  { username: 'aviv_gutnov',       password: '81547', displayName: 'סרן אביב גוטנוב',     role: 'smfaked',   unitId: 'mifaog_agam' },
  { username: 'amit_shohat',       password: '79236', displayName: 'סאל עמית שוחט',       role: 'smfaked',   unitId: 'mifaog_agam' },
  { username: 'yadid_shmuel',      password: '29634', displayName: 'רסל ידיד שמואל',      role: 'smfaked',   unitId: 'mifaog_modiin' },
  { username: 'moshe',             password: '43815', displayName: 'סאל משה',             role: 'smfaked',   unitId: 'mifaog_modiin' },
  { username: 'ofek_zilberman',    password: '94163', displayName: 'סגן אופק זילברמן',    role: 'smfaked',   unitId: 'mifaog_refua' },
  { username: 'shmulik_sokolik',   password: '62497', displayName: 'סאל שמוליק סוקוליק',  role: 'smfaked',   unitId: 'mifaog_refua' },
  { username: 'yossi_rafael',      password: '47291', displayName: 'סאל יוסי רפאל',       role: 'smfaked',   unitId: 'mifaog_handasa' },
  { username: 'leroy_shafir',      password: '63847', displayName: 'סאל ליהו שפיר',       role: 'smfaked',   unitId: 'mifaog_siua' },
  { username: 'omri_kalfon',       password: '19528', displayName: 'סאל עמרי כלפון',      role: 'smfaked',   unitId: 'mifaog_mahane' },
];

const EMAIL_DOMAIN = 'idf.budget';

async function migrateUser(u) {
  const email = `${u.username}@${EMAIL_DOMAIN}`;
  let uid;

  try {
    // Try to create a new Firebase Auth user
    // Prefix '1' matches AuthContext.tsx — users still type their 5-digit PIN
    const created = await auth.createUser({
      email,
      password: '1' + u.password,
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
