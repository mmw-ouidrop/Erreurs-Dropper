/**
 * ═══════════════════════════════════════════════════════════════
 *  OUIDROP — Google Apps Script
 *  À déployer comme "Application Web" dans votre projet Google Sheet
 *
 *  INSTRUCTIONS DE DÉPLOIEMENT :
 *  1. Ouvrir votre Google Sheet
 *  2. Extensions > Apps Script
 *  3. Coller ce code dans le fichier Code.gs
 *  4. Configurer les constantes ci-dessous
 *  5. Déployer > Nouveau déploiement > Type : Application Web
 *     - Exécuter en tant que : Moi
 *     - Accès : Tout le monde (anonyme)
 *  6. Copier l'URL de déploiement dans core.js (constante GAS_URL)
 * ═══════════════════════════════════════════════════════════════
 */

// ─── CONFIGURATION ─────────────────────────────────────────────
const CONFIG = {
  // ID de votre Google Sheet (dans l'URL : /spreadsheets/d/SPREADSHEET_ID/edit)
  SPREADSHEET_ID: 'VOTRE_SPREADSHEET_ID_ICI',

  // Nom de la feuille contenant les données brutes
  SHEET_NAME: 'Raw_Data',

  // ── Structure de la feuille Raw_Data ──────────────────────────
  // Les deux tables sont côte à côte.
  // Colonne de début de chaque table (index 0-based)
  AUTOMATE: {
    START_COL: 0,   // Colonne A
    HEADER_ROW: 1,  // Ligne des en-têtes (1-based)
    DATA_ROW:   2,  // Première ligne de données
    COLS: {
      code:       0,  // A
      emplacement:1,  // B
      description:2,  // C
      causes:     3,  // D
      mesures:    4,  // E
    }
  },

  LEXIUM: {
    START_COL: 6,   // Colonne G (avec une colonne vide F séparatrice)
    HEADER_ROW: 1,
    DATA_ROW:   2,
    COLS: {
      codeDec: 0,   // G
      codeHex: 1,   // H
      classe:  2,   // I
      description: 3, // J
      cause:   4,   // K
      mesures: 5,   // L
    }
  },

  LIENS: {
    START_COL: 13,  // Colonne N (ajuster selon votre sheet)
    HEADER_ROW: 1,
    DATA_ROW:   2,
    COLS: {
      titre: 0,
      url:   1,
    }
  }
};

// ─── POINT D'ENTRÉE HTTP GET ────────────────────────────────────
function doGet(e) {
  const action = e?.parameter?.action || 'getData';

  let result;
  try {
    if (action === 'getData') {
      result = getData();
    } else {
      result = { error: 'Action inconnue : ' + action };
    }
  } catch (err) {
    result = { error: err.message, stack: err.stack };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── LECTURE DES DONNÉES ────────────────────────────────────────
function getData() {
  const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) throw new Error(`Feuille "${CONFIG.SHEET_NAME}" introuvable.`);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) return { automate: [], lexium: [], liens: [] };

  // Lire toutes les données en un seul appel (plus performant)
  const allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  const automate = parseAutomate(allData);
  const lexium   = parseLexium(allData);
  const liens    = parseLiens(allData);

  return {
    automate,
    lexium,
    liens,
    meta: {
      generatedAt:     new Date().toISOString(),
      totalAutomate:   automate.length,
      totalLexium:     lexium.length,
      totalLiens:      liens.length,
    }
  };
}

// ─── PARSERS ────────────────────────────────────────────────────
function parseAutomate(allData) {
  const cfg  = CONFIG.AUTOMATE;
  const rows = [];

  for (let i = cfg.DATA_ROW - 1; i < allData.length; i++) {
    const row  = allData[i];
    const code = String(row[cfg.START_COL + cfg.COLS.code] || '').trim();

    // Arrêter quand la colonne code est vide (fin de table)
    if (!code) continue;

    rows.push({
      code:        code,
      emplacement: String(row[cfg.START_COL + cfg.COLS.emplacement] || '').trim(),
      description: String(row[cfg.START_COL + cfg.COLS.description] || '').trim(),
      causes:      String(row[cfg.START_COL + cfg.COLS.causes]      || '').trim(),
      mesures:     String(row[cfg.START_COL + cfg.COLS.mesures]     || '').trim(),
    });
  }

  return rows;
}

function parseLexium(allData) {
  const cfg  = CONFIG.LEXIUM;
  const rows = [];

  for (let i = cfg.DATA_ROW - 1; i < allData.length; i++) {
    const row     = allData[i];
    const codeDec = String(row[cfg.START_COL + cfg.COLS.codeDec] || '').trim();

    if (!codeDec) continue;

    rows.push({
      codeDec:     codeDec,
      codeHex:     String(row[cfg.START_COL + cfg.COLS.codeHex]     || '').trim(),
      classe:      String(row[cfg.START_COL + cfg.COLS.classe]       || '0').trim(),
      description: String(row[cfg.START_COL + cfg.COLS.description]  || '').trim(),
      cause:       String(row[cfg.START_COL + cfg.COLS.cause]        || '').trim(),
      mesures:     String(row[cfg.START_COL + cfg.COLS.mesures]      || '').trim(),
    });
  }

  return rows;
}

function parseLiens(allData) {
  const cfg  = CONFIG.LIENS;
  const rows = [];

  // Vérifier que la colonne existe
  if (cfg.START_COL >= (allData[0]?.length || 0)) return rows;

  for (let i = cfg.DATA_ROW - 1; i < allData.length; i++) {
    const row   = allData[i];
    const titre = String(row[cfg.START_COL + cfg.COLS.titre] || '').trim();
    const url   = String(row[cfg.START_COL + cfg.COLS.url]   || '').trim();

    if (!titre || !url) continue;
    rows.push({ titre, url });
  }

  return rows;
}

// ─── TEST LOCAL ─────────────────────────────────────────────────
// Pour tester sans déployer, exécuter cette fonction dans l'éditeur
function testGetData() {
  const result = getData();
  Logger.log('Automate : ' + result.automate.length + ' lignes');
  Logger.log('Lexium   : ' + result.lexium.length   + ' lignes');
  Logger.log('Liens    : ' + result.liens.length     + ' liens');
  Logger.log(JSON.stringify(result.automate[0]));
  Logger.log(JSON.stringify(result.lexium[0]));
}
