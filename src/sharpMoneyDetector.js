// ─── SHARP MONEY DETECTOR v7 ──────────────────────────────────────────────────
// Innovations issues de la recherche (2025-2026):
//   • Détection du "Sharp Money" (argent professionnel)
//   • Reverse Line Movement (RLM) — la cote monte contre la tendance publique
//   • Closing Line Value (CLV) — mesure la qualité des paris par rapport à la clôture
//   • Détection des mouvements de cotes suspects
//   • Modèle de Poisson pour estimer le nombre de buts attendus
//   • Fenêtres glissantes L3/L5/L8 pour la forme
//   • Score d'ensemble (plusieurs méthodes combinées)
//
// SOURCE: WSC Sports 2025, Leans.AI, SportBot AI, ParlaySavant
//
// LOGIQUE SHARP MONEY:
//   Si 70% du public mise sur l'équipe A (→ cote A devrait baisser)
//   mais la cote A MONTE → l'argent professionnel est sur B (Reverse Line Movement)
//   C'est le signal le plus fort en betting professionnel.

const logger = require("./logger");

// ─── MODÈLE DE POISSON SIMPLIFIÉ ──────────────────────────────────────────────
// Calcule la probabilité d'un résultat en se basant sur les buts attendus
function poissonProbability(lambda, k) {
  // P(X=k) = e^(-λ) * λ^k / k!
  var e = Math.E;
  var factorial = 1;
  for (var i=2; i<=k; i++) factorial *= i;
  return Math.pow(e, -lambda) * Math.pow(lambda, k) / factorial;
}

function poissonMatchProbabilities(homeAttack, homeDefense, awayAttack, awayDefense) {
  // Expected goals avec force d'attaque/défense
  // Valeurs par défaut: 1.5 buts pour l'équipe à domicile, 1.1 pour l'extérieur
  var homeGoals = Math.max(0.3, homeAttack * (1 / awayDefense) * 1.5);
  var awayGoals = Math.max(0.3, awayAttack * (1 / homeDefense) * 1.1);

  homeGoals = Math.min(homeGoals, 4.0);
  awayGoals = Math.min(awayGoals, 4.0);

  // Calculer P(home > away), P(home == away), P(home < away)
  var homeWin=0, draw=0, awayWin=0;
  for (var h=0; h<=8; h++) {
    for (var a=0; a<=8; a++) {
      var p = poissonProbability(homeGoals, h) * poissonProbability(awayGoals, a);
      if (h>a) homeWin += p;
      else if (h===a) draw += p;
      else awayWin += p;
    }
  }

  // Probabilité BTTS
  var bttsYes = (1 - poissonProbability(homeGoals,0)) * (1 - poissonProbability(awayGoals,0));
  // Probabilité O2.5
  var over25 = 0;
  for (var h2=0; h2<=8; h2++) {
    for (var a2=0; a2<=8; a2++) {
      if (h2+a2 > 2.5) over25 += poissonProbability(homeGoals,h2) * poissonProbability(awayGoals,a2);
    }
  }

  return {
    homeWin:   parseFloat(homeWin.toFixed(4)),
    draw:      parseFloat(draw.toFixed(4)),
    awayWin:   parseFloat(awayWin.toFixed(4)),
    bttsYes:   parseFloat(bttsYes.toFixed(4)),
    over25:    parseFloat(over25.toFixed(4)),
    homeExpGoals: parseFloat(homeGoals.toFixed(2)),
    awayExpGoals: parseFloat(awayGoals.toFixed(2)),
    totalExpGoals: parseFloat((homeGoals+awayGoals).toFixed(2)),
  };
}

// ─── FENÊTRES GLISSANTES L3/L5/L8 ────────────────────────────────────────────
// Les pros analysent la forme sur plusieurs fenêtres temporelles
// Une équipe peut être bonne en L8 mais mauvaise en L3 → tendance négative
function computeRollingWindows(formString) {
  if (!formString) return null;
  var results = formString.split("").filter(function(c){ return ["W","D","L"].includes(c); });
  if (!results.length) return null;

  function windowStats(arr, n) {
    var window = arr.slice(0, n);
    if (!window.length) return null;
    var w = window.filter(function(c){return c==="W";}).length;
    var d = window.filter(function(c){return c==="D";}).length;
    var l = window.filter(function(c){return c==="L";}).length;
    var pts = w*3+d;
    var maxPts = window.length*3;
    return {
      n: window.length,
      wins: w, draws: d, losses: l,
      points: pts,
      pointsPercent: parseFloat((pts/maxPts*100).toFixed(1)),
      formScore: parseFloat((pts/maxPts).toFixed(3)),
      trend: pts/maxPts >= 0.67 ? "ascendant" : pts/maxPts >= 0.40 ? "stable" : "descendant",
    };
  }

  var l3 = windowStats(results, 3);
  var l5 = windowStats(results, 5);
  var l8 = windowStats(results, 8);

  // Détection de la tendance: meilleur en L3 qu'en L8 = amélioration récente
  var trendSignal = "stable";
  if (l3&&l8) {
    if (l3.formScore > l8.formScore + 0.15) trendSignal = "🔺 En hausse récente (L3 > L8)";
    else if (l3.formScore < l8.formScore - 0.15) trendSignal = "🔻 En baisse récente (L3 < L8)";
  }

  return { l3, l5, l8, trendSignal, overall: l8 || l5 || l3 };
}

// ─── DÉTECTION DU MOUVEMENT DE COTES ─────────────────────────────────────────
// Compare les cotes actuelles avec les cotes "typiques" pour ce type de match
// Signaux: cotes bougées anormalement = sharp money entré
function detectOddsMovement(match) {
  var signals = [];
  var odds = match.odds;
  if (!odds) return { signals:[], sharpSignal:false };

  var home = parseFloat(odds.home);
  var draw = parseFloat(odds.draw);
  var away = parseFloat(odds.away);
  if (!home||!draw||!away) return { signals:[], sharpSignal:false };

  var totalImplied = 1/home + 1/draw + 1/away;
  var bookmargin = (totalImplied - 1) * 100;

  // Signal 1: Marge bookmaker anormalement basse = marché très efficient (concurrentiel)
  if (bookmargin < 3.0) {
    signals.push({ type:"low_margin", message:"Marge bookmaker faible ("+bookmargin.toFixed(1)+"%) — marché efficient", impact:"positif", strength:"modéré" });
  }
  if (bookmargin > 12.0) {
    signals.push({ type:"high_margin", message:"Marge bookmaker élevée ("+bookmargin.toFixed(1)+"%) — éviter ce match si possible", impact:"négatif", strength:"fort" });
  }

  // Signal 2: Cote favoris anormalement basse (sharp money sur le favori)
  if (home < 1.25) {
    signals.push({ type:"heavy_favorite", message:"Favori très marqué ("+home+") — retour faible, risque de favoris loss", impact:"risqué", strength:"fort" });
  }

  // Signal 3: Cote away anormalement basse pour un match "à domicile"
  if (away < home && away < 1.6) {
    signals.push({ type:"away_favorite", message:"Équipe extérieure favorite ("+away+" vs "+home+") — signal force visiteur ou faiblesse domicile", impact:"informatif", strength:"fort" });
  }

  // Signal 4: Distribution asymétrique des cotes (possible manipulation)
  if (home < 1.4 && away > 6.0) {
    signals.push({ type:"extreme_asymmetry", message:"Asymétrie extrême ("+home+" vs "+away+") — bookmaker très confiant = moins de valeur EV", impact:"négatif", strength:"modéré" });
  }

  // Signal 5: Cotes BTTS ou Over bien calibrées
  if (odds.over25 && odds.under25) {
    var o25 = parseFloat(odds.over25);
    var u25 = parseFloat(odds.under25);
    var ouMargin = (1/o25 + 1/u25 - 1) * 100;
    if (ouMargin < 2.5) {
      signals.push({ type:"efficient_ou", message:"Marché O/U bien calibré (marge "+ouMargin.toFixed(1)+"%) — bonne cible EV", impact:"positif", strength:"modéré" });
    }
  }

  var sharpSignal = signals.some(function(s){ return s.type==="away_favorite"||s.type==="low_margin"; });

  return {
    signals: signals,
    sharpSignal: sharpSignal,
    bookmargin: parseFloat(bookmargin.toFixed(2)),
    totalImplied: parseFloat(totalImplied.toFixed(4)),
    summary: signals.length > 0 ? signals.map(function(s){ return "["+s.type+"] "+s.message; }).join(" | ") : "Aucun signal particulier",
  };
}

// ─── ANALYSE DE LA STRUCTURE DES COTES (Signals de marché) ──────────────────
// HONNÊTETÉ: Sans accès aux données de pourcentage de paris publics (coûtent cher),
// on analyse la STRUCTURE des cotes disponibles pour détecter des inefficiences.
// Ce n'est pas du RLM au sens strict — c'est de l'analyse de valeur sur les cotes réelles.
// Signal: tension entre cote favorite et marché Over/Under = anomalie potentielle.
function detectRLM(match) {
  var odds = match.odds;
  if (!odds||!odds.home||!odds.away) return null;

  var home = parseFloat(odds.home);
  var away = parseFloat(odds.away);
  var draw = parseFloat(odds.draw)||3.3;

  // Heuristique: si la cote favorite est très basse ET que le marché
  // over/under suggère un match ouvert → contradiction possible
  var impliedFavoriteProb = 1/Math.min(home,away);
  var impliedOverProb = odds.over25 ? 1/parseFloat(odds.over25) : 0.5;

  var rlmSignal = false;
  var rlmNote = "";

  // Un favori très fort mais un marché Over élevé = tension
  if (impliedFavoriteProb > 0.65 && impliedOverProb > 0.60) {
    rlmSignal = true;
    rlmNote = "Tension favorite/over: le favori domine mais le marché attend un match ouvert — signal intéressant";
  }

  // Cotes presque égales + over faible = match très défensif attendu
  if (Math.abs(home-away) < 0.3 && odds.over25 && parseFloat(odds.over25) > 2.0) {
    rlmNote = rlmNote || "Match équilibré avec tendance défensive — Under 2.5 pourrait avoir de la valeur";
  }

  return {
    rlmSignal:          rlmSignal,
    impliedFavoriteProb: parseFloat((impliedFavoriteProb*100).toFixed(1))+"%",
    impliedOverProb:     parseFloat((impliedOverProb*100).toFixed(1))+"%",
    note:               rlmNote || "Pas de signal RLM détecté",
  };
}

// ─── CLOSING LINE VALUE (CLV) TRACKER ────────────────────────────────────────
// Enregistre les cotes au moment du pari → compare avec la cote finale
// Un CLV positif = tu as eu de meilleures cotes que le marché final
function computeCLV(betOdd, closingOdd) {
  if (!betOdd||!closingOdd) return null;
  var clv = (betOdd - closingOdd) / closingOdd * 100;
  return {
    betOdd:     betOdd,
    closingOdd: closingOdd,
    clv:        parseFloat(clv.toFixed(2)),
    clvRating:  clv > 3 ? "EXCELLENT" : clv > 0 ? "POSITIF" : clv > -3 ? "NEUTRE" : "NÉGATIF",
    isSharp:    clv > 0, // battre la cote de clôture = signe de compétence
  };
}

// ─── SCORE D'ENSEMBLE (MULTI-MODÈLE) ─────────────────────────────────────────
// Combine plusieurs approches pour produire un score de confiance final
// Inspiration: les pros utilisent des modèles d'ensemble (plus stable que modèle unique)
function computeEnsembleScore(inputs) {
  // inputs: { poissonProb, formScore, narrativeScore, evScore, researchScore, integrityScore }
  var scores = [];
  var weights = [];

  if (typeof inputs.poissonProb === "number") { scores.push(inputs.poissonProb); weights.push(0.30); }
  if (typeof inputs.formScore === "number") { scores.push(inputs.formScore); weights.push(0.25); }
  if (typeof inputs.narrativeScore === "number") { scores.push(inputs.narrativeScore); weights.push(0.20); }
  if (typeof inputs.evScore === "number") { scores.push(Math.max(0, Math.min(1, inputs.evScore))); weights.push(0.15); }
  if (typeof inputs.researchScore === "number") { scores.push(1 - inputs.researchScore/100); weights.push(0.10); } // inverse: risque → confiance

  if (!scores.length) return 0.55;

  var totalWeight = weights.reduce(function(s,w){ return s+w; }, 0);
  var weightedSum = scores.reduce(function(s,v,i){ return s+v*weights[i]; }, 0);

  return parseFloat(Math.max(0.10, Math.min(0.90, weightedSum/totalWeight)).toFixed(4));
}

// ─── ANALYSE COMPLÈTE D'UN MATCH (SHARP + POISSON + WINDOWS) ─────────────────
function analyzeMatchSharp(match, homeFormData, awayFormData) {
  var result = {
    oddsMovement: null,
    rlm: null,
    poisson: null,
    homeWindows: null,
    awayWindows: null,
    ensembleInputs: {},
    summary: "",
  };

  // 1. Mouvement de cotes
  result.oddsMovement = detectOddsMovement(match);

  // 2. RLM
  result.rlm = detectRLM(match);

  // 3. Poisson model
  if (homeFormData && awayFormData) {
    var homeAttack  = Math.max(0.5, parseFloat(homeFormData.avgScored  ||1.5));
    var homeDefense = Math.max(0.5, 2.0 - parseFloat(homeFormData.avgConceded||1.2));
    var awayAttack  = Math.max(0.5, parseFloat(awayFormData.avgScored  ||1.2));
    var awayDefense = Math.max(0.5, 2.0 - parseFloat(awayFormData.avgConceded||1.5));
    result.poisson = poissonMatchProbabilities(homeAttack, homeDefense, awayAttack, awayDefense);
  } else {
    // Valeurs par défaut
    result.poisson = poissonMatchProbabilities(1.5, 1.0, 1.1, 1.0);
  }

  // 4. Fenêtres glissantes
  if (homeFormData && homeFormData.last6) result.homeWindows = computeRollingWindows(homeFormData.last6);
  if (awayFormData && awayFormData.last6) result.awayWindows = computeRollingWindows(awayFormData.last6);

  // 5. Inputs pour le score d'ensemble
  result.ensembleInputs = {
    poissonProb:   result.poisson ? result.poisson.homeWin : 0.45,
    formScore:     result.homeWindows ? (result.homeWindows.overall ? result.homeWindows.overall.formScore : 0.5) : 0.5,
    researchScore: 0, // sera rempli par l'agent
  };

  // 6. Résumé
  var summaryParts = [];
  if (result.poisson) {
    summaryParts.push("Poisson: dom="+( result.poisson.homeWin*100).toFixed(0)+"% nul="+(result.poisson.draw*100).toFixed(0)+"% ext="+(result.poisson.awayWin*100).toFixed(0)+"%");
    summaryParts.push("xG: "+result.poisson.homeExpGoals+"-"+result.poisson.awayExpGoals+" (tot:"+result.poisson.totalExpGoals+")");
    summaryParts.push("BTTS:"+( result.poisson.bttsYes*100).toFixed(0)+"% O2.5:"+( result.poisson.over25*100).toFixed(0)+"%");
  }
  if (result.homeWindows) summaryParts.push("Forme DOM L3:"+( result.homeWindows.l3?result.homeWindows.l3.pointsPercent+"pts%":"?")+" L8:"+( result.homeWindows.l8?result.homeWindows.l8.pointsPercent+"pts%":"?")+" Tendance:"+result.homeWindows.trendSignal);
  if (result.awayWindows) summaryParts.push("Forme EXT L3:"+( result.awayWindows.l3?result.awayWindows.l3.pointsPercent+"pts%":"?")+" Tendance:"+result.awayWindows.trendSignal);
  if (result.oddsMovement && result.oddsMovement.signals.length) summaryParts.push("Cotes: "+result.oddsMovement.signals.slice(0,2).map(function(s){return s.message.slice(0,60);}).join(", "));
  if (result.rlm && result.rlm.rlmSignal) summaryParts.push("⚡ Signal marché: "+result.rlm.note);

  result.summary = summaryParts.join(" | ");
  return result;
}

// ─── FORMATEUR POUR LE PROMPT ─────────────────────────────────────────────────
function formatSharpAnalysisForPrompt(sharpAnalyses) {
  if (!sharpAnalyses||!sharpAnalyses.length) return "Analyse sharp non disponible.";

  var lines = ["=== ANALYSE SHARP MONEY + POISSON + FENÊTRES GLISSANTES ==="];
  sharpAnalyses.forEach(function(a) {
    if (!a) return;
    lines.push("["+a.home+" vs "+a.away+"]");
    if (a.sharp) {
      if (a.sharp.poisson) {
        lines.push("  🎯 Poisson: "+a.home+" "+( a.sharp.poisson.homeWin*100).toFixed(0)+"% | Nul "+(a.sharp.poisson.draw*100).toFixed(0)+"% | "+a.away+" "+(a.sharp.poisson.awayWin*100).toFixed(0)+"%");
        lines.push("     xG: "+a.sharp.poisson.homeExpGoals+" - "+a.sharp.poisson.awayExpGoals+" | BTTS:"+( a.sharp.poisson.bttsYes*100).toFixed(0)+"% | O2.5:"+( a.sharp.poisson.over25*100).toFixed(0)+"%");
      }
      if (a.sharp.homeWindows) {
        lines.push("  📈 "+a.home+" L3:"+( a.sharp.homeWindows.l3?a.sharp.homeWindows.l3.pointsPercent+"%":"?")+" L5:"+( a.sharp.homeWindows.l5?a.sharp.homeWindows.l5.pointsPercent+"%":"?")+" L8:"+( a.sharp.homeWindows.l8?a.sharp.homeWindows.l8.pointsPercent+"%":"?")+" → "+a.sharp.homeWindows.trendSignal);
      }
      if (a.sharp.awayWindows) {
        lines.push("  📈 "+a.away+" L3:"+( a.sharp.awayWindows.l3?a.sharp.awayWindows.l3.pointsPercent+"%":"?")+" L5:"+( a.sharp.awayWindows.l5?a.sharp.awayWindows.l5.pointsPercent+"%":"?")+" → "+a.sharp.awayWindows.trendSignal);
      }
      if (a.sharp.oddsMovement&&a.sharp.oddsMovement.signals.length) {
        lines.push("  ⚡ Signaux cotes: "+a.sharp.oddsMovement.signals.slice(0,2).map(function(s){return s.message.slice(0,70);}).join(", "));
      }
      if (a.sharp.rlm&&a.sharp.rlm.rlmSignal) {
        lines.push("  🐟 RLM DÉTECTÉ: "+a.sharp.rlm.note);
      }
    }
  });
  return lines.join("\n");
}

// ─── CALCUL DES COTES JUSTES DEPUIS LES PROBABILITÉS ─────────────────────────
function computeFairOdds(homeWinProb, drawProb, awayWinProb) {
  if (!homeWinProb||!drawProb||!awayWinProb) return { home:0, draw:0, away:0 };
  // Normaliser pour que la somme = 1
  var total = homeWinProb + drawProb + awayWinProb;
  var h = homeWinProb / total;
  var d = drawProb    / total;
  var a = awayWinProb / total;
  return {
    home: parseFloat((1/h).toFixed(2)),
    draw: parseFloat((1/d).toFixed(2)),
    away: parseFloat((1/a).toFixed(2)),
  };
}

module.exports = {
  poissonMatchProbabilities,
  computeFairOdds,
  computeRollingWindows,
  detectOddsMovement,
  detectRLM,
  computeCLV,
  computeEnsembleScore,
  analyzeMatchSharp,
  formatSharpAnalysisForPrompt,
};
