// ─── OPTIMIZER v5 — Compréhension narrative des victoires et défaites ─────────
const Anthropic = require("@anthropic-ai/sdk");
const {
  loadMemory, saveMemory, loadHistory, loadCausalJournal, saveCausalEntry,
  loadDimensionScores, saveDimensionScores, loadCapabilities, saveCapabilities,
} = require("./storage");
const { analyzeMatchOutcome } = require("./narrativeEngine");
const logger = require("./logger");

const client     = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL_LIGHT= "claude-haiku-4-5-20251001";

// ─── AUTOPSIE NARRATIVE D'UN PARI PERDU ──────────────────────────────────────
// Comprend POURQUOI le gagnant a gagné et le perdant a perdu
// Au-delà des statistiques — la narration et les forces humaines
async function conductPostMortem(bet) {
  if (!bet||bet.won!==false) return null;

  var entry = {
    betId: bet.id, timestamp: new Date().toISOString(),
    totalOdd: bet.totalOdd, mise: bet.mise,
    selections: (bet.selections||[]).map(function(s){
      return { match:s.home+" vs "+s.away, league:s.league, market:s.market, outcome:s.outcome, odd:s.odd, actualResult:s.actualResult||"inconnu", won:s.won };
    }),
    rootCauses: [], dimensionsAtFault: [], remediation: [],
    narrativeAnalysis: null, // NOUVEAU: analyse narrative
    isRecurring: false,
  };

  // ── Analyse narrative des résultats ──────────────────────────────────────
  // Essayer avec Claude Haiku, fallback sur analyse heuristique locale
  try {
    var narrativeOutcome = await analyzeMatchOutcome(bet, null);
    if (narrativeOutcome) {
      entry.narrativeAnalysis = narrativeOutcome;
      entry.rootCauses = entry.rootCauses.concat(narrativeOutcome.lossReasons.slice(0,3));
    }
  } catch {
    // Fallback: analyse heuristique sans IA
    var wrongSels = entry.selections.filter(function(s){ return !s.won; });
    var lossReasons = wrongSels.map(function(s){
      if (s.market==="BTTS" && s.outcome==="OUI") return "BTTS OUI échoué — l'une des équipes n'a pas marqué";
      if (s.market==="O25" && s.outcome==="OVER") return "Over 2.5 échoué — match plus défensif que prévu";
      if (s.market==="1X2" && s.outcome==="1") return "Domicile n'a pas gagné — surprise ou défaillance";
      if (s.market==="DC") return "Double chance insuffisante — résultat inattendu";
      return "Résultat inattendu sur "+s.market+":"+s.outcome+" pour "+s.match;
    });
    entry.rootCauses = entry.rootCauses.concat(lossReasons.slice(0,3));
    entry.narrativeAnalysis = { aiExplanation: "Analyse locale (sans IA): "+lossReasons.slice(0,2).join(" | ") };
  }

  // ── Analyse heuristique des causes ───────────────────────────────────────
  var selections = entry.selections;

  // Cause 1: Cotes trop élevées
  var highOdds = selections.filter(function(s){ return s.odd>4.0&&!s.won; });
  if (highOdds.length>0) {
    entry.rootCauses.push("Cote(s) individuelle(s) excessive(s): "+highOdds.map(function(s){return s.market+"@"+s.odd;}).join(",")+
      " — événement trop incertain, la cote reflète l'imprévisibilité");
    entry.dimensionsAtFault.push("odd_range");
    entry.remediation.push("Descendre progressivement la cote individuelle max de 0.5 point pour ce type de marché");
  }

  // Cause 2: Marché mal choisi pour le contexte
  var wrongCtxMarket = selections.filter(function(s){ return !s.won&&s.market==="BTTS"&&s.outcome==="OUI"; });
  if (wrongCtxMarket.length>0 && bet.weatherNote && bet.weatherNote.toLowerCase().includes("négatif")) {
    entry.rootCauses.push("BTTS OUI sélectionné malgré une météo défavorable aux buts — corrélation négative ignorée");
    entry.dimensionsAtFault.push("weather");
    entry.dimensionsAtFault.push("market_choice");
    entry.remediation.push("Ne jamais sélectionner BTTS OUI ou Over X.5 quand la météo annonce pluie forte ou vent >30km/h");
  }

  // Cause 3: Signal d'intégrité ignoré
  if (bet.integrityNote&&bet.integrityNote.toLowerCase().includes("risque")&&!bet.integrityNote.toLowerCase().includes("aucun")) {
    entry.rootCauses.push("Match sélectionné malgré un signal d'intégrité — la résistance à exclure ces matchs a coûté cher");
    entry.dimensionsAtFault.push("integrity");
    entry.remediation.push("Exclusion systématique de tout match avec score d'intégrité > 25, sans exception");
  }

  // Cause 4: Derby — surconfiance dans l'analyse
  if (bet.emotionalInsight&&bet.emotionalInsight.toLowerCase().includes("derby")) {
    var derbyLosses = selections.filter(function(s){ return !s.won; });
    if (derbyLosses.length>0) {
      entry.rootCauses.push("Derby dans le ticket: l'analyse narrative et statistique devient moins fiable — les derbies ont leurs propres lois");
      entry.dimensionsAtFault.push("emotional");
      entry.remediation.push("Limiter à 1 derby par ticket et choisir des marchés de type DC ou handicap plutôt que 1X2 sec");
    }
  }

  // Cause 5: Analyse narrative manquante ou contradictoire
  if (bet.narrativeInsight&&bet.narrativeInsight.toLowerCase().includes("fracture")) {
    entry.rootCauses.push("Équipe en état de fracture interne sélectionnée — les équipes divisées sont imprévisibles");
    entry.dimensionsAtFault.push("emotional");
    entry.remediation.push("Éviter les équipes en état de fracture, peu importe leurs stats récentes");
  }

  // Si aucune cause identifiée
  if (entry.rootCauses.length===0) {
    entry.rootCauses.push("Aléa statistique ou événement réellement imprévisible — certaines pertes sont incompressibles dans un combiné");
    entry.remediation.push("Surveiller sur 3+ paris similaires avant d'ajuster — ne pas sur-réagir à une seule perte");
  }

  // ── Analyse IA profonde (causes subtiles non heuristiques) ────────────────
  try {
    var selStr = entry.selections.map(function(s){ return s.match+" | "+s.market+":"+s.outcome+"@"+s.odd+" → réel:"+s.actualResult+" ("+( s.won?"✓":"✗")+")"; }).join("\n");
    var contextStr = [
      bet.narrativeInsight ? "Contexte narratif: "+bet.narrativeInsight.slice(0,200) : "",
      bet.emotionalInsight ? "Contexte émotionnel: "+bet.emotionalInsight.slice(0,150) : "",
      bet.weatherNote      ? "Météo: "+bet.weatherNote.slice(0,100) : "",
      bet.stakesNote       ? "Enjeux: "+bet.stakesNote.slice(0,100) : "",
    ].filter(Boolean).join("\n");

    if (!process.env.ANTHROPIC_API_KEY) return null;
    var res = await client.messages.create({
      model: MODEL_LIGHT,
      max_tokens: 500,
      messages:[{ role:"user", content:
        "Analyse causale narrative d'un pari perdu. Va AU-DELÀ des statistiques.\n\n"
        +"TICKET PERDU (cote:"+bet.totalOdd+" mise:"+bet.mise+")\n"
        +"SÉLECTIONS:\n"+selStr+"\n"
        +"CONTEXTE:\n"+contextStr+"\n\n"
        +"Comprends POURQUOI chaque équipe a produit ce résultat (facteurs humains, psychologiques, narratifs).\n"
        +"Identifie SI notre lecture de la situation était fondamentalement fausse ou simplement malchanceuse.\n"
        +"Réponds en JSON: {\"narrativeExplanation\":\"...\",\"rootCauses\":[\"...\"],\"dimensionsAtFault\":[\"forme\"|\"h2h\"|\"emotional\"|\"weather\"|\"stakes\"|\"integrity\"|\"teamStyle\"|\"odd_range\"|\"market_choice\"|\"narrative\"],\"remediation\":[\"...\"],\"wasAvoidable\":true|false}"
      }],
    });
    var raw = res.content.map(function(b){ return b.text||""; }).join("");
    var parsed = safeParseJSON(raw);
    if (parsed) {
      if (parsed.narrativeExplanation) entry.narrativeAnalysis = Object.assign(entry.narrativeAnalysis||{}, { aiExplanation: parsed.narrativeExplanation });
      if (parsed.rootCauses&&parsed.rootCauses.length) entry.rootCauses = parsed.rootCauses;
      if (parsed.dimensionsAtFault&&parsed.dimensionsAtFault.length) entry.dimensionsAtFault = Array.from(new Set(entry.dimensionsAtFault.concat(parsed.dimensionsAtFault)));
      if (parsed.remediation&&parsed.remediation.length) entry.remediation = Array.from(new Set(entry.remediation.concat(parsed.remediation)));
      entry.wasAvoidable = parsed.wasAvoidable;
    }
  } catch(e) { logger.debug("Autopsie IA: "+e.message); }

  saveCausalEntry(entry);
  return entry;
}

// ─── ANALYSE D'UN PARI GAGNÉ ─────────────────────────────────────────────────
// Comprendre POURQUOI le gagnant a gagné — pour reproduire ces patterns
async function analyzeWin(bet) {
  if (!bet||!bet.won) return null;
  // Si pas d'Anthropic, retourner une analyse basique mais réelle
  if (!process.env.ANTHROPIC_API_KEY) {
    var wonSels = (bet.selections||[]).filter(function(s){ return s.won; });
    return {
      patterns: wonSels.map(function(s){ return s.market+":"+s.outcome+" @"+s.odd+" ✓"; }),
      insight: "Paris gagnant: "+wonSels.length+"/"+bet.selections.length+" sélections correctes. Cote: "+bet.totalOdd.toFixed(2),
      source: "analyse locale"
    };
  }

  var winAnalysis = {
    betId: bet.id, timestamp: new Date().toISOString(),
    totalOdd: bet.totalOdd, gain: bet.gainNet,
    successFactors: [], narrativeWinReason: "", replicablePattern: "",
  };

  // Facteurs de succès
  (bet.selections||[]).forEach(function(sel) {
    if (sel.won) {
      var factor = buildWinFactor(sel, bet);
      if (factor) winAnalysis.successFactors.push(factor);
    }
  });

  // Contexte narratif de la victoire
  if (bet.narrativeInsight) {
    winAnalysis.narrativeWinReason = "L'analyse narrative était correcte: "+bet.narrativeInsight.slice(0,150);
  } else if (bet.emotionalInsight) {
    winAnalysis.narrativeWinReason = "Le contexte émotionnel bien lu: "+bet.emotionalInsight.slice(0,150);
  }

  // Pattern reproductible
  var avgOdd = (bet.selections||[]).reduce(function(s,sel){ return s+sel.odd; },0)/((bet.selections||[]).length||1);
  winAnalysis.replicablePattern = "Cote moy:"+avgOdd.toFixed(2)+" | marchés:"+Array.from(new Set((bet.selections||[]).map(function(s){return s.market;}))).join("+");

  return winAnalysis;
}

function buildWinFactor(sel, bet) {
  var factors = {
    "BTTS:OUI":  "BTTS OUI confirmé — les deux équipes avaient bien la motivation offensive attendue",
    "BTTS:NON":  "BTTS NON confirmé — la défense organisée a tenu, l'analyse du style défensif était juste",
    "O25:OVER":  "Over 2.5 confirmé — le rythme offensif du match correspondait à l'analyse",
    "O25:UNDER": "Under 2.5 confirmé — le contexte fermé bien identifié (météo/enjeu/style)",
    "O15:OVER":  "Over 1.5 confirmé — minimum de dynamisme bien anticipé",
    "1X2:1":     "Victoire domicile confirmée — avantage psychologique et forme bien lus",
    "1X2:2":     "Victoire extérieure confirmée — la motivation visiteur sous-estimée par les cotes bien identifiée",
    "1X2:X":     "Nul confirmé — équilibre tactique bien perçu",
    "DC:1X":     "Double chance 1X confirmé — protection efficace contre la surprise",
  };
  return factors[sel.market+":"+sel.outcome] || "Prédiction correcte: "+sel.market+":"+sel.outcome+"@"+sel.odd;
}

// ─── MISE À JOUR DES SCORES DE PRÉCISION ─────────────────────────────────────
function updateDimensionScores(bet) {
  var scores = loadDimensionScores();
  (bet.selections||[]).forEach(function(sel) {
    var mkt=sel.market||"?";
    if(!scores.markets[mkt])scores.markets[mkt]={correct:0,total:0,rate:0};
    scores.markets[mkt].total++;
    if(bet.won)scores.markets[mkt].correct++;
    scores.markets[mkt].rate=parseFloat((scores.markets[mkt].correct/scores.markets[mkt].total).toFixed(3));
    var lg=sel.league||"?";
    if(!scores.leagues[lg])scores.leagues[lg]={correct:0,total:0,rate:0};
    scores.leagues[lg].total++;
    if(bet.won)scores.leagues[lg].correct++;
    scores.leagues[lg].rate=parseFloat((scores.leagues[lg].correct/scores.leagues[lg].total).toFixed(3));
    var odd=parseFloat(sel.odd)||1;
    var range=odd<1.5?"1.1-1.5":odd<2.0?"1.5-2.0":odd<3.0?"2.0-3.0":odd<5.0?"3.0-5.0":"5.0+";
    scores.oddRanges[range].total++;
    var selWon=sel.won!==undefined?sel.won:bet.won;
    if(selWon)scores.oddRanges[range].correct++;
    scores.oddRanges[range].rate=parseFloat((scores.oddRanges[range].correct/scores.oddRanges[range].total).toFixed(3));
  });
  scores.lastUpdated=new Date().toISOString();
  saveDimensionScores(scores);
  return scores;
}

// ─── OPTIMISATION CAUSALE PROGRESSIVE ────────────────────────────────────────
async function runOptimization(stats) {
  logger.info("🔧 [OPTIMIZER v5] Optimisation causale narrative...");
  var memory=loadMemory(), history=loadHistory(), journal=loadCausalJournal(), scores=loadDimensionScores();
  var resolved=history.filter(function(b){return b.status==="resolved";});
  if(resolved.length<3){logger.info("🔧 Données insuffisantes");return memory;}
  var wins=resolved.filter(function(b){return b.won;}), losses=resolved.filter(function(b){return!b.won;});
  var roi=stats.totalMise>0?((stats.gains-stats.pertes)/stats.totalMise*100):0;
  logger.info("   "+resolved.length+" paris | ROI:"+roi.toFixed(1)+"% | "+wins.length+"V/"+losses.length+"D");

  // Analyse des causes récurrentes
  var recentEntries=journal.slice(-20);
  var causeCounts={};
  recentEntries.forEach(function(e){(e.dimensionsAtFault||[]).forEach(function(d){causeCounts[d]=(causeCounts[d]||0)+1;});});
  var dominantCause=Object.keys(causeCounts).sort(function(a,b){return causeCounts[b]-causeCounts[a];})[0];

  var params=JSON.parse(JSON.stringify(memory.dynamicParams));
  var changes=[];

  // Ajustements progressifs basés sur causes réelles
  if(causeCounts["odd_range"]&&causeCounts["odd_range"]>=2){
    var newMax=Math.max(2.5,(params.maxSingleOdd||10)-0.5);
    if(newMax!==params.maxSingleOdd){params.maxSingleOdd=newMax;changes.push("maxOdd réduit à "+newMax+" ("+causeCounts["odd_range"]+"x cause odd_range)");}
  }
  if(roi>5&&params.maxSingleOdd<10){params.maxSingleOdd=Math.min(10,params.maxSingleOdd+0.3);changes.push("maxOdd augmenté à "+params.maxSingleOdd.toFixed(1)+" (ROI positif)");}
  if(scores.markets){
    var wkMkt=Object.keys(scores.markets).filter(function(m){var s=scores.markets[m];return s.total>=4&&s.rate<0.30;});
    var stMkt=Object.keys(scores.markets).filter(function(m){var s=scores.markets[m];return s.total>=4&&s.rate>0.60;});
    if(wkMkt.length){params.blacklistedMarkets=wkMkt;changes.push("Marchés faibles (<30%): "+wkMkt.join(","));}
    if(stMkt.length){params.preferredMarkets=stMkt;changes.push("Marchés forts (>60%): "+stMkt.join(","));}
  }
  if(scores.leagues){
    var wkLg=Object.keys(scores.leagues).filter(function(l){var s=scores.leagues[l];return s.total>=4&&s.rate<0.30;});
    var stLg=Object.keys(scores.leagues).filter(function(l){var s=scores.leagues[l];return s.total>=4&&s.rate>0.60;});
    if(wkLg.length){params.blacklistedLeagues=wkLg;changes.push("Ligues faibles: "+wkLg.join(","));}
    if(stLg.length){params.preferredLeagues=stLg;changes.push("Ligues fortes: "+stLg.join(","));}
  }
  if(causeCounts["emotional"]&&causeCounts["emotional"]>=2){
    params.minConfidenceThreshold=Math.min(0.70,(params.minConfidenceThreshold||0.52)+0.03);
    changes.push("Confiance min augmentée à "+params.minConfidenceThreshold.toFixed(2)+" (pertes émotionnelles)");
  }
  if(causeCounts["narrative"]&&causeCounts["narrative"]>=2){
    changes.push("Intelligence narrative insuffisamment appliquée — renforcer le poids du moteur narratif");
  }
  var avgSels=resolved.reduce(function(s,b){return s+(b.selections&&b.selections.length||0);},0)/(resolved.length||1);
  if(losses.length>wins.length&&avgSels>8){params.maxEventsPerTicket=Math.max(5,(params.maxEventsPerTicket||10)-1);changes.push("maxEvts réduit à "+params.maxEventsPerTicket+" (range 30-400)");}
  if(wins.length>losses.length&&params.maxEventsPerTicket<10){params.maxEventsPerTicket=Math.min(10,params.maxEventsPerTicket+1);}

  // Consultation IA pour patterns subtils
  try {
    var causeSummary=recentEntries.slice(-10).map(function(e){return "cote:"+e.totalOdd+" causes:["+(e.rootCauses||[]).join("|")+"] narrative:"+( e.narrativeAnalysis&&e.narrativeAnalysis.aiExplanation?(e.narrativeAnalysis.aiExplanation.slice(0,80)):"non dispo");}).join("\n");
    // Vérifier les crédits avant d'appeler
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.debug("Optimization: pas de clé Anthropic — analyse locale uniquement");
      throw new Error("no_anthropic");
    }
    var aiRes=await client.messages.create({
      model:MODEL_LIGHT, max_tokens:500,
      messages:[{role:"user", content:
        "Optimiseur d'agent de paris. Analyse narrative des pertes et propose corrections PROGRESSIVES.\n\n"
        +"ROI:"+roi.toFixed(1)+"% "+wins.length+"V/"+losses.length+"D | Cause dominante:"+(dominantCause||"aucune")+"\n"
        +"AUTOPSIES:\n"+causeSummary+"\n"
        +"Scores marchés: "+JSON.stringify(scores.markets||{})+"\n\n"
        +"Identifie les patterns subtils (narratifs, psychologiques, contextuels) que les heuristiques n'ont pas détectés.\n"
        +'{"patterns":["..."],"corrections":["..."],"newCapability":"...","narrativeInsight":"..."}'
      }],
    });
    var raw=aiRes.content.map(function(b){return b.text||"";}).join("");
    var parsed=safeParseJSON(raw);
    if(parsed){
      if(parsed.patterns)memory.causalPatterns.lossCauses=(memory.causalPatterns.lossCauses||[]).concat(parsed.patterns).slice(-20);
      if(parsed.corrections)changes=changes.concat(parsed.corrections);
      if(parsed.narrativeInsight)memory.latestNarrativeInsight=parsed.narrativeInsight;
      if(parsed.newCapability){
        var caps=loadCapabilities();
        if(!caps.find(function(c){return c.name===parsed.newCapability;})){
          caps.push({name:parsed.newCapability,acquiredAt:new Date().toISOString(),active:true,trigger:"optimizer_v5"});
          saveCapabilities(caps);
          logger.info("🆕 Capacité acquise: "+parsed.newCapability);
        }
      }
    }
  } catch(e){logger.warn("Optimizer IA: "+e.message);}

  memory.dynamicParams=params;
  memory.cycles=(memory.cycles||0)+1;
  memory.lastOptimized=new Date().toISOString();
  if(changes.length){
    var logEntry={cycle:memory.cycles,ts:new Date().toISOString(),changes:changes,roi:roi.toFixed(1)};
    memory.optimizationLog=(memory.optimizationLog||[]).concat([logEntry]).slice(-30);
    changes.forEach(function(c){logger.info("   🔧 "+c);});
  } else {logger.info("   ✅ Paramètres stables");}
  saveMemory(memory);
  return memory;
}

// ─── ANALYSE DE PRÉCISION POST-RÉSOLUTION ────────────────────────────────────
function computeAccuracyAnalysis(bet) {
  if(!bet||!bet.selections||!bet.selections.length)return null;
  var correct=0,wrong=0,wellPredicted=[],wrongPredicted=[];
  bet.selections.forEach(function(sel){
    if(sel.won===true){correct++;wellPredicted.push(sel.home+" vs "+sel.away+" ("+sel.market+":"+sel.outcome+"@"+sel.odd+") ✓");}
    else if(sel.won===false){wrong++;wrongPredicted.push(sel.home+" vs "+sel.away+" — prédit:"+sel.outcome+" réel:"+(sel.actualResult||"?")+" ✗");}
  });
  var total=bet.selections.length,known=correct+wrong;
  var accuracy=known>0?Math.round(correct/known*100):(bet.won?75:25);
  var lesson=bet.won?"Ticket gagnant ("+total+" sél.). Pattern à reproduire.":wrongPredicted.length>0?"Erreur principale: "+wrongPredicted[0]+". Analyser la cause racine.":"Données insuffisantes.";
  return { globalAccuracy:accuracy, realizedRate:bet.won?"100":known>0?Math.round(correct/total*100)+"":"0", correctSelections:correct, totalSelections:total, wellPredicted:wellPredicted, wrongPredicted:wrongPredicted, lesson:lesson };
}

// ─── RAPPORT DE SANTÉ ────────────────────────────────────────────────────────
function buildAgentHealthReport(memory, scores, stats) {
  var params=memory.dynamicParams||{};
  var roi=stats.totalMise>0?((stats.gains-stats.pertes)/stats.totalMise*100):0;
  var r=["=== SANTÉ AGENT v5 (Cycle #"+(memory.cycles||0)+") ==="];
  r.push("ROI:"+roi.toFixed(1)+"% | Bankroll:"+stats.bankroll+" FCFA");
  r.push("Config: maxOdd="+params.maxSingleOdd+" | minConf="+params.minConfidenceThreshold+" | maxEvts="+params.maxEventsPerTicket);
  if(params.blacklistedMarkets&&params.blacklistedMarkets.length)r.push("Marchés évités: "+params.blacklistedMarkets.join(", "));
  if(params.preferredMarkets&&params.preferredMarkets.length)r.push("Marchés préférés: "+params.preferredMarkets.join(", "));
  if(memory.latestNarrativeInsight)r.push("Insight narratif: "+memory.latestNarrativeInsight.slice(0,120));
  var journal=loadCausalJournal(),cc={};
  journal.slice(-20).forEach(function(e){(e.dimensionsAtFault||[]).forEach(function(d){cc[d]=(cc[d]||0)+1;});});
  var top=Object.keys(cc).sort(function(a,b){return cc[b]-cc[a];}).slice(0,3);
  if(top.length)r.push("Top causes: "+top.map(function(k){return k+"("+cc[k]+"x)";}).join(", "));
  var mktStr=Object.keys(scores.markets||{}).filter(function(m){return scores.markets[m].total>=3;}).map(function(m){return m+":"+Math.round(scores.markets[m].rate*100)+"%";}).join(" | ");
  if(mktStr)r.push("Win rate marchés: "+mktStr);
  return r.join("\n");
}

function safeParseJSON(text) {
  if(!text)return null;
  var c=text.replace(/```json\n?|```\n?/g,"").trim();
  try{return JSON.parse(c);}catch{}
  var m=c.match(/\{[\s\S]*\}/);
  if(m){try{return JSON.parse(m[0]);}catch{}}
  return null;
}

module.exports = { runOptimization, conductPostMortem, analyzeWin, updateDimensionScores, computeAccuracyAnalysis, buildAgentHealthReport };
