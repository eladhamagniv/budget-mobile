/**
 * Admin tool: resets ALL users' Firebase Auth passwords back to the v1 scheme
 * ('1' + rawPassword) so every device can self-migrate to v3 on next login.
 *
 * Run this whenever:
 *   - Users are getting "wrong password" errors after a reinstall
 *   - A batch of users needs to be re-onboarded on new devices
 *
 * Usage:
 *   node scripts/resetAllPasswords.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const auth = admin.auth();

const EMAIL_DOMAIN = 'idf.budget';

const USERS = [
  { username: 'yakov',             password: 'R$Gy6u522R5mJ#' },
  { username: 'gideon_eliastam',   password: 'YN5S$Z3jC9@jwc' },
  { username: 'yoav_bruner',       password: 'v3Uj@uxU3q8#Px' },
  { username: 'chen_gordo',        password: '#z2sTJ2698U@Vt' },
  { username: 'omer_boker',        password: 'y2MXZYv!57$Tf8' },
  { username: 'yoni_hakohen',      password: 'vbkV#Wc7@5f9JJ' },
  { username: 'yontan_arye',       password: 'CS77!5FmX4$Nfn' },
  { username: 'yonatan_maier',     password: 'g9X$4BaA#3Z4Jj' },
  { username: 'baruch_benshoham',  password: '4feKvd5JY@@8F2' },
  { username: 'noam_michael',      password: '2$E5X#pV7XEf$w' },
  { username: 'rotem_priti',       password: 'A4#JK!gwk4qGh8' },
  { username: 'yehonatan_didon',   password: '3!aCCx2F2bvVN!' },
  { username: 'daniel_alon',       password: 'Fmzr$zUF4M9T@8' },
  { username: 'liad_ozihu',        password: 'UeT@5kc6M72kn#' },
  { username: 'eli_grant',         password: '5@58rBtt6WP!@g' },
  { username: 'maor_markowitz',    password: 'c3kpQKSt8D#27#' },
  { username: 'fadi',              password: 'A@a82Pv5EQaHP!' },
  { username: 'ran_mualem',        password: '6a7UQp@yz8V#6b' },
  { username: 'anna_el_toledano',  password: '!H4P9CFyah#QT9' },
  { username: 'teamor_sarhien',    password: '$z@k348ZeF$SQr' },
  { username: 'tevel_turkman',     password: 'qZvM$6@a!5Ps2c' },
  { username: 'ben_hazan',         password: '!a3wC7P#9bENrc' },
  { username: 'maya_shamesh',      password: '4@uy8P7xGQpgX$' },
  { username: 'oren_levi',         password: 'cKgm#3$3e8xLEq' },
  { username: 'aviv_gutnov',       password: 'A@a82Pv5EQaHP!' },  // was 5-digit, now 14-char
  { username: 'amit_shohat',       password: '6a7UQp@yz8V#6b' },  // was 5-digit, now 14-char
  { username: 'yadid_shmuel',      password: '#3G@TjD2tv8bMj' },
  { username: 'moshe',             password: 'gpA2x@#W5b9JyQ' },
  { username: 'ofek_zilberman',    password: 'mf56@#q4UQ87cX' },
  { username: 'shmulik_sokolik',   password: '6X#yTfZK4H9!fe' },
  { username: 'yossi_rafael',      password: 'Wf!6$hTMkQ26aK' },
  { username: 'leroy_shafir',      password: 'LYjG2pez$98#R#' },
  { username: 'omri_kalfon',       password: 'w5@hE8CcHG8@4D' },
];

async function resetAll() {
  console.log(`Resetting ${USERS.length} users to v1 password scheme...\n`);
  let ok = 0, fail = 0;

  for (const u of USERS) {
    const email = `${u.username}@${EMAIL_DOMAIN}`;
    const v1Password = '1' + u.password;
    try {
      const user = await auth.getUserByEmail(email);
      await auth.updateUser(user.uid, { password: v1Password });
      console.log(`✓ ${email}`);
      ok++;
    } catch (err) {
      console.error(`✗ ${email}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone. ${ok} reset, ${fail} failed.`);
  console.log('\nUsers can now log in on any device — the app will self-migrate to v3 on first login.');
  process.exit(0);
}

resetAll();
