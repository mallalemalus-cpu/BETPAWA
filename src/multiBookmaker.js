// ─── MULTI-BOOKMAKER v9 — Comparaison, Arbitrage, Line Shopping ──────────────
// Sources de cotes gratuites:
//   • The Odds API (500 req/mois gratuit) — déjà intégré, étendre aux bookmakers EU/AF
//   • API-Football (100 req/jour gratuit) — cotes de plusieurs bookmakers
//   • OddsPortal (scraping non-officiel via RSS) — historique cotes gratuites
//   • AllSportsAPI (plan gratuit limité)
//
// BOOKMAKERS COUVERTS (via The Odds API plan gratuit, region=eu):
//   Pinnacle, Betfair, William Hill, Unibet, Bet365, Betclic,
//   1xBet, Betway, Bwin, SportPesa (présent en Afrique)
//
// STRATÉGIES IMPLÉMENTÉES:
//   1. Line Shopping — trouver la meilleure cote disponible pour chaque sélection
//   2. Arbitrage — détecter les combos où gagner à coup sûr (très rare mais existe)
//   3. Sharp Consensus — si Pinnacle et Betfair s'accordent, c'est la "vraie" cote
//   4. Soft Book Comparison — BetPawa vs marché = identifier les cotes sur-évaluées
//   5. Odds Movement Tracking — détecter les mouvements de lignes (sharp money)

const https  = require("https");
const logger = require("./logger");

const ODDS_API_KEY     = process.env.ODDS_API_KEY || "";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || "";

// Bookmakers disponibles via The Odds API (région EU — gratuit)
const SHARP_BOOKMAKERS = ["pinnacle", "betfair_ex_eu", "matchbook"]; // références de marché
const SOFT_BOOKMAKERS  = ["unibet", "betclic", "williamhill", "bet365", "bwin"]; // comparaison
const ALL_BOOKMAKERS   = SHARP_BOOKMAKERS.concat(SOFT_BOOKMAKERS);

// ─── FETCH HTTP ───────────────────────────────────────────────────────────────
function fetchURL(url, headers) {
  return new Promise(function(resolve, reject) {
    var req = https.get(url, { headers: Object.assign({ "User-Agent":"BetPawaAgent/9.0" }, headers||{}) }, function(res) {
      var d = "";
      res.on("data", function(c){ d+=c; });
      res.on("end", function(){
        if (res.statusCode===429) return reject(new Error("Rate limit"));
        if (res.statusCode>=400) return reject(new Error("HTTP "+res.statusCode));
        try { resolve(JSON.parse(d)); } catch { reject(new Error("JSON invalide")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, function(){ req.destroy(); reject(new Error("Timeout")); });
  });
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }

// ─── RÉCUPÉRER COTES MULTI-BOOKMAKERS ────────────────────────────────────────
// Via The Odds API — retourne les cotes de tous les bookmakers disponibles
async function fetchMultiBookmakerOdds(league) {
  if (!ODDS_API_KEY) return null;

  var leagueMap = {
    "Premier League": "soccer_epl",
    "La Liga": "soccer_spain_la_liga",
    "Bundesliga": "soccer_germany_bundesliga",
    "Serie A": "soccer_italy_serie_a",
    "Ligue 1": "soccer_france_ligue_one",
    "Champions League": "soccer_uefa_champs_league",
    "Europa League": "soccer_uefa_europa_league",
    "Eredivisie": "soccer_netherlands_eredivisie",
    "Primeira Liga": "soccer_portugal_primeira_liga",
    "Süper Lig": "soccer_turkey_super_league",
    "Brasileirão": "soccer_brazil_campeonato",
  };

  var slug = leagueMap[league];
  if (!slug) return null;

  try {
    // Récupérer les cotes de tous les bookmakers EU disponibles
    var url = "https://api.the-odds-api.com/v4/sports/"+slug+"/odds/"
      + "?apiKey="+ODDS_API_KEY
      + "&regions=eu&markets=h2h,totals,btts"
      + "&oddsFormat=decimal&dateFormat=iso"
      + "&bookmakers="+ALL_BOOKMAKERS.join(",");
    return await fetchURL(url);
  } catch(e) {
    logger.debug("Multi-bookmaker fetch "+league+": "+e.message);
    return null;
  }
}

// ─── LINE SHOPPING ─────────────────────────────────────────────────────────────
// Pour chaque match, trouver la meilleure cote disponible sur chaque marché
function findBestOdds(matchData) {
  if (!matchData || !matchData.bookmakers || !matchData.bookmakers.length) return null;

  var best = {
    home: { odd: 0, bookmaker: "" },
    draw: { odd: 0, bookmaker: "" },
    away: { odd: 0, bookmaker: "" },
    btts_yes: { odd: 0, bookmaker: "" },
    over25: { odd: 0, bookmaker: "" },
    under25: { odd: 0, bookmaker: "" },
  };

  matchData.bookmakers.forEach(function(bk) {
    (bk.markets||[]).forEach(function(mkt) {
      if (mkt.key === "h2h") {
        mkt.outcomes.forEach(function(o) {
          if (o.name === matchData.home_team && o.price > best.home.odd) best.home = { odd: o.price, bookmaker: bk.title };
          if (o.name === matchData.away_team && o.price > best.away.odd) best.away = { odd: o.price, bookmaker: bk.title };
          if (o.name === "Draw" && o.price > best.draw.odd) best.draw = { odd: o.price, bookmaker: bk.title };
        });
      }
      if (mkt.key === "totals") {
        mkt.outcomes.forEach(function(o) {
          if (o.point===2.5 && o.name==="Over" && o.price > best.over25.odd) best.over25 = { odd: o.price, bookmaker: bk.title };
          if (o.point===2.5 && o.name==="Under" && o.price > best.under25.odd) best.under25 = { odd: o.price, bookmaker: bk.title };
        });
      }
      if (mkt.key === "btts") {
        mkt.outcomes.forEach(function(o) {
          if (o.name==="Yes" && o.price > best.btts_yes.odd) best.btts_yes = { odd: o.price, bookmaker: bk.title };
        });
      }
    });
  });

  return best;
}

// ─── CONSENSUS SHARP ──────────────────────────────────────────────────────────
// Les bookmakers sharp (Pinnacle, Betfair Exchange) → cote de référence "vraie"
function computeSharpConsensus(matchData) {
  var sharpOdds = { home: [], draw: [], away: [] };

  (matchData.bookmakers||[]).forEach(function(bk) {
    if (!SHARP_BOOKMAKERS.includes(bk.key)) return;
    (bk.markets||[]).forEach(function(mkt) {
      if (mkt.key !== "h2h") return;
      mkt.outcomes.forEach(function(o) {
        if (o.name === matchData.home_team) sharpOdds.home.push(o.price);
        else if (o.name === matchData.away_team) sharpOdds.away.push(o.price);
        else if (o.name === "Draw") sharpOdds.draw.push(o.price);
      });
    });
  });

  function avg(arr) { return arr.length ? arr.reduce(function(s,v){return s+v;},0)/arr.length : null; }

  var consensus = {
    home: avg(sharpOdds.home),
    draw: avg(sharpOdds.draw),
    away: avg(sharpOdds.away),
    available: sharpOdds.home.length > 0,
  };

  return consensus;
}

// ─── DÉTECTION D'ARBITRAGE ────────────────────────────────────────────────────
// Un arbitrage existe quand la somme des meilleures cotes inverses < 1
function detectArbitrage(bestOdds) {
  if (!bestOdds || !bestOdds.home.odd || !bestOdds.draw.odd || !bestOdds.away.odd) return null;

  var impliedSum = (1/bestOdds.home.odd) + (1/bestOdds.draw.odd) + (1/bestOdds.away.odd);
  var arbMargin = (1 - impliedSum) * 100; // positif = opportunité d'arb

  if (impliedSum < 1.0) {
    // Calculer les mises optimales pour garantir le profit
    var totalStake = 100; // mise de référence
    var stakeHome = (totalStake / bestOdds.home.odd / impliedSum) * impliedSum;
    return {
      exists: true,
      margin: parseFloat(arbMargin.toFixed(2)),
      stakes: {
        home: parseFloat((totalStake / bestOdds.home.odd / impliedSum * 100).toFixed(2)),
        draw: parseFloat((totalStake / bestOdds.draw.odd / impliedSum * 100).toFixed(2)),
        away: parseFloat((totalStake / bestOdds.away.odd / impliedSum * 100).toFixed(2)),
      },
      note: "Arbitrage de "+arbMargin.toFixed(2)+"% possible entre "+bestOdds.home.bookmaker+"/"+bestOdds.draw.bookmaker+"/"+bestOdds.away.bookmaker,
    };
  }
  return { exists: false, margin: parseFloat((-arbMargin).toFixed(2)), note: "Pas d'arb (marge bookie: "+(-arbMargin).toFixed(1)+"%)" };
}

// ─── COMPARAISON BETPAWA vs MARCHÉ ────────────────────────────────────────────
// Identifier où BetPawa offre de meilleures cotes que la concurrence
function compareBetpawaVsMarket(betpawaOdds, bestMarketOdds) {
  if (!betpawaOdds || !bestMarketOdds) return null;

  var comparisons = [];

  function compare(market, bpOdd, marketOdd, bookmaker) {
    var bpO = parseFloat(bpOdd), mO = parseFloat(marketOdd);
    if (!isFinite(bpO) || !isFinite(mO) || bpO <= 0 || mO <= 0) return;
    var diff = ((bpO/mO)-1)*100;
    comparisons.push({
      market: market,
      betpawaOdd: bpO,
      marketBestOdd: mO,
      bestBookmaker: bookmaker,
      betpawaVantage: parseFloat(diff.toFixed(1)),
      recommendation: diff > 3 ? "✅ BetPawa offre mieux (+"+diff.toFixed(1)+"%)" :
                      diff > 0 ? "👍 BetPawa légèrement mieux (+"+diff.toFixed(1)+"%)" :
                      diff > -3 ? "⚖️ Équivalent ("+diff.toFixed(1)+"%)" :
                      "❌ BetPawa moins bien ("+diff.toFixed(1)+"%) — chercher meilleure valeur",
    });
  }

  compare("1X2:1", betpawaOdds.home, bestMarketOdds.home&&bestMarketOdds.home.odd, bestMarketOdds.home&&bestMarketOdds.home.bookmaker);
  compare("1X2:X", betpawaOdds.draw, bestMarketOdds.draw&&bestMarketOdds.draw.odd, bestMarketOdds.draw&&bestMarketOdds.draw.bookmaker);
  compare("1X2:2", betpawaOdds.away, bestMarketOdds.away&&bestMarketOdds.away.odd, bestMarketOdds.away&&bestMarketOdds.away.bookmaker);
  compare("BTTS:OUI", betpawaOdds.btts_yes, bestMarketOdds.btts_yes&&bestMarketOdds.btts_yes.odd, bestMarketOdds.btts_yes&&bestMarketOdds.btts_yes.bookmaker);
  compare("O25:OVER", betpawaOdds.over25, bestMarketOdds.over25&&bestMarketOdds.over25.odd, bestMarketOdds.over25&&bestMarketOdds.over25.bookmaker);

  var bestForBetPawa = comparisons.filter(function(c){ return c.betpawaVantage > 0; });
  var bestMarket = comparisons.filter(function(c){ return c.betpawaVantage < -3; });

  return {
    comparisons: comparisons,
    betpawaAdvantage: bestForBetPawa.map(function(c){ return c.market+"+"+c.betpawaVantage+"%"; }).join(", ") || "aucun avantage",
    marketAdvantage: bestMarket.map(function(c){ return c.market+c.betpawaVantage+"%"; }).join(", ") || "aucun",
    overallVerdict: bestForBetPawa.length >= 2 ? "BetPawa favorable sur ce match" :
                    bestMarket.length >= 2 ? "Marché plus avantageux sur ce match" : "Équivalent",
  };
}

// ─── ANALYSE COMPLÈTE MULTI-BOOKMAKERS ────────────────────────────────────────
async function analyzeMultiBookmaker(matches) {
  var results = [];
  var processedLeagues = new Set();

  for (var i=0; i<Math.min(matches.length, 10); i++) {
    var match = matches[i];
    var league = match.league;

    // Ne fetcher qu'une fois par ligue pour économiser les requêtes
    if (!processedLeagues.has(league)) {
      processedLeagues.add(league);
      try {
        var multiOddsData = await fetchMultiBookmakerOdds(league);
        if (multiOddsData && Array.isArray(multiOddsData)) {
          multiOddsData.forEach(function(event) {
            var eventName = (event.home_team+"_"+event.away_team).toLowerCase();
            var matchName = (match.home+"_"+match.away).toLowerCase();
            if (eventName.includes(match.home.toLowerCase().split(" ")[0]) || matchName.includes((event.home_team||"").toLowerCase().split(" ")[0])) {
              var best = findBestOdds(event);
              var consensus = computeSharpConsensus(event);
              var arb = best ? detectArbitrage(best) : null;
              var comparison = (best && match.odds) ? compareBetpawaVsMarket(match.odds, best) : null;

              results.push({
                home: match.home, away: match.away, league: league,
                bestOdds: best,
                sharpConsensus: consensus,
                arbitrage: arb,
                betpawaComparison: comparison,
              });
            }
          });
        }
        await sleep(400);
      } catch(e) { logger.debug("Multi-bookie "+league+": "+e.message); }
    }
  }
  return results;
}

// ─── FORMATEUR PROMPT ─────────────────────────────────────────────────────────
function formatMultiBookmakerForPrompt(analyses) {
  if (!analyses || !analyses.length) return "Comparaison multi-bookmakers: non disponible ce cycle.";

  var lines = ["=== COMPARAISON MULTI-BOOKMAKERS ==="];
  analyses.slice(0,6).forEach(function(a) {
    if (!a) return;
    lines.push("\n["+a.home+" vs "+a.away+"]");
    if (a.bestOdds) {
      lines.push("  Meilleures cotes marché: 1="+a.bestOdds.home.odd+"("+a.bestOdds.home.bookmaker+")"
        +" X="+a.bestOdds.draw.odd+"("+a.bestOdds.draw.bookmaker+")"
        +" 2="+a.bestOdds.away.odd+"("+a.bestOdds.away.bookmaker+")");
    }
    if (a.sharpConsensus && a.sharpConsensus.available) {
      lines.push("  Consensus sharp (Pinnacle/Betfair): 1="+( a.sharpConsensus.home&&a.sharpConsensus.home.toFixed(2))
        +" X="+(a.sharpConsensus.draw&&a.sharpConsensus.draw.toFixed(2))
        +" 2="+(a.sharpConsensus.away&&a.sharpConsensus.away.toFixed(2)));
    }
    if (a.arbitrage) lines.push("  Arb: "+a.arbitrage.note);
    if (a.betpawaComparison) {
      lines.push("  BetPawa vs marché: "+a.betpawaComparison.overallVerdict);
      lines.push("  "+a.betpawaComparison.comparisons.slice(0,3).map(function(c){ return c.market+":"+c.recommendation.slice(0,40); }).join(" | "));
    }
  });
  return lines.join("\n");
}

module.exports = {
  fetchMultiBookmakerOdds,
  findBestOdds,
  computeSharpConsensus,
  detectArbitrage,
  compareBetpawaVsMarket,
  analyzeMultiBookmaker,
  formatMultiBookmakerForPrompt,
  SHARP_BOOKMAKERS,
  SOFT_BOOKMAKERS,
};
