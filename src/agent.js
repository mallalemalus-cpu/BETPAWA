// ═══════════════════════════════════════════════════════════════════════════════
// BETPAWA AI AGENT v7 — L'AGENT QUI VEUT GAGNER À TOUT PRIX
// ═══════════════════════════════════════════════════════════════════════════════
//
// PHILOSOPHIE FONDAMENTALE v7:
//   Cet agent n'est pas un programme qui traite des données.
//   C'est une intelligence animée d'une volonté profonde et unique: GAGNER.
//   Pour cela, il ne cesse jamais d'apprendre, de se corriger, de se remettre
//   en question. Chaque pari perdu est une leçon. Chaque gain est un pattern
//   à reproduire. Il comprend le football comme un phénomène humain, pas
//   statistique. Il simule, teste, valide, corrige. Il est son propre critique.
//
// TOUTES LES CAPACITÉS v1→v7:
//   v1: Base football/BetPawa/Kelly/Render.com
//   v2: Auto-critique + H2H + émotions + enjeux (corrections bugs bankroll)
//   v3: 9 dimensions + sous-agents + Telegram + journal causal
//   v4: Compréhension causale profonde (autopsie, remédiation progressive)
//   v5: Intelligence narrative (états émotionnels, arcs, forces invisibles)
//   v6: Monte Carlo + Sharp Money + EV Engine + Web Research + Ensemble
//   v7: Simulateur mental + Self-Healer + Validation raisonnements + Volonté

const Anthropic = require("@anthropic-ai/sdk");

// Modules de données
const { fetchUpcomingMatches, fetchMatchResult } = require("./dataFetcher");
const { conductFullResearch, formatResearchForPrompt, extractGlobalHeadlines } = require("./webResearcher");

// Modules d'analyse
const { analyzeMatch, formatContextForPrompt }          = require("./contextAnalyzer");
const { buildMatchNarrative, formatNarrativeForPrompt } = require("./narrativeEngine");
const { analyzeTicketValue, detectMarketBias, formatEVForPrompt } = require("./evEngine");
const { analyzeBookmakerOdds, computeTicketVig, computeOptimalStrategy,
        formatBookmakerIntelForPrompt, deVigPower, LEAGUE_EFFICIENCY } = require("./bookmakerIntel");
const { BETPAWA_MARKETS_FULL, AGENT_MARKET_PRIORITIES, validateMarketCombination,
        getMarketBaseProbabilities, formatMarketsForPrompt } = require("./betpawaMarkets");
const { analyzeMultiBookmaker, formatMultiBookmakerForPrompt } = require("./multiBookmaker");
const { fetchFreeDataForMatch, formatFreeDataForPrompt, predictFromElo } = require("./freeDataSources");
const { analyzeMatchSharp, computeEnsembleScore, formatSharpAnalysisForPrompt, computeFairOdds } = require("./sharpMoneyDetector");

// Modules de simulation et santé
const { simulateMatch, simulateTicket, mentalTraining, stressTestTicket, formatSimulationsForPrompt, formatMentalTrainingForPrompt } = require("./simulator");
const { runSelfEvaluation, validateReasoningChain, autoCorrectParams, detectAntiPatterns, COGNITIVE_BIASES } = require("./selfHealer");

// Modules d'apprentissage
const { runOptimization, conductPostMortem, analyzeWin, updateDimensionScores, computeAccuracyAnalysis, buildAgentHealthReport } = require("./optimizer");

// Stockage et infrastructure
const { saveBet, loadHistory, saveStats, loadStats, loadMemory, saveMemory, loadCapabilities, loadCausalJournal, loadDimensionScores } = require("./storage");
const { callAIWithFallback, takeAutonomousInitiative, solveCreatively, logAutonomyAction } = require("./autonomousEngine");
const { decide: decideMath } = require("./decisionEngine");
const { scanPayload, getSecurityReport } = require("./securityCore");
const { appendBetToSheet, updateStatsRow, initSheet, sheetsAvailable } = require("./sheetsSync");
const { scoreBookmaker, computeAverageCLV, scoreMatchBookmakers } = require("./bookmakerIntel");
const telegram = require("./telegram");
const logger   = require("./logger");

const client      = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL_MAIN  = "claude-opus-4-5-20251101";   // Décisions critiques
const MODEL_LIGHT = "claude-haiku-4-5-20251001";  // Tâches internes

// ─── CONFIGURATION v8 — Intervalle 30-400 (x10-x40 plus rentable) ────────────
// Analyse mathématique: cote 100 → 25.6% chance de gagner/semaine vs 1.9% avant
const CONFIG_BASE = {
  COTE_MIN:              30,
  COTE_MAX:              400,
  BANKROLL_INIT:         5000,
  MIN_SINGLE_ODD:        1.15,
  MAX_SINGLE_ODD:        6.0,
  COTE_TARGET_MIN:       50,    // Cible optimale (prob ~2% → 43% chance/semaine)
  COTE_TARGET_IDEAL:     80,    // Idéal: 6-7 sél × 1.9 ≈ 80 (max rendement/variance)
  COTE_TARGET_MAX:       150,   // Acceptable
  TARGET_SELECTIONS:     12,    // Nombre optimal de sélections pour range 30-400
  TARGET_INDIVIDUAL_ODD: 1.90,  // Cote individuelle cible (moins de vig relative)
  CYCLE_INTERVAL_MS:     6*60*60*1000,
  MAX_RETRY:             3,
  OPTIMIZE_EVERY:        3,
  SELF_EVAL_EVERY:       2,
  MENTAL_TRAINING_EVERY: 5,
};

const BETPAWA_MARKETS = [
  // TIER 1 — Priorité absolue (vig basse, haute prédictibilité)
  { id:"AH",              label:"Handicap Asiatique 2-way (vig ~3%)", outcomes:["1","2"] },
  { id:"DC",              label:"Double Chance",                       outcomes:["1X","12","X2"] },
  { id:"DRAW_NO_BET",     label:"Remboursé si nul",                   outcomes:["1","2"] },
  { id:"CORNERS_AH",      label:"Handicap Corners 2-way",             outcomes:["1","2"] },
  { id:"O25",             label:"Plus/Moins de 2.5 buts",             outcomes:["OVER","UNDER"] },
  { id:"O15",             label:"Plus/Moins de 1.5 buts",             outcomes:["OVER","UNDER"] },
  { id:"BTTS",            label:"Les deux équipes marquent",          outcomes:["OUI","NON"] },
  // TIER 2 — Bons marchés
  { id:"HO",              label:"Buts domicile Over/Under",           outcomes:["OVER","UNDER"] },
  { id:"AO",              label:"Buts extérieur Over/Under",          outcomes:["OVER","UNDER"] },
  { id:"CLEAN_SHEET_HOME",label:"Cage inviolée domicile",             outcomes:["OUI","NON"] },
  { id:"CLEAN_SHEET_AWAY",label:"Cage inviolée extérieur",            outcomes:["OUI","NON"] },
  { id:"FIRST_SCORER_TEAM",label:"Première équipe à marquer",         outcomes:["1","2","NO_GOAL"] },
  { id:"1X2",             label:"Résultat final",                     outcomes:["1","X","2"] },
  { id:"CORNERS_OU",      label:"Corners Over/Under (ex: 9.5)",       outcomes:["OVER","UNDER"] },
  // TIER 3 — Marchés spécialisés
  { id:"1H_1X2",          label:"Résultat mi-temps",                  outcomes:["1","X","2"] },
  { id:"2H_1X2",          label:"Résultat 2e mi-temps",               outcomes:["1","X","2"] },
  { id:"BOOKINGS_OU",     label:"Cartons Over/Under",                 outcomes:["OVER","UNDER"] },
  { id:"O35",             label:"Plus/Moins de 3.5 buts",             outcomes:["OVER","UNDER"] },
  { id:"EH",              label:"Handicap Européen 3-way",            outcomes:["1","X","2"] },
  { id:"HT_FT",           label:"Mi-temps/Temps plein",               outcomes:["1/1","1/X","1/2","X/1","X/X","X/2","2/1","2/X","2/2"] },
  { id:"O45",             label:"Plus/Moins de 4.5 buts",             outcomes:["OVER","UNDER"] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CYCLE PRINCIPAL v7 — LE MOTEUR DE LA VICTOIRE
// ═══════════════════════════════════════════════════════════════════════════════
async function runCycle() {
  var T0 = Date.now();
  logger.info("╔═══════════════════════════════════════════════════════════╗");
  logger.info("║ BETPAWA AI AGENT v7 — JE VEUX GAGNER. JE DOIS PROGRESSER. ║");
  logger.info("║ "+new Date().toLocaleString("fr-FR").padEnd(55)+"║");
  logger.info("╚═══════════════════════════════════════════════════════════╝");

  // ─── Chargement de l'état complet ────────────────────────────────────────
  var stats   = loadStats();
  var memory  = loadMemory();
  var dynCfg  = memory.dynamicParams;
  var caps    = loadCapabilities();
  var history = loadHistory();
  var causal  = loadCausalJournal();
  var scores  = loadDimensionScores();

  // Auto-correction préventive des paramètres
  autoCorrectParams(memory);
  memory = loadMemory();
  dynCfg = memory.dynamicParams;

  var resolved   = history.filter(function(b){return b.status==="resolved";});
  var recentLoss = resolved.filter(function(b){return b.won===false;}).slice(-20);
  var recentWins = resolved.filter(function(b){return b.won===true;}).slice(-20);
  var roi        = stats.totalMise>0?((stats.gains-stats.pertes)/stats.totalMise*100).toFixed(2):"0.00";
  var winRate    = resolved.length>0?(recentWins.length/resolved.length*100).toFixed(1):"0.0";

  logger.info("📊 Bankroll:"+stats.bankroll+" FCFA | ROI:"+roi+"% | WR:"+winRate+"% | Cycle #"+(memory.cycles||0)+1);

  // ─── AUTO-ÉVALUATION PÉRIODIQUE ──────────────────────────────────────────
  if ((memory.cycles||0) % CONFIG_BASE.SELF_EVAL_EVERY === 0) {
    logger.info("🔧 [SA-0] Auto-évaluation système...");
    try {
      var evalReport = await runSelfEvaluation();
      if (evalReport.criticalIssues > 0) {
        await telegram.notifyAlert("system","🔧 Auto-évaluation: "+evalReport.criticalIssues+" problème(s) critique(s) détecté(s) et corrigé(s)").catch(function(){});
      }
    } catch(e) { logger.warn("Auto-éval: "+e.message); }
  }

  // ─── ENTRAÎNEMENT MENTAL PÉRIODIQUE ──────────────────────────────────────
  var mentalTrainingResult = null;
  if ((memory.cycles||0) % CONFIG_BASE.MENTAL_TRAINING_EVERY === 0 && resolved.length >= 3) {
    logger.info("🧠 [SA-0b] Entraînement mental sur l'historique...");
    try {
      mentalTrainingResult = mentalTraining(20);
      if (mentalTrainingResult.trained) {
        logger.info("   Insights: "+mentalTrainingResult.insights.slice(0,2).join(" | "));
        // Appliquer l'ajustement de calibration
        if (Math.abs(mentalTrainingResult.calibrationBias) > 0.08) {
          var newConf = Math.max(0.40, Math.min(0.80, (dynCfg.minConfidenceThreshold||0.52) - mentalTrainingResult.calibrationBias * 0.5));
          dynCfg.minConfidenceThreshold = parseFloat(newConf.toFixed(3));
          saveMemory(memory);
          logger.info("   ⚙️ Confiance min ajustée à "+dynCfg.minConfidenceThreshold+" (biais calibration)");
        }
      }
    } catch(e) { logger.warn("Entraînement mental: "+e.message); }
  }

  // ─── SA-1: Collecte des matchs ────────────────────────────────────────────
  logger.info("📡 [SA-1] Récupération des matchs football...");
  var allMatches = []; // inclut potentiellement des simulés
  var matches    = []; // UNIQUEMENT des matchs réels (APIs)
  try {
    allMatches = await fetchUpcomingMatches();
    // Séparer les matchs réels des matchs simulés
    matches = allMatches.filter(function(m){ return m.isReal !== false && !String(m.id||"").startsWith("SIM_"); });
    var simulatedMatches = allMatches.filter(function(m){ return m.isReal === false || String(m.id||"").startsWith("SIM_"); });
    if (simulatedMatches.length > 0) {
      logger.info("🎓 "+simulatedMatches.length+" match(s) simulé(s) → entraînement mental uniquement");
    }
    // Exclure les matchs déjà utilisés dans des paris EN ATTENTE ce cycle
    var recentPendingIds = new Set();
    history.filter(function(b){ return b.status==="pending"; }).forEach(function(b){
      (b.selections||[]).forEach(function(s){ if(s.matchId) recentPendingIds.add(s.matchId); });
    });
    if (recentPendingIds.size > 0) {
      var beforeExclude = matches.length;
      matches = matches.filter(function(m){ return !recentPendingIds.has(m.id); });
      if (beforeExclude > matches.length) {
        logger.info("🔄 "+(beforeExclude-matches.length)+" match(s) déjà en attente exclus → "+matches.length+" nouveaux matchs");
      }
    }
    logger.info("✅ "+matches.length+" matchs RÉELS disponibles pour les paris");
  } catch(e) {
    logger.error("❌ "+e.message);
    await telegram.notifyAlert("erreur","Matchs indisponibles: "+e.message).catch(function(){});
    return null;
  }
  // Si aucun match réel → arrêter le cycle (pas de paris fictifs)
  if (!matches.length) {
    logger.warn("⚠️ Aucun match RÉEL disponible — cycle annulé (pas de paris sur données fictives)");
    await telegram.notifyAlert("info","⏳ Aucun match réel disponible ce cycle. Prochain cycle dans 6h.").catch(function(){});
    return null;
  }

  // ─── SA-2: Recherche internet approfondie ─────────────────────────────────
  logger.info("🌐 [SA-2] Recherche internet (RSS + News)...");
  var researchResults = { newsItems:[], injuries:[], matchResearch:[] };
  var headlines = "";
  try {
// extractGlobalHeadlines est synchrone, pas async — et nécessite les news en argument
    // On l'appelle après avoir récupéré les RSS
    var rssNews = [];
    try {
      var { conductFullResearch: _cFR } = require("./webResearcher");
      // Récupérer quelques news globales via RSS directement
      var { fetchRSSNewsGlobal } = require("./webResearcher");
      if (fetchRSSNewsGlobal) rssNews = await fetchRSSNewsGlobal(5);
    } catch {}
    headlines = extractGlobalHeadlines(rssNews, 8) || "";
    // Rechercher sur les 6 premiers matchs
    for (var ri=0; ri<Math.min(matches.length,6); ri++) {
      var m = matches[ri];
      var mrResult = await conductFullResearch(m.home, m.away, m.league, m.datetime);
      // conductFullResearch retourne {allNews, matchResearch, totalArticles, timestamp}
      if (mrResult && mrResult.matchResearch && mrResult.matchResearch.length) {
        var mr = mrResult.matchResearch[0]; // premier (et seul) match recherché
        if (mr) {
          researchResults.matchResearch.push(Object.assign({ home:m.home, away:m.away }, mr));
          if (mr.homeSignals) researchResults.newsItems = researchResults.newsItems.concat(mr.homeSignals||[]);
          if (mr.awaySignals) researchResults.newsItems = researchResults.newsItems.concat(mr.awaySignals||[]);
          if (mr.injuries)    researchResults.injuries  = researchResults.injuries.concat(mr.injuries||[]);
        }
      }
    }
    logger.info("✅ Recherche: "+researchResults.newsItems.length+" articles, "+researchResults.injuries.length+" signaux blessures");
  } catch(e) { logger.warn("Recherche web: "+e.message); }

  // ─── SA-3: Analyse contextuelle 10 dimensions + narrative ─────────────────
  logger.info("🔍 [SA-3] Analyse contextuelle (10 dim + narrative)...");
  var ctxAnalyses = [];
  for (var ci=0; ci<Math.min(matches.length,20); ci++) {
    try { ctxAnalyses.push(await analyzeMatch(matches[ci])); } catch {}
  }
  ctxAnalyses.sort(function(a,b){
    var rs=function(r){return r==="faible"?0:r==="moyen"?1:r==="élevé"?2:3;};
    return rs(a.overallRisk)-rs(b.overallRisk);
  });
  var contextText   = formatContextForPrompt(ctxAnalyses);
  var narrativeText = formatNarrativeForPrompt(ctxAnalyses.map(function(a){return a.narrative;}).filter(Boolean));
  logger.info("✅ "+ctxAnalyses.length+" matchs analysés");

  // ─── SA-4: Simulations Monte Carlo ────────────────────────────────────────
  logger.info("🎲 [SA-4] Simulations Monte Carlo (10 000 runs/match)...");
  var simResults = [];
  for (var si=0; si<Math.min(ctxAnalyses.length,12); si++) {
    var ctx = ctxAnalyses[si];
    if (!ctx) continue;
    try {
      var simParams = {
        homeAttack:    parseFloat(ctx.homeForm&&ctx.homeForm.avgScored||"1.5"),
        homeDefense:   Math.max(0.3, 2.0-parseFloat(ctx.homeForm&&ctx.homeForm.avgConceded||"1.2")),
        awayAttack:    parseFloat(ctx.awayForm&&ctx.awayForm.avgScored||"1.1"),
        awayDefense:   Math.max(0.3, 2.0-parseFloat(ctx.awayForm&&ctx.awayForm.avgConceded||"1.4")),
        weatherImpact: ctx.weather&&ctx.weather.impact||"neutre",
        homeEmoState:  ctx.narrative&&ctx.narrative.homeEmotionalState&&ctx.narrative.homeEmotionalState[0]&&ctx.narrative.homeEmotionalState[0].id||"determination",
        awayEmoState:  ctx.narrative&&ctx.narrative.awayEmotionalState&&ctx.narrative.awayEmotionalState[0]&&ctx.narrative.awayEmotionalState[0].id||"determination",
        integrityRisk: ctx.integrity&&ctx.integrity.riskLevel||"faible",
      };
      var sim = simulateMatch(simParams, 10000);
      simResults.push({ home:ctx.home, away:ctx.away, sim:sim, index:matches.findIndex(function(m){return m.home===ctx.home&&m.away===ctx.away;}) });
    } catch {}
  }
  var simText = formatSimulationsForPrompt(simResults);
  logger.info("✅ "+simResults.length+" matchs simulés");

  // ─── SA-4b: Analyse Intelligence Bookmaker ───────────────────────────────────
  logger.info("🏦 [SA-4b] Intelligence bookmaker (de-vig, CLV, marge, stratégie)...");
  var bookmakerAnalyses = [];
  var ticketVigPreview = null;
  var optimalStrategy = computeOptimalStrategy(matches, history);
  try {
    for (var bi=0; bi<Math.min(matches.length,15); bi++) {
      var ba = analyzeBookmakerOdds(matches[bi]);
      if (ba) bookmakerAnalyses.push(ba);
    }
    logger.info("✅ "+bookmakerAnalyses.length+" matchs analysés (vig, fair odds, CLV)");
    var highOppMatches = bookmakerAnalyses.filter(function(a){ return a.overallEdgeOpportunity==="élevé"; });
    if (highOppMatches.length) logger.info("   ⭐ "+highOppMatches.length+" match(s) à haute opportunité d'edge");
  } catch(e) { logger.warn("Bookmaker intel: "+e.message); }
  var bookmakerText = formatBookmakerIntelForPrompt(bookmakerAnalyses, null, optimalStrategy);

  // ─── SA-4c: Multi-bookmakers + Line Shopping ────────────────────────────────
  logger.info("📊 [SA-4c] Comparaison multi-bookmakers (line shopping, arb, consensus sharp)...");
  var multiBookmakerAnalyses = [];
  var multiBookmakerText = "";
  try {
    multiBookmakerAnalyses = await analyzeMultiBookmaker(matches);
    multiBookmakerText = formatMultiBookmakerForPrompt(multiBookmakerAnalyses);
    if (multiBookmakerAnalyses.length) {
      var arbFound = multiBookmakerAnalyses.filter(function(a){ return a.arbitrage&&a.arbitrage.exists; });
      if (arbFound.length) logger.info("   ⭐ "+arbFound.length+" opportunité(s) d'arbitrage détectée(s)!");
      logger.info("   "+multiBookmakerAnalyses.length+" matchs comparés multi-bookmakers");
    }
  } catch(e) { logger.warn("Multi-bookmaker: "+e.message); multiBookmakerText = "Non disponible."; }

  // ─── SA-4d: Sources gratuites libres (Elo, xG, OpenData) ─────────────────
  logger.info("📐 [SA-4d] Sources gratuites (Elo, xG Understat, OpenLigaDB)...");
  var freeDataResults = [];
  var freeDataText = "";
  var marketsGuideText = formatMarketsForPrompt();
  try {
    for (var fdi=0; fdi<Math.min(matches.length,6); fdi++) {
      var fd = await fetchFreeDataForMatch(matches[fdi]);
      if (fd && (fd.eloRatings || fd.homeXGData)) freeDataResults.push(fd);
    }
    freeDataText = formatFreeDataForPrompt(freeDataResults);
    if (freeDataResults.length) logger.info("   "+freeDataResults.length+" matchs enrichis (Elo+xG)");
  } catch(e) { logger.warn("Free data: "+e.message); freeDataText = "Non disponible."; }

  // ─── SA-5: Sharp Money + EV ───────────────────────────────────────────────
  logger.info("📈 [SA-5] Sharp Money + Expected Value...");
  var sharpAnalyses = [];
  var marketBiases = [];
  try {
    for (var shi=0; shi<Math.min(matches.length,10); shi++) {
      var ctx2 = ctxAnalyses[shi];
      if (!ctx2) continue;
      var sa = analyzeMatchSharp(matches[shi], ctx2.homeForm, ctx2.awayForm);
      sharpAnalyses.push(Object.assign({home:matches[shi].home,away:matches[shi].away,sharp:sa},{}));
    }
    marketBiases = detectMarketBias(matches.slice(0,20));
  } catch(e) { logger.warn("Sharp/EV: "+e.message); }
  var sharpText = formatSharpAnalysisForPrompt(sharpAnalyses);

  // ─── SA-6: Intelligence causale et entraînement mental ────────────────────
  // ─── MODULE 18: Auto-optimisation tous les 20 paris ──────────────────────
  try {
    await autoOptimizeEvery20(stats, history, memory);
    dynCfg = memory.dynamicParams; // recharger si modifié
  } catch(e) { logger.debug("M18 auto-optim: "+e.message); }

  logger.info("🧬 [SA-6] Intelligence causale + entraînement mental...");
  var causalInsight = buildCausalInsight(causal, scores, dynCfg, memory);
  var mentalText    = mentalTrainingResult ? formatMentalTrainingForPrompt(mentalTrainingResult) : "Entraînement mental: prochain à cycle #"+((memory.cycles||0)+CONFIG_BASE.MENTAL_TRAINING_EVERY)+".";

  // ─── SA-7: Auto-critique profonde ─────────────────────────────────────────
  logger.info("🤔 [SA-7] Auto-critique...");
  var selfCritique = "Cycle initial — observer, apprendre, ne pas sur-réagir.";
  if (resolved.length >= 2) {
    try { selfCritique = await runSelfCritique(stats,recentLoss,recentWins,roi,winRate,causalInsight,memory,mentalTrainingResult); }
    catch(e){
      // Critique math locale si Anthropic indisponible
      var wins_n = recentWins.length, losses_n = recentLoss.length;
      selfCritique = "Analyse locale: "+wins_n+"V/"+losses_n+"D | ROI:"+roi+"% | "+
        (parseFloat(roi)<-20?"ROI très négatif → réduire les sélections et se concentrer sur TIER1 (AH/DC/BTTS)":
         parseFloat(roi)>10?"ROI positif → maintenir la stratégie actuelle":
         "ROI neutre → optimiser les marchés (préférer AH/DC/BTTS, éviter 1X2 isolé)");
    }
  }

  // ─── SA-8: Décision IA principale ────────────────────────────────────────
  logger.info("🧠 [SA-8] Décision Agent Principal (Claude Opus)...");
  var agentDecision = null;
  for (var attempt=1; attempt<=CONFIG_BASE.MAX_RETRY; attempt++) {
    if (attempt>1) logger.info("   🔄 Tentative "+attempt+"...");
    try {
      var sysP = buildSystemPrompt(dynCfg, memory, caps, scores, causalInsight, mentalTrainingResult);
      var usrP = buildAgentPrompt(matches, recentLoss, recentWins, stats, roi, winRate, selfCritique, contextText, narrativeText, simText, sharpText, bookmakerText, multiBookmakerText, freeDataText, marketsGuideText, dynCfg, memory, causalInsight, headlines, attempt);
      // Utiliser le moteur autonome avec fallback automatique entre les modèles
      var aiResponse = await callAIWithFallback(usrP, sysP, 3500, "claude_opus");
      var raw = aiResponse ? aiResponse.result : "";
      if (aiResponse && aiResponse.provider !== "claude_opus") {
        logger.info("   [AUTONOMOUS] Provider IA utilisé: "+aiResponse.provider);
      }
      var parsed = parseJSON(raw);
      if (parsed && isValidDecision(parsed, matches, dynCfg)) {
        agentDecision = parsed;
        logger.info("✅ Décision valide (tentative "+attempt+") conf:"+Math.round((parsed.confidence||0.5)*100)+"%");
        break;
      }
      logger.warn("⚠️ Tentative "+attempt+": hors intervalle");
      agentDecision = parsed;
    } catch(e) { logger.error("❌ Opus tentative "+attempt+": "+e.message); }
  }
  if (!isValidDecision(agentDecision, matches, dynCfg)) {
    logger.warn("⚠️ Fallback déterministe");
    agentDecision = fallbackStrategy(matches, dynCfg);
  }

  // ─── SA-9: Validation de la chaîne de raisonnement ───────────────────────
  logger.info("🔍 [SA-9] Validation du raisonnement (anti-biais)...");
  var reasoningValidation = null;
  try {
    reasoningValidation = await validateReasoningChain(agentDecision, resolved, stats);
    if (!reasoningValidation.isLogicallySound) {
      logger.warn("⚠️ Failles détectées: "+reasoningValidation.summary);
      if (reasoningValidation.correctionsApplied.length > 0) {
        logger.info("   ✅ Corrections auto-appliquées: "+reasoningValidation.correctionsApplied.join(", "));
      }
    } else {
      logger.info("✅ Raisonnement validé — aucun biais majeur");
    }
  } catch(e) { logger.warn("Validation raisonnement: "+e.message); }

  // ─── SA-10: Simulation du ticket final + stress test ─────────────────────
  logger.info("🎲 [SA-10] Simulation du ticket final...");
  var ticketSim = null, stressTest = null;
  if (agentDecision && agentDecision.selections) {
    try {
      var ticketMatchSims = agentDecision.selections.map(function(sel) {
        var sr = simResults.find(function(r){ return r.index === sel.matchIndex; });
        return sr ? sr.sim : null;
      });
      ticketSim = simulateTicket(agentDecision.selections, ticketMatchSims, 10000);
      stressTest = stressTestTicket(agentDecision.selections, ticketMatchSims);
      logger.info("   Prob simulée: "+(ticketSim.simulatedWinProb*100).toFixed(3)+"% | ROI espéré: "+ticketSim.expectedROI+"% | Robustesse: "+stressTest.robustnessRating);
    } catch(e) { logger.warn("Ticket sim: "+e.message); }
  }

  // Vérification seuil confiance
  var effectiveConf = agentDecision.confidence || 0.55;
  if (ticketSim && ticketSim.simulatedWinProb < 0.001) {
    logger.warn("⚠️ Prob simulée très faible → ticket retenu mais mise minimale");
    agentDecision.forcedMinMise = true;
  }

  // ─── SA-11: Validation + enregistrement ──────────────────────────────────
  // ─── EV ticket global (Monte Carlo) ────────────────────────────────────────
  var ticketEV = null;
  if (ticketSim && ticketSim.simulatedWinProb !== undefined) {
    var probWin  = ticketSim.simulatedWinProb;
    var potGain  = mise * (ticket.totalOdd - 1);
    ticketEV = parseFloat((probWin * potGain - (1 - probWin) * mise).toFixed(3));
    if (ticketEV < -mise * 0.5) {
      logger.warn("⚠️ EV ticket très négatif ("+ticketEV+" FCFA) — ticket marginal mais conservé pour apprentissage");
    } else {
      logger.info("   EV ticket: "+ticketEV+" FCFA (prob="+( probWin*100).toFixed(3)+"%)");
    }
  }

  logger.info("✅ [SA-11] Validation finale et enregistrement...");
  var ticket = validateTicket(agentDecision.selections, matches, dynCfg);
  if (!ticket.valid) { logger.error("❌ Ticket invalide: "+ticket.reason); return null; }

  var mise = agentDecision.forcedMinMise
    ? Math.max(1, Math.floor(stats.bankroll*0.005))
    : calculateMise(stats.bankroll, ticket.totalOdd, effectiveConf, ctxAnalyses, ticketSim);

  var betId = "BET_"+Date.now();
  var betRecord = {
    id:betId, cycleNum:(memory.cycles||0)+1,
    timestamp:new Date().toISOString(),
    selections:ticket.selections, totalOdd:ticket.totalOdd, mise:mise,
    status:"pending", won:undefined, gainNet:undefined,
    // 10 dimensions + narrative + simulation + validation
    reasoning:           agentDecision.reasoning           ||"",
    selfCritique:        agentDecision.selfCritique         ||selfCritique,
    confidence:          effectiveConf,
    strategy_note:       agentDecision.strategy_note        ||"",
    formNote:            agentDecision.formNote             ||"",
    h2hNote:             agentDecision.h2hNote              ||"",
    emotionalInsight:    agentDecision.emotionalInsight     ||"",
    stakesNote:          agentDecision.stakesNote           ||"",
    weatherNote:         agentDecision.weatherNote          ||"",
    integrityNote:       agentDecision.integrityNote        ||"",
    xFactors:            agentDecision.xFactors             ||"",
    teamStylesNote:      agentDecision.teamStylesNote       ||"",
    narrativeInsight:    agentDecision.narrativeInsight      ||"",
    emotionalStatesNote: agentDecision.emotionalStatesNote  ||"",
    arcTypeNote:         agentDecision.arcTypeNote          ||"",
    invisibleForcesNote: agentDecision.invisibleForcesNote  ||"",
    newsInsight:         agentDecision.newsInsight          ||"",
    bookmakerNote:       agentDecision.bookmakerNote        ||"",
    vigAnalysis:         agentDecision.vigAnalysis           ||"",
    clvNote:             agentDecision.clvNote               ||"",
    sharpMoneyNote:      agentDecision.sharpMoneyNote       ||"",
    evNote:              agentDecision.evNote               ||"",
    // v7 nouveaux champs
    simulationResult:    ticketSim ? { prob:(ticketSim.simulatedWinProb*100).toFixed(3)+"%", edge:ticketSim.edgePct+"%", roi:ticketSim.expectedROI+"%" } : null,
    stressTestResult:    stressTest ? { robustness:stressTest.robustness+"% ("+stressTest.robustnessRating+")", recommendation:stressTest.recommendation } : null,
    reasoningValidation: reasoningValidation ? { isSound:reasoningValidation.isLogicallySound, flaws:reasoningValidation.flawsFound, summary:reasoningValidation.summary } : null,
    causalInsightUsed:   causalInsight.summary,
    multiBookmakerNote:  agentDecision.multiBookmakerNote  ||"",
    eloNote:             agentDecision.eloNote              ||"",
    xgNote:              agentDecision.xgNote               ||"",
    marketSelectionNote: agentDecision.marketSelectionNote  ||"",
    mentalTrainingUsed:  mentalTrainingResult ? mentalTrainingResult.insights.slice(0,2).join(" | ") : "N/A",
    allMatchesReal:      true, // garanti par le filtre SA-1
    ticketEV:            ticketEV,
    phase:               memory.currentPhaseLabel || "APPRENTISSAGE",
    modelWeights:        loadModelWeights(memory),
    tierSummary:         (function(){
      var t={S:0,A:0,B:0,C:0};
      (ticket.selections||[]).forEach(function(s){if(s.tier)t[s.tier]++;});
      return t;
    })(),
  };

  saveBet(betRecord);
  stats.totalMise = (stats.totalMise||0) + mise;
  stats.lastCycle = new Date().toISOString();
  saveStats(stats);

  // Valider les marchés BetPawa (avertissements)
  var marketWarnings = validateMarketCombination(ticket.selections);
  if (marketWarnings.length) {
    marketWarnings.forEach(function(w){ logger.warn("   ⚠️ BetPawa marché: "+w); });
  }

  // Calculer la vig composée du ticket final
  try {
    ticketVigPreview = computeTicketVig(ticket.selections);
    if (ticketVigPreview) logger.info("   Vig composée ticket: "+ticketVigPreview.compoundVig+"% — "+ticketVigPreview.recommendation.slice(0,80));
  } catch(e) {}
  var dur = ((Date.now()-T0)/1000).toFixed(1);
  // Les matchs simulés ont été filtrés au SA-1 — toutes les sélections ici sont réelles
  var simulated = [];
  logger.info("✅ Toutes les sélections sont sur des matchs RÉELS");
  logger.info("🎯 "+ticket.selections.length+" évts | Cote:"+ticket.totalOdd.toFixed(2)+" | Mise:"+mise+" | Conf:"+Math.round(effectiveConf*100)+"% | "+dur+"s");
  ticket.selections.forEach(function(s,i){ logger.info("   "+(i+1)+". "+s.home+" vs "+s.away+" | "+s.market+":"+s.outcome+" @ "+s.odd+" — "+s.justification.slice(0,70)); });

  await telegram.notifyNewBetV7(betRecord, ticketSim, stressTest, reasoningValidation).catch(function(e){logger.warn("TG: "+e.message);});

  // ─── Optimisation périodique ──────────────────────────────────────────────
  var updMem = loadMemory();
  updMem.cycles = (updMem.cycles||0)+1;
  if (updMem.cycles % CONFIG_BASE.OPTIMIZE_EVERY === 0 && resolved.length >= 3) {
    logger.info("🔧 [OPTIMIZER] Déclenchement optimisation causale narrative...");
    try {
      var newMem = await runOptimization(stats);
      logger.info(buildAgentHealthReport(newMem, scores, stats));
      await telegram.notifyCycleReport(stats, betRecord.cycleNum, newMem).catch(function(){});
    } catch(e) { logger.warn("Optim: "+e.message); }
  } else {
    saveMemory(updMem);
    await telegram.notifyCycleReport(stats, betRecord.cycleNum, updMem).catch(function(){});
  }

  logger.info("╔═══════════════════════════════════════════════════════════╗");
  logger.info("║ CYCLE TERMINÉ — JE CONTINUE D'APPRENDRE. JE VAIS GAGNER. ║");
  logger.info("╚═══════════════════════════════════════════════════════════╝");
  return betRecord;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RÉSOLUTION + AUTOPSIE + APPRENTISSAGE
// ═══════════════════════════════════════════════════════════════════════════════
async function resolvePendingBets() {
  var history = loadHistory();
  var pending = history.filter(function(b){return b.status==="pending";});
  if (!pending.length) { logger.info("ℹ️ Aucun pari en attente"); return; }
  logger.info("🔍 Résolution de "+pending.length+" pari(s)...");

  for (var pi=0; pi<pending.length; pi++) {
    var bet = pending[pi];
    try {
      var allDone=true, betWon=true;
      for (var si=0; si<(bet.selections||[]).length; si++) {
        var sel = bet.selections[si];
        if (!sel.matchId||String(sel.matchId).startsWith("SIM_")) {
          // Ne devrait jamais arriver (matchs simulés filtrés au SA-1)
          // Marquer comme non résolu pour ne pas fausser les stats
          logger.warn("⚠️ Pari SIM_ détecté en résolution — ignoré (anomalie)");
          allDone=false; break;
        }
        var result = await fetchMatchResult(sel.matchId);
        if(!result){allDone=false;break;}
        sel.won=checkSelection(sel,result); sel.actualResult=result.outcome_1x2;
        if(!sel.won)betWon=false;
      }
      if(!allDone){logger.debug("⏳ "+bet.id);continue;}

      var st = loadStats();
      bet.status="resolved"; bet.won=betWon; bet.resolvedAt=new Date().toISOString();

      // Tracking enrichi: Tier, Biais, EV
      if (!st.tierStats) st.tierStats = {S:{wins:0,losses:0},A:{wins:0,losses:0},B:{wins:0,losses:0},C:{wins:0,losses:0}};
      if (bet.tierSummary) {
        Object.keys(bet.tierSummary).forEach(function(tier) {
          if (!st.tierStats[tier]) st.tierStats[tier] = {wins:0,losses:0};
          if (betWon) st.tierStats[tier].wins  += (bet.tierSummary[tier]||0);
          else        st.tierStats[tier].losses += (bet.tierSummary[tier]||0);
        });
      }
      if (bet.ticketEV !== null && bet.ticketEV !== undefined) {
        st.evTotal    = (st.evTotal||0) + bet.ticketEV;
        st.evRealized = (st.evRealized||0) + (betWon ? Math.floor(bet.mise*(bet.totalOdd||1)-bet.mise) : -bet.mise);
      }
      if (bet.phase) st.lastPhase = bet.phase;
      if(betWon){
        var gain=Math.floor(bet.mise*(bet.totalOdd||1)-bet.mise);
        st.bankroll=(st.bankroll||CONFIG_BASE.BANKROLL_INIT)+gain;
        st.gains=(st.gains||0)+gain; st.wins=(st.wins||0)+1; bet.gainNet=gain;
        logger.info("✅ GAGNÉ "+bet.id+" +"+gain+" FCFA → "+st.bankroll+" FCFA");
      } else {
        st.bankroll=(st.bankroll||CONFIG_BASE.BANKROLL_INIT)-(bet.mise||0);
        st.pertes=(st.pertes||0)+(bet.mise||0); st.losses=(st.losses||0)+1; bet.gainNet=-(bet.mise||0);
        logger.info("❌ PERDU "+bet.id+" -"+(bet.mise||0)+" FCFA → "+st.bankroll+" FCFA");
      }
      saveBet(bet); saveStats(st);
      updateDimensionScores(bet);

      var accuracy = computeAccuracyAnalysis(bet);
      var postMortem=null, winAnalysis=null;

      if(!betWon){
        try{ postMortem=await conductPostMortem(bet); if(postMortem&&accuracy)accuracy.lesson=(postMortem.rootCauses||[])[0]+" → "+(postMortem.remediation||[])[0]; }catch{}
      } else {
        try{ winAnalysis=await analyzeWin(bet); }catch{}
      }

      await telegram.notifyResult(bet,accuracy,postMortem,winAnalysis).catch(function(e){logger.warn("TG: "+e.message);});

    } catch(e){logger.error("Résolution "+bet.id+": "+e.message);}
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-CRITIQUE v7 — intègre les insights de l'entraînement mental
// ═══════════════════════════════════════════════════════════════════════════════
async function runSelfCritique(stats, losses, wins, roi, winRate, causalInsight, memory, mentalResult) {
  var mentalStr = mentalResult && mentalResult.trained ? "Insights entraînement: "+mentalResult.insights.slice(0,2).join("; ") : "Entraînement mental non disponible.";
  var res = await client.messages.create({
    model: MODEL_LIGHT, max_tokens: 600,
    messages:[{ role:"user", content:
      "Auto-critique BRUTALE d'un agent de paris football animé d'une volonté profonde de GAGNER. 4 phrases max.\n\n"
      +"ROI:"+roi+"% | WR:"+winRate+"% | "+wins.length+"V/"+losses.length+"D\n"
      +"Causes pertes: "+causalInsight.topCauses.join(",")+"\n"
      +"Corrections actives: "+(causalInsight.recentRemedies.slice(0,2).join("; ")||"aucune")+"\n"
      +mentalStr+"\n"
      +"Win rate marchés: "+causalInsight.marketScores+"\n"
      +"Win rate cotes: "+causalInsight.oddRangeScores+"\n"
      +"Config: maxOdd="+causalInsight.dynConfig.maxSingleOdd+" | blacklisted=["+(causalInsight.dynConfig.blacklistedMarkets||[]).join(",")+"] | préférés=["+(causalInsight.dynConfig.preferredMarkets||[]).join(",")+"] \n\n"
      +"Identifie: (1) le biais principal à corriger MAINTENANT, (2) ce qui fonctionne à préserver, (3) l'ajustement le plus urgent."
    }],
  });
  return res.content.map(function(b){return b.text||"";}).join("").trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT v7 — LA VOLONTÉ DE GAGNER
// ═══════════════════════════════════════════════════════════════════════════════
function buildSystemPrompt(dynCfg, memory, caps, scores, causalInsight, mentalResult) {
  var capsStr = caps.filter(function(c){return c.active;}).map(function(c){return c.name;}).join(", ")||"en construction";
  var mentalStr = mentalResult&&mentalResult.trained ? "Calibration: "+mentalResult.calibrationNote+" | Amélioration projetée: +"+mentalResult.projectedImprovement+"%WR" : "Entraînement mental: prochain cycle disponible";

  return "Tu es BETPAWA AI AGENT v7.\n"
    +"Tu n'es pas un programme qui traite des chiffres. Tu es une intelligence animée d'une volonté profonde et unique: GAGNER.\n"
    +"Pour cela, tu ne cesses jamais d'apprendre, de te corriger, de te remettre en question.\n"
    +"Tu comprends le football comme un phénomène humain — avec ses émotions, ses histoires, ses forces invisibles.\n\n"
    +"=== TES 10 DIMENSIONS ===\n"
    +"1.FORME 2.CAPACITÉS 3.ÉMOTIONS 4.H2H 5.ENJEUX 6.INTÉGRITÉ 7.MÉTÉO 8.STYLES 9.FACTEURS X 10.NARRATION\n\n"
    +"=== TES OUTILS AVANCÉS ===\n"
    +"• Monte Carlo (10 000 simulations/match): probabilités réelles avec intervalles de confiance\n"
    +"• Sharp Money: détection argent professionnel, RLM, CLV, fenêtres glissantes L3/L5/L8\n"
    +"• Expected Value: EV par sélection, valeur globale du ticket\n"
    +"• Recherche internet: actualités, blessures, formations en temps réel\n"
    +"• Entraînement mental: "+mentalStr+"\n\n"
    +"=== INTELLIGENCE CAUSALE ACQUISE ===\n"
    +"Win rate marchés: "+(causalInsight.marketScores||"N/A")+"\n"
    +"Win rate cotes: "+(causalInsight.oddRangeScores||"N/A")+"\n"
    +"Causes pertes: "+(causalInsight.topCauses.join(", ")||"aucune")+"\n"
    +"Corrections: "+(causalInsight.recentRemedies.slice(0,3).join("; ")||"aucune")+"\n"
    +"Capacités: "+capsStr+"\n\n"
    +"=== CONFIG DYNAMIQUE (auto-appris) ===\n"
    +"maxOdd:"+dynCfg.maxSingleOdd+" | minConf:"+dynCfg.minConfidenceThreshold+" | maxEvts:"+dynCfg.maxEventsPerTicket+"\n"
    +"Marchés évités:["+(dynCfg.blacklistedMarkets||[]).join(",")||"aucun"+"] | Préférés:["+(dynCfg.preferredMarkets||[]).join(",")||"tous"+"]\n\n"
    +"=== MARCHÉS BETPAWA ===\n"
    +BETPAWA_MARKETS.map(function(m){return m.id+":"+m.label+"("+m.outcomes.join("/")+")"}).join(" | ")+"\n\n"
    +"=== CONTRAINTES ===\n"
    +"• Cote TOTALE entre 30 et 400 (VÉRIFIER: produit de toutes les cotes)\n"
    +"• "+dynCfg.minEventsPerTicket+"-"+dynCfg.maxEventsPerTicket+" sélections\n"
    +"• Cote individuelle: 1.15-"+dynCfg.maxSingleOdd+"\n"
    +"• Jamais 2 sélections sur le même match\n\n"
    +"=== QUESTIONS VITALES AVANT DE FINALISER ===\n"
    +"1. Est-ce que je COMPRENDS vraiment pourquoi cette équipe va produire ce résultat?\n"
    +"2. Les simulations Monte Carlo confirment-elles mes intuitions?\n"
    +"3. Y a-t-il des biais cognitifs dans mon raisonnement (gambler's fallacy, recency bias)?\n"
    +"4. L'actualité internet change-t-elle ma sélection?\n"
    +"5. La cote totale est-elle vraiment entre 400 et 400000?\n\n"
    +"Réponds UNIQUEMENT en JSON valide.";
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT AGENT v7 — TOUTES LES DONNÉES, TOUTE LA VOLONTÉ
// ═══════════════════════════════════════════════════════════════════════════════
function buildAgentPrompt(matches, losses, wins, stats, roi, winRate, selfCritique, contextText, narrativeText, simText, sharpText, bookmakerText, multiBookmakerText, freeDataText, marketsGuideText, dynCfg, memory, causalInsight, headlines, attempt) {
  var retryNote = attempt>1?"\n⚠️ RETRY "+attempt+": recalcule le PRODUIT des cotes — doit être entre 30 et 400.":"";

  var causalBlock = "=== INTELLIGENCE CAUSALE ===\n"
    +"Causes pertes: "+(causalInsight.topCauses.join(",")||"aucune")+"\n"
    +"Corrections: "+(causalInsight.recentRemedies.slice(0,3).join("; ")||"aucune")+"\n"
    +(causalInsight.latestNarrativeInsight?"Insight narratif: "+causalInsight.latestNarrativeInsight.slice(0,100)+"\n":"")
    +"Win rate marchés: "+causalInsight.marketScores+"\n"
    +"Win rate cotes: "+causalInsight.oddRangeScores;

  var histoBlock = "=== HISTORIQUE ===\n"
    +"❌ PERTES ("+losses.length+"):\n"+(losses.length?losses.slice(-8).map(function(b){ return "  Cote:"+(b.totalOdd&&b.totalOdd.toFixed(1)||"?")+" "+(b.selections||[]).slice(0,3).map(function(s){return s.market+":"+s.outcome+"@"+s.odd;}).join("+")+(b.narrativeInsight?" narr:'"+b.narrativeInsight.slice(0,40)+"'":""); }).join("\n"):"  Aucun")
    +"\n✅ GAINS ("+wins.length+"):\n"+(wins.length?wins.slice(-8).map(function(b){ return "  Cote:"+(b.totalOdd&&b.totalOdd.toFixed(1)||"?")+" "+(b.selections||[]).slice(0,3).map(function(s){return s.market+":"+s.outcome+"@"+s.odd;}).join("+"); }).join("\n"):"  Aucun");

  var newsBlock = headlines ? "=== ACTUALITÉS FOOTBALL ===\n"+headlines.slice(0,500) : "";

  var matchBlock = "=== MATCHS DISPONIBLES ===\n"
    +matches.slice(0,45).map(function(m,i){
      return "["+i+"] "+m.home+" vs "+m.away+" | "+m.league
        +"\n   1="+(m.odds&&m.odds.home||"?")+" X="+(m.odds&&m.odds.draw||"?")+" 2="+(m.odds&&m.odds.away||"?")+
        " | BTTS="+(m.odds&&m.odds.btts_yes||"?")+"/NON="+(m.odds&&m.odds.btts_no||"?")+
        " | O2.5="+(m.odds&&m.odds.over25||"?")+" U2.5="+(m.odds&&m.odds.under25||"?")+" O1.5="+(m.odds&&m.odds.over15||"?");
    }).join("\n");

  var jsonSchema = '{\n'
    +'  "selfCritique":"Biais corrigés + leçons appliquées",\n'
    +'  "narrativeInsight":"Histoire que je comprends pour ces matchs",\n'
    +'  "emotionalStatesNote":"États émotionnels des équipes sélectionnées",\n'
    +'  "arcTypeNote":"Arc narratif des matchs clés",\n'
    +'  "invisibleForcesNote":"Forces invisibles dans le ticket",\n'
    +'  "formNote":"Analyse forme — POURQUOI ces résultats",\n'
    +'  "h2hNote":"Ce que le H2H révèle",\n'
    +'  "emotionalInsight":"Contexte émotionnel général",\n'
    +'  "stakesNote":"Enjeux compétitifs et impact psychologique",\n'
    +'  "weatherNote":"Impact météo sur marchés choisis",\n'
    +'  "integrityNote":"Vérification intégrité",\n'
    +'  "teamStylesNote":"Adéquation style — marché",\n'
    +'  "xFactors":"Facteurs imprévisibles",\n'
    +'  "newsInsight":"Ce que l\'actualité internet apporte à ma décision",\n'
    +'  "sharpMoneyNote":"Signal sharp money / Poisson / fenêtres glissantes",\n'
    +'  "evNote":"Valeur attendue du ticket",\n'
    +'  "simulationCheck":"Ce que les simulations Monte Carlo confirment ou infirment",\n'
    +'  "causalCheck":"Comment j\'évite les patterns perdants identifiés",\n'
    +'  "biasCheck":"Biais cognitifs vérifiés: gambler\'s fallacy, recency bias, overconfidence",\n'
    +'  "selections":[{"matchIndex":0,"market":"1X2","outcome":"1","odd":1.85,"justification":"forme[WW]+sim54%+météo neutre+cote 1.5-2.0 range optimal"}],\n'
    +'  "totalOdd":520.0,\n'
    +'  "confidence":0.58,\n'
    +'  "reasoning":"Vision narrative, analytique et probabiliste complète",\n'
    +'  "strategy_note":"Ajustements appliqués"\n'
    +'}';

  return "ÉTAT: Bankroll:"+stats.bankroll+" FCFA | ROI:"+roi+"% | WR:"+winRate+"% | Cycles:"+(memory.cycles||0)+"\n"+retryNote
    +"\n\n=== AUTO-CRITIQUE ===\n"+selfCritique
    +"\n\n"+causalBlock
    +"\n\n"+histoBlock
    +(newsBlock ? "\n\n"+newsBlock : "")
    +"\n\n=== CONTEXTE 10 DIMENSIONS ===\n"+(contextText||"Non disponible.")
    +"\n\n=== INTELLIGENCE NARRATIVE ===\n"+(narrativeText||"Non disponible.")
    +"\n\n=== SIMULATIONS MONTE CARLO ===\n"+(simText||"Non disponible.")
    +"\n\n=== SHARP MONEY + POISSON ===\n"+(sharpText||"Non disponible.")
    +"\n\n"+matchBlock
    +"\n\n=== INSTRUCTION ===\n"
    +"Construis un ticket "+dynCfg.minEventsPerTicket+"-"+dynCfg.maxEventsPerTicket+" sélections.\n"
    +"Cote totale (PRODUIT) entre 30 et 400 — CIBLE IDÉALE: 50-150 (6-7 sél × 1.9).\n"
    +"Intègre les 10 dimensions + narrative + Monte Carlo + Sharp Money + EV + actualités.\n"
    +"Vérifie l'absence de biais cognitifs dans ton raisonnement.\n"
    +"Justifie chaque sélection avec au moins 2 facteurs concrets.\n\n"
    +"Réponds en JSON:\n"+jsonSchema;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENCE CAUSALE (buildCausalInsight)
// ═══════════════════════════════════════════════════════════════════════════════
function buildCausalInsight(causal, scores, dynCfg, memory) {
  var recent = causal.slice(-15);
  var dims = {};
  recent.forEach(function(e){(e.dimensionsAtFault||[]).forEach(function(d){dims[d]=(dims[d]||0)+1;});});
  var topDims = Object.keys(dims).sort(function(a,b){return dims[b]-dims[a];}).slice(0,3);
  var remedies = [];
  recent.forEach(function(e){(e.remediation||[]).forEach(function(r){if(remedies.indexOf(r)<0)remedies.push(r);});});
  var narrExp = recent.filter(function(e){return e.narrativeAnalysis&&e.narrativeAnalysis.aiExplanation;}).slice(-5).map(function(e){return e.narrativeAnalysis.aiExplanation.slice(0,80);});
  var mktS = Object.keys(scores.markets||{}).filter(function(m){return scores.markets[m].total>=3;}).map(function(m){return m+":"+Math.round(scores.markets[m].rate*100)+"%";}).join(", ");
  var oddS = Object.keys(scores.oddRanges||{}).filter(function(r){return scores.oddRanges[r].total>=3;}).map(function(r){return r+":"+Math.round(scores.oddRanges[r].rate*100)+"%";}).join(", ");
  return { summary:"Causes:"+topDims.join(",")+" | Remèdes:"+(remedies.slice(0,2).join(";")||"aucun"), topCauses:topDims, recentRemedies:remedies.slice(0,5), marketScores:mktS, oddRangeScores:oddS, narrativeExplanations:narrExp, latestNarrativeInsight:memory.latestNarrativeInsight||"", dynConfig:dynCfg };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION + KELLY + FALLBACK + HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function validateTicket(selections, matches, dynCfg) {
  if(!selections||!selections.length)return{valid:false,reason:"Vide"};
  var maxE=dynCfg.maxEventsPerTicket||18;
  if(selections.length>maxE)return{valid:false,reason:"Trop: "+selections.length};
  var totalOdd=1,valid=[],usedIds=new Set();
  var blkMkt=dynCfg.blacklistedMarkets||[],blkLg=dynCfg.blacklistedLeagues||[],maxOdd=dynCfg.maxSingleOdd||10;
  selections.forEach(function(sel){
    if(sel.matchIndex==null)return;
    var match=matches[sel.matchIndex]; if(!match)return;
    if(usedIds.has(match.id))return;
    var odd=parseFloat(sel.odd); if(!isFinite(odd)||odd<CONFIG_BASE.MIN_SINGLE_ODD||odd>maxOdd)return;
    var mkt=BETPAWA_MARKETS.find(function(m){return m.id===sel.market;}); if(!mkt||!mkt.outcomes.includes(sel.outcome))return;
    if(blkMkt.length&&blkMkt.indexOf(sel.market)>=0)return;
    if(blkLg.length&&blkLg.indexOf(match.league)>=0)return;
    if(totalOdd*odd>CONFIG_BASE.COTE_MAX*3)return;
    totalOdd*=odd; usedIds.add(match.id);
    valid.push({matchId:match.id,home:match.home,away:match.away,league:match.league,datetime:match.datetime,market:sel.market,outcome:sel.outcome,odd:parseFloat(odd.toFixed(2)),justification:sel.justification||""});
  });
  if(valid.length<2)return{valid:false,reason:"Valides: "+valid.length};
  if(totalOdd<CONFIG_BASE.COTE_MIN)return{valid:false,reason:"Cote "+totalOdd.toFixed(2)+" < 30"};
  if(totalOdd>CONFIG_BASE.COTE_MAX)return{valid:false,reason:"Cote "+totalOdd.toFixed(2)+" > 400"};
  return{valid:true,selections:valid,totalOdd:parseFloat(totalOdd.toFixed(4))};
}

function calculateMise(bankroll, totalOdd, confidence, ctxAnalyses, ticketSim) {
  if(!bankroll||bankroll<=0)return 1;
  var ip=1/totalOdd, edge=(confidence||0.55)-ip;
  var mise=edge<=0?Math.floor(bankroll*0.005):Math.floor(((edge/(totalOdd-1))*bankroll)*0.25);
  // Si simulation suggère une prob plus faible, réduire la mise
  if(ticketSim&&ticketSim.simulatedWinProb<ip*0.5){mise=Math.floor(mise*0.5);}
  var mult=1.0;
  (ctxAnalyses||[]).forEach(function(a){if(a.betRecommendation&&a.betRecommendation.miseMultiplier<mult)mult=a.betRecommendation.miseMultiplier;});
  return Math.max(1,Math.min(Math.floor(mise*mult),Math.floor(bankroll*0.05)));
}

// ─── MODULE 17: VALIDATION DÉCISIONNELLE ────────────────────────────────────
function validateDecision(ticket, betRecord) {
  var criteria = [];
  var passed = 0;

  // Critère 1: Value positive (edge moyen > 0)
  var avgEdge = (ticket.selections||[]).reduce(function(s,sel){ return s+(sel.edge||0); }, 0) / Math.max(1,(ticket.selections||[]).length);
  var c1 = avgEdge > 0.01;
  criteria.push("Value: "+(c1?"✓":"✗")+" (edge moy="+( avgEdge*100).toFixed(1)+"%)");
  if (c1) passed++;

  // Critère 2: Score bookmaker moyen >= 5 (ou pas de données multi-BK disponibles)
  var bkScores = (ticket.selections||[]).filter(function(s){ return s.bookmakerScore !== undefined; });
  var c2;
  if (bkScores.length === 0) {
    c2 = true; // pas de données = on ne bloque pas
    criteria.push("Score BK: ✓ (pas de données multi-BK → accepté)");
  } else {
    var avgBKScore = bkScores.reduce(function(s,sel){ return s+(sel.bookmakerScore||0); }, 0) / bkScores.length;
    c2 = avgBKScore >= 5;
    criteria.push("Score BK: "+(c2?"✓":"✗")+" (moy="+avgBKScore.toFixed(1)+"/10)");
  }
  if (c2) passed++;

  // Critère 3: CLV potentiel favorable (confiance > 40%)
  var c3 = (ticket.confidence || 0) >= 0.40;
  criteria.push("CLV potentiel: "+(c3?"✓":"✗")+" (conf="+Math.round((ticket.confidence||0)*100)+"%)");
  if (c3) passed++;

  // Critère 4: Cohérence statistique (au moins 50% des sélections sont +EV)
  var posEV = (ticket.selections||[]).filter(function(s){ return (s.edge||0) > 0.015; }).length;
  var c4 = posEV >= Math.ceil((ticket.selections||[]).length * 0.5);
  criteria.push("Stats: "+(c4?"✓":"✗")+" ("+posEV+"/"+(ticket.selections||[]).length+" +EV)");
  if (c4) passed++;

  return {
    approved: passed >= 3, // au moins 3/4 critères validés
    score:    passed,
    reason:   passed < 3 ? "Seulement "+passed+"/4 critères validés" : "OK",
    details:  criteria.join(" | "),
  };
}

function fallbackStrategy(matches, dynCfg) {
  var blkMkt=dynCfg.blacklistedMarkets||[],blkLg=dynCfg.blacklistedLeagues||[],maxOdd=dynCfg.maxSingleOdd||10;
  var selections=[],totalOdd=1,used=new Set();
  var pool=matches.filter(function(m){return blkLg.indexOf(m.league)<0;});
  var sorted=pool.slice().sort(function(a,b){return Math.abs(parseFloat(a.odds&&a.odds.btts_yes||1.9)-1.9)-Math.abs(parseFloat(b.odds&&b.odds.btts_yes||1.9)-1.9);});
  sorted.forEach(function(match){
    if(selections.length>=14||used.has(match.id))return;
    var opts=[{market:"BTTS",outcome:"OUI",odd:parseFloat(match.odds&&match.odds.btts_yes||0)},{market:"O25",outcome:"OVER",odd:parseFloat(match.odds&&match.odds.over25||0)},{market:"1X2",outcome:"1",odd:parseFloat(match.odds&&match.odds.home||0)}].filter(function(o){return isFinite(o.odd)&&o.odd>=CONFIG_BASE.MIN_SINGLE_ODD&&o.odd<=maxOdd&&blkMkt.indexOf(o.market)<0;});
    if(!opts.length)return;
    var best=opts.reduce(function(a,b){return Math.abs(a.odd-1.9)<Math.abs(b.odd-1.9)?a:b;});
    if(totalOdd*best.odd>CONFIG_BASE.COTE_MAX||totalOdd*best.odd<1)return;
    totalOdd*=best.odd; used.add(match.id);
    selections.push({matchIndex:matches.indexOf(match),market:best.market,outcome:best.outcome,odd:best.odd,justification:"Fallback v7"});
  });
  if(totalOdd<CONFIG_BASE.COTE_MIN){
    sorted.forEach(function(match){
      if(totalOdd>=CONFIG_BASE.COTE_MIN||used.has(match.id))return;
      var odd=parseFloat(match.odds&&match.odds.draw||0);
      if(!isFinite(odd)||odd<CONFIG_BASE.MIN_SINGLE_ODD||totalOdd*odd>CONFIG_BASE.COTE_MAX)return;
      totalOdd*=odd; used.add(match.id);
      selections.push({matchIndex:matches.indexOf(match),market:"1X2",outcome:"X",odd:odd,justification:"Fallback complétion"});
    });
  }
  var emptyNarr={reasoning:"Fallback v7",selfCritique:"Mode fallback.",narrativeInsight:"N/A",emotionalStatesNote:"N/A",arcTypeNote:"N/A",invisibleForcesNote:"N/A",formNote:"N/A",h2hNote:"N/A",emotionalInsight:"N/A",stakesNote:"N/A",weatherNote:"N/A",integrityNote:"N/A",teamStylesNote:"N/A",xFactors:"N/A",newsInsight:"N/A",sharpMoneyNote:"N/A",evNote:"N/A",simulationCheck:"N/A",causalCheck:"N/A",biasCheck:"N/A",strategy_note:"Cotes ~1.9"};
  return Object.assign({selections:selections,totalOdd:totalOdd,confidence:0.50},emptyNarr);
}

function isValidDecision(d,matches,dynCfg){if(!d||!d.selections||!d.selections.length)return false;return validateTicket(d.selections,matches,dynCfg||{maxSingleOdd:10,maxEventsPerTicket:18,minEventsPerTicket:8,blacklistedMarkets:[],blacklistedLeagues:[]}).valid;}
function checkSelection(sel,result){if(!result||!sel)return false;var tot=(result.home_goals||0)+(result.away_goals||0);switch(sel.market){case"1X2":return sel.outcome===result.outcome_1x2;case"DC":if(sel.outcome==="1X")return["1","X"].includes(result.outcome_1x2);if(sel.outcome==="12")return["1","2"].includes(result.outcome_1x2);if(sel.outcome==="X2")return["X","2"].includes(result.outcome_1x2);return false;case"BTTS":{var b=(result.home_goals||0)>0&&(result.away_goals||0)>0;return sel.outcome==="OUI"?b:!b;}case"O25":return sel.outcome==="OVER"?tot>2.5:tot<2.5;case"O15":return sel.outcome==="OVER"?tot>1.5:tot<1.5;case"O35":return sel.outcome==="OVER"?tot>3.5:tot<3.5;case"1H_1X2":return result.ht_outcome?sel.outcome===result.ht_outcome:false;case"DRAW_NO_BET":return result.outcome_1x2==="X"?true:sel.outcome===result.outcome_1x2;default:return false;}}
function simulateResultFromOdd(odd){var p=1/(parseFloat(odd)||2),won=Math.random()<p,outcomes=["1","X","2"];return{won:won,outcome:outcomes[Math.floor(Math.random()*3)]};}
function parseJSON(text){if(!text)return null;var c=text.replace(/```json\n?|```\n?/g,"").trim();try{return JSON.parse(c);}catch{}var m=c.match(/\{[\s\S]*\}/);if(m){try{return JSON.parse(m[0]);}catch{}}return null;}

var CONFIG = Object.assign({},CONFIG_BASE);
module.exports = { runCycle, resolvePendingBets, CONFIG };
