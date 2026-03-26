// User registry — roles and display names only (no passwords).
// Used by pushToRole broadcasts and any code that needs to enumerate users.

export interface UserEntry {
  username: string;
  displayName: string;
  role: string;
  unitId?: string;
}

export const USERS: UserEntry[] = [
  // ── Admin ─────────────────────────────────────────────────────────────────
  { username: 'yakov',             displayName: 'יעקוב',               role: 'kazin' },
  { username: 'gideon_eliastam',   displayName: 'גדעון אליאסטם',       role: 'samaog' },
  { username: 'yoav_bruner',       displayName: 'יואב ברונר',           role: 'maog' },
  // ── חטיבה 900 ─────────────────────────────────────────────────────────────
  { username: 'chen_gordo',        displayName: 'רס"ן חן גורדו',       role: 'kas_900',   unitId: 'hativa_900' },
  // ── חטיבה 646 ─────────────────────────────────────────────────────────────
  { username: 'omer_boker',        displayName: 'רס"ן עומר בוקר',      role: 'klach_646', unitId: 'klach_646' },
  { username: 'yoni_hakohen',      displayName: 'אל"מ יוני הכהן',      role: 'klach_646', unitId: 'klach_646' },
  // ── חטיבה 179 ─────────────────────────────────────────────────────────────
  { username: 'yontan_arye',       displayName: 'רס"ן יונתן אריה',     role: 'klach_179', unitId: 'klach_179' },
  { username: 'yonatan_maier',     displayName: 'אל"מ יונתן מאיר',     role: 'klach_179', unitId: 'klach_179' },
  // ── חטיבה 11 ──────────────────────────────────────────────────────────────
  { username: 'baruch_benshoham',  displayName: 'רס"ן ברוך בן שוהם',  role: 'klach_11',  unitId: 'klach_11' },
  { username: 'noam_michael',      displayName: 'אל"מ נועם מיכאל',     role: 'klach_11',  unitId: 'klach_11' },
  // ── גדודים ────────────────────────────────────────────────────────────────
  { username: 'rotem_priti',       displayName: 'רס"ן רותם פריטי',     role: 'smfaked',   unitId: 'gdod_90' },
  { username: 'yehonatan_didon',   displayName: 'רס"ן יהונתן דידון',   role: 'smfaked',   unitId: 'gdod_92' },
  { username: 'daniel_alon',       displayName: 'רס"ן דניאל אלון',     role: 'smfaked',   unitId: 'gdod_93' },
  { username: 'liad_ozihu',        displayName: 'רס"ן ליעד עוזיהו',    role: 'smfaked',   unitId: 'gdod_94' },
  { username: 'eli_grant',         displayName: 'רס"ן אלי גרנט',       role: 'smfaked',   unitId: 'gdod_97' },
  { username: 'maor_markowitz',    displayName: 'רס"ן מאור מרקוביץ',   role: 'smfaked',   unitId: 'bach_900' },
  // ── מיפו"ג ────────────────────────────────────────────────────────────────
  { username: 'fadi',              displayName: 'רס"ן פאדי',           role: 'smfaked',   unitId: 'mifaog_logistika' },
  { username: 'ran_mualem',        displayName: 'סא"ל רן מועלם',       role: 'smfaked',   unitId: 'mifaog_logistika' },
  { username: 'anna_el_toledano',  displayName: 'רס"ן אנא-אל טולדנו',  role: 'smfaked',   unitId: 'mifaog_tna' },
  { username: 'teamor_sarhien',    displayName: 'סא"ל תיאמור סארחיין', role: 'smfaked',   unitId: 'mifaog_tna' },
  { username: 'tevel_turkman',     displayName: 'רס"ן תבל טרוקמן',     role: 'smfaked',   unitId: 'mifaog_tkshuv' },
  { username: 'ben_hazan',         displayName: 'סא"ל בן חזן',         role: 'smfaked',   unitId: 'mifaog_tkshuv' },
  { username: 'maya_shamesh',      displayName: 'רס"ן מאיה שמש',       role: 'smfaked',   unitId: 'mifaog_masan' },
  { username: 'oren_levi',         displayName: 'סא"ל אורן לוי',       role: 'smfaked',   unitId: 'mifaog_masan' },
  { username: 'aviv_gutnov',       displayName: 'סרן אביב גוטנוב',     role: 'smfaked',   unitId: 'mifaog_agam' },
  { username: 'amit_shohat',       displayName: 'סא"ל עמית שוחט',      role: 'smfaked',   unitId: 'mifaog_agam' },
  { username: 'yadid_shmuel',      displayName: 'רס"ל ידיד שמואל',     role: 'smfaked',   unitId: 'mifaog_modiin' },
  { username: 'moshe',             displayName: 'סא"ל משה',            role: 'smfaked',   unitId: 'mifaog_modiin' },
  { username: 'ofek_zilberman',    displayName: 'סגן אופק זילברמן',    role: 'smfaked',   unitId: 'mifaog_refua' },
  { username: 'shmulik_sokolik',   displayName: 'סא"ל שמוליק סוקוליק', role: 'smfaked',   unitId: 'mifaog_refua' },
  { username: 'yossi_rafael',      displayName: 'סא"ל יוסי רפאל',      role: 'smfaked',   unitId: 'mifaog_handasa' },
  { username: 'leroy_shafir',      displayName: 'סא"ל ליהו שפיר',      role: 'smfaked',   unitId: 'mifaog_siua' },
  { username: 'omri_kalfon',       displayName: 'סא"ל עמרי כלפון',     role: 'smfaked',   unitId: 'mifaog_mahane' },
];

export const getUsersByRole = (role: string): UserEntry[] =>
  USERS.filter(u => u.role === role);
