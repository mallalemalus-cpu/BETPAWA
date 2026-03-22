// ─── WEB RESEARCHER v6 ────────────────────────────────────────────────────────
// Recherche internet approfondie GRATUITE pour l'agent:
//   • Flux RSS BBC Sport, ESPN, Goal.com, Sky Sports Football
//   • Actualités récentes: blessures confirmées, suspensions, transferts, crises
//   • Formations confirmées pré-match (API-Football gratuit)
//   • Analyse de sentiment des news (positive/négative pour chaque équipe)
//   • Détection de signaux faibles: déclarations entraîneur, tensions vestiaire
//   • NewsAPI.org (plan gratuit: 100 req/jour)
//
// PRINCIPE: L'agent sait MAINTENANT ce que les stats ne peuvent pas savoir:
//   "Kane absent à l'entraînement hier → probable forfait"
//   "Entraîneur du PSG a démissionné ce matin"
//   "Transfert surprise confirmé — joueur clé parti"

const https  = require("https");
const http   = require("http");
const logger = require("./logger");

const NEWS_API_KEY     = process.env.NEWS_API_KEY      || ""; // newsapi.org gratuit 100/jour
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY  || "";

// ─── HTTP HELPERS ─────────────────────────────────────────────────────────────
function fetchURL(url, headers, useHttp) {
  return new Promise(function(resolve, reject) {
    var lib = useHttp ? http : https;
    var req = lib.get(url, { headers: Object.assign({ "User-Agent": "BetPawaAgent/6.0 (Research)" }, headers||{}) }, function(res) {
      var d = "";
      // Suivre les redirections
      if (res.statusCode === 301 || res.statusCode === 302) {
        var loc = res.headers.location;
        if (loc) return fetchURL(loc, headers, loc.startsWith("http://")).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) return reject(new Error("HTTP "+res.statusCode+" for "+url));
      res.on("data", function(c){ d+=c; });
      res.on("end", function(){ resolve(d); });
    });
    req.on("error", reject);
    req.setTimeout(10000, function(){ req.destroy(); reject(new Error("Timeout: "+url)); });
  });
}

function sleep(ms) { return new Promise(function(r){ setTimeout(r,ms); }); }

// ─── PARSEUR RSS NATIF (sans librairie externe) ───────────────────────────────
function parseRSS(xmlText) {
  var items = [];
  var itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];
  itemMatches.forEach(function(item) {
    var title       = extractTag(item, "title");
    var description = extractTag(item, "description");
    var link        = extractTag(item, "link") || extractTag(item, "guid");
    var pubDate     = extractTag(item, "pubDate");
    if (title) items.push({ title: cleanText(title), description: cleanText(description||""), link: link||"", pubDate: pubDate||"" });
  });
  return items;
}

function extractTag(text, tag) {
  var match = text.match(new RegExp("<"+tag+"[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/"+tag+">")) ||
              text.match(new RegExp("<"+tag+"[^>]*>([\\s\\S]*?)<\\/"+tag+">"));
  return match ? match[1].trim() : "";
}

function cleanText(t) {
  return t.replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#\d+;/g,"").trim().slice(0,300);
}

// ─── FLUX RSS FOOTBALL GRATUITS ───────────────────────────────────────────────
const RSS_FEEDS = [
  { name:"BBC Sport Football",   url:"https://feeds.bbci.co.uk/sport/football/rss.xml" },
  { name:"Sky Sports Football",  url:"https://www.skysports.com/rss/12040" },
  { name:"Goal.com",             url:"https://www.goal.com/feeds/en/news" },
  { name:"ESPN FC",              url:"https://www.espn.com/espn/rss/soccer/news" },
  { name:"UEFA",                 url:"https://www.uefa.com/rssfeed/uefacom_en_news.xml" },
];

async function fetchRSSNews(maxItemsPerFeed) {
  maxItemsPerFeed = maxItemsPerFeed || 8;
  var allNews = [];

  for (var i=0; i<RSS_FEEDS.length; i++) {
    var feed = RSS_FEEDS[i];
    try {
      var xml = await fetchURL(feed.url);
      var items = parseRSS(xml).slice(0, maxItemsPerFeed);
      items.forEach(function(item) { item.source = feed.name; });
      allNews = allNews.concat(items);
      logger.debug("RSS "+feed.name+": "+items.length+" articles");
      await sleep(200);
    } catch(e) {
      logger.debug("RSS "+feed.name+" indisponible: "+e.message);
    }
  }

  return allNews;
}

// ─── NEWSAPI.ORG (gratuit 100 req/jour) ──────────────────────────────────────
async function fetchNewsAPI(query) {
  if (!NEWS_API_KEY) return [];
  try {
    var url = "https://newsapi.org/v2/everything?q="+encodeURIComponent(query)+"&language=en&sortBy=publishedAt&pageSize=10&apiKey="+NEWS_API_KEY;
    var raw = await fetchURL(url);
    var data = JSON.parse(raw);
    return (data.articles||[]).map(function(a) {
      return { title: a.title||"", description: a.description||"", source: a.source&&a.source.name||"NewsAPI", pubDate: a.publishedAt||"", link: a.url||"" };
    });
  } catch(e) {
    logger.debug("NewsAPI: "+e.message);
    return [];
  }
}

// ─── API-FOOTBALL: BLESSURES ET COMPOSITIONS CONFIRMÉES ──────────────────────
async function fetchInjuriesAndLineup(fixtureId) {
  if (!API_FOOTBALL_KEY || !fixtureId) return null;
  var result = { injuries:[], lineup:null, predictions:null };

  try {
    // Blessures pour ce match
    var injUrl = "https://v3.football.api-sports.io/injuries?fixture="+fixtureId;
    var injRaw = await fetchURL(injUrl, { "x-apisports-key": API_FOOTBALL_KEY });
    var injData = JSON.parse(injRaw);
    (injData.response||[]).forEach(function(p) {
      result.injuries.push({
        player:  p.player&&p.player.name||"?",
        team:    p.team&&p.team.name||"?",
        type:    p.player&&p.player.type||"?",
        reason:  p.player&&p.player.reason||"?",
      });
    });
  } catch(e) { logger.debug("Injuries API: "+e.message); }

  try {
    // Prédictions
    var predUrl = "https://v3.football.api-sports.io/predictions?fixture="+fixtureId;
    var predRaw = await fetchURL(predUrl, { "x-apisports-key": API_FOOTBALL_KEY });
    var predData = JSON.parse(predRaw);
    var pred = predData.response&&predData.response[0];
    if (pred) {
      result.predictions = {
        winner:        pred.predictions&&pred.predictions.winner&&pred.predictions.winner.name||"?",
        winnerComment: pred.predictions&&pred.predictions.winner&&pred.predictions.winner.comment||"",
        homeWinPct:    pred.predictions&&pred.predictions.percent&&pred.predictions.percent.home||"?",
        drawPct:       pred.predictions&&pred.predictions.percent&&pred.predictions.percent.draw||"?",
        awayWinPct:    pred.predictions&&pred.predictions.percent&&pred.predictions.percent.away||"?",
        advice:        pred.predictions&&pred.predictions.advice||"",
        homeFormScore: pred.teams&&pred.teams.home&&pred.teams.home.last_5&&pred.teams.home.last_5.form||"?",
        awayFormScore: pred.teams&&pred.teams.away&&pred.teams.away.last_5&&pred.teams.away.last_5.form||"?",
      };
    }
  } catch(e) { logger.debug("Predictions API: "+e.message); }

  return result;
}

// ─── RECHERCHE CIBLÉE PAR ÉQUIPE ──────────────────────────────────────────────
async function searchTeamNews(teamName, allNews) {
  var nameVariants = [
    teamName,
    teamName.split(" ").pop(), // ex: "Manchester City" → "City"
    teamName.split(" ")[0],    // ex: "Manchester City" → "Manchester"
  ].filter(Boolean);

  return allNews.filter(function(article) {
    var text = (article.title + " " + article.description).toLowerCase();
    return nameVariants.some(function(v){ return text.includes(v.toLowerCase()); });
  });
}

// ─── ANALYSE DE SENTIMENT DES NEWS ───────────────────────────────────────────
function analyzeSentiment(articles) {
  if (!articles||!articles.length) return { sentiment:"neutre", score:0, signals:[] };

  var positiveKeywords = ["wins","victory","scored","brilliant","form","confident","returns","fit","comeback","historic","unbeaten","dominant","great"];
  var negativeKeywords = ["injury","injured","doubt","suspended","banned","crisis","sacked","fired","resign","loss","defeat","poor","terrible","concern","chaos","absent","miss","out","unavailable","setback","row","dispute","argument","protest"];
  var criticalKeywords = ["sacked","fired","resign","quit","suspended","banned","absent","unavailable","miss","out","injury","crisis","chaos"];

  var positiveScore=0, negativeScore=0;
  var signals = [];

  articles.slice(0,10).forEach(function(a) {
    var text = (a.title+" "+a.description).toLowerCase();
    positiveKeywords.forEach(function(k){ if(text.includes(k)) positiveScore++; });
    negativeKeywords.forEach(function(k){ if(text.includes(k)) negativeScore++; });
    criticalKeywords.forEach(function(k){
      if(text.includes(k)) {
        signals.push({ keyword:k, headline:a.title.slice(0,100), source:a.source });
      }
    });
  });

  var score = positiveScore - negativeScore;
  var sentiment = score > 2 ? "positif" : score < -2 ? "négatif" : "neutre";

  return { sentiment:sentiment, score:score, positiveScore:positiveScore, negativeScore:negativeScore, signals:signals.slice(0,5) };
}

// ─── EXTRACTION DES SIGNAUX CLÉS ─────────────────────────────────────────────
// Identifie les informations critiques: blessures confirmées, crises, absences
function extractKeySignals(articles, teamName) {
  var signals = [];
  var keywords = {
    injury:     ["injured","injury","out","miss","setback","doubt","unavailable","absent"],
    suspension: ["suspended","banned","red card","accumulation","ban"],
    manager:    ["sacked","fired","resigned","quit","dismissed","interim","appointed"],
    transfer:   ["transfer","signed","joins","leaves","departs","loan"],
    crisis:     ["crisis","chaos","row","dispute","argument","protest","unrest","dressing room"],
    positive:   ["returns","fit","comeback","available","confident","record","unbeaten"],
  };

  articles.forEach(function(a) {
    var text = (a.title+" "+a.description).toLowerCase();
    Object.keys(keywords).forEach(function(type) {
      keywords[type].forEach(function(kw) {
        if (text.includes(kw) && text.includes(teamName.toLowerCase().split(" ")[0].toLowerCase())) {
          signals.push({
            type: type,
            headline: a.title.slice(0,120),
            source: a.source,
            date: a.pubDate ? new Date(a.pubDate).toLocaleDateString("fr-FR") : "?",
            betImpact: getBetImpact(type),
          });
        }
      });
    });
  });

  // Dédupliquer
  var seen = {};
  return signals.filter(function(s) {
    var key = s.type+s.headline.slice(0,30);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }).slice(0, 6);
}

function getBetImpact(type) {
  var impacts = {
    injury:     "DÉFAVORABLE — joueur clé potentiellement absent",
    suspension: "DÉFAVORABLE — réduction de l'effectif",
    manager:    "TRÈS INCERTAIN — changement de dynamique imprévisible",
    transfer:   "VARIABLE — dépend du joueur concerné",
    crisis:     "DÉFAVORABLE — instabilité collective",
    positive:   "FAVORABLE — retour de force",
  };
  return impacts[type] || "VARIABLE";
}

// ─── RECHERCHE COMPLÈTE POUR UN MATCH ────────────────────────────────────────
async function researchMatch(match, allNews) {
  var homeNews = await searchTeamNews(match.home, allNews);
  var awayNews = await searchTeamNews(match.away, allNews);

  var homeSentiment = analyzeSentiment(homeNews);
  var awaySentiment = analyzeSentiment(awayNews);
  var homeSignals   = extractKeySignals(homeNews, match.home);
  var awaySignals   = extractKeySignals(awayNews, match.away);

  // Blessures API-Football si ID disponible
  var injuryData = null;
  if (match.id && !String(match.id).startsWith("SIM_") && API_FOOTBALL_KEY) {
    try {
      injuryData = await fetchInjuriesAndLineup(match.id);
    } catch {}
  }

  return {
    home:          match.home,
    away:          match.away,
    homeSentiment: homeSentiment,
    awaySentiment: awaySentiment,
    homeSignals:   homeSignals,
    awaySignals:   awaySignals,
    injuries:      injuryData&&injuryData.injuries||[],
    predictions:   injuryData&&injuryData.predictions||null,
    researchScore: computeResearchScore(homeSentiment, awaySentiment, homeSignals, awaySignals),
  };
}

function computeResearchScore(homeS, awayS, homeSignals, awaySignals) {
  // Score de risque basé sur les signaux négatifs trouvés
  var riskScore = 0;
  if (homeS.sentiment==="négatif") riskScore += 15;
  if (awayS.sentiment==="négatif") riskScore += 10;
  homeSignals.forEach(function(s){ if(["crisis","manager","injury"].includes(s.type)) riskScore+=10; });
  awaySignals.forEach(function(s){ if(["crisis","manager"].includes(s.type)) riskScore+=8; });
  return Math.min(100, riskScore);
}

// ─── RAPPORT GLOBAL DES RECHERCHES ───────────────────────────────────────────
async function conductFullResearch(matchesOrHome, away, league, datetime) {
  // Compatibilité: accepte soit (matches[]) soit (home, away, league, datetime)
  var matches;
  if (typeof matchesOrHome === "string") {
    // Appelé avec (home, away, league, datetime) — convertir en tableau
    matches = [{ home: matchesOrHome, away: away||"", league: league||"", datetime: datetime||new Date().toISOString(), id: "SEARCH_"+Date.now() }];
  } else {
    matches = Array.isArray(matchesOrHome) ? matchesOrHome : [matchesOrHome];
  }
  logger.info("🔎 [WEB RESEARCH] Démarrage recherche internet approfondie...");

  // 1. Récupérer toutes les actualités RSS
  var allNews = await fetchRSSNews(10);
  logger.info("   📰 "+allNews.length+" articles récupérés des RSS");

  // 2. Recherche ciblée par match (max 12 matchs pour limiter le temps)
  var matchResearch = [];
  var topMatches = matches.slice(0, 12);

  for (var i=0; i<topMatches.length; i++) {
    try {
      var research = await researchMatch(topMatches[i], allNews);
      matchResearch.push(research);
    } catch(e) {
      logger.debug("Research "+topMatches[i].home+" vs "+topMatches[i].away+": "+e.message);
    }
  }

  logger.info("   ✅ "+matchResearch.length+" matchs analysés");

  return {
    allNews:       allNews,
    matchResearch: matchResearch,
    totalArticles: allNews.length,
    timestamp:     new Date().toISOString(),
  };
}

// ─── FORMATEUR POUR LE PROMPT ─────────────────────────────────────────────────
function formatResearchForPrompt(researchData) {
  if (!researchData||!researchData.matchResearch||!researchData.matchResearch.length) {
    return "Recherche internet non disponible (vérifier connexion ou clés API).";
  }

  var lines = ["=== RECHERCHE INTERNET EN TEMPS RÉEL ==="];
  lines.push("Sources: BBC Sport, Sky Sports, Goal.com, ESPN FC, UEFA");
  lines.push("Articles analysés: "+researchData.totalArticles+" | Heure: "+new Date(researchData.timestamp).toLocaleTimeString("fr-FR"));
  lines.push("");

  researchData.matchResearch.forEach(function(r) {
    if (!r) return;
    lines.push("["+r.home+" vs "+r.away+"]");

    // Sentiment
    var sentLine = "  Sentiment DOM: "+r.homeSentiment.sentiment+" ("+r.homeSentiment.score+") | EXT: "+r.awaySentiment.sentiment+" ("+r.awaySentiment.score+")";
    lines.push(sentLine);

    // Signaux critiques domicile
    if (r.homeSignals&&r.homeSignals.length) {
      lines.push("  🚨 Signaux "+r.home+":");
      r.homeSignals.slice(0,3).forEach(function(s){ lines.push("    ["+s.type.toUpperCase()+"] "+s.headline+" → "+s.betImpact); });
    }
    // Signaux critiques extérieur
    if (r.awaySignals&&r.awaySignals.length) {
      lines.push("  🚨 Signaux "+r.away+":");
      r.awaySignals.slice(0,3).forEach(function(s){ lines.push("    ["+s.type.toUpperCase()+"] "+s.headline+" → "+s.betImpact); });
    }
    // Blessures confirmées API
    if (r.injuries&&r.injuries.length) {
      lines.push("  🏥 Blessés confirmés: "+r.injuries.slice(0,5).map(function(i){ return i.player+" ("+i.team+", "+i.type+")"; }).join(", "));
    }
    // Prédictions API
    if (r.predictions) {
      lines.push("  📊 Prédiction API: "+r.predictions.winner+" | "+r.predictions.homeWinPct+"% / "+r.predictions.drawPct+"% / "+r.predictions.awayWinPct+"% | '"+r.predictions.advice+"'");
    }
    if (r.researchScore>20) lines.push("  ⚠️ Score risque actualités: "+r.researchScore+"/100");
  });

  return lines.join("\n");
}

// ─── HEADLINES GLOBALES (pour le contexte général) ───────────────────────────
function extractGlobalHeadlines(allNews, limit) {
  if (!allNews) return ""; // appelé sans args — retourner vide
  limit = limit||8;
  var footballKeywords = ["goal","football","soccer","premier league","champions","bundesliga","serie a","ligue","la liga","transfer","manager","injury","final","derby","europa"];
  return allNews.filter(function(a) {
    var text=(a.title||"").toLowerCase();
    return footballKeywords.some(function(k){ return text.includes(k); });
  }).slice(0, limit).map(function(a){ return "["+a.source+"] "+a.title; }).join("\n");
}

// Alias pour la compatibilité avec agent.js
function fetchRSSNewsGlobal(maxItems) { return fetchRSSNews(maxItems||5); }

module.exports = {
  conductFullResearch,
  formatResearchForPrompt,
  fetchRSSNews,
  fetchNewsAPI,
  searchTeamNews,
  analyzeSentiment,
  extractKeySignals,
  extractGlobalHeadlines,
};
