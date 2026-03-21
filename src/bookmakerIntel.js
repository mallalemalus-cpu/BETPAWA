// ─── BOOKMAKER INTELLIGENCE v8 ───────────────────────────────────────────────
// Sources: Pinnacle.com, Bet-Analytix, RebelBetting, Buchdahl (2024-2025)
//
// COMMENT LES BOOKMAKERS FONCTIONNENT — CE QUE L'AGENT DOIT COMPRENDRE :
//
// 1. LE VIG (Vigorish / Overround / Marge)
//    Chaque cote est délibérément abaissée pour que la somme des prob. implicites > 100%.
//    Exemple: 1=2.00 X=3.40 2=3.60 → implicites: 50%+29.4%+27.8% = 107.2% → vig = 7.2%
//    Ce 7.2% est l'edge structurel du bookmaker. Pour gagner, l'agent doit le surmonter.
//
// 2. SHARP vs SOFT BOOKMAKERS
//    Sharp (Pinnacle, BetCRIS): vig 1-3%, acceptent les sharp bettors, leurs cotes reflètent
//    la vraie probabilité. Leurs cotes de clôture = "vérité statistique".
//    Soft (BetPawa, Betway, 1xBet): vig 5-12%, cotes souvent mal calibrées sur petits marchés.
//    Stratégie: utiliser Pinnacle comme référence "vraie" → chercher où BetPawa offre mieux.
//
// 3. CLOSING LINE VALUE (CLV)
//    La cote de clôture (juste avant le match) est la plus précise car elle intègre toute
//    l'information disponible. Battre cette cote = edge réel et mesurable.
//    CLV > 0 systématiquement → profit sur le long terme (prouvé mathématiquement).
//
// 4. FAVORITE-LONGSHOT BIAS
//    Les bookmakers surchargent les outsiders (longshots) et sous-chargent les favoris.
//    Sur BetPawa pour le football: les cotes > 3.0 ont généralement une marge cachée plus haute.
//    → Préférer les sélections avec cotes 1.4-2.5 pour minimiser le vig effectif.
//
// 5. MARKET EFFICIENCY PAR LIGUE
//    UCL/PL/La Liga: très efficaces (sharp money, liquidité élevée) → edge difficile
//    Ligues mineures, matchs de semaine: moins efficaces → plus d'opportunités
//    BetPawa Afrique: marchés locaux parfois mal calibrés → opportunités réelles
//
// 6. RECOMMENDED TARGET: COTE 50-150
//    Mathématiquement optimal pour l'intervalle 30-400:
//    - Prob/ticket 0.7-2% → semaine: 17-43% de gain
//    - Kelly mise utile (edge > vig)
//    - 5-8 sélections × cote 1.7-2.2 ≈ cote ticket 80-120

const logger = require("./logger");

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const VIG_BY_MARKET = {
  "1X2":         { avg: 0.062, min: 0.030, max: 0.120 }, // 6.2% moyen sur 1X2 football
  "DC":          { avg: 0.040, min: 0.020, max: 0.080 },
  "BTTS":        { avg: 0.050, min: 0.025, max: 0.090 },
  "O25":         { avg: 0.045, min: 0.020, max: 0.085 },
  "O15":         { avg: 0.042, min: 0.018, max: 0.080 },
  "O35":         { avg: 0.048, min: 0.022, max: 0.090 },
  "1H_1X2":      { avg: 0.075, min: 0.040, max: 0.130 }, // mi-temps: plus de vig
  "DRAW_NO_BET": { avg: 0.035, min: 0.018, max: 0.065 },
};

// Efficacité des ligues (1=très efficace, 0=peu efficace)
const LEAGUE_EFFICIENCY = {
  "Champions League": 0.92, "Premier League": 0.90, "La Liga": 0.88,
  "Bundesliga": 0.87, "Serie A": 0.86, "Ligue 1": 0.84,
  "Europa League": 0.82, "Eredivisie": 0.78, "Primeira Liga": 0.77,
  "Süper Lig": 0.70, "Brasileirão": 0.68, "CAN": 0.65,
  "default": 0.72,
};

// Marge BetPawa estimée par marché (empirique Afrique)
const BETPAWA_VIG = {
  "1X2": 0.075, "DC": 0.055, "BTTS": 0.060,
  "O25": 0.055, "O15": 0.050, "O35": 0.058,
  "1H_1X2": 0.090, "DRAW_NO_BET": 0.045,
};

// ─── DE-VIG (SUPPRESSION DE LA MARGE) ────────────────────────────────────────
// Méthode Power (recommandée - gère le favorite-longshot bias)
// Trouve les "vraies" probabilités sans la marge du bookmaker
function deVigPower(odds) {
  if (!odds || !odds.length) return null;
  var impliedProbs = odds.map(function(o) { return 1 / parseFloat(o); });
  var overround = impliedProbs.reduce(function(s, p) { return s + p; }, 0);
  if (overround <= 0) return null;

  // Trouver la puissance k telle que sum(p^k) = 1
  var k = 1.0;
  for (var iter = 0; iter < 100; iter++) {
    var probsK = impliedProbs.map(function(p) { return Math.pow(p, k); });
    var sumK = probsK.reduce(function(s, p) { return s + p; }, 0);
    if (Math.abs(sumK - 1.0) < 0.0001) break;
    k += (sumK > 1.0) ? 0.01 : -0.01;
  }

  var fairProbs = impliedProbs.map(function(p) { return Math.pow(p, k); });
  var fairOdds  = fairProbs.map(function(p) { return parseFloat((1 / p).toFixed(3)); });
  var vig = (overround - 1) * 100;

  return { fairProbs: fairProbs, fairOdds: fairOdds, vig: parseFloat(vig.toFixed(2)), k: parseFloat(k.toFixed(4)), overround: parseFloat(overround.toFixed(4)) };
}

// Méthode Multiplicative (simple, bonne pour 2-way markets)
function deVigMultiplicative(odds) {
  var impliedProbs = odds.map(function(o) { return 1 / parseFloat(o); });
  var overround = impliedProbs.reduce(function(s, p) { return s + p; }, 0);
  var fairProbs = impliedProbs.map(function(p) { return p / overround; });
  var fairOdds  = fairProbs.map(function(p) { return parseFloat((1 / p).toFixed(3)); });
  return { fairProbs: fairProbs, fairOdds: fairOdds, vig: parseFloat(((overround-1)*100).toFixed(2)), overround: parseFloat(overround.toFixed(4)) };
}

// ─── ANALYSE COMPLÈTE D'UN MATCH (PERSPECTIVE BOOKMAKER) ─────────────────────
function analyzeBookmakerOdds(match) {
  var odds = match.odds;
  if (!odds || !odds.home) return null;

  var result = {
    match: match.home + " vs " + match.away,
    league: match.league,
    markets: {},
    leagueEfficiency: LEAGUE_EFFICIENCY[match.league] || LEAGUE_EFFICIENCY["default"],
    overallEdgeOpportunity: "faible",
    bestValueMarket: null,
    bookmakerProfile: classifyBookmakerOdds(odds),
    favoritelongshotBias: detectFavoriteLongshotBias(odds),
    recommendations: [],
  };

  // ── Analyser le marché 1X2 ────────────────────────────────────────────────
  if (odds.home && odds.draw && odds.away) {
    var devig1x2 = deVigPower([odds.home, odds.draw, odds.away]);
    if (devig1x2) {
      result.markets["1X2"] = {
        rawOdds:   { home: odds.home, draw: odds.draw, away: odds.away },
        fairOdds:  { home: devig1x2.fairOdds[0], draw: devig1x2.fairOdds[1], away: devig1x2.fairOdds[2] },
        fairProbs: { home: (devig1x2.fairProbs[0]*100).toFixed(1)+"%", draw: (devig1x2.fairProbs[1]*100).toFixed(1)+"%", away: (devig1x2.fairProbs[2]*100).toFixed(1)+"%" },
        vig:       devig1x2.vig,
        vigRating: devig1x2.vig < 4 ? "excellent" : devig1x2.vig < 6 ? "bon" : devig1x2.vig < 8 ? "moyen" : "élevé",
        bestOutcome: findBestOutcome(
          [{outcome:"1",offered:odds.home,fair:devig1x2.fairOdds[0]},
           {outcome:"X",offered:odds.draw,fair:devig1x2.fairOdds[1]},
           {outcome:"2",offered:odds.away,fair:devig1x2.fairOdds[2]}]
        ),
      };
    }
  }

  // ── Analyser BTTS ─────────────────────────────────────────────────────────
  if (odds.btts_yes && odds.btts_no) {
    var devigBTTS = deVigMultiplicative([odds.btts_yes, odds.btts_no]);
    if (devigBTTS) {
      result.markets["BTTS"] = {
        rawOdds: { oui: odds.btts_yes, non: odds.btts_no },
        fairOdds: { oui: devigBTTS.fairOdds[0], non: devigBTTS.fairOdds[1] },
        fairProbs: { oui: (devigBTTS.fairProbs[0]*100).toFixed(1)+"%", non: (devigBTTS.fairProbs[1]*100).toFixed(1)+"%" },
        vig: devigBTTS.vig,
        vigRating: devigBTTS.vig < 4 ? "excellent" : devigBTTS.vig < 6 ? "bon" : "élevé",
        bestOutcome: findBestOutcome(
          [{outcome:"OUI",offered:odds.btts_yes,fair:devigBTTS.fairOdds[0]},
           {outcome:"NON",offered:odds.btts_no, fair:devigBTTS.fairOdds[1]}]
        ),
      };
    }
  }

  // ── Analyser O/U 2.5 ─────────────────────────────────────────────────────
  if (odds.over25 && odds.under25) {
    var devigOU = deVigMultiplicative([odds.over25, odds.under25]);
    if (devigOU) {
      result.markets["O25"] = {
        rawOdds: { over: odds.over25, under: odds.under25 },
        fairOdds: { over: devigOU.fairOdds[0], under: devigOU.fairOdds[1] },
        fairProbs: { over: (devigOU.fairProbs[0]*100).toFixed(1)+"%", under: (devigOU.fairProbs[1]*100).toFixed(1)+"%" },
        vig: devigOU.vig,
        vigRating: devigOU.vig < 4 ? "excellent" : devigOU.vig < 6 ? "bon" : "élevé",
        bestOutcome: findBestOutcome(
          [{outcome:"OVER",offered:odds.over25,fair:devigOU.fairOdds[0]},
           {outcome:"UNDER",offered:odds.under25,fair:devigOU.fairOdds[1]}]
        ),
      };
    }
  }

  // ── Trouver le meilleur marché ────────────────────────────────────────────
  var bestEV = -Infinity;
  Object.keys(result.markets).forEach(function(mkt) {
    var m = result.markets[mkt];
    if (m.bestOutcome && m.bestOutcome.ev > bestEV) {
      bestEV = m.bestOutcome.ev;
      result.bestValueMarket = { market: mkt, outcome: m.bestOutcome.outcome, ev: m.bestOutcome.ev, fairOdds: m.bestOutcome.fair, offeredOdds: m.bestOutcome.offered };
    }
  });

  // ── Score d'opportunité global ────────────────────────────────────────────
  var efficiency = result.leagueEfficiency;
  var vigLevel = result.markets["1X2"] ? result.markets["1X2"].vig : 7;
  var edgeScore = (1 - efficiency) * 30 + (vigLevel > 7 ? 20 : 0) + (bestEV > 3 ? 30 : bestEV > 0 ? 15 : 0);
  result.overallEdgeOpportunity = edgeScore >= 50 ? "élevé" : edgeScore >= 30 ? "moyen" : "faible";

  // ── Recommandations spécifiques ───────────────────────────────────────────
  if (vigLevel > 8) {
    result.recommendations.push("Vig élevé ("+vigLevel.toFixed(1)+"%) — marché moins efficient, opportunités possibles si bien analysé");
  }
  if (efficiency < 0.75) {
    result.recommendations.push("Ligue à faible efficacité ("+( efficiency*100).toFixed(0)+"%) — plus d'erreurs de pricing du bookmaker");
  }
  if (result.favoritelongshotBias.detected) {
    result.recommendations.push("Favorite-Longshot Bias détecté: "+result.favoritelongshotBias.note);
  }
  if (result.bestValueMarket && result.bestValueMarket.ev > 2) {
    result.recommendations.push("Meilleure valeur: "+result.bestValueMarket.market+" "+result.bestValueMarket.outcome+" (EV=+"+result.bestValueMarket.ev.toFixed(1)+"%)");
  }

  return result;
}

// ─── CALCUL DU CLV (CLOSING LINE VALUE) ──────────────────────────────────────
// Mesure si l'agent a parié avant que le marché ne s'ajuste = edge réel
function trackCLV(selection, closingOdds) {
  if (!selection.odd || !closingOdds) return null;
  var betOdd     = parseFloat(selection.odd);
  var closingOdd = parseFloat(closingOdds);
  var clvPct     = (betOdd / closingOdd - 1) * 100;

  return {
    betOdd:        betOdd,
    closingOdd:    closingOdd,
    clv:           parseFloat(clvPct.toFixed(2)),
    clvRating:     clvPct > 5 ? "EXCELLENT" : clvPct > 2 ? "BON" : clvPct > 0 ? "POSITIF" : clvPct > -3 ? "NEUTRE" : "NÉGATIF",
    isPositive:    clvPct > 0,
    interpretation: clvPct > 0
      ? "Pari placé avant que le marché ne corrige → edge réel confirmé"
      : "Marché plus précis qu'au moment du pari → à analyser",
  };
}

// ─── CALCULER LA VIG EFFECTIVE D'UN TICKET ───────────────────────────────────
// La vig se compose sur un combiné — crucial à comprendre
function computeTicketVig(selections) {
  if (!selections || !selections.length) return null;
  var totalVig = 1.0;
  var details  = [];

  selections.forEach(function(sel) {
    var marketVig = BETPAWA_VIG[sel.market] || 0.06;
    totalVig *= (1 + marketVig);
    details.push({ market: sel.market, vig: (marketVig*100).toFixed(1)+"%" });
  });

  var compoundVig = (totalVig - 1) * 100;
  return {
    compoundVig:   parseFloat(compoundVig.toFixed(2)),
    perLeg:        details,
    threshold:     "Pour un EV positif, l'agent doit avoir un edge global > "+compoundVig.toFixed(1)+"% sur ce ticket",
    isViable:      compoundVig < 40,
    recommendation: compoundVig > 50
      ? "Vig trop élevée sur ce combiné — réduire le nombre de sélections ou choisir des marchés plus efficaces"
      : compoundVig > 30
      ? "Vig significative ("+compoundVig.toFixed(1)+"%) — nécessite un edge fort sur chaque sélection"
      : "Vig acceptable ("+compoundVig.toFixed(1)+"%) pour ce nombre de sélections",
  };
}

// ─── STRATÉGIE OPTIMALE CONTRE LES BOOKMAKERS ────────────────────────────────
// Intègre toutes les connaissances de la recherche
function computeOptimalStrategy(matches, history) {
  var resolved = history.filter(function(b){ return b.status==="resolved"; });
  var clvHistory = resolved.filter(function(b){ return b.clvData; });

  // Analyser le win rate par tranche de cote individuelle pour identifier la "zone dorée"
  var zonalStats = {};
  resolved.forEach(function(bet) {
    (bet.selections||[]).forEach(function(sel) {
      var odd = parseFloat(sel.odd);
      var zone = odd < 1.5 ? "1.15-1.5" : odd < 2.0 ? "1.5-2.0" : odd < 2.5 ? "2.0-2.5" : odd < 3.5 ? "2.5-3.5" : "3.5+";
      if (!zonalStats[zone]) zonalStats[zone] = { wins:0, total:0 };
      zonalStats[zone].total++;
      if (sel.won) zonalStats[zone].wins++;
    });
  });

  // Trouver la zone d'or (meilleur win rate avec volume suffisant)
  var goldenZone = "1.5-2.0"; // défaut recommandé
  var bestWR = 0;
  Object.keys(zonalStats).forEach(function(zone) {
    var s = zonalStats[zone];
    if (s.total >= 5) {
      var wr = s.wins / s.total;
      if (wr > bestWR) { bestWR = wr; goldenZone = zone; }
    }
  });

  // Cible de cote optimale pour l'intervalle 30-400
  var targetMin = 50, targetMax = 150, targetIdeal = 80;

  return {
    goldenOddZone: goldenZone,
    goldenZoneStats: zonalStats[goldenZone],
    targetTicketOdd: { min: targetMin, ideal: targetIdeal, max: targetMax },
    targetSelections: 6, // pour atteindre ~80 avec des cotes ~1.9
    targetIndividualOdd: 1.90, // maximise le rapport prob/vig
    strategy: "Concentrer sur cotes individuelles 1.6-2.2 (moins de vig relative) · "
      + "Ligues peu efficaces (CAN, Brasileirão, Süper Lig) pour plus d'inefficiences · "
      + "Marchés BTTS/O25 moins chargés en vig que 1X2 sur petites ligues · "
      + "Cibler cote ticket 50-150 (zone optimale mathématique) · "
      + "Parier tôt (avant les ajustements) pour CLV positif",
    avoidStrategies: [
      "Cotes individuelles > 3.5 (favorite-longshot bias: sur-margé par le bookmaker)",
      "Tickets de 10+ sélections (vig composée > 60%)",
      "Marchés 1X2 UCL/PL (trop efficaces, edge difficile)",
      "Parier tard (après les mouvements de lignes)",
    ],
  };
}

// ─── FORMATEUR POUR LE PROMPT ─────────────────────────────────────────────────
function formatBookmakerIntelForPrompt(analyses, ticketVig, optimalStrategy) {
  var lines = ["=== INTELLIGENCE BOOKMAKER (MARGE + CLV + OPPORTUNITÉS) ==="];

  if (optimalStrategy) {
    lines.push("STRATÉGIE OPTIMALE:");
    lines.push("  • Zone d'or cotes individuelles: "+optimalStrategy.goldenOddZone+" (historique: "+(optimalStrategy.goldenZoneStats?optimalStrategy.goldenZoneStats.wins+"/"+optimalStrategy.goldenZoneStats.total+" ="+( optimalStrategy.goldenZoneStats.wins/Math.max(1,optimalStrategy.goldenZoneStats.total)*100).toFixed(0)+"%":"pas assez de données")+")" );
    lines.push("  • Cible ticket: "+optimalStrategy.targetTicketOdd.min+"-"+optimalStrategy.targetTicketOdd.max+" (idéal: "+optimalStrategy.targetTicketOdd.ideal+")");
    lines.push("  • "+optimalStrategy.strategy.slice(0,200));
    lines.push("  ⛔ ÉVITER: "+(optimalStrategy.avoidStrategies||[]).slice(0,2).join(" | "));
  }

  if (ticketVig) {
    lines.push("VIG COMPOSÉE DU TICKET: "+ticketVig.compoundVig+"% — "+ticketVig.recommendation.slice(0,100));
  }

  if (analyses && analyses.length) {
    lines.push("ANALYSE MARCHÉS ("+analyses.length+" matchs):");
    analyses.slice(0,8).forEach(function(a) {
      if (!a) return;
      var m1x2 = a.markets && a.markets["1X2"];
      var mbtts = a.markets && a.markets["BTTS"];
      lines.push("  ["+a.match+"] Eff:"+( a.leagueEfficiency*100).toFixed(0)+"% | Opp:"+a.overallEdgeOpportunity);
      if (m1x2) {
        lines.push("    1X2 vig:"+m1x2.vig+"% ("+m1x2.vigRating+") | Fair: 1="+m1x2.fairOdds.home+" X="+m1x2.fairOdds.draw+" 2="+m1x2.fairOdds.away);
      }
      if (mbtts) {
        lines.push("    BTTS vig:"+mbtts.vig+"% | Fair: OUI="+mbtts.fairOdds.oui+" NON="+mbtts.fairOdds.non);
      }
      if (a.bestValueMarket && a.bestValueMarket.ev > 1) {
        lines.push("    ★ Meilleure valeur: "+a.bestValueMarket.market+" "+a.bestValueMarket.outcome+" EV=+"+a.bestValueMarket.ev.toFixed(1)+"%");
      }
      if (a.recommendations && a.recommendations.length) {
        lines.push("    → "+a.recommendations[0]);
      }
    });
  }

  return lines.join("\n");
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function findBestOutcome(outcomes) {
  var best = null;
  outcomes.forEach(function(o) {
    var offered = parseFloat(o.offered), fair = parseFloat(o.fair);
    if (!isFinite(offered)||!isFinite(fair)) return;
    var ev = (offered / fair - 1) * 100; // % d'edge vs cote juste
    if (!best || ev > best.ev) best = { outcome: o.outcome, offered: offered, fair: fair, ev: parseFloat(ev.toFixed(2)) };
  });
  return best;
}

function classifyBookmakerOdds(odds) {
  if (!odds || !odds.home || !odds.draw || !odds.away) return "inconnu";
  var sum = (1/odds.home) + (1/odds.draw) + (1/odds.away);
  var vig = (sum - 1) * 100;
  return vig < 4 ? "sharp (<4% vig)" : vig < 7 ? "standard (4-7% vig)" : "soft (>7% vig — plus d'opportunités)";
}

function detectFavoriteLongshotBias(odds) {
  if (!odds || !odds.home || !odds.away) return { detected: false, note: "" };
  var homeOdd = parseFloat(odds.home), awayOdd = parseFloat(odds.away);
  var ratio = Math.max(homeOdd, awayOdd) / Math.min(homeOdd, awayOdd);
  if (ratio > 3.0) {
    var longshot = homeOdd > awayOdd ? "domicile" : "extérieur";
    return {
      detected: true,
      note: "L'outsider ("+longshot+" @ "+(Math.max(homeOdd,awayOdd)).toFixed(2)+") est potentiellement sur-margé. Préférer le favori ("+Math.min(homeOdd,awayOdd).toFixed(2)+") pour moins de vig effective.",
    };
  }
  return { detected: false, note: "" };
}

module.exports = {
  deVigPower,
  deVigMultiplicative,
  analyzeBookmakerOdds,
  trackCLV,
  computeTicketVig,
  computeOptimalStrategy,
  formatBookmakerIntelForPrompt,
  LEAGUE_EFFICIENCY,
  BETPAWA_VIG,
  VIG_BY_MARKET,
};
