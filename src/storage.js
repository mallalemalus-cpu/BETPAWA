// ─── STORAGE v4 — Mémoire causale profonde ───────────────────────────────────
const fs   = require("fs");
const path = require("path");

const DATA_DIR     = path.join(__dirname, "../data");
const BETS_FILE    = path.join(DATA_DIR, "bets.json");
const STATS_FILE   = path.join(DATA_DIR, "stats.json");
const MEMORY_FILE  = path.join(DATA_DIR, "memory.json");
const CAUSAL_FILE  = path.join(DATA_DIR, "causal_journal.json"); // autopsies des pertes
const CAPS_FILE    = path.join(DATA_DIR, "capabilities.json");
const SCORES_FILE  = path.join(DATA_DIR, "dimension_scores.json"); // précision par dimension

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Bets ──────────────────────────────────────────────────────────────────────
function loadBets()     { try { if (!fs.existsSync(BETS_FILE)) return []; return JSON.parse(fs.readFileSync(BETS_FILE,"utf8")); } catch { return []; } }
function loadHistory()  { return loadBets(); }
function saveBet(bet)   { var b=loadBets(); var i=b.findIndex(function(x){return x.id===bet.id;}); if(i>=0)b[i]=bet; else b.push(bet); fs.writeFileSync(BETS_FILE,JSON.stringify(b,null,2)); }

// ── Stats ─────────────────────────────────────────────────────────────────────
const DEFAULT_STATS = { bankroll:5000, totalMise:0, gains:0, pertes:0, wins:0, losses:0, startDate:new Date().toISOString(), lastCycle:null };
function loadStats()    { try { if(!fs.existsSync(STATS_FILE)) return {...DEFAULT_STATS}; return {...DEFAULT_STATS,...JSON.parse(fs.readFileSync(STATS_FILE,"utf8"))}; } catch { return {...DEFAULT_STATS}; } }
function saveStats(s)   { fs.writeFileSync(STATS_FILE,JSON.stringify(s,null,2)); }

// ── Mémoire principale de l'agent ─────────────────────────────────────────────
const DEFAULT_MEMORY = {
  version: 4,
  cycles: 0,
  // Patterns causaux identifiés (pas juste des labels)
  causalPatterns: {
    // Ex: { cause: "cotes>4 en Derby", effect: "perte 8/9", action: "limiter cote individuelle à 3.5 en derby" }
    lossCauses: [],
    winCauses: [],
  },
  // Paramètres dynamiques auto-ajustés — Intervalle 30-400
  dynamicParams: {
    maxSingleOdd: 6.0,
    preferredOddRange: [1.4, 3.0],
    blacklistedMarkets: [],
    blacklistedLeagues: [],
    preferredMarkets: [],
    preferredLeagues: [],
    minConfidenceThreshold: 0.52,
    maxEventsPerTicket: 18,
    minEventsPerTicket: 8,
  },
  // Capacités acquises progressivement
  capabilities: [],
  // Historique des optimisations
  optimizationLog: [],
  lastOptimized: null,
};

function loadMemory()   { try { if(!fs.existsSync(MEMORY_FILE)) return JSON.parse(JSON.stringify(DEFAULT_MEMORY)); var m=JSON.parse(fs.readFileSync(MEMORY_FILE,"utf8")); return Object.assign({},JSON.parse(JSON.stringify(DEFAULT_MEMORY)),m); } catch { return JSON.parse(JSON.stringify(DEFAULT_MEMORY)); } }
function saveMemory(m)  { fs.writeFileSync(MEMORY_FILE,JSON.stringify(m,null,2)); }

// ── Journal causal des pertes (autopsie) ─────────────────────────────────────
function loadCausalJournal() { try { if(!fs.existsSync(CAUSAL_FILE)) return []; return JSON.parse(fs.readFileSync(CAUSAL_FILE,"utf8")); } catch { return []; } }
function saveCausalEntry(entry) {
  var j = loadCausalJournal();
  j.push(entry);
  // Garder seulement les 100 dernières entrées
  if (j.length > 100) j = j.slice(-100);
  fs.writeFileSync(CAUSAL_FILE, JSON.stringify(j,null,2));
}

// ── Scores de précision par dimension d'analyse ───────────────────────────────
const DEFAULT_SCORES = {
  // Chaque dimension: { correct: N, total: N, rate: 0.0 }
  forme:      { correct:0, total:0, rate:0 },
  h2h:        { correct:0, total:0, rate:0 },
  emotional:  { correct:0, total:0, rate:0 },
  weather:    { correct:0, total:0, rate:0 },
  stakes:     { correct:0, total:0, rate:0 },
  integrity:  { correct:0, total:0, rate:0 },
  teamStyle:  { correct:0, total:0, rate:0 },
  // Par marché
  markets: {},
  // Par ligue
  leagues: {},
  // Par tranche de cote individuelle
  oddRanges: {
    "1.1-1.5":  { correct:0, total:0, rate:0 },
    "1.5-2.0":  { correct:0, total:0, rate:0 },
    "2.0-3.0":  { correct:0, total:0, rate:0 },
    "3.0-5.0":  { correct:0, total:0, rate:0 },
    "5.0+":     { correct:0, total:0, rate:0 },
  },
  lastUpdated: null,
};

function loadDimensionScores() {
  try {
    if (!fs.existsSync(SCORES_FILE)) return JSON.parse(JSON.stringify(DEFAULT_SCORES));
    return Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_SCORES)), JSON.parse(fs.readFileSync(SCORES_FILE,"utf8")));
  } catch { return JSON.parse(JSON.stringify(DEFAULT_SCORES)); }
}
function saveDimensionScores(s) { fs.writeFileSync(SCORES_FILE,JSON.stringify(s,null,2)); }

// ── Capacités ─────────────────────────────────────────────────────────────────
function loadCapabilities()   { try { if(!fs.existsSync(CAPS_FILE)) return []; return JSON.parse(fs.readFileSync(CAPS_FILE,"utf8")); } catch { return []; } }
function saveCapabilities(c)  { fs.writeFileSync(CAPS_FILE,JSON.stringify(c,null,2)); }

module.exports = {
  saveBet, loadBets, loadHistory, loadStats, saveStats,
  loadMemory, saveMemory,
  loadCausalJournal, saveCausalEntry,
  loadDimensionScores, saveDimensionScores,
  loadCapabilities, saveCapabilities,
};
