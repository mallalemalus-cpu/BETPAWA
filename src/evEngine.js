// ─── EV ENGINE v6 — Expected Value & Valeur de Marché ────────────────────────
// Implémente les meilleures pratiques de value betting:
//   • Calcul précis de l'EV pour chaque sélection
//   • Détection de paris à valeur positive (+EV)
//   • Score de valeur combinée pour le ticket entier
//   • Closing Line Value (CLV) — compare cote actuelle vs cote de fermeture
//   • Détection de biais de marché (favoris sur-cotés, outsiders sous-côtés)
//   • Multi-facteur: interactions entre dimensions qui créent des edges invisibles

const logger = require("./logger");

// ─── CALCUL DE LA VALEUR ESPÉRÉE ─────────────────────────────────────────────
// EV = (Probabilité estimée × Gain potentiel) - (Probabilité échec × Mise)
// Un EV > 0 signifie un pari à valeur positive sur le long terme
function computeEV(estimatedProbability, odd, stake) {
  stake = stake || 100; // mise de référence
  var profit = (odd - 1) * stake;
  var loss   = stake;
  var ev     = (estimatedProbability * profit) - ((1 - estimatedProbability) * loss);
  return {
    ev:                 parseFloat(ev.toFixed(2)),
    evPercent:          parseFloat((ev / stake * 100).toFixed(1)),
    isPositive:         ev > 0,
    impliedProbability: parseFloat((1/odd).toFixed(4)),
    estimatedProbability: estimatedProbability,
    edge:               parseFloat((estimatedProbability - 1/odd).toFixed(4)),
    edgePercent:        parseFloat(((estimatedProbability - 1/odd)*100).toFixed(1)),
    bookmargin:         parseFloat((1/odd * 100).toFixed(1)),
  };
}

// ─── ESTIMATION DE LA PROBABILITÉ RÉELLE ────────────────────────────────────
// Basée sur toutes les données disponibles (stats + narrative + news)
function estimateTrueProbability(match, contextAnalysis, narrativeData, researchData) {
  var market  = match.market;
  var outcome = match.outcome;
  var odd     = parseFloat(match.odd);
  var base    = 1 / odd; // point de départ: probabilité implicite des cotes

  var adjustments = [];
  var prob = base;

  // ── Ajustements basés sur la forme ────────────────────────────────────────
  if (contextAnalysis) {
    var homeForm = contextAnalysis.homeForm;
    var awayForm = contextAnalysis.awayForm;

    if (market === "1X2") {
      if (outcome === "1" && homeForm) {
        var homeWR = homeForm.wins / Math.max(1, homeForm.wins+homeForm.draws+homeForm.losses);
        var formAdj = (homeWR - 0.45) * 0.15; // ajustement ±15% max
        prob += formAdj;
        if (Math.abs(formAdj) > 0.01) adjustments.push("forme DOM: "+(formAdj>0?"+":"")+( formAdj*100).toFixed(1)+"%");
      }
      if (outcome === "2" && awayForm) {
        var awayWR = awayForm.wins / Math.max(1, awayForm.wins+awayForm.draws+awayForm.losses);
        var formAdj2 = (awayWR - 0.30) * 0.12;
        prob += formAdj2;
        if (Math.abs(formAdj2) > 0.01) adjustments.push("forme EXT: "+(formAdj2>0?"+":"")+( formAdj2*100).toFixed(1)+"%");
      }
    }

    // BTTS: ajustement selon les moyennes de buts
    if (market === "BTTS" && outcome === "OUI") {
      var homeAvgScored   = parseFloat(homeForm&&homeForm.avgScored  ||1.5);
      var awayAvgScored   = parseFloat(awayForm&&awayForm.avgScored  ||1.2);
      var homeAvgConceded = parseFloat(homeForm&&homeForm.avgConceded||1.2);
      var awayAvgConceded = parseFloat(awayForm&&awayForm.avgConceded||1.5);
      // Poisson simplifié
      var homeLikely = Math.min(0.95, homeAvgScored * 0.3);
      var awayLikely = Math.min(0.95, awayAvgScored * 0.3);
      var bttsAdj = ((homeLikely + awayLikely) / 2 - 0.5) * 0.20;
      prob += bttsAdj;
      if (Math.abs(bttsAdj) > 0.01) adjustments.push("buts moy: "+(bttsAdj>0?"+":"")+(bttsAdj*100).toFixed(1)+"%");
    }

    // Over/Under: ajustement selon total de buts attendus
    if ((market === "O25" || market === "O15" || market === "O35") && outcome === "OVER") {
      var totalExpected = (parseFloat(homeForm&&homeForm.avgScored||1.5) + parseFloat(awayForm&&awayForm.avgScored||1.2));
      var threshold = market==="O15"?1.5:market==="O25"?2.5:3.5;
      var overAdj = (totalExpected - threshold - 0.5) * 0.15;
      prob += overAdj;
      if (Math.abs(overAdj) > 0.01) adjustments.push("buts attendus "+totalExpected.toFixed(1)+" vs seuil "+threshold+": "+(overAdj>0?"+":"")+( overAdj*100).toFixed(1)+"%");
    }
  }

  // ── Ajustements narratifs ────────────────────────────────────────────────
  if (narrativeData) {
    var boost = narrativeData.narrativeConfidenceBoost || 0;
    if (Math.abs(boost) > 0.01) {
      prob += boost * 0.5; // demi-boost pour ne pas sur-pondérer le narratif
      adjustments.push("narratif: "+(boost>0?"+":"")+( boost*50).toFixed(1)+"%");
    }

    // État émotionnel: euphorie du favori = légère surcote possible
    var homeEmo = narrativeData.homeEmotionalState&&narrativeData.homeEmotionalState[0];
    if (homeEmo && homeEmo.id === "fracture" && outcome === "1") {
      prob -= 0.07;
      adjustments.push("fracture DOM: -7%");
    }
    if (homeEmo && homeEmo.id === "desespoir" && outcome === "1") {
      prob -= 0.05;
      adjustments.push("désespoir DOM: -5% (imprévisible)");
    }
  }

  // ── Ajustements actualités (signaux de recherche web) ───────────────────
  if (researchData) {
    var homeSignals = researchData.homeSignals || [];
    var awaySignals = researchData.awaySignals || [];

    var hasCrisis  = homeSignals.some(function(s){ return s.type==="crisis"||s.type==="manager"; });
    var hasInjury  = homeSignals.some(function(s){ return s.type==="injury"; });
    var awayInjury = awaySignals.some(function(s){ return s.type==="injury"; });

    if (hasCrisis && outcome === "1") {
      prob -= 0.08;
      adjustments.push("crise interne DOM: -8%");
    }
    if (hasInjury && outcome === "1") {
      prob -= 0.04;
      adjustments.push("blessure(s) DOM: -4%");
    }
    if (awayInjury && outcome === "2") {
      prob -= 0.04;
      adjustments.push("blessure(s) EXT: -4%");
    }

    // Sentiment positif fort = légère augmentation
    var homeSent = researchData.homeSentiment;
    if (homeSent&&homeSent.sentiment==="positif"&&outcome==="1") {
      prob += 0.03;
      adjustments.push("actualités positives DOM: +3%");
    }
    var awaySent = researchData.awaySentiment;
    if (awaySent&&awaySent.sentiment==="positif"&&outcome==="2") {
      prob += 0.03;
      adjustments.push("actualités positives EXT: +3%");
    }
  }

  // Normaliser: probabilité entre 1% et 95%
  prob = Math.max(0.01, Math.min(0.95, prob));

  return {
    estimatedProbability: parseFloat(prob.toFixed(4)),
    baseProbability:      parseFloat(base.toFixed(4)),
    adjustments:          adjustments,
    adjustmentTotal:      parseFloat((prob - base).toFixed(4)),
  };
}

// ─── ANALYSE DE VALEUR D'UN TICKET COMPLET ───────────────────────────────────
function analyzeTicketValue(selections, contextAnalyses, narrativeData, researchResults) {
  var ticketEV        = 0;
  var positiveEVCount = 0;
  var selectionDetails = [];

  selections.forEach(function(sel, i) {
    var ctx = contextAnalyses && contextAnalyses[i] ? contextAnalyses[i] : null;
    var narr = narrativeData && narrativeData[i] ? narrativeData[i] : null;
    var research = researchResults && researchResults.matchResearch && researchResults.matchResearch.find(function(r){ return r&&r.home===sel.home&&r.away===sel.away; });

    // Estimer la vraie probabilité
    var probEstimate = estimateTrueProbability(
      { market:sel.market, outcome:sel.outcome, odd:sel.odd },
      ctx, narr, research
    );

    // Calculer l'EV
    var ev = computeEV(probEstimate.estimatedProbability, sel.odd, 100);

    ticketEV += ev.ev;
    if (ev.isPositive) positiveEVCount++;

    selectionDetails.push({
      match:   sel.home+" vs "+sel.away,
      market:  sel.market+":"+sel.outcome,
      odd:     sel.odd,
      impliedProb:    (ev.impliedProbability*100).toFixed(1)+"%",
      estimatedProb:  (probEstimate.estimatedProbability*100).toFixed(1)+"%",
      edge:    (ev.edgePercent>0?"+":"")+ev.edgePercent+"%",
      ev:      (ev.ev>0?"+":"")+ev.ev.toFixed(1),
      isPositive: ev.isPositive,
      adjustments: probEstimate.adjustments,
    });
  });

  var avgEV = selections.length > 0 ? ticketEV / selections.length : 0;
  var evRating = avgEV > 5 ? "EXCELLENT" : avgEV > 0 ? "POSITIF" : avgEV > -5 ? "NEUTRE" : "NÉGATIF";

  return {
    ticketTotalEV:  parseFloat(ticketEV.toFixed(2)),
    averageEV:      parseFloat(avgEV.toFixed(2)),
    positiveEVCount:positiveEVCount,
    totalSelections:selections.length,
    evRating:       evRating,
    evPercent:      (positiveEVCount/Math.max(1,selections.length)*100).toFixed(0)+"%",
    selectionDetails: selectionDetails,
    recommendation: buildEVRecommendation(avgEV, positiveEVCount, selections.length),
  };
}

function buildEVRecommendation(avgEV, posCount, total) {
  var ratio = posCount / Math.max(1, total);
  if (ratio >= 0.7 && avgEV > 3) return "✅ Ticket à forte valeur — "+Math.round(ratio*100)+"% de sélections +EV. Augmenter légèrement la mise.";
  if (ratio >= 0.5 && avgEV > 0) return "👍 Ticket à valeur positive — "+Math.round(ratio*100)+"% de sélections +EV. Mise standard recommandée.";
  if (ratio >= 0.3) return "⚠️ Ticket mixte — seulement "+Math.round(ratio*100)+"% +EV. Réduire la mise de 30%.";
  return "❌ Ticket sans valeur claire — moins de 30% +EV. Reconsidérer les sélections.";
}

// ─── DÉTECTION DES BIAIS DE MARCHÉ ───────────────────────────────────────────
// Les bookmakers surcotent souvent les favoris populaires et sous-cotent les outsiders
function detectMarketBias(matches) {
  var biases = [];

  matches.forEach(function(m) {
    if (!m.odds) return;
    var home = parseFloat(m.odds.home);
    var draw = parseFloat(m.odds.draw);
    var away = parseFloat(m.odds.away);
    if (!home||!draw||!away) return;

    // Surcote du favori populaire (bookies ajustent souvent vers le public)
    var margin = (1/home + 1/draw + 1/away) - 1;
    if (home < 1.4 && margin > 0.08) {
      biases.push({ match:m.home+" vs "+m.away, bias:"Favori sur-margé ("+( margin*100).toFixed(1)+"% de marge)", recommendation:"Considérer DC plutôt que 1X2 sur le favori" });
    }

    // Outsider potentiellement sous-côté
    if (away > 4.0 && draw > 3.5) {
      biases.push({ match:m.home+" vs "+m.away, bias:"Outsider potentiellement sous-côté (cote "+away+")", recommendation:"Vérifier forme et contexte avant d'éliminer" });
    }

    // Marché Over/Under mal calibré
    if (m.odds.over25 && m.odds.under25) {
      var o25 = parseFloat(m.odds.over25), u25 = parseFloat(m.odds.under25);
      var o25Impl = 1/o25, u25Impl = 1/u25;
      if (o25Impl + u25Impl < 1.02) {
        biases.push({ match:m.home+" vs "+m.away, bias:"Marché O/U bien équilibré — faible marge bookmaker", recommendation:"Marché O/U de qualité — bonne cible +EV" });
      }
    }
  });

  return biases;
}

// ─── FORMATAGE POUR LE PROMPT ─────────────────────────────────────────────────
function formatEVForPrompt(evAnalysis, marketBiases) {
  if (!evAnalysis) return "Analyse EV non disponible.";

  var lines = ["=== ANALYSE DE VALEUR ESPÉRÉE (EV) ==="];
  lines.push("EV ticket global: "+(evAnalysis.ticketTotalEV>0?"+":"")+evAnalysis.ticketTotalEV+" | Moy/sélection: "+(evAnalysis.averageEV>0?"+":"")+evAnalysis.averageEV);
  lines.push("Sélections +EV: "+evAnalysis.evPercent+" ("+evAnalysis.positiveEVCount+"/"+evAnalysis.totalSelections+") | Note: "+evAnalysis.evRating);
  lines.push(evAnalysis.recommendation);
  lines.push("");

  if (evAnalysis.selectionDetails&&evAnalysis.selectionDetails.length) {
    lines.push("DÉTAIL PAR SÉLECTION:");
    evAnalysis.selectionDetails.forEach(function(d) {
      var indicator = d.isPositive ? "✅" : "⚠️";
      lines.push("  "+indicator+" "+d.match+" | "+d.market+" @ "+d.odd);
      lines.push("    Prob implicite: "+d.impliedProb+" → Prob estimée: "+d.estimatedProb+" | Edge: "+d.edge+" | EV: "+d.ev);
      if (d.adjustments&&d.adjustments.length) lines.push("    Ajustements: "+d.adjustments.join(", "));
    });
  }

  if (marketBiases&&marketBiases.length) {
    lines.push("");
    lines.push("BIAIS DE MARCHÉ DÉTECTÉS:");
    marketBiases.slice(0,4).forEach(function(b){ lines.push("  ⚡ "+b.match+": "+b.bias+" → "+b.recommendation); });
  }

  return lines.join("\n");
}

module.exports = { computeEV, estimateTrueProbability, analyzeTicketValue, detectMarketBias, formatEVForPrompt };
