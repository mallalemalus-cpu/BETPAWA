// ─── DATA FETCHER v3 ─────────────────────────────────────────────────────────
// Sources gratuites utilisées:
//   • The Odds API      — cotes en temps réel (500 req/mois gratuit)
//   • football-data.org — matchs, résultats, classements (gratuit)
//   • Open-Meteo        — météo (100% gratuit, pas de clé requise)
//   • API-Football free — stats joueurs/équipes (plan gratuit 100 req/jour)
const https  = require("https");
const logger = require("./logger");

const ODDS_API_KEY     = process.env.ODDS_API_KEY     || "";
const FOOTBALL_DATA_KEY= process.env.FOOTBALL_DATA_KEY|| "";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || ""; // api-football.com gratuit

const FOOTBALL_LEAGUES = [
  "soccer_epl","soccer_spain_la_liga","soccer_germany_bundesliga",
  "soccer_italy_serie_a","soccer_france_ligue_one","soccer_uefa_champs_league",
  "soccer_uefa_europa_league","soccer_africa_cup_of_nations",
  "soccer_netherlands_eredivisie","soccer_portugal_primeira_liga",
  "soccer_turkey_super_league","soccer_brazil_campeonato",
];

// Coordonnées GPS des stades majeurs (pour météo)
const STADIUM_COORDS = {
  "Premier League":    { lat: 51.5, lon: -0.1 },
  "La Liga":           { lat: 40.4, lon: -3.7 },
  "Bundesliga":        { lat: 48.1, lon: 11.5 },
  "Serie A":           { lat: 41.9, lon: 12.5 },
  "Ligue 1":           { lat: 48.8, lon: 2.3  },
  "Champions League":  { lat: 51.5, lon: -0.1 },
  "default":           { lat: 48.8, lon: 2.3  },
};

// ─── HTTP HELPER ──────────────────────────────────────────────────────────────
function fetchURL(url, headers, timeout) {
  headers = headers || {};
  timeout = timeout || 10000;
  return new Promise(function(resolve, reject) {
    var req = https.get(url, { headers: Object.assign({ "User-Agent": "BetPawaAgent/3.0" }, headers) }, function(res) {
      var d = "";
      res.on("data", function(c){ d+=c; });
      res.on("end", function(){
        if (res.statusCode === 429) return reject(new Error("Rate limit"));
        if (res.statusCode === 401) return reject(new Error("Auth error (401)"));
        if (res.statusCode >= 400) return reject(new Error("HTTP "+res.statusCode));
        try { resolve(JSON.parse(d)); } catch { reject(new Error("JSON invalide")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, function(){ req.destroy(); reject(new Error("Timeout")); });
  });
}

function sleep(ms) { return new Promise(function(r){ setTimeout(r,ms); }); }

// ─── RÉCUPÉRER MATCHS + COTES ─────────────────────────────────────────────────
async function fetchUpcomingMatches() {
  var matches = [];

  if (ODDS_API_KEY) {
    try {
      matches = await fetchFromOddsAPI();
      logger.info("Source: The Odds API — " + matches.length + " matchs");
      if (matches.length >= 15) return matches;
    } catch(e) { logger.warn("Odds API: " + e.message); }
  }

  if (FOOTBALL_DATA_KEY) {
    try {
      var fd = await fetchFromFootballData();
      // Merge (dédupliquer par nom équipe)
      var names = new Set(matches.map(function(m){ return m.home+"_"+m.away; }));
      fd.forEach(function(m){ if(!names.has(m.home+"_"+m.away)) matches.push(m); });
      logger.info("Source: football-data.org — total " + matches.length + " matchs");
      if (matches.length >= 10) return matches;
    } catch(e) { logger.warn("football-data.org: " + e.message); }
  }

  // Si des clés API sont configurées mais échouent → signaler clairement
  // Ne PAS inventer des matchs fictifs si l'utilisateur a des vraies clés
  if (ODDS_API_KEY || FOOTBALL_DATA_KEY) {
    logger.warn("⚠️ APIs configurées mais indisponibles — aucun match réel récupéré ce cycle");
    logger.warn("   Causes possibles: quota Odds API épuisé, football-data timeout");
    logger.warn("   L'agent va passer ce cycle sans parier (protection bankroll)");
    return []; // retourner vide → cycle abandonné proprement
  }
  // Seulement si AUCUNE clé configurée: mode démo avec matchs simulés
  logger.warn("Mode démo (aucune clé API) — matchs simulés pour test uniquement");
  return generateRealisticMatches();
}

// ─── THE ODDS API ─────────────────────────────────────────────────────────────
async function fetchFromOddsAPI() {
  var all = [];
  for (var i = 0; i < Math.min(FOOTBALL_LEAGUES.length, 5); i++) {
    var league = FOOTBALL_LEAGUES[i];
    try {
      var url = "https://api.the-odds-api.com/v4/sports/"+league+"/odds/?apiKey="+ODDS_API_KEY+"&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso";
      var data = await fetchURL(url);
      if (!Array.isArray(data)) continue;
      data.forEach(function(ev){
        var m = parseOddsEvent(ev, league);
        if (m) all.push(m);
      });
      await sleep(400);
    } catch(e) { logger.warn("  Odds API "+league+": "+e.message); }
  }
  return all;
}

function parseOddsEvent(ev, league) {
  try {
    var odds = { home:null, draw:null, away:null, btts_yes:null, btts_no:null, over25:null, under25:null, over15:null, under35:null };
    for (var bi = 0; bi < (ev.bookmakers||[]).length; bi++) {
      var bk = ev.bookmakers[bi];
      for (var mi = 0; mi < (bk.markets||[]).length; mi++) {
        var mkt = bk.markets[mi];
        if (mkt.key === "h2h") {
          mkt.outcomes.forEach(function(o){
            if (o.name === ev.home_team) odds.home = o.price;
            else if (o.name === ev.away_team) odds.away = o.price;
            else if (o.name === "Draw") odds.draw = o.price;
          });
        }
        if (mkt.key === "totals") {
          mkt.outcomes.forEach(function(o){
            if (o.point == 2.5 && o.name==="Over")  odds.over25  = o.price;
            if (o.point == 2.5 && o.name==="Under") odds.under25 = o.price;
            if (o.point == 1.5 && o.name==="Over")  odds.over15  = o.price;
            if (o.point == 3.5 && o.name==="Under") odds.under35 = o.price;
          });
        }
        if (mkt.key === "btts") {
          mkt.outcomes.forEach(function(o){
            if (o.name==="Yes") odds.btts_yes = o.price;
            if (o.name==="No")  odds.btts_no  = o.price;
          });
        }
      }
      break; // un bookmaker suffit
    }
    if (!odds.home || !odds.away) return null;
    // Calculer BTTS si non fourni par l'API (modèle Poisson simplifié)
    if (!odds.btts_yes || !odds.btts_no) {
      var bttsProb = estimateBTTS(odds);
      if (bttsProb > 0) {
        odds.btts_yes = parseFloat((1/(bttsProb*0.94)).toFixed(2));
        odds.btts_no  = parseFloat((1/((1-bttsProb)*0.94)).toFixed(2));
      }
    }
    // Calculer DC si non fourni
    if (!odds.dc_1X && odds.home && odds.draw) {
      var p1X = (1/parseFloat(odds.home)) + (1/parseFloat(odds.draw));
      odds.dc_1X = parseFloat((1/(p1X*0.96)).toFixed(2));
    }
    if (!odds.dc_X2 && odds.draw && odds.away) {
      var pX2 = (1/parseFloat(odds.draw)) + (1/parseFloat(odds.away));
      odds.dc_X2 = parseFloat((1/(pX2*0.96)).toFixed(2));
    }
    return { id:ev.id, home:ev.home_team, away:ev.away_team, league:formatLeague(league), datetime:ev.commence_time, odds:odds, source:"odds_api" };
  } catch { return null; }
}

// ─── FOOTBALL-DATA.ORG ────────────────────────────────────────────────────────
async function fetchFromFootballData() {
  var comps = ["PL","PD","BL1","SA","FL1","CL","EL"];
  var all = [];
  for (var i = 0; i < comps.length; i++) {
    try {
      var url = "https://api.football-data.org/v4/competitions/"+comps[i]+"/matches?status=SCHEDULED&limit=8";
      var data = await fetchURL(url, { "X-Auth-Token": FOOTBALL_DATA_KEY });
      (data.matches||[]).forEach(function(m){
        all.push({
          id: String(m.id),
          homeTeamId: m.homeTeam && m.homeTeam.id,
          awayTeamId: m.awayTeam && m.awayTeam.id,
          home: m.homeTeam && m.homeTeam.name || "?",
          away: m.awayTeam && m.awayTeam.name || "?",
          league: m.competition && m.competition.name || comps[i],
          datetime: m.utcDate,
          odds: enrichOdds(generateOdds(m.homeTeam&&m.homeTeam.name, m.awayTeam&&m.awayTeam.name)),
          source: "football_data",
        });
      });
      await sleep(250);
    } catch(e) { logger.warn("  FD "+comps[i]+": "+e.message); }
  }
  return all;
}

// ─── RÉSULTAT D'UN MATCH ──────────────────────────────────────────────────────
async function fetchMatchResult(matchId) {
  if (!matchId || String(matchId).startsWith("SIM_")) return null; // simulé → résolution probabiliste
  if (FOOTBALL_DATA_KEY) {
    try {
      var url = "https://api.football-data.org/v4/matches/"+matchId;
      var d = await fetchURL(url, { "X-Auth-Token": FOOTBALL_DATA_KEY });
      if (d.status === "FINISHED" && d.score && d.score.fullTime) {
        var hg = d.score.fullTime.home, ag = d.score.fullTime.away;
        return {
          home_goals: hg, away_goals: ag,
          outcome_1x2: hg>ag?"1":hg<ag?"2":"X",
          ht_outcome: d.score.halfTime ? (d.score.halfTime.home>d.score.halfTime.away?"1":d.score.halfTime.home<d.score.halfTime.away?"2":"X") : null,
        };
      }
      return null;
    } catch { return null; }
  }
  return null;
}

// ─── MÉTÉO OPEN-METEO (100% gratuit, aucune clé) ─────────────────────────────
async function fetchWeather(league, datetime) {
  try {
    var coords = STADIUM_COORDS[league] || STADIUM_COORDS["default"];
    var date = datetime ? datetime.slice(0,10) : new Date().toISOString().slice(0,10);
    var url = "https://api.open-meteo.com/v1/forecast?latitude="+coords.lat+"&longitude="+coords.lon
      +"&daily=precipitation_sum,windspeed_10m_max,temperature_2m_max,temperature_2m_min"
      +"&start_date="+date+"&end_date="+date+"&timezone=auto";
    var data = await fetchURL(url);
    if (!data.daily) return null;
    var rain  = (data.daily.precipitation_sum||[0])[0] || 0;
    var wind  = (data.daily.windspeed_10m_max||[0])[0] || 0;
    var tmax  = (data.daily.temperature_2m_max||[20])[0] || 20;
    var tmin  = (data.daily.temperature_2m_min||[10])[0] || 10;

    var impact = "neutre";
    var note   = "";
    if (rain > 10) { impact = "négatif fort"; note = "Pluie importante (" + rain + "mm) — favorise matchs serrés, moins de buts"; }
    else if (rain > 3) { impact = "légèrement négatif"; note = "Légère pluie (" + rain + "mm) — terrain glissant possible"; }
    if (wind > 40) { impact = "négatif"; note += (note?" | ":"")+"Vent fort (" + wind + "km/h) — perturbe jeu aérien et tirs"; }
    if (tmax < 5) { impact = "négatif"; note += (note?" | ":"")+"Froid intense (" + tmin + "°/" + tmax + "°) — crampes, fatigue accrue"; }
    if (tmax > 35) { impact = "négatif"; note += (note?" | ":"")+"Chaleur extrême (" + tmax + "°) — baisse d'intensité en 2e mi-temps"; }
    if (!note) note = "Conditions favorables (" + tmin + "-" + tmax + "°C, vent " + wind + "km/h)";

    return { rain:rain, wind:wind, tmax:tmax, tmin:tmin, impact:impact, note:note };
  } catch(e) {
    logger.debug("Météo indisponible: " + e.message);
    return null;
  }
}

// ─── STATS ÉQUIPES VIA API-FOOTBALL (gratuit 100 req/jour) ───────────────────
async function fetchTeamStats(teamName, league) {
  if (!API_FOOTBALL_KEY) return null;
  // Mapping league → ID API-Football
  var leagueIds = { "Premier League":39, "La Liga":140, "Bundesliga":78, "Serie A":135, "Ligue 1":61, "Champions League":2 };
  var lid = leagueIds[league];
  if (!lid) return null;
  try {
    // Rechercher l'équipe
    var url = "https://v3.football.api-sports.io/teams?search="+encodeURIComponent(teamName.slice(0,10));
    var data = await fetchURL(url, { "x-apisports-key": API_FOOTBALL_KEY });
    var teams = (data.response||[]);
    if (!teams.length) return null;
    var teamId = teams[0].team && teams[0].team.id;
    if (!teamId) return null;

    // Stats de la saison courante
    var year = new Date().getFullYear();
    var urlStats = "https://v3.football.api-sports.io/teams/statistics?league="+lid+"&season="+year+"&team="+teamId;
    var stats = await fetchURL(urlStats, { "x-apisports-key": API_FOOTBALL_KEY });
    var s = stats.response;
    if (!s) return null;

    return {
      played:     (s.fixtures&&s.fixtures.played&&s.fixtures.played.total) || 0,
      wins:       (s.fixtures&&s.fixtures.wins&&s.fixtures.wins.total) || 0,
      draws:      (s.fixtures&&s.fixtures.draws&&s.fixtures.draws.total) || 0,
      losses:     (s.fixtures&&s.fixtures.loses&&s.fixtures.loses.total) || 0,
      goalsFor:   (s.goals&&s.goals.for&&s.goals.for.total&&s.goals.for.total.total) || 0,
      goalsAgainst:(s.goals&&s.goals.against&&s.goals.against.total&&s.goals.against.total.total)||0,
      form:       (s.form||"").slice(-6),
      cleanSheets:(s.clean_sheet&&s.clean_sheet.total) || 0,
    };
  } catch { return null; }
}

// ─── SIMULATEUR DE MATCHS RÉALISTES ──────────────────────────────────────────
function generateRealisticMatches() {
  var fixtures = [
    ["Arsenal","Chelsea","Premier League"], ["Man City","Liverpool","Premier League"],
    ["Tottenham","Man United","Premier League"], ["Newcastle","Aston Villa","Premier League"],
    ["Real Madrid","Barcelona","La Liga"], ["Atletico Madrid","Sevilla","La Liga"],
    ["Bayern Munich","Dortmund","Bundesliga"], ["Leverkusen","RB Leipzig","Bundesliga"],
    ["Inter Milan","AC Milan","Serie A"], ["Juventus","Napoli","Serie A"],
    ["PSG","Marseille","Ligue 1"], ["Lyon","Monaco","Ligue 1"],
    ["Porto","Benfica","Primeira Liga"], ["Ajax","PSV","Eredivisie"],
    ["Galatasaray","Fenerbahce","Süper Lig"], ["Celtic","Rangers","Scottish Prem"],
    ["Sporting CP","Braga","Primeira Liga"], ["Feyenoord","AZ","Eredivisie"],
    ["Nice","Lille","Ligue 1"], ["Roma","Lazio","Serie A"],
    ["Valencia","Real Betis","La Liga"], ["Wolfsburg","Freiburg","Bundesliga"],
    ["West Ham","Brentford","Premier League"], ["Villarreal","Athletic Bilbao","La Liga"],
  ];
  var now = new Date();
  return fixtures.map(function(f, i) {
    var d = new Date(now.getTime() + (i*2.5+1)*3600000);
    return {
      id: "SIM_"+i+"_"+Date.now(),
      home: f[0], away: f[1], league: f[2],
      datetime: d.toISOString(),
      odds: generateOdds(f[0], f[1]),
      source: "simulated",
    };
  });
}

function generateOdds(home, away) {
  var topTeams = ["Real Madrid","Barcelona","Man City","Bayern Munich","PSG","Liverpool","Inter Milan","Chelsea","Arsenal"];
  var hs = topTeams.indexOf(home)>=0 ? 1.35 : 1.0;
  var as = topTeams.indexOf(away)>=0 ? 1.35 : 1.0;
  var tot = hs + as + 1.0;
  var ho  = Math.max(1.20, parseFloat(((tot/hs)*0.88 + Math.random()*0.25).toFixed(2)));
  var ao  = Math.max(1.20, parseFloat(((tot/as)*0.88 + Math.random()*0.25).toFixed(2)));
  var dr  = parseFloat((3.1 + Math.random()*0.7).toFixed(2));
  return {
    home:     ho,
    draw:     dr,
    away:     ao,
    btts_yes: parseFloat((1.65+Math.random()*0.45).toFixed(2)),
    btts_no:  parseFloat((1.90+Math.random()*0.35).toFixed(2)),
    over25:   parseFloat((1.72+Math.random()*0.38).toFixed(2)),
    under25:  parseFloat((1.92+Math.random()*0.32).toFixed(2)),
    over15:   parseFloat((1.28+Math.random()*0.18).toFixed(2)),
    under35:  parseFloat((1.35+Math.random()*0.20).toFixed(2)),
  };
}

function formatLeague(slug) {
  var map = {
    "soccer_epl":"Premier League","soccer_spain_la_liga":"La Liga",
    "soccer_germany_bundesliga":"Bundesliga","soccer_italy_serie_a":"Serie A",
    "soccer_france_ligue_one":"Ligue 1","soccer_uefa_champs_league":"Champions League",
    "soccer_uefa_europa_league":"Europa League","soccer_africa_cup_of_nations":"CAN",
    "soccer_netherlands_eredivisie":"Eredivisie","soccer_portugal_primeira_liga":"Primeira Liga",
    "soccer_turkey_super_league":"Süper Lig","soccer_brazil_campeonato":"Brasileirão",
  };
  return map[slug] || slug;
}

// ─── ESTIMATION BTTS PAR POISSON ─────────────────────────────────────────────
function estimateBTTS(odds) {
  if (!odds || !odds.home || !odds.away) return 0.52;
  var h = parseFloat(odds.home), d = parseFloat(odds.draw), a = parseFloat(odds.away);
  if (!h||!d||!a||!isFinite(h)||!isFinite(d)||!isFinite(a)) return 0.52;
  // De-vig pour obtenir les vraies probabilités
  var total = 1/h + 1/d + 1/a;
  var pHome = (1/h)/total;
  var pAway = (1/a)/total;
  // xG calibrés empiriquement (matchs européens: avg ~1.4 dom, ~1.1 ext)
  // Plus la probabilité de gagner est haute, plus les xG sont élevés
  var homeXG = Math.max(0.4, Math.min(3.0, pHome * 2.8 + 0.2));
  var awayXG = Math.max(0.3, Math.min(2.5, pAway * 2.4 + 0.2));
  // Poisson: P(score > 0) = 1 - e^(-xG)
  var pHomeScores = 1 - Math.exp(-homeXG);
  var pAwayScores = 1 - Math.exp(-awayXG);
  var btts = pHomeScores * pAwayScores;
  // Clamper dans une plage réaliste (40-65% en football européen)
  return parseFloat(Math.max(0.40, Math.min(0.65, btts)).toFixed(3));
}

function enrichOdds(odds) {
  if (!odds) return odds;
  if (!odds.btts_yes || !odds.btts_no) {
    var bttsProb = estimateBTTS(odds);
    if (bttsProb > 0) {
      odds.btts_yes = parseFloat((1/(bttsProb*0.94)).toFixed(2));
      odds.btts_no  = parseFloat((1/((1-bttsProb)*0.94)).toFixed(2));
    }
  }
  if (!odds.dc_1X && odds.home && odds.draw) {
    var p1X = (1/parseFloat(odds.home)) + (1/parseFloat(odds.draw));
    odds.dc_1X = parseFloat((1/(p1X*0.96)).toFixed(2));
  }
  if (!odds.dc_X2 && odds.draw && odds.away) {
    var pX2 = (1/parseFloat(odds.draw)) + (1/parseFloat(odds.away));
    odds.dc_X2 = parseFloat((1/(pX2*0.96)).toFixed(2));
  }
  return odds;
}

module.exports = { fetchUpcomingMatches, fetchMatchResult, fetchWeather, fetchTeamStats, enrichOdds, estimateBTTS };
