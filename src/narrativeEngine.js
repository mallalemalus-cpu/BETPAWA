// ─── NARRATIVE ENGINE v5 ─────────────────────────────────────────────────────
// Dépasse le raisonnement purement statistique pour comprendre:
//   - L'HISTOIRE humaine derrière chaque match
//   - L'ÉTAT INTÉRIEUR des équipes (pas juste des chiffres)
//   - POURQUOI un vainqueur gagne (momentum, psychologie collective, récit)
//   - POURQUOI un perdant perd (fractures, peur, désespoir, surchauffe)
//   - Les FORCES INVISIBLES qui influencent un résultat
//
// DISTINCTION FONDAMENTALE:
//   Statistique: "Arsenal a 3V 1D 1L sur les 5 derniers matchs"
//   Narratif:    "Arsenal sort d'une victoire humiliante contre Tottenham,
//                 l'équipe est dans un état d'euphorie collective, les joueurs
//                 se sentent invincibles — mais cette confiance excessive peut
//                 générer une négligence défensive fatale contre un adversaire motivé"

const logger = require("./logger");

// ─── ÉTATS ÉMOTIONNELS PROFONDS ───────────────────────────────────────────────
// Chaque équipe a un état intérieur qui transcende les statistiques
const EMOTIONAL_STATES = {
  EUPHORIE:     { id:"euphorie",     intensity:9, effect:"confiance maximale mais risque d'arrogance",       betImpact:"favorable mais surveiller sur-confiance" },
  DETERMINATION:{ id:"determination",intensity:8, effect:"focus total, discipline, envie de prouver",        betImpact:"très favorable — équipe solide psychologiquement" },
  PRESSION:     { id:"pression",     intensity:7, effect:"besoin vital de résultat, peut paralyser ou galvaniser", betImpact:"imprévisible — peut jouer de façon ultra-conservatrice" },
  RESILIENCE:   { id:"resilience",   intensity:7, effect:"équipe qui rebondit après adversité",               betImpact:"favorable — les équipes résilientes surperforment" },
  VENGEANCE:    { id:"vengeance",    intensity:8, effect:"motivation hors-norme pour effacer une humiliation",betImpact:"très favorable pour l'équipe motivée par la revanche" },
  FATIGUE:      { id:"fatigue",      intensity:6, effect:"mentale et physique, calendrier chargé",            betImpact:"défavorable — risque d'erreurs et de blessures" },
  FRACTURE:     { id:"fracture",     intensity:8, effect:"divisions internes, joueurs-entraîneur, clans",     betImpact:"très défavorable — implosion possible" },
  DEUIL:        { id:"deuil",        intensity:9, effect:"perte tragique (mort, blessure grave joueur clé)",  betImpact:"imprévisible — peut unir ou effondrer" },
  DESESPOIR:    { id:"desespoir",    intensity:9, effect:"relégation imminente, survie en jeu",               betImpact:"dangereux — équipe en mode kamikaze ou complètement effondrée" },
  APATHIE:      { id:"apathie",      intensity:4, effect:"saison déjà jouée, nothing to lose",                betImpact:"défavorable — manque d'intensité" },
  TRANSITION:   { id:"transition",   intensity:5, effect:"nouveau staff, nouvelle philosophie, adaptation",   betImpact:"incertain — dépend de la vitesse d'adaptation" },
  REVEIL:       { id:"reveil",       intensity:7, effect:"équipe qui reprend vie après une mauvaise passe",   betImpact:"favorable si confirmé par plusieurs matchs" },
};

// ─── BASE DE CONNAISSANCES CONTEXTUELLES ─────────────────────────────────────
// Ce que l'agent SAIT sur les équipes au-delà des stats
const TEAM_NARRATIVES = {
  // Angleterre
  "Manchester City":   { identity:"machine tactique de Guardiola", vulnerability:"ralentit sans Rodri/De Bruyne", strength:"jeu de position inimitable", psyche:"confiance systémique" },
  "Arsenal":           { identity:"projet de génération d'Arteta", vulnerability:"manque d'expérience en finale", strength:"pressing collectif", psyche:"peur de retomber" },
  "Liverpool":         { identity:"identité Klopp gravée dans l'ADN", vulnerability:"transition post-Klopp difficile", strength:"énergie collective", psyche:"nostalgie + renouveau" },
  "Chelsea":           { identity:"club en reconstruction permanente", vulnerability:"instabilité chronique (entraîneurs)", strength:"profondeur d'effectif", psyche:"manque d'identité" },
  "Manchester United": { identity:"géant endormi cherchant son identité", vulnerability:"irrégularité chronique", strength:"noms et histoire", psyche:"pression de l'héritage" },
  "Tottenham":         { identity:"club qui joue bien sans gagner", vulnerability:"mentalité des grands matchs", strength:"attaque rapide", psyche:"syndrome du finaliste" },
  // Espagne
  "Real Madrid":       { identity:"le club des remontadas impossibles", vulnerability:"dépendance aux vedettes", strength:"ADN de la victoire en finale", psyche:"champion ultime" },
  "Barcelona":         { identity:"identité footballistique mondiale", vulnerability:"crise financière et générationnelle", strength:"tiki-taka et académie", psyche:"restauration de l'honneur" },
  "Atletico Madrid":   { identity:"bloc compact Simeone — béton et transitions", vulnerability:"offensivement limité", strength:"mentalité de guerrier", psyche:"anti-football assumé" },
  // Allemagne
  "Bayern Munich":     { identity:"dictature footballistique bavaroise", vulnerability:"pression de devoir tout gagner", strength:"machine bien huilée", psyche:"la Bundesliga comme droit acquis" },
  "Dortmund":          { identity:"émotion, jeunesse, Westfalenstadion", vulnerability:"vendre ses meilleurs joueurs", strength:"vitesse et pressing", psyche:"toujours le second en Bundesliga" },
  // Italie
  "Inter Milan":       { identity:"bloc défensif champion d'Europe", vulnerability:"vieillissement du noyau", strength:"solidarité défensive", psyche:"retour au sommet après le chaos" },
  "AC Milan":          { identity:"club historique en renaissance", vulnerability:"irrégularité", strength:"transitions rapides", psyche:"reconstruire la grandeur" },
  "Juventus":          { identity:"la Vieille Dame — pragmatisme absolu", vulnerability:"manque de flamboyance", strength:"experience et sang-froid", psyche:"obsession de la Serie A" },
  "Napoli":            { identity:"passion napolitaine post-Maradona/Osimhen", vulnerability:"perd ses vedettes chaque été", strength:"pressing intense", psyche:"vivre dans l'héritage de 2023" },
  // France
  "PSG":               { identity:"argent, ego et contradictions", vulnerability:"vestiaire de stars ingérables", strength:"talent individuel pur", psyche:"obsession Ligue des Champions" },
  "Marseille":         { identity:"passion méditerranéenne brute", vulnerability:"instabilité institutionnelle", strength:"soutien populaire inégalé", psyche:"vivre pour le derby et l'OM" },
  "Lyon":              { identity:"club formateur qui cherche son niveau", vulnerability:"entre deux périodes", strength:"jeunes talents", psyche:"nostalgie des grandes heures" },
  "Monaco":            { identity:"club de transit des pépites mondiales", vulnerability:"vendre ses meilleurs", strength:"collectif sans ego", psyche:"formation et rebond" },
  // Derby / Rivalités
  "Rangers":           { identity:"fierté protestante, Old Firm", vulnerability:"infériorité technique vs Celtic", strength:"atmosph\u00e8re Ibrox", psyche:"identitaire et politique" },
  "Celtic":            { identity:"fierté catholique, Old Firm", vulnerability:"level en championnat domestique", strength:"Parkhead + supporters", psyche:"domination écossaise + Europe" },
  "Galatasaray":       { identity:"passion turque débordante", vulnerability:"irrégularité continentale", strength:"atmosphère Ali Sami Yen", psyche:"honneur national en derby" },
  "Fenerbahce":        { identity:"tradition et rivalité d'Istanbul", vulnerability:"instabilité entraîneur", strength:"soutien massive", psyche:"éternelle rivalité Gala" },
};

// ─── CONSTRUCTION DU RÉCIT D'UN MATCH ────────────────────────────────────────
function buildMatchNarrative(match, contextAnalysis) {
  var homeNarr = TEAM_NARRATIVES[match.home] || { identity:"équipe non cataloguée", vulnerability:"inconnue", strength:"inconnue", psyche:"neutre" };
  var awayNarr = TEAM_NARRATIVES[match.away] || { identity:"équipe non cataloguée", vulnerability:"inconnue", strength:"inconnue", psyche:"neutre" };

  // Identifier les états émotionnels
  var homeEmotions = detectEmotionalState(match.home, contextAnalysis, "home");
  var awayEmotions = detectEmotionalState(match.away, contextAnalysis, "away");

  // Construire la tension narrative
  var narrativeTension = buildNarrativeTension(match, homeNarr, awayNarr, homeEmotions, awayEmotions, contextAnalysis);

  // Identifier les forces invisibles
  var invisibleForces = identifyInvisibleForces(match, contextAnalysis, homeEmotions, awayEmotions);

  // Construire l'arc narratif complet
  var storyArc = buildStoryArc(match, homeNarr, awayNarr, homeEmotions, awayEmotions, contextAnalysis);

  // Prédiction narrative (beyond statistics)
  var narrativePrediction = buildNarrativePrediction(homeNarr, awayNarr, homeEmotions, awayEmotions, contextAnalysis);

  return {
    homeIdentity:     homeNarr,
    awayIdentity:     awayNarr,
    homeEmotionalState: homeEmotions,
    awayEmotionalState: awayEmotions,
    narrativeTension: narrativeTension,
    invisibleForces:  invisibleForces,
    storyArc:         storyArc,
    narrativePrediction: narrativePrediction,
    narrativeConfidenceBoost: computeNarrativeBoost(homeEmotions, awayEmotions, contextAnalysis),
  };
}

// ─── DÉTECTION DE L'ÉTAT ÉMOTIONNEL ─────────────────────────────────────────
function detectEmotionalState(teamName, ctx, side) {
  var states = [];
  var ec = ctx && ctx.emotionalContext && ctx.emotionalContext[side];
  var form = side==="home" ? (ctx&&ctx.homeForm) : (ctx&&ctx.awayForm);

  if (!ec) return [EMOTIONAL_STATES.APATHIE];

  // Analyse de la forme → état émotionnel
  if (form) {
    var formStr = form.last6||"";
    var wins = (formStr.match(/W/g)||[]).length;
    var losses = (formStr.match(/L/g)||[]).length;

    if (wins >= 5) states.push(EMOTIONAL_STATES.EUPHORIE);
    else if (wins >= 3) states.push(EMOTIONAL_STATES.DETERMINATION);
    if (losses >= 4) states.push(EMOTIONAL_STATES.DESESPOIR);
    else if (losses >= 2) states.push(EMOTIONAL_STATES.PRESSION);

    // Pattern W après série de L = réveil
    if (formStr.startsWith("W") && formStr.slice(1,4).includes("L")) states.push(EMOTIONAL_STATES.REVEIL);
  }

  // Contexte émotionnel déclaré
  var morale = (ec.morale||"").toLowerCase();
  if (morale.includes("élevé") || morale.includes("elevé")) {
    if (!states.find(function(s){ return s.id==="euphorie"; })) states.push(EMOTIONAL_STATES.DETERMINATION);
  }
  if (morale.includes("bas") || morale.includes("critique")) {
    if (!states.find(function(s){ return s.id==="desespoir"; })) states.push(EMOTIONAL_STATES.FRACTURE);
  }

  // Derby → vengeance ou pression
  var atmo = (ctx&&ctx.emotionalContext&&ctx.emotionalContext.atmosphere)||"";
  if (atmo.toLowerCase().includes("derby") || atmo.toLowerCase().includes("rivalité")) {
    states.push(EMOTIONAL_STATES.VENGEANCE);
    states.push(EMOTIONAL_STATES.PRESSION);
  }

  // Facteurs de pression de fin de saison
  var stakes = ctx && ctx.stakes;
  if (stakes && (stakes.urgency==="critique" || stakes.urgency==="très élevée")) {
    states.push(EMOTIONAL_STATES.DESESPOIR);
  }

  if (!states.length) states.push(EMOTIONAL_STATES.DETERMINATION);
  return states;
}

// ─── TENSION NARRATIVE ────────────────────────────────────────────────────────
function buildNarrativeTension(match, homeNarr, awayNarr, homeEmo, awayEmo, ctx) {
  var tensions = [];

  // Clash d'identités
  if (homeNarr.identity && awayNarr.identity) {
    tensions.push("Clash: ["+homeNarr.identity+"] contre ["+awayNarr.identity+"]");
  }

  // Vulnérabilité vs force
  var homeTopEmo = homeEmo[0]||EMOTIONAL_STATES.APATHIE;
  var awayTopEmo = awayEmo[0]||EMOTIONAL_STATES.APATHIE;

  if (homeTopEmo.intensity > awayTopEmo.intensity) {
    tensions.push(match.home+" portée par '"+homeTopEmo.id+"' (intensité "+homeTopEmo.intensity+"/10) face à "+match.away+" moins galvanisée");
  } else if (awayTopEmo.intensity > homeTopEmo.intensity) {
    tensions.push(match.away+" portée par '"+awayTopEmo.id+"' (intensité "+awayTopEmo.intensity+"/10) — danger extérieur sous-estimé par les cotes");
  }

  // Vulnérabilité exploitable
  if (awayNarr.vulnerability && homeEmo.find(function(e){ return e.intensity>=7; })) {
    tensions.push("Vulnérabilité de "+match.away+" ("+awayNarr.vulnerability+") potentiellement exploitable si "+match.home+" maintient son élan");
  }

  return tensions.join(" | ");
}

// ─── FORCES INVISIBLES ────────────────────────────────────────────────────────
// Ce que les stats ne voient pas
function identifyInvisibleForces(match, ctx, homeEmo, awayEmo) {
  var forces = [];

  // Force 1: Avantage psychologique de l'ADN de champion
  var homeNarr = TEAM_NARRATIVES[match.home];
  var awayNarr = TEAM_NARRATIVES[match.away];
  if (homeNarr && homeNarr.psyche.toLowerCase().includes("champion")) {
    forces.push("ADN champion: "+match.home+" sait gagner quand ça compte — les grands matchs les réveillent");
  }
  if (awayNarr && awayNarr.psyche.toLowerCase().includes("finaliste")) {
    forces.push("Syndrome du finaliste: "+match.away+" peut se bloquer au moment décisif");
  }

  // Force 2: Momentum collectif (impossible à quantifier)
  var hasEuphorie = homeEmo.find(function(e){ return e.id==="euphorie"; });
  if (hasEuphorie) {
    forces.push("Momentum collectif: une équipe en euphorie génère une énergie qui dépasse la somme de ses parties — attention à la sous-estimation par les cotes");
  }

  // Force 3: L'effet "match piège"
  var stakes = ctx && ctx.stakes;
  if (stakes && stakes.level==="régulier" && (homeEmo.find(function(e){ return e.id==="apathie"; }) || awayEmo.find(function(e){ return e.id==="apathie"; }))) {
    forces.push("Match piège: enjeu faible = risque de sous-motivation — les favoris peuvent trébucher");
  }

  // Force 4: Pression de l'histoire
  var derby = ctx && ctx.emotionalContext && ctx.emotionalContext.atmosphere && ctx.emotionalContext.atmosphere.includes("derby");
  if (derby) {
    forces.push("Pression de l'histoire: dans un derby, 6 mois de préparation mentale se déroulent en 90 minutes — toutes les analyses préalables deviennent secondaires");
  }

  // Force 5: Résilience de l'adversité
  if (awayEmo.find(function(e){ return e.id==="resilience"; })) {
    forces.push("Résilience: "+match.away+" a prouvé sa capacité à performer sous pression — ne pas sous-estimer");
  }

  // Force 6: Fragilité cachée du favori
  if (homeNarr && homeNarr.vulnerability && homeEmo.find(function(e){ return e.id==="euphorie"||e.id==="determination"; })) {
    forces.push("Fragilité cachée: "+match.home+" ("+homeNarr.vulnerability+") — même les favoris ont leurs Achille");
  }

  return forces;
}

// ─── ARC NARRATIF ─────────────────────────────────────────────────────────────
// L'histoire que ce match va raconter
function buildStoryArc(match, homeNarr, awayNarr, homeEmo, awayEmo, ctx) {
  var homeTopEmo = homeEmo[0]||EMOTIONAL_STATES.DETERMINATION;
  var awayTopEmo = awayEmo[0]||EMOTIONAL_STATES.DETERMINATION;
  var stakes = ctx && ctx.stakes;

  // Identifier le type narratif du match
  var arcType = "regular";
  if (homeTopEmo.id==="vengeance" || awayTopEmo.id==="vengeance") arcType = "redemption";
  else if (homeTopEmo.id==="desespoir" || awayTopEmo.id==="desespoir") arcType = "survival";
  else if (homeTopEmo.id==="euphorie" && awayTopEmo.id==="pression") arcType = "giant_vs_challenger";
  else if (homeTopEmo.id==="fracture") arcType = "crisis";
  else if (stakes && (stakes.level==="maximum")) arcType = "epic";

  var arcDescriptions = {
    redemption:         "Match de rédemption — une équipe joue pour effacer une humiliation passée. Ces matchs transcendent la tactique.",
    survival:           "Match de survie — une équipe joue pour sa vie. L'intensité émotionnelle peut générer des performances miraculeuses ou un effondrement total.",
    giant_vs_challenger:"Le favori euphorique contre l'outsider affamé. Les cotes peuvent sous-estimer la détermination du challenger.",
    crisis:             "Un club en crise interne: les résultats deviennent imprévisibles. La cohésion est brisée.",
    epic:               "Match à enjeu maximal — tout peut arriver. L'expérience des grands matchs devient le facteur clé.",
    regular:            "Match de routine — les qualités techniques et tactiques dominent. Les stats sont plus fiables.",
  };

  return {
    type:        arcType,
    description: arcDescriptions[arcType] || arcDescriptions.regular,
    keyMoment:   buildKeyMomentPrediction(arcType, match, homeNarr, awayNarr),
  };
}

function buildKeyMomentPrediction(arcType, match, homeNarr, awayNarr) {
  var moments = {
    redemption:  "Le premier but sera décisif — s'il tombe en faveur de l'équipe motivée par la revanche, le match peut être plié rapidement",
    survival:    "L'équipe en survie jouera probablement défensivement avec un ou deux joueurs en mission — score serré très probable",
    giant_vs_challenger: "Si le challenger marque en premier, l'euphorie du favori peut se transformer en panique — surveiller le 1er but",
    crisis:      "Les erreurs individuelles seront plus fréquentes — les marchés Over/BTTS peuvent être pertinents",
    epic:        "Match qui se décide souvent sur un détail ou une erreur arbitrale — éviter les marchés de buts",
    regular:     "Logique habituelle — s'appuyer sur la forme et les stats",
  };
  return moments[arcType] || moments.regular;
}

// ─── PRÉDICTION NARRATIVE ─────────────────────────────────────────────────────
function buildNarrativePrediction(homeNarr, awayNarr, homeEmo, awayEmo, ctx) {
  var homeScore = homeEmo.reduce(function(s,e){ return s+e.intensity; }, 0);
  var awayScore = awayEmo.reduce(function(s,e){ return s+e.intensity; }, 0);

  // Considérer avantage domicile
  homeScore += 1.5;

  var diff = homeScore - awayScore;
  var narrativeEdge, marketImplication;

  if (diff > 3) {
    narrativeEdge = "domicile fort";
    marketImplication = "DC 1X ou 1X2:1 — énergie collective domicile supérieure";
  } else if (diff < -3) {
    narrativeEdge = "extérieur surprenant";
    marketImplication = "Risque pour le favori — considérer DC X2 ou 1X2:2";
  } else {
    narrativeEdge = "équilibré";
    marketImplication = "BTTS ou Over/Under selon les styles — résultat vraiment ouvert";
  }

  // Impact sur les marchés
  var homeEuphorie = homeEmo.find(function(e){ return e.id==="euphorie"||e.id==="determination"; });
  var awayDefensive = awayEmo.find(function(e){ return e.id==="pression"||e.id==="desespoir"; });

  if (homeEuphorie && awayDefensive) {
    marketImplication += " | Domicile en forme + visiteur sous pression = favorable Over 1.5";
  }

  return {
    narrativeEdge:   narrativeEdge,
    homeNarrScore:   homeScore.toFixed(1),
    awayNarrScore:   awayScore.toFixed(1),
    marketImplication: marketImplication,
    confidence:      Math.min(0.85, 0.5 + Math.abs(diff)*0.05),
  };
}

// ─── BOOST DE CONFIANCE NARRATIF ─────────────────────────────────────────────
function computeNarrativeBoost(homeEmo, awayEmo, ctx) {
  var boost = 0;
  var homeTopEmo = homeEmo[0]||EMOTIONAL_STATES.APATHIE;
  var awayTopEmo = awayEmo[0]||EMOTIONAL_STATES.APATHIE;

  // Boost positif: états émotionnels clairs et contrastés → plus prévisible
  if (homeTopEmo.intensity >= 8 && awayTopEmo.intensity <= 5) boost += 0.05;
  // Boost négatif: deux états très intenses → imprévisible
  if (homeTopEmo.intensity >= 8 && awayTopEmo.intensity >= 8) boost -= 0.08;
  // Derby: réduire la confiance
  var derby = ctx && ctx.emotionalContext && ctx.emotionalContext.atmosphere && ctx.emotionalContext.atmosphere.includes("derby");
  if (derby) boost -= 0.10;
  // Fracture interne → très imprévisible
  if (homeTopEmo.id==="fracture"||awayTopEmo.id==="fracture") boost -= 0.12;

  return boost;
}

// ─── ANALYSE CAUSALE D'UN RÉSULTAT ────────────────────────────────────────────
// Comprendre POURQUOI le gagnant a gagné et POURQUOI le perdant a perdu
// Au-delà des statistiques — la narration du match
async function analyzeMatchOutcome(bet, narrative) {
  if (!bet.selections || !bet.selections.length) return null;

  var wonSelections  = bet.selections.filter(function(s){ return s.won===true; });
  var lostSelections = bet.selections.filter(function(s){ return s.won===false; });

  // Analyse heuristique profonde
  var winReasons  = [];
  var lossReasons = [];
  var narrativeLesson = "";

  // Analyser chaque sélection gagnante
  wonSelections.forEach(function(sel) {
    var reason = deduceWinReason(sel, narrative);
    if (reason) winReasons.push(reason);
  });

  // Analyser chaque sélection perdante
  lostSelections.forEach(function(sel) {
    var reason = deduceLossReason(sel, narrative);
    if (reason) lossReasons.push(reason);
  });

  // Générer la narration globale
  if (bet.won) {
    narrativeLesson = buildWinNarrative(bet, winReasons, narrative);
  } else {
    narrativeLesson = buildLossNarrative(bet, lossReasons, narrative);
  }

  return {
    winReasons:       winReasons,
    lossReasons:      lossReasons,
    narrativeLesson:  narrativeLesson,
    understandingLevel: winReasons.length + lossReasons.length > 2 ? "profond" : "superficiel",
  };
}

function deduceWinReason(sel, narrative) {
  var reasons = {
    "1X2:1": "L'équipe à domicile a exploité son avantage psychologique et physique",
    "1X2:2": "L'équipe visiteuse a su résister à la pression du public et jouer son jeu",
    "1X2:X": "Les deux équipes ont maintenu un équilibre tactique — ni l'une ni l'autre n'a voulu prendre de risques",
    "BTTS:OUI": "Les deux équipes avaient suffisamment de motivation offensive pour se créer des occasions",
    "BTTS:NON": "Au moins une équipe a maintenu sa concentration défensive sur 90 minutes",
    "O25:OVER": "Le match s'est joué à un rythme élevé avec des équipes ouvertes offensivement",
    "O25:UNDER": "Les équipes ont privilégié la prudence — le contexte (météo/enjeu/style) a favorisé les matchs fermés",
    "O15:OVER": "Au moins deux buts marqués — le minimum de dynamisme offensif attendu était là",
    "DC:1X": "Le favori ou le nul s'est produit — la double chance a protégé contre la surprise",
  };
  var key = sel.market+":"+sel.outcome;
  return reasons[key] || "Prédiction correcte sur "+sel.market+" — contexte favorable bien identifié";
}

function deduceLossReason(sel, narrative) {
  var reasons = {
    "1X2:1": "L'équipe à domicile n'a pas confirmé sa supériorité attendue — chercher : changement de formation, absentéisme clé, attitude défensive adverse",
    "1X2:2": "L'équipe visiteuse n'a pas été la menace attendue — peut-être intimidée par l'atmosphère ou trop conservative",
    "1X2:X": "Le nul attendu ne s'est pas produit — l'un des équipes a trouvé les ressources pour faire la différence",
    "BTTS:OUI": "L'une des équipes n'a pas marqué — soit la défense adverse était organisée, soit les attaquants étaient absents/méformes",
    "BTTS:NON": "Les deux équipes ont marqué malgré nos attentes — l'une d'elles a eu une réaction inattendue",
    "O25:OVER": "Le match est resté fermé — météo, fatigue, ou tactique ultra-défensive non anticipée",
    "O25:UNDER": "Trop de buts — le match a été plus ouvert que prévu, peut-être un but rapide qui a tout déstabilisé",
  };
  var key = sel.market+":"+sel.outcome;
  return reasons[key] || "Erreur de prédiction sur "+sel.market+":"+sel.outcome+" — revoir l'analyse contextuelle pour ce type de match";
}

function buildWinNarrative(bet, reasons, narrative) {
  var base = "✅ VICTOIRE COMPRISE: Le ticket a gagné car ";
  if (reasons.length >= 2) {
    base += reasons.slice(0,2).join(". De plus, ");
  } else if (reasons.length === 1) {
    base += reasons[0];
  } else {
    base += "les conditions générales (forme, contexte, enjeux) étaient bien alignées.";
  }
  base += " Pattern à retenir pour des contextes similaires.";
  return base;
}

function buildLossNarrative(bet, reasons, narrative) {
  var base = "❌ DÉFAITE ANALYSÉE: ";
  if (reasons.length >= 2) {
    base += "Erreurs principales: (1) "+reasons[0]+" (2) "+reasons[1]+". ";
  } else if (reasons.length === 1) {
    base += reasons[0]+". ";
  }

  // Identifier la vraie nature de l'erreur
  var errorType = "";
  var hasIntegrity = bet.integrityNote && bet.integrityNote.toLowerCase().includes("risque");
  var hasWeather   = bet.weatherNote && bet.weatherNote.toLowerCase().includes("négatif");

  if (hasIntegrity) errorType = "Signal d'intégrité ignoré — à ne jamais répéter.";
  else if (hasWeather) errorType = "Impact météo sous-estimé — revoir les marchés de buts par mauvais temps.";
  else errorType = "Prédiction contextuelle imparfaite — renforcer l'analyse narrative pour ce type de match.";

  base += errorType;
  return base;
}

// ─── FORMATEUR POUR LE PROMPT PRINCIPAL ──────────────────────────────────────
function formatNarrativeForPrompt(matchNarratives) {
  if (!matchNarratives||!matchNarratives.length) return "Intelligence narrative non disponible.";

  return matchNarratives.map(function(n) {
    if (!n||!n.homeIdentity) return "";
    var lines = [];
    lines.push("[RÉCIT] "+n.homeIdentity.identity+" vs "+n.awayIdentity.identity);
    lines.push("  État émotionnel DOM: "+(n.homeEmotionalState||[]).map(function(e){ return e.id+"("+e.intensity+"/10)"; }).join(",")+
      " → "+(n.homeEmotionalState&&n.homeEmotionalState[0]?n.homeEmotionalState[0].betImpact:"?"));
    lines.push("  État émotionnel EXT: "+(n.awayEmotionalState||[]).map(function(e){ return e.id+"("+e.intensity+"/10)"; }).join(",")+
      " → "+(n.awayEmotionalState&&n.awayEmotionalState[0]?n.awayEmotionalState[0].betImpact:"?"));
    if (n.narrativeTension) lines.push("  Tension: "+n.narrativeTension);
    if (n.storyArc) lines.push("  Arc narratif: ["+n.storyArc.type+"] "+n.storyArc.description);
    if (n.storyArc&&n.storyArc.keyMoment) lines.push("  Moment clé: "+n.storyArc.keyMoment);
    if (n.invisibleForces&&n.invisibleForces.length) lines.push("  Forces invisibles: "+n.invisibleForces.slice(0,2).join(" | "));
    if (n.narrativePrediction) {
      lines.push("  Lecture narrative: ["+n.narrativePrediction.narrativeEdge+"] score DOM:"+n.narrativePrediction.homeNarrScore+" EXT:"+n.narrativePrediction.awayNarrScore);
      lines.push("  Implication marché: "+n.narrativePrediction.marketImplication);
    }
    return lines.join("\n");
  }).filter(Boolean).join("\n\n");
}

module.exports = {
  buildMatchNarrative,
  analyzeMatchOutcome,
  formatNarrativeForPrompt,
  TEAM_NARRATIVES,
  EMOTIONAL_STATES,
};
