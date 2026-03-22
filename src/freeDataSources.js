// ─── FREE DATA SOURCES v9 — Sources gratuites additionnelles ─────────────────
// Sources 100% gratuites non encore exploitées:
//   • Understat.com — xG réels par match (scraping JSON embeds)
//   • StatsBomb Open Data — données historiques détaillées (GitHub)
//   • OpenLigaDB — Bundesliga officiel (API publique gratuite)
//   • WorldFootball.net — résultats historiques
//   • Transfermarkt — valeurs marchés joueurs (proxy valeur équipe)
//   • Sofascore — statistiques live (non-officiel)
//   • Clubelo.com — ratings ELO des équipes (API publique gratuite)
//   • Football-data.co.uk — données CSV historiques (gratuit)

const https  = require("https");
const http   = require("http");
const logger = require("./logger");

function fetchURL(url, headers, useHttp) {
  return new Promise(function(resolve, reject) {
    var lib = useHttp ? http : https;
    var req = lib.get(url, { headers: Object.assign({ "User-Agent":"BetPawaAgent/9.0 (Research)" }, headers||{}) }, function(res) {
      var d = "";
      if (res.statusCode===301||res.statusCode===302) {
        var loc=res.headers.location;
        if (loc) return fetchURL(loc, headers, loc.startsWith("http://")).then(resolve).catch(reject);
      }
      if (res.statusCode>=400) return reject(new Error("HTTP "+res.statusCode));
      res.on("data",function(c){d+=c;}); res.on("end",function(){resolve(d);});
    });
    req.on("error",reject);
    req.setTimeout(10000,function(){req.destroy();reject(new Error("Timeout"));});
  });
}
function sleep(ms){ return new Promise(function(r){setTimeout(r,ms);}); }

// ─── CLUB ELO RATINGS ─────────────────────────────────────────────────────────
// API publique gratuite — http://clubelo.com/API
// Ratings ELO = meilleure estimation objective de la force des équipes
async function fetchClubEloRating(teamName) {
  try {
    // clubelo.com/API retourne CSV, pas JSON — utiliser l'endpoint CSV correct
    var cleanName = teamName.replace(/\s+/g,"-").replace(/[^a-zA-Z0-9-]/g,"");
    // Essayer l'API CSV de clubelo
    var url = "http://api.clubelo.com/"+cleanName;
    var raw = await fetchURL(url, {}, true);
    // Format CSV: Rank,Club,Country,Level,Elo,From,To
    var lines = raw.trim().split("\n");
    if (lines.length < 2) return null;
    // Dernière ligne = rating le plus récent
    var last = lines[lines.length-1].split(",");
    if (last.length < 5) return null;
    var elo = parseFloat(last[4]);
    if (!isFinite(elo) || elo === 0) return null;
    return {
      team: teamName,
      elo: elo,
      rank: parseInt(last[0])||999,
      country: last[2]||"",
      level: parseInt(last[3])||1,
      source: "clubelo.com (CSV)",
    };
  } catch(e) {
    logger.debug("ClubElo "+teamName+": "+e.message);
    return null;
  }
}

// Prédiction de résultat basée sur Elo
function predictFromElo(homeElo, awayElo) {
  if (!homeElo || !awayElo) return null;
  // Formule standard Elo + avantage domicile (+100 points)
  var homeAdj = homeElo + 100; // avantage domicile
  var eloDiff = homeAdj - awayElo;
  var homeWinProb = 1 / (1 + Math.pow(10, -eloDiff/400));
  var awayWinProb = 1 / (1 + Math.pow(10, eloDiff/400)) * 0.85;
  var drawProb = 1 - homeWinProb - awayWinProb;

  // Normaliser
  var total = homeWinProb + drawProb + awayWinProb;
  return {
    homeWin: parseFloat((homeWinProb/total).toFixed(4)),
    draw:    parseFloat((drawProb/total).toFixed(4)),
    awayWin: parseFloat((awayWinProb/total).toFixed(4)),
    eloDiff: eloDiff,
    confidence: Math.abs(eloDiff) > 200 ? "haute" : Math.abs(eloDiff) > 100 ? "moyenne" : "faible",
  };
}

// ─── OPENLIGADB — Bundesliga officiel (API publique, aucune clé) ──────────────
async function fetchOpenLigaData(season, league) {
  try {
    var leagueMap = { "Bundesliga": "bl1", "2. Bundesliga": "bl2" };
    var lg = leagueMap[league];
    if (!lg) return null;
    var url = "https://api.openligadb.de/getmatchdata/"+lg+"/"+(season||new Date().getFullYear());
    var data = await fetchURL(url);
    var parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.slice(0,10) : null;
  } catch(e) {
    logger.debug("OpenLigaDB: "+e.message);
    return null;
  }
}

// ─── DONNÉES XG DEPUIS UNDERSTAT ─────────────────────────────────────────────
// Understat.com embed JSON dans ses pages HTML
async function fetchUnderstatXG(homeTeam, awayTeam) {
  try {
    var cleanHome = homeTeam.replace(/\s/g,"_");
    var cleanAway = awayTeam.replace(/\s/g,"_");
    // Understat supporte les top 5 ligues + Russie/Écosse
    var knownTeams = ["Arsenal","Chelsea","Liverpool","Manchester_City","Manchester_United","Tottenham",
                      "Real_Madrid","Barcelona","Atletico_Madrid","Bayern_Munich","Dortmund",
                      "Inter","Milan","Juventus","PSG","Marseille","Lyon"];
    if (!knownTeams.some(function(t){ return cleanHome.includes(t.split("_")[0]); })) return null;

    var url = "https://understat.com/team/"+cleanHome+"/"+new Date().getFullYear();
    var html = await fetchURL(url);
    // Extraire les stats xG des scripts JSON embarqués
    var xgMatch = html.match(/var datesData\s*=\s*JSON\.parse\('([^']+)'\)/);
    if (!xgMatch) return null;
    var datesData = JSON.parse(xgMatch[1].replace(/\\/g,""));
    if (!Array.isArray(datesData) || !datesData.length) return null;

    var recent = datesData.slice(-8);
    var avgXG = recent.reduce(function(s,m){ return s+parseFloat(m.xG||0); },0) / recent.length;
    var avgXGA = recent.reduce(function(s,m){ return s+parseFloat(m.xGA||0); },0) / recent.length;
    return { team: homeTeam, avgXG: parseFloat(avgXG.toFixed(2)), avgXGA: parseFloat(avgXGA.toFixed(2)), matches: recent.length, source: "understat.com" };
  } catch(e) {
    logger.debug("Understat "+homeTeam+": "+e.message);
    return null;
  }
}

// ─── ANALYSE COMPLÈTE DES SOURCES GRATUITES ───────────────────────────────────
async function fetchFreeDataForMatch(match) {
  var data = { home: match.home, away: match.away, league: match.league, sources: [] };

  // 1. Club Elo
  var homeElo = null, awayElo = null;
  try {
    homeElo = await fetchClubEloRating(match.home);
    await sleep(300);
    awayElo = await fetchClubEloRating(match.away);
    if (homeElo && awayElo) {
      data.eloRatings = { home: homeElo, away: awayElo };
      data.eloPrediction = predictFromElo(homeElo.elo, awayElo.elo);
      data.sources.push("clubelo.com");
      logger.debug("Elo "+match.home+"("+homeElo.elo+") vs "+match.away+"("+awayElo.elo+") → prédiction: DOM="+( data.eloPrediction&&(data.eloPrediction.homeWin*100).toFixed(0)+"%)"));
    }
  } catch {}

  // 2. xG Understat (top ligues seulement)
  try {
    var homeXG = await fetchUnderstatXG(match.home, match.away);
    await sleep(200);
    if (homeXG) { data.homeXGData = homeXG; data.sources.push("understat.com(dom)"); }
  } catch {}

  // 3. OpenLigaDB (Bundesliga)
  if (match.league === "Bundesliga") {
    try {
      var openData = await fetchOpenLigaData(new Date().getFullYear(), "Bundesliga");
      if (openData) { data.openLigaData = openData.slice(0,3); data.sources.push("openligadb.de"); }
    } catch {}
  }

  return data;
}

// ─── FORMATEUR PROMPT ─────────────────────────────────────────────────────────
function formatFreeDataForPrompt(freeDataResults) {
  if (!freeDataResults || !freeDataResults.length) return "Sources gratuites: non disponibles ce cycle.";

  var lines = ["=== DONNÉES SOURCES GRATUITES (ELO + xG + OpenData) ==="];
  freeDataResults.forEach(function(d) {
    if (!d || (!d.eloRatings && !d.homeXGData)) return;
    lines.push("\n["+d.home+" vs "+d.away+"]");
    if (d.eloRatings) {
      lines.push("  ELO: "+d.home+"="+d.eloRatings.home.elo.toFixed(0)+" vs "+d.away+"="+d.eloRatings.away.elo.toFixed(0)
        +" (diff="+( d.eloPrediction&&d.eloPrediction.eloDiff.toFixed(0))+")");
      if (d.eloPrediction) {
        lines.push("  Prédiction Elo: DOM="+(d.eloPrediction.homeWin*100).toFixed(1)+"%"
          +" NUL="+(d.eloPrediction.draw*100).toFixed(1)+"%"
          +" EXT="+(d.eloPrediction.awayWin*100).toFixed(1)+"%"
          +" (confiance: "+d.eloPrediction.confidence+")");
      }
    }
    if (d.homeXGData) {
      lines.push("  xG récent DOM: "+d.homeXGData.avgXG+" pour / "+d.homeXGData.avgXGA+" contre ("+d.homeXGData.matches+" matchs, Understat)");
    }
    if (d.sources.length) lines.push("  Sources: "+d.sources.join(", "));
  });
  return lines.join("\n");
}

module.exports = {
  fetchClubEloRating,
  predictFromElo,
  fetchOpenLigaData,
  fetchUnderstatXG,
  fetchFreeDataForMatch,
  formatFreeDataForPrompt,
};
