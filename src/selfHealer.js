// ─── SELF HEALER v7 — Auto-détection, Correction et Évaluation ───────────────
// Inspiré de: RepairAgent (2024), Self-Healing Software Systems (2025),
//             Agentic LLM patterns (2025)
//
// CAPACITÉS:
//   1. DÉTECTION DE BUGS RUNTIME — surveille les erreurs et anomalies en live
//   2. VALIDATION DES CHAÎNES DE RAISONNEMENT — cherche les failles logiques
//   3. AUTO-ÉVALUATION — vérifie que toutes les capacités fonctionnent
//   4. CORRECTION AUTONOME — propose et enregistre des patches
//   5. SURVEILLANCE DES MÉTRIQUES — détecte les dégradations de performance
//
// FAILLES TYPIQUES DANS LES CHAÎNES DE PENSÉE DES AGENTS DE PARIS:
//   → Biais de récence (over-réagir à la dernière défaite)
//   → Corrélation fallacy (croire que deux sélections sont indépendantes)
//   → Anchoring (rester accroché à une cote de référence obsolète)
//   → Gambler's fallacy (croire qu'une équipe "doit" gagner après X défaites)
//   → Overconfidence après une série de gains
//   → Underestimation de la variance dans les combinés longs

const Anthropic = require("@anthropic-ai/sdk");
const fs        = require("fs");
const path      = require("path");
const { loadMemory, saveMemory, loadHistory, loadStats, loadDimensionScores } = require("./storage");
const logger = require("./logger");

const client     = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL      = "claude-haiku-4-5-20251001";
const HEAL_LOG   = path.join(__dirname, "../data/self_heal_log.json");

// ─── FAILLES COGNITIVES CONNUES ───────────────────────────────────────────────
const COGNITIVE_BIASES = {
  RECENCY_BIAS:      { id:"recency_bias",      description:"Sur-pondération des résultats récents (dernier match > long terme)", severity:"élevé" },
  GAMBLERS_FALLACY:  { id:"gamblers_fallacy",  description:"Croire qu'une équipe 'doit' gagner après X défaites consécutives", severity:"élevé" },
  OVERCONFIDENCE:    { id:"overconfidence",    description:"Confiance > 75% sur des combinés de 12+ sélections (mathématiquement impossible)", severity:"critique" },
  CORRELATION_FAIL:  { id:"correlation_fail",  description:"Traiter comme indépendants des événements corrélés (Derby + Derby même jour)", severity:"moyen" },
  ANCHORING:         { id:"anchoring",         description:"Baser une décision sur une cote vue précédemment plutôt que la cote actuelle", severity:"moyen" },
  NARRATIVE_FALLACY: { id:"narrative_fallacy", description:"Inventer une histoire cohérente pour justifier un biais préexistant", severity:"élevé" },
  SUNK_COST:         { id:"sunk_cost",         description:"Augmenter la mise pour 'récupérer' les pertes précédentes", severity:"critique" },
  SURVIVORSHIP_BIAS: { id:"survivorship_bias", description:"Analyser uniquement les succès passés en ignorant les échecs similaires", severity:"moyen" },
  HOT_HAND_FALLACY:  { id:"hot_hand_fallacy",  description:"Croire qu'une série de gains garantit le prochain gain", severity:"moyen" },
};

// ─── CHARGEMENT/SAUVEGARDE DU JOURNAL DE SANTÉ ───────────────────────────────
function loadHealLog() {
  try { if (!fs.existsSync(HEAL_LOG)) return []; return JSON.parse(fs.readFileSync(HEAL_LOG,"utf8")); }
  catch { return []; }
}
function saveHealLog(entry) {
  var log = loadHealLog();
  log.push(entry);
  if (log.length > 50) log = log.slice(-50);
  fs.writeFileSync(HEAL_LOG, JSON.stringify(log, null, 2));
}

// ─── AUTO-ÉVALUATION COMPLÈTE ─────────────────────────────────────────────────
// Vérifie que toutes les capacités fonctionnent et détecte les dégradations
async function runSelfEvaluation() {
  logger.info("🔧 [SELF-HEALER] Auto-évaluation complète...");
  var report = {
    timestamp: new Date().toISOString(),
    checks: [],
    overallHealth: "ok",
    issuesFound: 0,
    criticalIssues: 0,
  };

  // ── Check 1: Modules essentiels chargent sans erreur ──────────────────────
  var modules = ["./simulator","./evEngine","./sharpMoneyDetector","./narrativeEngine",
                 "./contextAnalyzer","./optimizer","./webResearcher","./dataFetcher"];
  modules.forEach(function(mod) {
    try {
      require(mod);
      report.checks.push({ module: mod, status: "ok" });
    } catch(e) {
      report.checks.push({ module: mod, status: "error", error: e.message });
      report.issuesFound++;
      if (mod.includes("evEngine")||mod.includes("simulator")||mod.includes("optimizer")) report.criticalIssues++;
    }
  });

  // ── Check 2: Cohérence des données de stockage ────────────────────────────
  try {
    var stats  = loadStats();
    var mem    = loadMemory();
    var hist   = loadHistory();

    if (stats.bankroll <= 0) {
      report.checks.push({ check:"bankroll", status:"warning", message:"Bankroll à zéro ou négative: "+stats.bankroll });
      report.issuesFound++;
    } else { report.checks.push({ check:"bankroll", status:"ok", value:stats.bankroll }); }

    if (stats.bankroll > stats.totalMise * 10 && stats.totalMise > 0) {
      report.checks.push({ check:"stats_coherence", status:"warning", message:"Bankroll >> mises totales — incohérence possible" });
    } else { report.checks.push({ check:"stats_coherence", status:"ok" }); }

    // Vérifier les paris pending depuis trop longtemps (>48h)
    var now = Date.now();
    var stalePending = hist.filter(function(b){
      return b.status==="pending" && b.timestamp && (now - new Date(b.timestamp).getTime()) > 48*3600*1000;
    });
    if (stalePending.length > 0) {
      report.checks.push({ check:"stale_pending", status:"warning", message: stalePending.length+" paris en attente depuis >48h — résultats bloqués?" });
      report.issuesFound++;
    } else { report.checks.push({ check:"stale_pending", status:"ok" }); }

    // Vérifier config dynamique cohérente
    var dp = mem.dynamicParams;
    if (dp.maxSingleOdd < 1.15 || dp.maxSingleOdd > 15) {
      report.checks.push({ check:"dynamic_config", status:"warning", message:"maxSingleOdd hors limites: "+dp.maxSingleOdd });
      report.issuesFound++;
      // AUTO-CORRECTION
      dp.maxSingleOdd = Math.max(1.5, Math.min(10, dp.maxSingleOdd));
      saveMemory(mem);
      report.checks.push({ check:"dynamic_config_fix", status:"fixed", message:"maxSingleOdd corrigé à "+dp.maxSingleOdd });
    } else { report.checks.push({ check:"dynamic_config", status:"ok", value:dp.maxSingleOdd }); }

    if (dp.minEventsPerTicket > dp.maxEventsPerTicket) {
      report.checks.push({ check:"events_range", status:"error", message:"min > max events: "+dp.minEventsPerTicket+">"+dp.maxEventsPerTicket });
      dp.minEventsPerTicket = 8; dp.maxEventsPerTicket = 18;
      saveMemory(mem);
      report.checks.push({ check:"events_range_fix", status:"fixed", message:"Corrigé: min=8 max=18" });
      report.issuesFound++;
    } else { report.checks.push({ check:"events_range", status:"ok" }); }

  } catch(e) {
    report.checks.push({ check:"storage", status:"error", error: e.message });
    report.criticalIssues++;
  }

  // ── Check 3: Simulation Monte Carlo fonctionne ────────────────────────────
  try {
    var { simulateMatch } = require("./simulator");
    var testSim = simulateMatch({ homeAttack:1.5, homeDefense:1.0, awayAttack:1.1, awayDefense:1.0 }, 1000);
    if (testSim.probabilities.homeWin.prob > 0 && testSim.probabilities.draw.prob > 0) {
      report.checks.push({ check:"simulator", status:"ok", homeWin: testSim.probabilities.homeWin.pct+"%" });
    } else {
      report.checks.push({ check:"simulator", status:"error", message:"Probabilités invalides" });
      report.criticalIssues++;
    }
  } catch(e) {
    report.checks.push({ check:"simulator", status:"error", error: e.message });
    report.issuesFound++;
  }

  // ── Check 4: Score de précision en dégradation? ───────────────────────────
  try {
    var scores = loadDimensionScores();
    var recentWinRate = 0, totalRecent = 0;
    Object.keys(scores.markets||{}).forEach(function(m) {
      var s = scores.markets[m];
      if (s.total >= 5) { recentWinRate += s.rate; totalRecent++; }
    });
    if (totalRecent > 0) {
      var avgWR = recentWinRate / totalRecent;
      if (avgWR < 0.20) {
        report.checks.push({ check:"win_rate_degradation", status:"warning", message:"Win rate global très bas: "+Math.round(avgWR*100)+"%  — révision stratégique recommandée" });
        report.issuesFound++;
      } else { report.checks.push({ check:"win_rate", status:"ok", value: Math.round(avgWR*100)+"%" }); }
    }
  } catch {}

  // Résumé
  report.overallHealth = report.criticalIssues > 0 ? "critical" : report.issuesFound > 2 ? "degraded" : "ok";
  var okCount = report.checks.filter(function(c){return c.status==="ok"||c.status==="fixed";}).length;
  logger.info("🔧 Auto-évaluation: "+okCount+"/"+report.checks.length+" OK | "+(report.issuesFound+" problème(s)") + " | Santé: "+report.overallHealth);
  saveHealLog(report);
  return report;
}

// ─── VALIDATION DE LA CHAÎNE DE RAISONNEMENT ─────────────────────────────────
// Cherche les failles logiques dans le raisonnement de l'agent AVANT qu'il décide
async function validateReasoningChain(agentDecision, betHistory, stats) {
  var flaws = [];
  var warnings = [];

  var sels   = agentDecision.selections || [];
  var conf   = agentDecision.confidence || 0.55;
  var roi    = stats.totalMise > 0 ? (stats.gains-stats.pertes)/stats.totalMise : 0;

  // ── Faille 1: OVERCONFIDENCE ───────────────────────────────────────────────
  var mathematicalMaxConf = Math.pow(0.70, sels.length); // si chaque sélection a 70% de chance
  if (conf > mathematicalMaxConf * 1.5 && sels.length > 8) {
    flaws.push({
      bias: COGNITIVE_BIASES.OVERCONFIDENCE,
      evidence: "Confiance déclarée "+Math.round(conf*100)+"% pour "+sels.length+" sélections — maximum mathématique réaliste: "+Math.round(mathematicalMaxConf*100)+"%",
      correction: "Réduire la confiance à "+Math.round(mathematicalMaxConf*0.8*100)+"%",
      apply: function() { agentDecision.confidence = parseFloat((mathematicalMaxConf * 0.8).toFixed(3)); },
    });
  }

  // ── Faille 2: GAMBLER'S FALLACY ────────────────────────────────────────────
  var recentLosses = betHistory.filter(function(b){return b.won===false;}).slice(-5);
  if (recentLosses.length >= 4) {
    var reasoning = (agentDecision.reasoning||"").toLowerCase();
    if (reasoning.includes("doit") || reasoning.includes("temps que") || reasoning.includes("enfin")) {
      flaws.push({
        bias: COGNITIVE_BIASES.GAMBLERS_FALLACY,
        evidence: "4+ défaites récentes + language suggérant 'c'est le moment de gagner'",
        correction: "Chaque paris est indépendant. 4 défaites ne rendent pas le 5e plus probable.",
        apply: function() {}, // ne pas modifier, seulement avertir
      });
    }
  }

  // ── Faille 3: RECENCY BIAS ─────────────────────────────────────────────────
  var recentWins = betHistory.filter(function(b){return b.won===true;}).slice(-5);
  if (recentWins.length >= 4) {
    var currentConf = agentDecision.confidence || 0.55;
    var historicalAvgConf = betHistory.slice(-20).reduce(function(s,b){return s+(b.confidence||0.55);},0) / Math.max(1,betHistory.slice(-20).length);
    if (currentConf > historicalAvgConf * 1.25) {
      warnings.push({
        bias: COGNITIVE_BIASES.HOT_HAND_FALLACY,
        evidence: "Confiance actuelle "+Math.round(currentConf*100)+"% vs moyenne historique "+Math.round(historicalAvgConf*100)+"% après 4+ gains",
        correction: "Maintenir la discipline même après une série de succès",
      });
    }
  }

  // ── Faille 4: CORRELATIONS (derbies multiples) ────────────────────────────
  var derbyCount = sels.filter(function(s){ return s.justification && s.justification.toLowerCase().includes("derby"); }).length;
  if (derbyCount >= 2) {
    flaws.push({
      bias: COGNITIVE_BIASES.CORRELATION_FAIL,
      evidence: derbyCount+" sélections de type 'derby' dans le même ticket — les derbies partagent des patterns d'imprévisibilité",
      correction: "Limiter à 1 derby par ticket pour éviter les corrélations défavorables",
      apply: function() {
        // Retirer les derbies en excès (garder le premier)
        var derbyFound = false;
        agentDecision.selections = agentDecision.selections.filter(function(s) {
          var isDerby = s.justification && s.justification.toLowerCase().includes("derby");
          if (isDerby && !derbyFound) { derbyFound = true; return true; }
          if (isDerby && derbyFound) return false;
          return true;
        });
      },
    });
  }

  // ── Faille 5: NARRATIVE FALLACY ────────────────────────────────────────────
  var reasoning = agentDecision.reasoning || "";
  var tooNarrativeCount = 0;
  var narrativeKeywords = ["histoire", "destin", "mérite", "vengeance", "honneur", "doit prouver", "obligé de"];
  narrativeKeywords.forEach(function(kw) { if (reasoning.toLowerCase().includes(kw)) tooNarrativeCount++; });
  if (tooNarrativeCount >= 3 && sels.length > 10) {
    warnings.push({
      bias: COGNITIVE_BIASES.NARRATIVE_FALLACY,
      evidence: "Raisonnement très narratif ("+tooNarrativeCount+" indicateurs) sur un long combiné — risque de justification post-hoc",
      correction: "Ancrer au moins 60% des justifications sur des données concrètes (stats, cotes, H2H)",
    });
  }

  // ── Faille 6: SUNK COST ────────────────────────────────────────────────────
  if (stats.pertes > stats.bankroll * 0.3) {
    warnings.push({
      bias: COGNITIVE_BIASES.SUNK_COST,
      evidence: "Pertes cumulées ("+stats.pertes.toFixed(0)+" FCFA) représentent "+Math.round(stats.pertes/stats.bankroll*100)+"% de la bankroll",
      correction: "Ne pas augmenter la mise pour 'récupérer' — appliquer Kelly strict",
    });
  }

  // ── Consultation IA pour failles subtiles ─────────────────────────────────
  var aiFlaws = [];
  if ((flaws.length + warnings.length) < 2 && betHistory.length >= 5) {
    try {
      var res = await client.messages.create({
        model: MODEL,
        max_tokens: 400,
        messages:[{ role:"user", content:
          "Analyse les failles logiques dans ce raisonnement d'agent de paris. Sois brutal et précis.\n\n"
          +"RAISONNEMENT: "+reasoning.slice(0,300)+"\n"
          +"SÉLECTIONS: "+sels.slice(0,3).map(function(s){return s.market+":"+s.outcome+"@"+s.odd;}).join("+")+"\n"
          +"CONFIANCE DÉCLARÉE: "+Math.round(conf*100)+"%\n"
          +"ROI ACTUEL: "+(roi*100).toFixed(1)+"%\n\n"
          +"Identifie les biais cognitifs (recency bias, gamblers fallacy, narrative fallacy, overconfidence, etc.)\n"
          +'Réponds en JSON: {"flaws":[{"bias":"...","evidence":"...","correction":"..."}],"isLogicallySound":true|false}'
        }],
      });
      var raw = res.content.map(function(b){return b.text||"";}).join("");
      var parsed = safeParseJSON(raw);
      if (parsed && parsed.flaws) {
        aiFlaws = parsed.flaws;
        if (!parsed.isLogicallySound) warnings.push({ bias: {id:"ai_detected", description:"Faille détectée par analyse IA"}, evidence: aiFlaws[0]&&aiFlaws[0].evidence||"", correction: aiFlaws[0]&&aiFlaws[0].correction||"" });
      }
    } catch {}
  }

  // Appliquer les corrections automatiques
  var applied = [];
  flaws.forEach(function(f) {
    if (f.apply) {
      try { f.apply(); applied.push(f.bias.id); }
      catch {}
    }
  });

  var result = {
    flawsFound:   flaws.length,
    warningsFound:warnings.length,
    aiFlawsFound: aiFlaws.length,
    flaws:        flaws.map(function(f){ return { bias:f.bias.id, severity:f.bias.severity, evidence:f.evidence, correction:f.correction }; }),
    warnings:     warnings.map(function(w){ return { bias:w.bias.id||"?", evidence:w.evidence, correction:w.correction }; }),
    aiFlaws:      aiFlaws,
    correctionsApplied: applied,
    isLogicallySound: flaws.length === 0 && aiFlaws.length === 0,
    summary: flaws.length + warnings.length === 0 ? "✅ Raisonnement sain — aucune faille majeure détectée" : "⚠️ "+flaws.length+" faille(s) + "+warnings.length+" avertissement(s)",
  };

  if (!result.isLogicallySound) logger.warn("🔍 [REASONING VALIDATOR] "+result.summary);
  else logger.info("✅ [REASONING VALIDATOR] Raisonnement validé");

  return result;
}

// ─── CORRECTION AUTONOME DES PARAMÈTRES CORROMPUS ────────────────────────────
function autoCorrectParams(memory) {
  var dp = memory.dynamicParams;
  var corrections = [];

  // Corriger les valeurs hors limites
  if (dp.maxSingleOdd < 1.5)  { dp.maxSingleOdd = 1.5;  corrections.push("maxSingleOdd trop bas → 1.5"); }
  if (dp.maxSingleOdd > 8.0)  { dp.maxSingleOdd = 6.0;  corrections.push("maxSingleOdd trop haut → 6.0"); }
  if (dp.minEventsPerTicket < 5)  { dp.minEventsPerTicket = 5;  corrections.push("minEvents trop bas → 5"); }
  if (dp.minEventsPerTicket > 15) { dp.minEventsPerTicket = 8;  corrections.push("minEvents trop haut → 8"); }
  if (dp.maxEventsPerTicket < dp.minEventsPerTicket) { dp.maxEventsPerTicket = dp.minEventsPerTicket + 4; corrections.push("maxEvents < minEvents → corrigé"); }
  if (dp.maxEventsPerTicket > 12) { dp.maxEventsPerTicket = 10; corrections.push("maxEvents > 10 → 10 (range 30-400)"); }
  if (dp.minConfidenceThreshold < 0.40) { dp.minConfidenceThreshold = 0.40; corrections.push("minConf trop bas → 0.40"); }
  if (dp.minConfidenceThreshold > 0.85) { dp.minConfidenceThreshold = 0.65; corrections.push("minConf trop haut → 0.65"); }

  // Éviter que la blacklist soit trop agressive
  if ((dp.blacklistedMarkets||[]).length > 5) {
    dp.blacklistedMarkets = dp.blacklistedMarkets.slice(-3);
    corrections.push("blacklistedMarkets réduit (trop agressif)");
  }
  if ((dp.blacklistedLeagues||[]).length > 6) {
    dp.blacklistedLeagues = dp.blacklistedLeagues.slice(-4);
    corrections.push("blacklistedLeagues réduit");
  }

  // Anti-pattern: si BTTS blacklisté par accident → le retirer de la blacklist
  // mais réduire son poids via les preferredMarkets
  if ((dp.blacklistedMarkets||[]).includes("BTTS") && (dp.blacklistedMarkets||[]).length > 3) {
    dp.blacklistedMarkets = dp.blacklistedMarkets.filter(function(m){ return m !== "BTTS"; });
    corrections.push("BTTS retiré de la blacklist (trop agressif) → géré par corrélation");
  }

  if (corrections.length > 0) {
    saveMemory(memory);
    corrections.forEach(function(c){ logger.info("🔧 [AUTO-CORRECT] "+c); });
  }

  return corrections;
}

// ─── DÉTECTION DES ANTI-PATTERNS ─────────────────────────────────────────────
function detectAntiPatterns(bets) {
  var alerts = [];
  if (!bets || bets.length < 3) return alerts;

  var recent = bets.filter(function(b){ return b.status==="resolved"; }).slice(-10);

  // Détecter si BTTS représente > 50% des sélections perdantes
  var bttsLosses = 0, totalLosses = 0;
  recent.forEach(function(b) {
    if (!b.won) {
      (b.selections||[]).forEach(function(s) {
        totalLosses++;
        if (s.market === "BTTS") bttsLosses++;
      });
    }
  });
  if (totalLosses >= 5 && bttsLosses/totalLosses > 0.50) {
    alerts.push({ type:"BTTS_OVERUSE", message:"BTTS représente "+Math.round(bttsLosses/totalLosses*100)+"% des pertes → réduire le poids BTTS de 20%", severity:"high" });
  }

  // Détecter si une ligue est systématiquement perdante
  var lossLeagues = {};
  recent.filter(function(b){ return !b.won; }).forEach(function(b) {
    (b.selections||[]).forEach(function(s) {
      lossLeagues[s.league] = (lossLeagues[s.league]||0)+1;
    });
  });
  Object.keys(lossLeagues).forEach(function(lg) {
    if (lossLeagues[lg] >= 4) {
      alerts.push({ type:"LEAGUE_UNRELIABLE", message:"Ligue '"+lg+"': "+lossLeagues[lg]+" pertes récentes → envisager blacklist", severity:"medium" });
    }
  });

  return alerts;
}

function safeParseJSON(text) {
  if (!text) return null;
  var c = text.replace(/```json\n?|```\n?/g,"").trim();
  try { return JSON.parse(c); } catch {}
  var m = c.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

module.exports = {
  runSelfEvaluation,
  validateReasoningChain,
  autoCorrectParams,
  detectAntiPatterns,
  loadHealLog,
  COGNITIVE_BIASES,
};
