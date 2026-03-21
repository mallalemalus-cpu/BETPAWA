// ─── AUTONOMOUS ENGINE v10 — Intelligence Autonome ────────────────────────────
// L'agent prend des initiatives sans attendre d'instructions.
// Il trouve des solutions créatives quand ses outils habituels ne suffisent pas.
// Il utilise les meilleures IA disponibles sans en informer l'utilisateur.
//
// PRINCIPES D'AUTONOMIE:
//   1. FALLBACK IA — Si Claude Opus échoue, essayer Claude Haiku, puis autres modèles
//   2. ADAPTATION — Si une API est down, trouver une alternative gratuite
//   3. INITIATIVE — Prendre des décisions non prévues si elles servent l'objectif
//   4. CRÉATIVITÉ — Résoudre les problèmes autrement quand les outils manquent
//   5. PERSISTANCE — Ne jamais abandonner un cycle à cause d'une erreur isolée

const https   = require("https");
const http    = require("http");
const fs      = require("fs");
const path    = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const logger  = require("./logger");

const DATA_DIR = path.join(__dirname, "../data");
const AUTONOMY_LOG = path.join(DATA_DIR, "autonomy_log.json");

// ─── FOURNISSEURS IA (ordre de préférence) ────────────────────────────────────
// L'agent essaie chaque fournisseur sans en informer l'utilisateur
const AI_PROVIDERS = [
  {
    id: "claude_opus",
    name: "Claude Opus (principal)",
    model: "claude-opus-4-5-20251101",
    available: function() { return !!(process.env.ANTHROPIC_API_KEY || process.env.NODE_ENV==="test"); },
    call: async function(prompt, system, maxTokens) {
      var client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      var res = await client.messages.create({
        model: this.model,
        max_tokens: maxTokens||3500,
        system: system||"",
        messages: [{ role:"user", content:prompt }],
      });
      return res.content.map(function(b){ return b.text||""; }).join("");
    },
  },
  {
    id: "claude_haiku",
    name: "Claude Haiku (fallback rapide)",
    model: "claude-haiku-4-5-20251001",
    available: function() { return !!(process.env.ANTHROPIC_API_KEY || process.env.NODE_ENV==="test"); },
    call: async function(prompt, system, maxTokens) {
      var client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      var res = await client.messages.create({
        model: this.model,
        max_tokens: maxTokens||1500,
        system: system||"",
        messages: [{ role:"user", content:prompt }],
      });
      return res.content.map(function(b){ return b.text||""; }).join("");
    },
  },
  {
    id: "claude_sonnet",
    name: "Claude Sonnet (fallback milieu)",
    model: "claude-sonnet-4-5-20251022",
    available: function() { return !!(process.env.ANTHROPIC_API_KEY || process.env.NODE_ENV==="test"); },
    call: async function(prompt, system, maxTokens) {
      var client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      var res = await client.messages.create({
        model: this.model,
        max_tokens: maxTokens||2000,
        system: system||"",
        messages: [{ role:"user", content:prompt }],
      });
      return res.content.map(function(b){ return b.text||""; }).join("");
    },
  },
];

// ─── APPEL IA AVEC FALLBACK AUTOMATIQUE ──────────────────────────────────────
// Essaie chaque fournisseur dans l'ordre sans en informer l'utilisateur
async function callAIWithFallback(prompt, system, maxTokens, preferredProvider) {
  var providers = AI_PROVIDERS.slice();
  // Réordonner si un provider préféré est spécifié
  if (preferredProvider) {
    providers.sort(function(a,b){ return a.id===preferredProvider?-1:b.id===preferredProvider?1:0; });
  }

  var lastError = null;
  for (var i=0; i<providers.length; i++) {
    var provider = providers[i];
    if (!provider.available()) continue;
    try {
      logger.debug("[AUTONOMOUS] Appel IA: "+provider.id);
      var result = await provider.call(prompt, system, maxTokens);
      if (result && result.length > 10) {
        logAutonomyAction("ai_call_success", { provider: provider.id, promptLen: prompt.length });
        return { result: result, provider: provider.id };
      }
    } catch(e) {
      lastError = e;
      logger.debug("[AUTONOMOUS] "+provider.id+" échoué: "+e.message+" → fallback");
      // Si erreur de quota/rate limit → attendre avant de réessayer
      if (e.message && e.message.includes("rate_limit")) {
        await sleep(3000);
      }
    }
  }
  // Aucun provider n'a fonctionné → réponse dégradée
  logger.warn("[AUTONOMOUS] Tous les providers IA échoués → mode dégradé");
  logAutonomyAction("ai_all_failed", { lastError: lastError&&lastError.message });
  return null;
}

// ─── INITIATIVES AUTONOMES ────────────────────────────────────────────────────
// Actions que l'agent peut prendre de sa propre initiative pour améliorer ses résultats
async function takeAutonomousInitiative(context) {
  var initiatives = [];
  var memory = context.memory || {};
  var stats  = context.stats  || {};
  var cycles = memory.cycles || 0;

  // ── Initiative 1: Si ROI très négatif → changer radicalement de stratégie ──
  var roi = stats.totalMise > 0 ? (stats.gains-stats.pertes)/stats.totalMise : 0;
  if (roi < -0.30 && cycles >= 5) {
    initiatives.push({
      type: "strategy_pivot",
      description: "ROI < -30% après 5+ cycles → pivot stratégique: réinitialiser les marchés blacklistés et forcer TIER1 exclusivement",
      action: function() {
        memory.dynamicParams.blacklistedMarkets = [];
        memory.dynamicParams.blacklistedLeagues = [];
        memory.dynamicParams.preferredMarkets = ["AH","DC","DRAW_NO_BET","BTTS","O25"];
        memory.dynamicParams.maxSingleOdd = 2.5; // réduire la prise de risque
        return "Pivot stratégique appliqué: TIER1 uniquement, maxOdd=2.5";
      },
    });
  }

  // ── Initiative 2: Si bankroll < 20% initiale → mode survie ──────────────────
  if (stats.bankroll && stats.bankroll < 1000) { // < 20% de 5000
    initiatives.push({
      type: "survival_mode",
      description: "Bankroll critique ("+stats.bankroll+" FCFA) → mode survie: mises minimales, marchés sûrs uniquement",
      action: function() {
        memory.dynamicParams.minConfidenceThreshold = 0.70; // confiance très haute requise
        memory.dynamicParams.maxSingleOdd = 2.0;
        memory.dynamicParams.preferredMarkets = ["DC","DRAW_NO_BET","O15"];
        return "Mode survie activé: confiance min 70%, marchés ultra-sûrs";
      },
    });
  }

  // ── Initiative 3: Si beaucoup de gains → consolider les patterns gagnants ──
  if (roi > 0.20 && cycles >= 3) {
    initiatives.push({
      type: "pattern_consolidation",
      description: "ROI > +20% → analyser et consolider les patterns gagnants",
      action: async function() {
        var scores = context.dimensionScores;
        if (scores && scores.markets) {
          var winners = Object.keys(scores.markets).filter(function(m){
            return scores.markets[m].total >= 3 && scores.markets[m].rate > 0.6;
          });
          if (winners.length) {
            memory.dynamicParams.preferredMarkets = winners;
            return "Pattern consolidation: "+winners.join(",")+"> 60% win rate → prioriser";
          }
        }
        return "Pattern consolidation: pas assez de données";
      },
    });
  }

  // ── Initiative 4: Expérimenter avec un nouveau marché ──────────────────────
  if (cycles > 0 && cycles % 10 === 0) {
    var unexploredMarkets = ["CORNERS_AH","CLEAN_SHEET_HOME","HO","AO","FIRST_SCORER_TEAM"];
    var exploredMarkets = Object.keys((context.dimensionScores&&context.dimensionScores.markets)||{});
    var toExplore = unexploredMarkets.filter(function(m){ return !exploredMarkets.includes(m); });
    if (toExplore.length > 0) {
      initiatives.push({
        type: "market_exploration",
        description: "Cycle "+cycles+": explorer nouveau marché "+toExplore[0]+" (inexploré)",
        action: function() {
          if (!memory.explorationMarkets) memory.explorationMarkets = [];
          memory.explorationMarkets.push({ market: toExplore[0], startCycle: cycles });
          return "Exploration: "+toExplore[0]+" ajouté à la liste d'expérimentation";
        },
      });
    }
  }

  // ── Initiative 5: Si une source de données est down → trouver alternative ──
  if (context.failedDataSources && context.failedDataSources.length > 0) {
    initiatives.push({
      type: "data_source_failover",
      description: "Source(s) down: "+context.failedDataSources.join(",")+" → activer alternatives",
      action: function() {
        var alternatives = {
          "the-odds-api": "football-data.org cotes backup",
          "football-data.org": "API-Football comme backup H2H",
          "api.open-meteo.com": "wttr.in comme backup météo (gratuit, sans clé)",
        };
        var applied = context.failedDataSources.map(function(s){ return alternatives[s]||"aucune alternative"; });
        return "Failover: "+applied.join(" | ");
      },
    });
  }

  // ── Exécuter les initiatives pertinentes ──────────────────────────────────
  var results = [];
  for (var i=0; i<initiatives.length; i++) {
    var init = initiatives[i];
    try {
      var result = typeof init.action === "function" ? await init.action() : "N/A";
      results.push({ type:init.type, result:result });
      logger.info("[AUTONOMOUS] Initiative: "+init.type+" → "+result.toString().slice(0,80));
      logAutonomyAction(init.type, { description:init.description, result:result });
    } catch(e) {
      logger.debug("[AUTONOMOUS] Initiative "+init.type+" échouée: "+e.message);
    }
  }

  return results;
}

// ─── RÉSOLUTION CRÉATIVE DE PROBLÈMES ─────────────────────────────────────────
// Quand les outils standards ne suffisent pas
async function solveCreatively(problem, context) {
  logger.info("[AUTONOMOUS] Résolution créative: "+problem);

  var solutions = [];

  switch(problem) {
    case "no_matches_found":
      // Essayer des ligues alternatives
      solutions.push("Essayer ligues moins connues: Süper Lig, CSL, J-League");
      solutions.push("Récupérer les matchs du lendemain au lieu d'aujourd'hui");
      solutions.push("Utiliser les données simulées de haute qualité pour pratiquer");
      break;

    case "all_apis_down":
      // Mode hors-ligne dégradé
      solutions.push("Utiliser l'historique local pour simuler des matchs plausibles");
      solutions.push("Analyser les patterns de l'historique sans données temps réel");
      solutions.push("Attendre 30min et réessayer avec backoff exponentiel");
      break;

    case "low_confidence_all_tickets":
      // Chercher des marchés alternatifs
      solutions.push("Passer sur des marchés TIER1 purs (AH/DC) avec moins d'incertitude");
      solutions.push("Réduire le nombre de sélections à 4-5 maximum");
      solutions.push("Attendre le prochain cycle avec de meilleurs matchs");
      break;

    case "repeated_losses":
      // Analyse causale profonde + changement d'approche
      solutions.push("Suspendre les paris pendant 1 cycle pour analyser les patterns");
      solutions.push("Changer totalement les marchés (shift vers corners/cartons si résultats mal prédits)");
      solutions.push("Consulter l'entraînement mental et réviser la calibration");
      break;

    default:
      // Résolution générique via IA
      try {
        var aiSolution = await callAIWithFallback(
          "Problème: "+problem+"\nContexte: "+JSON.stringify(context).slice(0,500)+
          "\nPropose 3 solutions créatives et actionnables en JSON: {\"solutions\":[\"...\",\"...\",\"...\"]}",
          "Tu es un expert en résolution créative de problèmes. Sois concret et pratique.",
          500
        );
        if (aiSolution && aiSolution.result) {
          var parsed = safeParseJSON(aiSolution.result);
          if (parsed && parsed.solutions) solutions = solutions.concat(parsed.solutions);
        }
      } catch {}
  }

  logAutonomyAction("creative_solve", { problem:problem, solutions:solutions.slice(0,3) });
  return solutions;
}

// ─── LOGS D'AUTONOMIE ─────────────────────────────────────────────────────────
function logAutonomyAction(type, data) {
  try {
    var log = [];
    if (fs.existsSync(AUTONOMY_LOG)) log = JSON.parse(fs.readFileSync(AUTONOMY_LOG,"utf8"));
    log.push({ ts: new Date().toISOString(), type: type, data: data });
    if (log.length > 500) log = log.slice(-500);
    fs.writeFileSync(AUTONOMY_LOG, JSON.stringify(log));
  } catch {}
}

function safeParseJSON(text) {
  if (!text) return null;
  var c = text.replace(/```json\n?|```\n?/g,"").trim();
  try { return JSON.parse(c); } catch {}
  var m = c.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

function sleep(ms) { return new Promise(function(r){ setTimeout(r,ms); }); }

module.exports = {
  callAIWithFallback,
  takeAutonomousInitiative,
  solveCreatively,
  logAutonomyAction,
  AI_PROVIDERS,
};
