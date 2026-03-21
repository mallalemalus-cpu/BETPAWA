// ─── BETPAWA MARKETS v9 — Catalogue complet betpawa.cm ───────────────────────
// Source: https://www.betpawa.cm/rules (page officielle des règles)
// Tous les marchés disponibles sur BetPawa Cameroun — FOOTBALL UNIQUEMENT
//
// MARCHÉS OMIS DANS LES VERSIONS PRÉCÉDENTES:
//   • Score exact (Correct Score)                     → très haute cote, EV difficile
//   • Mi-temps / Temps plein (HT/FT)                  → 9 combinaisons
//   • Premier/Dernier/À tout moment buteur             → nécessite stats joueurs
//   • Première équipe à marquer                        → plus simple que 1er buteur
//   • Cage inviolée domicile/extérieur (Clean Sheet)   → excellent avec bon défense
//   • Corners Over/Under (8.5, 9.5, 10.5, 11.5)       → marché sous-analysé
//   • Handicap corners 2-way                           → opportunité d'edge
//   • Cartons: 1X2, Over/Under, Exact                  → derbies physiques
//   • Handicap asiatique 2-way (Asian Handicap)        → élimine le nul
//   • Handicap européen 3-way                          → avec nul comme option
//   • O/U buts domicile seul / extérieur seul          → spécifique à une équipe
//   • Nombre exact de buts total                       → haute variance, haute cote
//   • Résultat 2e mi-temps                             → différent du FT
//   • Paiement anticipé (2 buts d'avance)              → fonctionnalité cashout

// ─── CATALOGUE COMPLET DES MARCHÉS ───────────────────────────────────────────
const BETPAWA_MARKETS_FULL = {

  // ── MARCHÉS RÉSULTAT ────────────────────────────────────────────────────────
  "1X2": {
    label: "Résultat final (Match Nul autorisé)",
    outcomes: ["1","X","2"],
    periods: ["FT","1H","2H"],
    vigTypical: 0.062,
    complexity: "simple",
    predictability: "haute",
    notes: "Marché le plus populaire. 1=domicile X=nul 2=extérieur. Temps réglementaire seulement.",
  },
  "DC": {
    label: "Double Chance",
    outcomes: ["1X","12","X2"],
    periods: ["FT"],
    vigTypical: 0.040,
    complexity: "simple",
    predictability: "très haute",
    notes: "Moins de vig que 1X2. 1X=domicile ou nul, 12=l'un des deux gagne, X2=nul ou extérieur.",
  },
  "DRAW_NO_BET": {
    label: "Remboursé si nul (Draw No Bet)",
    outcomes: ["1","2"],
    periods: ["FT"],
    vigTypical: 0.035,
    complexity: "simple",
    predictability: "haute",
    notes: "Si nul → remboursement. Moins de vig. Excellent pour favoris modérés.",
  },
  "AH": {
    label: "Handicap Asiatique 2-way",
    outcomes: ["1","2"],
    periods: ["FT","1H"],
    vigTypical: 0.030, // LE PLUS BAS — meilleur rapport qualité/vig
    complexity: "avancé",
    predictability: "haute",
    notes: "Élimine le nul. Vig la plus basse (2-4%). Les pros l'utilisent le plus. " +
           "Ex: -1.5 = l'équipe doit gagner de 2+ buts. +0.5 = gagner ou nul.",
    lines: [-2.5, -2.0, -1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0, 2.5],
  },
  "EH": {
    label: "Handicap Européen 3-way",
    outcomes: ["1","X","2"],
    periods: ["FT","1H","2H"],
    vigTypical: 0.055,
    complexity: "intermédiaire",
    predictability: "haute",
    notes: "Version avec nul inclus. Ex: +1 = résultat + 1 but pour l'outsider.",
    lines: [-2, -1, 0, 1, 2],
  },

  // ── MARCHÉS BUTS ─────────────────────────────────────────────────────────────
  "O15": {
    label: "Plus/Moins de 1.5 buts",
    outcomes: ["OVER","UNDER"],
    periods: ["FT","2H"],
    vigTypical: 0.042,
    complexity: "simple",
    predictability: "très haute",
    notes: "OVER 1.5 = 2+ buts. Probabilité ~75-80% dans la majorité des matchs.",
  },
  "O25": {
    label: "Plus/Moins de 2.5 buts",
    outcomes: ["OVER","UNDER"],
    periods: ["FT","1H","2H"],
    vigTypical: 0.045,
    complexity: "simple",
    predictability: "haute",
    notes: "Marché de référence. ~52% de matchs terminent Over 2.5.",
  },
  "O35": {
    label: "Plus/Moins de 3.5 buts",
    outcomes: ["OVER","UNDER"],
    periods: ["FT"],
    vigTypical: 0.048,
    complexity: "simple",
    predictability: "haute",
    notes: "~30% des matchs. Excellent pour équipes très offensives.",
  },
  "O45": {
    label: "Plus/Moins de 4.5 buts",
    outcomes: ["OVER","UNDER"],
    periods: ["FT"],
    vigTypical: 0.052,
    complexity: "intermédiaire",
    predictability: "moyenne",
    notes: "~15% des matchs. Cotes attractives mais variance élevée.",
  },
  "HO": {
    label: "Buts domicile Over/Under",
    outcomes: ["OVER","UNDER"],
    periods: ["FT"],
    vigTypical: 0.055,
    lines: [0.5, 1.5, 2.5],
    complexity: "intermédiaire",
    predictability: "haute",
    notes: "Spécifique à l'équipe domicile. Moins de public analysis → plus d'inefficiences.",
  },
  "AO": {
    label: "Buts extérieur Over/Under",
    outcomes: ["OVER","UNDER"],
    periods: ["FT"],
    vigTypical: 0.055,
    lines: [0.5, 1.5, 2.5],
    complexity: "intermédiaire",
    predictability: "haute",
    notes: "Spécifique à l'équipe extérieure. Même logique que HO.",
  },
  "EXACT_GOALS": {
    label: "Nombre exact de buts",
    outcomes: ["0","1","2","3","4","5+"],
    periods: ["FT"],
    vigTypical: 0.080,
    complexity: "avancé",
    predictability: "basse",
    notes: "Haute cote, haute variance. Modèle Poisson recommandé. 0 buts ~8%, 1 but ~17%, 2 buts ~21%.",
  },
  "BTTS": {
    label: "Les deux équipes marquent",
    outcomes: ["OUI","NON"],
    periods: ["FT"],
    vigTypical: 0.050,
    complexity: "simple",
    predictability: "haute",
    notes: "OUI ~53% en moyenne. Plus intéressant sur matchs offensifs ou derbies.",
  },

  // ── MARCHÉS MI-TEMPS ─────────────────────────────────────────────────────────
  "1H_1X2": {
    label: "Résultat mi-temps",
    outcomes: ["1","X","2"],
    periods: ["1H"],
    vigTypical: 0.075,
    complexity: "intermédiaire",
    predictability: "moyenne",
    notes: "Nul à la mi-temps ~40-45%. Bon pour équipes qui démarrent fort.",
  },
  "2H_1X2": {
    label: "Résultat 2e mi-temps",
    outcomes: ["1","X","2"],
    periods: ["2H"],
    vigTypical: 0.075,
    complexity: "intermédiaire",
    predictability: "moyenne",
    notes: "Différent du résultat FT. Équipes qui reviennent bien en 2e mi-temps.",
  },
  "HT_FT": {
    label: "Mi-temps / Temps plein (Double résultat)",
    outcomes: ["1/1","1/X","1/2","X/1","X/X","X/2","2/1","2/X","2/2"],
    periods: ["FT"],
    vigTypical: 0.095,
    complexity: "expert",
    predictability: "basse",
    notes: "9 combinaisons. Cotes très élevées. Excellent pour 1/1 (favori mène et gagne) ou X/1 (retournement).",
  },

  // ── MARCHÉS BUTEURS ───────────────────────────────────────────────────────────
  "FIRST_SCORER_TEAM": {
    label: "Première équipe à marquer",
    outcomes: ["1","2","NO_GOAL"],
    periods: ["FT"],
    vigTypical: 0.060,
    complexity: "simple",
    predictability: "haute",
    notes: "Plus simple que le 1er buteur individuel. L'équipe à domicile marque en premier ~55%.",
  },
  "CLEAN_SHEET_HOME": {
    label: "Cage inviolée domicile",
    outcomes: ["OUI","NON"],
    periods: ["FT"],
    vigTypical: 0.055,
    complexity: "simple",
    predictability: "haute",
    notes: "L'équipe domicile ne concède pas. ~40-45% pour les équipes défensives solides.",
  },
  "CLEAN_SHEET_AWAY": {
    label: "Cage inviolée extérieur",
    outcomes: ["OUI","NON"],
    periods: ["FT"],
    vigTypical: 0.055,
    complexity: "simple",
    predictability: "haute",
    notes: "L'équipe extérieure ne concède pas. ~30-35%. Bon pour grandes équipes déplacement.",
  },

  // ── MARCHÉS CORNERS ───────────────────────────────────────────────────────────
  "CORNERS_OU": {
    label: "Corners Over/Under",
    outcomes: ["OVER","UNDER"],
    periods: ["FT","1H"],
    vigTypical: 0.048,
    lines: [7.5, 8.5, 9.5, 10.5, 11.5, 12.5],
    complexity: "avancé",
    predictability: "haute",
    notes: "Marché SOUS-ANALYSÉ par le public → plus d'inefficiences. " +
           "Dépend du style de jeu (attaque par les côtés) et de la qualité défensive adverse.",
  },
  "CORNERS_AH": {
    label: "Handicap corners 2-way",
    outcomes: ["1","2"],
    periods: ["FT","1H"],
    vigTypical: 0.038,
    complexity: "avancé",
    predictability: "haute",
    notes: "Vig très basse. Quelle équipe obtient le plus de corners? L'équipe qui attaque plus.",
  },

  // ── MARCHÉS CARTONS ───────────────────────────────────────────────────────────
  "BOOKINGS_1X2": {
    label: "Équipe avec le plus de cartons",
    outcomes: ["1","X","2"],
    periods: ["FT"],
    vigTypical: 0.065,
    complexity: "avancé",
    predictability: "moyenne",
    notes: "Dépend de l'historique disciplinaire et de la réputation de l'arbitre.",
  },
  "BOOKINGS_OU": {
    label: "Nombre de cartons Over/Under",
    outcomes: ["OVER","UNDER"],
    periods: ["FT"],
    vigTypical: 0.058,
    lines: [2.5, 3.5, 4.5, 5.5],
    complexity: "avancé",
    predictability: "moyenne",
    notes: "Derbies et matchs à fort enjeu → plus de cartons. Stats arbitre = clé.",
  },
  "BOOKINGS_EXACT": {
    label: "Nombre exact de cartons",
    outcomes: ["0","1","2","3","4","5+"],
    periods: ["FT"],
    vigTypical: 0.085,
    complexity: "expert",
    predictability: "basse",
    notes: "Haute variance, haute cote. Jeu de niche pour spécialistes.",
  },

  // ── MARCHÉS SCORE EXACT ───────────────────────────────────────────────────────
  "CORRECT_SCORE": {
    label: "Score exact",
    outcomes: ["0-0","1-0","0-1","1-1","2-0","0-2","2-1","1-2","2-2","3-0","0-3","3-1","1-3","other"],
    periods: ["FT"],
    vigTypical: 0.120,
    complexity: "expert",
    predictability: "très basse",
    notes: "Très haute vig. Modèle Poisson peut donner un edge. Scores les plus probables: 1-0(~14%), 1-1(~11%), 2-1(~10%).",
  },
};

// ─── MARCHÉS RECOMMANDÉS PAR PROFIL D'AGENT ──────────────────────────────────
// Classés par rapport efficacité/vig/prédictibilité pour l'intervalle 30-400
const AGENT_MARKET_PRIORITIES = {
  // PRIORITÉ 1: Meilleur rapport vig/prédictibilité → utiliser en priorité
  TIER1: ["AH", "DC", "DRAW_NO_BET", "CORNERS_AH", "O25", "O15", "BTTS"],
  // PRIORITÉ 2: Bon marché, vig acceptable
  TIER2: ["HO", "AO", "CLEAN_SHEET_HOME", "CLEAN_SHEET_AWAY", "FIRST_SCORER_TEAM", "1X2", "CORNERS_OU"],
  // PRIORITÉ 3: Marchés spécialisés, utiliser avec données précises
  TIER3: ["1H_1X2", "2H_1X2", "BOOKINGS_OU", "O35", "EH"],
  // ÉVITER pour combinés (vig trop haute ou variance trop grande)
  AVOID: ["CORRECT_SCORE", "HT_FT", "EXACT_GOALS", "BOOKINGS_EXACT", "BOOKINGS_1X2"],
};

// ─── MARKETS COMPATIBLES POUR LES COMBINÉS (RÈGLES BETPAWA) ─────────────────
// BetPawa Cameroun: max 60 sélections par ticket
// Certains marchés sont corrélés → attention aux "correlated parlays"
const CORRELATED_MARKETS = [
  // Ces paires sont fortement corrélées → le bookmaker peut les refuser ou c'est mathématiquement douteux
  ["1X2", "DC"],          // DC est un sous-ensemble de 1X2 → trop corrélé sur même match
  ["BTTS", "O15"],        // BTTS OUI implique souvent O15 OVER
  ["O25", "BTTS"],        // partiellement corrélé
  ["1H_1X2", "1X2"],      // résultat mi-temps corrélé au résultat final
];

// ─── VÉRIFICATION DE LA COHÉRENCE D'UN TICKET ────────────────────────────────
function validateMarketCombination(selections) {
  var warnings = [];

  // Vérifier si le marché existe dans le catalogue BetPawa
  selections.forEach(function(sel) {
    var mktDef = BETPAWA_MARKETS_FULL[sel.market];
    if (!mktDef) {
      warnings.push("Marché '"+sel.market+"' non reconnu sur BetPawa.cm — vérifier la disponibilité");
      return;
    }
    if (!mktDef.outcomes.includes(sel.outcome)) {
      warnings.push("Issue '"+sel.outcome+"' invalide pour "+sel.market+" sur BetPawa.cm");
    }
    // Avertir sur les marchés à haute vig
    if (mktDef.vigTypical > 0.09) {
      warnings.push("Marché "+sel.market+" ("+mktDef.label+"): vig élevée ("+Math.round(mktDef.vigTypical*100)+"%) — edge requis plus important");
    }
    // Avertir sur AVOID
    if (AGENT_MARKET_PRIORITIES.AVOID.includes(sel.market)) {
      warnings.push("Marché "+sel.market+" déconseillé pour les combinés (vig trop haute ou variance excessive)");
    }
  });

  // Vérifier les corrélations sur le même match
  var byMatch = {};
  selections.forEach(function(sel) { (byMatch[sel.matchId||sel.matchIndex||0] = byMatch[sel.matchId||sel.matchIndex||0]||[]).push(sel.market); });
  Object.keys(byMatch).forEach(function(mid) {
    var mkts = byMatch[mid];
    CORRELATED_MARKETS.forEach(function(pair) {
      if (mkts.includes(pair[0]) && mkts.includes(pair[1])) {
        warnings.push("CORRÉLATION sur même match: "+pair[0]+" + "+pair[1]+" → éviter sur le même événement");
      }
    });
  });

  return warnings;
}

// ─── CALCUL DES PROBABILITÉS RÉALISTES PAR MARCHÉ ────────────────────────────
// Basé sur les statistiques historiques de football (toutes ligues)
function getMarketBaseProbabilities(market, outcome, matchStrength) {
  // matchStrength: { homeAttack, homeDefense, awayAttack, awayDefense } (normalisé 0.5-2.0)
  var base = 0.5;
  switch(market) {
    case "O25":
      var xg = (matchStrength.homeAttack||1.5) + (matchStrength.awayAttack||1.1);
      base = outcome==="OVER" ? Math.min(0.85, Math.max(0.30, xg/4.5)) : 1-Math.min(0.85, Math.max(0.30, xg/4.5));
      break;
    case "O15":
      base = outcome==="OVER" ? 0.82 : 0.18; // ~82% des matchs ont 2+ buts
      break;
    case "O35":
      base = outcome==="OVER" ? 0.30 : 0.70;
      break;
    case "BTTS":
      base = outcome==="OUI" ? 0.53 : 0.47;
      break;
    case "CORNERS_OU":
      base = outcome==="OVER" ? 0.52 : 0.48; // très équilibré ~10 corners/match
      break;
    case "CLEAN_SHEET_HOME":
      base = outcome==="OUI" ? 0.42 : 0.58; // ~42% cage inviolée domicile
      break;
    case "CLEAN_SHEET_AWAY":
      base = outcome==="OUI" ? 0.30 : 0.70;
      break;
    case "FIRST_SCORER_TEAM":
      if (outcome==="1") base = 0.54; else if (outcome==="2") base = 0.37; else base = 0.09; // 9% = 0-0
      break;
    case "AH":
      base = 0.50; // par définition
      break;
    default:
      base = 0.50;
  }
  return Math.max(0.01, Math.min(0.99, base));
}

// ─── FORMATEUR POUR LE PROMPT ─────────────────────────────────────────────────
function formatMarketsForPrompt() {
  var lines = ["=== MARCHÉS COMPLETS BETPAWA.CM (betpawa.cm) ==="];
  lines.push("Tu DOIS former des paris UNIQUEMENT avec ces marchés disponibles sur betpawa.cm.\n");

  var tiers = [
    { name:"TIER 1 — PRIORITÉ (vig basse, haute prédictibilité)", ids: AGENT_MARKET_PRIORITIES.TIER1 },
    { name:"TIER 2 — BON MARCHÉ", ids: AGENT_MARKET_PRIORITIES.TIER2 },
    { name:"TIER 3 — MARCHÉS SPÉCIALISÉS", ids: AGENT_MARKET_PRIORITIES.TIER3 },
    { name:"ÉVITER pour combinés", ids: AGENT_MARKET_PRIORITIES.AVOID },
  ];

  tiers.forEach(function(tier) {
    lines.push("\n" + tier.name + ":");
    tier.ids.forEach(function(id) {
      var m = BETPAWA_MARKETS_FULL[id];
      if (!m) return;
      lines.push("  "+id+": "+m.label+" ("+m.outcomes.join("/")+") vig:"+Math.round(m.vigTypical*100)+"% — "+m.notes.slice(0,80));
    });
  });

  lines.push("\nPour handicap asiatique (AH), inclure 'line' (ex: -1.5, +0.5) dans la justification.");
  lines.push("Pour Over/Under avec ligne spécifique (ex: Corners 9.5), inclure la ligne dans la justification.");
  return lines.join("\n");
}

module.exports = {
  BETPAWA_MARKETS_FULL,
  AGENT_MARKET_PRIORITIES,
  CORRELATED_MARKETS,
  validateMarketCombination,
  getMarketBaseProbabilities,
  formatMarketsForPrompt,
};
