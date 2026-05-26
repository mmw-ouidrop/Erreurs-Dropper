/* ═══════════════════════════════════════════════
   OUIDROP — Core JS (auth, cache, utils)
   ═══════════════════════════════════════════════ */

'use strict';

// ─── CONFIG ────────────────────────────────────────────────────────────
const OD = {
  // Auth
  SESSION_KEY:    'od_session',
  SESSION_LONG:   1000 * 60 * 60 * 24 * 30,
  SESSION_SHORT:  1000 * 60 * 60 * 8,
  PASSWORD_HASH:  '210154149c0c39a8429193556b38607b35a92b38037872870adec491ab776774',

  // Cache BDD
  CACHE_KEY:      'od_db_cache',
  CACHE_TS_KEY:   'od_db_ts',
  CACHE_TTL:      1000 * 60 * 60 * 24,  // 24h

  // Local user data
  HISTORY_KEY:    'od_history',
  LINKS_KEY:      'od_user_links',
  NOTES_KEY:      'od_notes',

  // Google Apps Script URL (à remplacer par votre URL déployée)
  // Le script doit accepter ?action=getData et retourner JSON
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwNlMpEV-sy8cZ0q6P-euX-J_aqO79fSmZX8WO9-4XNs3unP0OLkxlqZguwD5voyY8PIw/exec',

  // Durée d'affichage max de l'historique
  HISTORY_MAX: 50,
};

// ─── AUTH GUARD ────────────────────────────────────────────────────────
function requireAuth() {
  const raw = localStorage.getItem(OD.SESSION_KEY);
  if (!raw) { redirectLogin(); return false; }
  try {
    const s = JSON.parse(raw);
    if (!s.exp || Date.now() >= s.exp) { redirectLogin(); return false; }
    return true;
  } catch(e) { redirectLogin(); return false; }
}

function redirectLogin() {
  localStorage.removeItem(OD.SESSION_KEY);
  const base = window.location.pathname.split('/').slice(0,-1).join('/') + '/';
  window.location.href = base + 'login.html';
}

function logout() {
  localStorage.removeItem(OD.SESSION_KEY);
  redirectLogin();
}

// ─── DATABASE CACHE ────────────────────────────────────────────────────
async function getDB(forceRefresh = false) {
  const ts = parseInt(localStorage.getItem(OD.CACHE_TS_KEY) || '0');
  const age = Date.now() - ts;
  const raw = localStorage.getItem(OD.CACHE_KEY);

  if (!forceRefresh && raw && age < OD.CACHE_TTL) {
    try { return JSON.parse(raw); } catch(e) {}
  }

  // Fetch depuis Google Apps Script
  return await fetchFromGAS();
}

async function fetchFromGAS() {
  const url = OD.GAS_URL + '?action=getData';
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();

  // Stocker en cache
  localStorage.setItem(OD.CACHE_KEY, JSON.stringify(data));
  localStorage.setItem(OD.CACHE_TS_KEY, Date.now().toString());
  return data;
}

function getCacheAge() {
  const ts = parseInt(localStorage.getItem(OD.CACHE_TS_KEY) || '0');
  if (!ts) return null;
  const diff = Date.now() - ts;
  if (diff < 60000) return 'à l\'instant';
  if (diff < 3600000) return `il y a ${Math.floor(diff/60000)} min`;
  if (diff < 86400000) return `il y a ${Math.floor(diff/3600000)}h`;
  return `il y a ${Math.floor(diff/86400000)}j`;
}

// ─── HISTORY ───────────────────────────────────────────────────────────
function addToHistory(code, source) {
  let hist = getHistory();
  // Retire si déjà présent
  hist = hist.filter(h => !(h.code === code && h.source === source));
  hist.unshift({ code, source, ts: Date.now() });
  hist = hist.slice(0, OD.HISTORY_MAX);
  localStorage.setItem(OD.HISTORY_KEY, JSON.stringify(hist));
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(OD.HISTORY_KEY) || '[]'); }
  catch(e) { return []; }
}

function clearHistory() {
  localStorage.removeItem(OD.HISTORY_KEY);
}

// ─── NOTES ─────────────────────────────────────────────────────────────
function getNotes() {
  try { return JSON.parse(localStorage.getItem(OD.NOTES_KEY) || '{}'); }
  catch(e) { return {}; }
}

function setNote(key, text) {
  const notes = getNotes();
  if (text.trim()) notes[key] = { text: text.trim(), ts: Date.now() };
  else delete notes[key];
  localStorage.setItem(OD.NOTES_KEY, JSON.stringify(notes));
}

function exportNotes() {
  const notes = getNotes();
  const keys  = Object.keys(notes);
  if (!keys.length) return null;

  let out = 'Code Erreur\tSource\tDate\tNote\n';
  for (const k of keys) {
    const [source, code] = k.split('::');
    const d = new Date(notes[k].ts).toLocaleString('fr-FR');
    out += `${code}\t${source}\t${d}\t${notes[k].text.replace(/\n/g,' ')}\n`;
  }
  return out;
}

// ─── USER LINKS ─────────────────────────────────────────────────────────
function getUserLinks() {
  try { return JSON.parse(localStorage.getItem(OD.LINKS_KEY) || '[]'); }
  catch(e) { return []; }
}

function saveUserLinks(links) {
  localStorage.setItem(OD.LINKS_KEY, JSON.stringify(links));
}

// ─── FUZZY SEARCH ──────────────────────────────────────────────────────
function fuzzyMatch(query, text) {
  if (!query || !text) return false;
  const q = normalize(query);
  const t = normalize(text);
  // Exact substring
  if (t.includes(q)) return true;
  // Chaque mot du query doit apparaître dans text
  return q.split(' ').filter(w=>w.length>1).every(w => t.includes(w));
}

function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ─── TOAST ─────────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ', warn: '⚠' };
  el.innerHTML = `<span>${icons[type]||'ℹ'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(()=>el.remove(), 300); }, duration);
}

// ─── CLIPBOARD ─────────────────────────────────────────────────────────
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copié dans le presse-papier !', 'success');
  } catch(e) {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Copié !', 'success');
  }
}

// ─── DATE FORMAT ───────────────────────────────────────────────────────
function fmtDate(ts) {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function fmtDateShort(ts) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return 'Auj. ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── SEVERITY LABEL ────────────────────────────────────────────────────
function severityLabel(cls) {
  const labels = {
    '0': 'Info', '1': 'Avertissement',
    '2': 'Récupérable', '3': 'Grave', '4': 'Fatale'
  };
  return labels[String(cls)] || 'Inconnue';
}

// ─── MISSING CHECK ─────────────────────────────────────────────────────
function isMissing(val) {
  return !val || val.trim() === '--' || val.trim() === '-' || val.trim() === '';
}

// ─── SAMPLE DATA (fallback si GAS non configuré) ──────────────────────
// Permet de tester l'interface sans le Google Apps Script
function getSampleData() {
  return {
    automate: [
      { code: '10001', emplacement: 'Data Exchange', description: 'Taille de la trame envoyée par le serveur non conforme (voir log LLUM)', causes: '--', mesures: '--' },
      { code: '30002', emplacement: 'Use PAP', description: 'Coordonnées de rack associées au casier erronées (RACK.Distance && NAV.diActlPos)', causes: '--', mesures: '--' },
      { code: '10003', emplacement: 'TcpClient', description: 'Erreur lors de la réception de la dernière trame (erreur carte KRB)', causes: '--', mesures: '--' },
      { code: '10004', emplacement: 'TcpClient', description: 'Perte de communication avec la carte de poids ascenseur (erreur carte KRB)', causes: '--', mesures: '--' },
      { code: '30004', emplacement: 'TcpClient', description: 'Perte de communication avec la carte de poids ascenseur (erreur carte KRB)', causes: 'Perte de communication avec la carte sondes de poids.', mesures: 'Acquitter (clear) le code erreur ou vérifier la connexion.' },
      { code: '20005', emplacement: 'Back', description: 'Perte de communication ponctuelle avec un équipement CAREL', causes: '--', mesures: '--' },
      { code: '30005', emplacement: 'Back', description: 'Perte de communication prolongée avec un équipement CAREL', causes: 'Perte de communication prolongée avec un équipement CAREL (froid).', mesures: 'Rebrancher physiquement la sonde de température en laissant du mou.' },
      { code: '30301', emplacement: 'Drive Stepper', description: 'Perte de la communication avec le driver moteur (.HeartBit)', causes: 'Perte de communication WiFi avec la carte driver (ex: PAP).', mesures: 'RAZ du code erreur et ARM du driver concerné.' },
      { code: '30304', emplacement: 'Drive Stepper', description: 'Echec de l\'amorçage du mouvement du moteur (.Error)', causes: 'Échec armement moteur ou blocage physique (ex: ALD2).', mesures: 'Effectuer ARM + RUN ou petit homing avant de relancer.' },
      { code: '30305', emplacement: 'Drive Stepper', description: 'Echec en cours de mouvement du moteur (.Error)', causes: 'Échec en cours de mouvement moteur (Drive Stepper, ALF2, ALD2).', mesures: 'Effectuer ARM + RUN ou un Homing du composant.' },
      { code: '30306', emplacement: 'Drive Stepper', description: 'Arrêt du mouvement sur dépassement de la consigne à la précision donnée', causes: 'Dépassement de la position target pendant le mouvement (IsMoving).', mesures: 'Faire un ARM + RUN sur le PAP pour forcer la relance.' },
      { code: '30606', emplacement: 'Home PAP', description: 'Blocage du pap aléatoire pendant la procédure de prise d\'origine', causes: 'Blocage PAP durant son Homing.', mesures: 'Mettre Graph Home PAP à 1 (avec Side Swap à FALSE si nécessaire).' },
      { code: '30611', emplacement: 'Use PAP', description: 'Blocage du pap sur le mouvement d\'approche de l\'onglet', causes: 'Blocage de la courroie préhension en approche sur onglet (.Stuck).', mesures: 'Effectuer un ARM + RUN.' },
      { code: '30612', emplacement: 'Use PAP', description: 'Blocage du pap lors du retour à la position d\'origine sur casier', causes: 'Blocage PAP (souvent en Kick, ou transfert lent).', mesures: 'Effectuer un ARM + RUN, et ajuster position NAV si besoin.' },
      { code: '30613', emplacement: 'CenterPAP', description: 'Echec du centrage du casier sur la navette (.SensorLocker_SIDE)', causes: 'Échec centrage casier (SensorLocker_SIDE perdu).', mesures: 'Recentrer le casier, mettre UsePAP à 220 et PAP.Busy à FALSE.' },
      { code: '30101', emplacement: 'Computer', description: 'Le casier présent au niveau de la façade ne peut être déposé dans le rack', causes: '--', mesures: '--' },
      { code: '30102', emplacement: 'Computer', description: 'Le casier appelé est introuvable dans le rack', causes: 'Casier introuvable ou désynchronisation base de données (LLUM vs Automate).', mesures: 'Mettre à jour l\'automate pour correspondre au LLUM ou libérer le casier.' },
    ],
    lexium: [
      { codeDec: '4352', codeHex: '1100', classe: '0', description: 'Paramètres en dehors de la plage de valeurs autorisées', cause: 'La valeur indiquée était en dehors de la plage de valeurs autorisée pour ce paramètre.', mesures: 'La valeur indiquée doit être comprise dans la plage de valeurs autorisée.' },
      { codeDec: '4353', codeHex: '1101', classe: '0', description: 'Paramètre n\'existe pas', cause: 'La gestion des paramètres a détecté une erreur : le paramètre (index) n\'existe pas.', mesures: 'Sélectionnez un autre paramètre (index).' },
      { codeDec: '4355', codeHex: '1103', classe: '0', description: 'Écriture du paramètre non autorisée (READ-only)', cause: 'Accès en écriture aux paramètres Read-Only', mesures: 'Écrire uniquement dans les paramètres inscriptibles.' },
      { codeDec: '4356', codeHex: '1104', classe: '0', description: 'Accès en écriture refusé (aucun droit d\'accès)', cause: 'L\'accès au paramètre est uniquement possible en mode expert.', mesures: 'Accès en écriture expert nécessaire.' },
      { codeDec: '4358', codeHex: '1106', classe: '0', description: 'Commande non autorisée lorsque l\'étage de puissance est activé.', cause: 'Commande non autorisée lorsque l\'étage de puissance est activé.', mesures: 'Désactiver l\'étage de puissance et répéter l\'instruction.' },
      { codeDec: '4363', codeHex: '110B', classe: '3', description: 'Erreur détectée lors du téléchargement de la configuration', cause: 'Erreur détectée lors du contrôle des paramètres.', mesures: 'La valeur contenue dans les informations d\'erreur supplémentaires indique l\'adresse de registre Modbus.' },
      { codeDec: '4365', codeHex: '110D', classe: '1', description: 'Configuration de base du variateur nécessaire selon les réglages sortie usine.', cause: '"First Setup" (FSU) n\'a pas été exécuté ou pas complètement.', mesures: 'Effectuez un First Setup.' },
      { codeDec: '4372', codeHex: '1114', classe: '4', description: 'Téléchargement de la configuration annulé', cause: 'Une erreur de communication ou une erreur dans l\'outil externe a été détectée lors du téléchargement d\'une configuration.', mesures: 'Désactiver puis réactiver le variateur et répéter la tentative de téléchargement.' },
      { codeDec: '45321', codeHex: 'B109', classe: '4', description: 'Module de communication : Heartbeat de synchronisation perdu entre le module et le variateur', cause: '-', mesures: '-' },
      { codeDec: '45344', codeHex: 'B120', classe: '2', description: 'Communication cyclique : temps de cycle incorrect.', cause: 'Le variateur ne prend pas en charge le temps de cycle configuré.', mesures: 'Modifiez le temps de cycle dans la commande maître.' },
    ],
    liens: [
      { titre: 'Documentation machine', url: 'https://example.com/docs' },
      { titre: 'Portail GMAO', url: 'https://example.com/gmao' },
    ]
  };
}
