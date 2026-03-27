// ─── MODULE 15: GOOGLE SHEETS AUTO-SYNC ──────────────────────────────────────
// Synchronise automatiquement les données de paris vers Google Sheets
// Utilise l'API Google Sheets v4 via service account ou API key publique
//
// PRÉREQUIS (variables d'environnement optionnelles):
//   GOOGLE_SHEETS_ID    — ID du spreadsheet (dans l'URL)
//   GOOGLE_SHEETS_KEY   — Clé API Google (plan gratuit, lecture/écriture publique)
//
// FORMAT des colonnes (Module 15 exact):
//   A: ID pari | B: Date | C: Match | D: Type | E: Cote | F: Mise
//   G: Résultat | H: Gain/Perte | I: ROI cumulé | J: CLV | K: Score BK | L: Ligue

const https  = require("https");
const logger = require("./logger");

const SHEETS_ID  = process.env.GOOGLE_SHEETS_ID  || "";
const SHEETS_KEY = process.env.GOOGLE_SHEETS_KEY  || "";
const SHEET_NAME = "BetPawa_AI"; // nom de l'onglet

// ─── FORMATER UNE LIGNE DE PARI ──────────────────────────────────────────────
function formatBetRow(bet, roiCumul) {
  var date     = bet.timestamp ? new Date(bet.timestamp).toLocaleDateString("fr-FR") : "—";
  var matchStr = (bet.selections||[]).slice(0,2).map(function(s){
    return s.home+" vs "+s.away;
  }).join(", ")+(bet.selections&&bet.selections.length>2?" +"+( bet.selections.length-2):"");
  var typeStr  = (bet.selections||[]).slice(0,2).map(function(s){
    return s.market+":"+s.outcome;
  }).join(", ");
  var resultat = bet.status==="pending" ? "EN ATTENTE" : bet.won ? "GAGNÉ" : "PERDU";
  var gainPerte= bet.status==="pending" ? 0 : bet.won ? (bet.gainNet||0) : -(bet.mise||0);
  var clv      = (bet.clvAverage !== undefined && bet.clvAverage !== null) ? bet.clvAverage : "";
  var scoreBK  = (bet.bookmakerScore !== undefined) ? bet.bookmakerScore : "";
  var league   = (bet.selections||[])[0] ? (bet.selections[0].league||"") : "";

  return [
    bet.id || "",
    date,
    matchStr,
    typeStr,
    bet.totalOdd ? parseFloat(bet.totalOdd).toFixed(2) : "",
    bet.mise || 1,
    resultat,
    gainPerte,
    roiCumul !== undefined ? parseFloat(roiCumul).toFixed(1)+"%" : "",
    clv !== "" ? clv+"%" : "",
    scoreBK !== "" ? scoreBK+"/10" : "",
    league,
  ];
}

// ─── REQUÊTE API GOOGLE SHEETS ────────────────────────────────────────────────
function sheetsRequest(method, path, body) {
  return new Promise(function(resolve, reject) {
    if (!SHEETS_ID || !SHEETS_KEY) {
      resolve({ skipped: true, reason: "GOOGLE_SHEETS_ID ou GOOGLE_SHEETS_KEY non configuré", ok: true });
      return;
    }
    var url = "https://sheets.googleapis.com/v4/spreadsheets/"+SHEETS_ID+path+"?key="+SHEETS_KEY;
    var bodyStr = body ? JSON.stringify(body) : "";
    var opts = {
      hostname: "sheets.googleapis.com",
      path:     "/v4/spreadsheets/"+SHEETS_ID+path+"?key="+SHEETS_KEY,
      method:   method,
      headers:  { "Content-Type":"application/json", "Content-Length": Buffer.byteLength(bodyStr||"") },
    };
    var req = https.request(opts, function(res) {
      var d = "";
      res.on("data", function(c){ d+=c; });
      res.on("end", function() {
        try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); }
      });
    });
    req.on("error", function(e){ reject(e); });
    req.setTimeout(8000, function(){ req.destroy(); reject(new Error("Sheets API timeout")); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── AJOUTER UNE LIGNE ────────────────────────────────────────────────────────
async function appendBetToSheet(bet, roiCumul) {
  if (!SHEETS_ID || !SHEETS_KEY) {
    logger.debug("[SHEETS] Non configuré — export ignoré (ajouter GOOGLE_SHEETS_ID + GOOGLE_SHEETS_KEY)");
    return { skipped: true, ok: true };
  }
  try {
    var row = formatBetRow(bet, roiCumul);
    var body = {
      values: [row],
      majorDimension: "ROWS",
    };
    var path = "/values/"+encodeURIComponent(SHEET_NAME+"!A:L")+":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS";
    var result = await sheetsRequest("POST", "/values/"+encodeURIComponent(SHEET_NAME+"!A:L")+":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS", body);
    if (result && result.updates) {
      logger.info("📊 [SHEETS] Ligne ajoutée: "+bet.id+" → "+SHEET_NAME);
      return result;
    } else {
      logger.debug("[SHEETS] Réponse inattendue: "+JSON.stringify(result).slice(0,100));
      return null;
    }
  } catch(e) {
    logger.debug("[SHEETS] Erreur: "+e.message);
    return null;
  }
}

// ─── METTRE À JOUR LES STATS GLOBALES ─────────────────────────────────────────
async function updateStatsRow(stats, clvAvg) {
  if (!SHEETS_ID || !SHEETS_KEY) return null;
  try {
    var roi = stats.totalMise > 0 ? ((stats.gains-stats.pertes)/stats.totalMise*100).toFixed(1)+"%" : "0.0%";
    var wr  = (stats.wins+stats.losses) > 0 ? (stats.wins/(stats.wins+stats.losses)*100).toFixed(0)+"%" : "0%";
    var statsRow = [
      "=== STATS ===",
      new Date().toLocaleDateString("fr-FR"),
      "Bankroll: "+(stats.bankroll||5000).toLocaleString("fr-FR")+" FCFA",
      "ROI: "+roi,
      "Win rate: "+wr,
      "Gains: +"+(stats.gains||0).toLocaleString("fr-FR")+" F",
      "Pertes: -"+(stats.pertes||0).toLocaleString("fr-FR")+" F",
      "",
      roi,
      clvAvg !== null ? clvAvg+"%" : "",
      "",
      (stats.wins||0)+"V / "+(stats.losses||0)+"D",
    ];
    // Mettre à jour la ligne 2 (réservée aux stats)
    var body = { values: [statsRow], majorDimension: "ROWS" };
    await sheetsRequest("PUT", "/values/"+encodeURIComponent(SHEET_NAME+"!A2:L2")+"?valueInputOption=USER_ENTERED", body);
    return true;
  } catch(e) {
    logger.debug("[SHEETS] updateStats: "+e.message);
    return null;
  }
}

// ─── INITIALISER LA FEUILLE (en-têtes) ───────────────────────────────────────
async function initSheet() {
  if (!SHEETS_ID || !SHEETS_KEY) return null;
  try {
    var headers = [["ID Pari","Date","Match","Type","Cote","Mise","Résultat","Gain/Perte","ROI Cumulé","CLV","Score BK","Ligue"]];
    var body = { values: headers };
    await sheetsRequest("PUT", "/values/"+encodeURIComponent(SHEET_NAME+"!A1:L1")+"?valueInputOption=USER_ENTERED", body);
    logger.info("📊 [SHEETS] En-têtes initialisés dans: "+SHEET_NAME);
    return true;
  } catch(e) {
    logger.debug("[SHEETS] initSheet: "+e.message);
    return null;
  }
}

module.exports = {
  appendBetToSheet,
  updateStatsRow,
  initSheet,
  formatBetRow,
  sheetsAvailable: function() { return !!(SHEETS_ID && SHEETS_KEY); },
};
