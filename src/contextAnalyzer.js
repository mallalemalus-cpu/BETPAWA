// ─── CONTEXT ANALYZER v5 — Analyse contextuelle + Intelligence narrative ──────
const https   = require("https");
const logger  = require("./logger");
const { fetchWeather, fetchTeamStats } = require("./dataFetcher");
const { buildMatchNarrative }          = require("./narrativeEngine");

const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || "";

function fetchURL(url, headers) {
  return new Promise(function(resolve, reject) {
    var req = https.get(url, { headers: Object.assign({ "User-Agent":"BetPawaAgent/5.0" }, headers||{}) }, function(res) {
      var d=""; res.on("data",function(c){d+=c;}); res.on("end",function(){
        if (res.statusCode>=400) return reject(new Error("HTTP "+res.statusCode));
        try{resolve(JSON.parse(d));}catch{reject(new Error("JSON"));}
      });
    });
    req.on("error",reject);
    req.setTimeout(8000,function(){req.destroy();reject(new Error("Timeout"));});
  });
}
function sleep(ms){ return new Promise(function(r){setTimeout(r,ms);}); }

// ─── ANALYSE COMPLÈTE D'UN MATCH ─────────────────────────────────────────────
async function analyzeMatch(match) {
  var a = {
    matchId: match.id, home: match.home, away: match.away, league: match.league,
    h2h: null, homeForm: null, awayForm: null,
    homeStats: null, awayStats: null,
    emotionalContext: null, stakes: null,
    weather: null, integrity: null, teamStyles: null, xFactors: null,
    narrative: null,      // NOUVEAU: intelligence narrative
    overallRisk: "moyen", betRecommendation: null,
  };

  var isSim = !match.id || String(match.id).startsWith("SIM_");

  // H2H + forme (API réelles si dispo)
  if (!isSim && FOOTBALL_DATA_KEY) {
    try { a.h2h = await fetchH2H(match.id); await sleep(120); } catch {}
    if (match.homeTeamId) try { a.homeForm = await fetchTeamForm(match.homeTeamId); await sleep(100); } catch {}
    if (match.awayTeamId) try { a.awayForm = await fetchTeamForm(match.awayTeamId); await sleep(100); } catch {}
  }

  if (process.env.API_FOOTBALL_KEY) {
    try { a.homeStats = await fetchTeamStats(match.home, match.league); await sleep(80); } catch {}
    try { a.awayStats = await fetchTeamStats(match.away, match.league); await sleep(80); } catch {}
  }

  try { a.weather = await fetchWeather(match.league, match.datetime); } catch {}

  // Analyses heuristiques
  a.emotionalContext  = buildEmotionalContext(match, a.homeForm, a.awayForm);
  a.stakes            = analyzeStakes(match);
  a.integrity         = analyzeIntegrity(match, a);
  a.teamStyles        = analyzeTeamStyles(match);
  a.xFactors          = identifyXFactors(match, a);
  a.overallRisk       = computeRisk(a);
  a.betRecommendation = buildRecommendation(a, match);

  // NOUVEAU: Intelligence narrative — construction du récit
  try { a.narrative = buildMatchNarrative(match, a); } catch(e) { logger.debug("Narrative: "+e.message); }

  return a;
}

// ─── H2H ─────────────────────────────────────────────────────────────────────
async function fetchH2H(matchId) {
  var url = "https://api.football-data.org/v4/matches/"+matchId+"/head2head?limit=10";
  var data = await fetchURL(url, { "X-Auth-Token": FOOTBALL_DATA_KEY });
  if (!data.matches||!data.matches.length) return { available:false };
  var results = data.matches.map(function(m){
    var hg=m.score&&m.score.fullTime&&m.score.fullTime.home||0;
    var ag=m.score&&m.score.fullTime&&m.score.fullTime.away||0;
    return { date:m.utcDate&&m.utcDate.slice(0,10), home:m.homeTeam&&m.homeTeam.name, away:m.awayTeam&&m.awayTeam.name, score:hg+"-"+ag, winner:m.score&&m.score.winner||"UNKNOWN", totalGoals:hg+ag };
  });
  var hw=results.filter(function(r){return r.winner==="HOME_TEAM";}).length;
  var aw=results.filter(function(r){return r.winner==="AWAY_TEAM";}).length;
  var dr=results.filter(function(r){return r.winner==="DRAW";}).length;
  var avgG=results.reduce(function(s,r){return s+r.totalGoals;},0)/(results.length||1);
  var btts=results.filter(function(r){var p=r.score.split("-");return parseInt(p[0])>0&&parseInt(p[1])>0;}).length/(results.length||1);
  return {
    available:true, totalMeetings:results.length, homeWins:hw, awayWins:aw, draws:dr,
    homeWinPct:((hw/results.length)*100).toFixed(0), awayWinPct:((aw/results.length)*100).toFixed(0), drawPct:((dr/results.length)*100).toFixed(0),
    avgGoals:avgG.toFixed(1), bttsRate:(btts*100).toFixed(0)+"%",
    recentMatches:results.slice(0,5), trend:computeTrend(results),
  };
}

async function fetchTeamForm(teamId) {
  var url = "https://api.football-data.org/v4/teams/"+teamId+"/matches?status=FINISHED&limit=6";
  var data = await fetchURL(url, { "X-Auth-Token": FOOTBALL_DATA_KEY });
  if (!data.matches||!data.matches.length) return null;
  var form = data.matches.map(function(m){
    var isH=m.homeTeam&&m.homeTeam.id===teamId;
    var sc=isH?(m.score.fullTime.home||0):(m.score.fullTime.away||0);
    var cc=isH?(m.score.fullTime.away||0):(m.score.fullTime.home||0);
    var won=m.score.winner===(isH?"HOME_TEAM":"AWAY_TEAM"), draw=m.score.winner==="DRAW";
    return { date:m.utcDate&&m.utcDate.slice(0,10), opponent:isH?m.awayTeam&&m.awayTeam.name:m.homeTeam&&m.homeTeam.name, result:won?"W":draw?"D":"L", scored:sc, conceded:cc };
  });
  var ws=0,ds=0,ls=0,sc=0,cc=0;
  form.forEach(function(f){ if(f.result==="W")ws++; else if(f.result==="D")ds++; else ls++; sc+=f.scored; cc+=f.conceded; });
  return { last6:form.map(function(f){return f.result;}).join(""), wins:ws, draws:ds, losses:ls, avgScored:(sc/(form.length||1)).toFixed(1), avgConceded:(cc/(form.length||1)).toFixed(1), momentum:computeMomentum(form), recentResults:form.slice(0,5) };
}

// ─── CONTEXTE ÉMOTIONNEL ──────────────────────────────────────────────────────
function buildEmotionalContext(match, homeForm, awayForm) {
  var ctx = {
    home:{ team:match.home, morale:"neutre", pressure:"normale", motivation:"standard", factors:[] },
    away:{ team:match.away, morale:"neutre", pressure:"normale", motivation:"standard", factors:[] },
    atmosphere:"standard", psychologicalEdge:"neutre",
  };
  function applyForm(f,side) {
    if(!f)return;
    if(f.wins>=4){side.morale="très élevé";side.factors.push(f.wins+" victoires récentes");}
    else if(f.wins>=2){side.morale="bon";side.factors.push("bonne série");}
    else if(f.losses>=3){side.morale="bas";side.pressure="élevée";side.factors.push(f.losses+" défaites");}
    else if(f.losses>=4){side.morale="critique";side.pressure="maximale";side.factors.push("crise de résultats");}
    if(parseFloat(f.avgScored)>=2.5)side.factors.push("attaque prolifique ("+f.avgScored+" buts/match)");
    if(parseFloat(f.avgConceded)>=2.0)side.factors.push("défense poreuse ("+f.avgConceded+" encaissés)");
  }
  applyForm(homeForm,ctx.home); applyForm(awayForm,ctx.away);
  var RIVALS = {
    "El Clasico":[["Real Madrid","Barcelona"],["Barcelona","Real Madrid"]],
    "Derby de Milan":[["Inter Milan","AC Milan"],["AC Milan","Inter Milan"]],
    "Der Klassiker":[["Bayern Munich","Dortmund"],["Dortmund","Bayern Munich"]],
    "Le Classique":[["PSG","Marseille"],["Marseille","PSG"]],
    "North London Derby":[["Arsenal","Tottenham"],["Tottenham","Arsenal"]],
    "Manchester Derby":[["Man City","Man United"],["Man United","Man City"]],
    "Old Firm":[["Celtic","Rangers"],["Rangers","Celtic"]],
    "Derby d'Istanbul":[["Galatasaray","Fenerbahce"],["Fenerbahce","Galatasaray"]],
  };
  Object.keys(RIVALS).forEach(function(name){
    RIVALS[name].forEach(function(pair){
      if(match.home===pair[0]&&match.away===pair[1]){
        ctx.atmosphere="derby intense — "+name;
        ctx.home.motivation=ctx.away.motivation="maximale";
        ctx.home.pressure=ctx.away.pressure="très élevée";
        ctx.home.factors.push(name+" — surpassement fréquent des pronostics");
        ctx.psychologicalEdge="Derby "+name+" — analyse narrative prioritaire sur les stats";
      }
    });
  });
  if(ctx.home.morale==="très élevé"&&(ctx.away.morale==="bas"||ctx.away.morale==="critique"))ctx.psychologicalEdge=match.home+" (forme nettement supérieure)";
  else if(ctx.away.morale==="très élevé"&&(ctx.home.morale==="bas"||ctx.home.morale==="critique"))ctx.psychologicalEdge=match.away+" (forme extérieure supérieure)";
  return ctx;
}

// ─── STYLES DE JEU ────────────────────────────────────────────────────────────
function analyzeTeamStyles(match) {
  var STYLES = {
    "Manchester City":  {style:"possession/pressing haut",goalsAvg:2.4,defenseSolid:true,bttsLikely:false},
    "Real Madrid":      {style:"contre-attaque efficace",goalsAvg:2.3,defenseSolid:true,bttsLikely:false},
    "Bayern Munich":    {style:"pressing intensif",goalsAvg:2.8,defenseSolid:false,bttsLikely:true},
    "PSG":              {style:"attaque individuelle",goalsAvg:2.5,defenseSolid:false,bttsLikely:true},
    "Liverpool":        {style:"contre-pressing/direct",goalsAvg:2.3,defenseSolid:false,bttsLikely:true},
    "Arsenal":          {style:"possession/construction",goalsAvg:2.2,defenseSolid:true,bttsLikely:false},
    "Inter Milan":      {style:"bloc bas/transitions",goalsAvg:1.8,defenseSolid:true,bttsLikely:false},
    "Atletico Madrid":  {style:"défense organisée/direct",goalsAvg:1.5,defenseSolid:true,bttsLikely:false},
    "Chelsea":          {style:"pressing/variabilité",goalsAvg:1.9,defenseSolid:false,bttsLikely:true},
    "Barcelona":        {style:"tiki-taka/possession",goalsAvg:2.2,defenseSolid:false,bttsLikely:true},
    "Dortmund":         {style:"attaque rapide/transitions",goalsAvg:2.5,defenseSolid:false,bttsLikely:true},
    "Napoli":           {style:"haute pression/combinaisons",goalsAvg:2.1,defenseSolid:false,bttsLikely:true},
    "Marseille":        {style:"pressing/verticalité",goalsAvg:1.8,defenseSolid:false,bttsLikely:true},
  };
  var hs=STYLES[match.home]||{style:"non catalogué",goalsAvg:1.6,defenseSolid:false,bttsLikely:null};
  var as=STYLES[match.away]||{style:"non catalogué",goalsAvg:1.6,defenseSolid:false,bttsLikely:null};
  var bttsIdx=hs.bttsLikely&&as.bttsLikely?"élevé":(!hs.bttsLikely&&!as.bttsLikely)?"faible":"moyen";
  var o25Idx=(hs.goalsAvg+as.goalsAvg)>3.5?"élevé":(hs.goalsAvg+as.goalsAvg)>2.8?"moyen":"faible";
  return { homeStyle:hs, awayStyle:as, bttsIndex:bttsIdx, over25Index:o25Idx, note:match.home+" ("+hs.style+") vs "+match.away+" ("+as.style+")" };
}

// ─── INTÉGRITÉ ────────────────────────────────────────────────────────────────
function analyzeIntegrity(match, analysis) {
  var riskLevel="faible",flags=[],score=0;
  var HIGH_RISK=["Süper Lig","Brasileirão","Scottish Prem","Serie B","Ligue 2"];
  if(HIGH_RISK.indexOf(match.league)>=0){score+=20;flags.push("Ligue à risque d'intégrité ("+match.league+")");}
  var odds=match.odds||{};
  var minOdd=Math.min(parseFloat(odds.home||99),parseFloat(odds.away||99),parseFloat(odds.draw||99));
  if(minOdd<1.10){score+=30;flags.push("Cote dominante anormale ("+minOdd+") — possible manipulation");}
  if(odds.home&&odds.away){var diff=Math.abs(parseFloat(odds.home)-parseFloat(odds.away));if(diff<0.05){score+=10;flags.push("Cotes home/away quasi identiques");}}
  var month=new Date(match.datetime||Date.now()).getMonth()+1;
  if(month>=4&&month<=5){score+=5;flags.push("Fin de saison — enjeux relégation/qualification");}
  var KNOWN_RISK=["Fenerbahce","Juventus"];
  if(KNOWN_RISK.indexOf(match.home)>=0||KNOWN_RISK.indexOf(match.away)>=0){score+=15;flags.push("Équipe avec historique de contrôles d'intégrité");}
  if(score>=40)riskLevel="élevé"; else if(score>=20)riskLevel="modéré";
  return {
    riskLevel:riskLevel, suspicionScore:score, flags:flags,
    recommendation:riskLevel==="élevé"?"ÉVITER — risque intégrité élevé":riskLevel==="modéré"?"Prudence — réduire mise":"Aucun signal suspect",
  };
}

// ─── ENJEUX ───────────────────────────────────────────────────────────────────
function analyzeStakes(match) {
  var s={level:"régulier",homeStake:"classement",awayStake:"classement",competitionPhase:"saison régulière",urgency:"normale",factors:[]};
  var league=(match.league||"").toLowerCase();
  var month=new Date(match.datetime||Date.now()).getMonth()+1;
  if(month>=4&&month<=5){s.level="élevé";s.urgency="élevée";s.factors.push("Fin de saison");}
  if(league.includes("champions")){s.level="maximum";s.competitionPhase="UCL";s.urgency="très élevée";s.factors.push("Enjeux UCL: +50M€, prestige continental");}
  if(league.includes("europa")){s.level="élevé";s.competitionPhase="UEL";s.factors.push("Qualification européenne");}
  if(league.includes("can")||league.includes("africa")){s.level="très élevé";s.competitionPhase="CAN";s.factors.push("Fierté nationale — motivation hors norme");}
  return s;
}

// ─── FACTEURS X ───────────────────────────────────────────────────────────────
function identifyXFactors(match, analysis) {
  var factors=[];
  if(analysis.weather&&analysis.weather.impact!=="neutre")factors.push("Météo: "+analysis.weather.note);
  if(analysis.emotionalContext&&analysis.emotionalContext.atmosphere!=="standard")factors.push("Derby: statistiques moins fiables");
  if(analysis.stakes&&(analysis.stakes.level==="maximum"||analysis.stakes.urgency==="critique"))factors.push("Enjeu critique: risque de jeu ultra-défensif");
  if(match.league&&match.league.toLowerCase().includes("champions"))factors.push("Rotation/fatigue UCL possible");
  factors.push("Absences de dernière minute non vérifiables");
  factors.push("Décisions VAR/arbitrage imprévisibles");
  return factors;
}

// ─── RECOMMANDATION GLOBALE ───────────────────────────────────────────────────
function buildRecommendation(a, match) {
  var score=50,reasons=[];
  if(a.integrity){score-=a.integrity.suspicionScore;if(a.integrity.riskLevel==="élevé")reasons.push("RISQUE INTÉGRITÉ");}
  if(a.weather&&a.weather.impact==="négatif fort"){score-=15;reasons.push("Météo défavorable");}
  if(a.homeForm&&a.homeForm.wins>=3){score+=10;reasons.push("Bonne forme domicile");}
  if(a.emotionalContext&&a.emotionalContext.atmosphere!=="standard"){score-=10;reasons.push("Derby — imprévisible");}
  // Boost narratif si disponible
  if(a.narrative&&a.narrative.narrativeConfidenceBoost){score+=a.narrative.narrativeConfidenceBoost*100;}
  score=Math.max(0,Math.min(100,score));
  return {
    confidenceBoost:score>=60?0.05:score<40?-0.10:0,
    rating:score>=70?"favorable":score>=50?"neutre":score>=30?"risqué":"déconseillé",
    reasons:reasons,
    miseMultiplier:a.integrity&&a.integrity.riskLevel==="élevé"?0.4:a.integrity&&a.integrity.riskLevel==="modéré"?0.65:1.0,
  };
}

function computeRisk(a) {
  var r=0;
  if(a.integrity&&a.integrity.suspicionScore>=40)r+=2; else if(a.integrity&&a.integrity.suspicionScore>=20)r+=1;
  if(a.emotionalContext&&a.emotionalContext.atmosphere!=="standard")r+=1;
  if(a.weather&&a.weather.impact!=="neutre")r+=1;
  if(a.stakes&&(a.stakes.level==="maximum"||a.stakes.urgency==="critique"))r+=1;
  // L'état narratif fracturé ajoute du risque
  if(a.narrative&&a.narrative.homeEmotionalState&&a.narrative.homeEmotionalState.find(function(e){return e.id==="fracture";}))r+=1;
  return r>=5?"très élevé":r>=3?"élevé":r>=2?"moyen":"faible";
}

// ─── FORMATAGE COMPLET POUR LE PROMPT ────────────────────────────────────────
function formatContextForPrompt(analyses) {
  if (!analyses||!analyses.length) return "Contexte non disponible.";
  return analyses.map(function(a) {
    var lines=["\n["+a.home+" vs "+a.away+" | "+a.league+"] RISQUE:"+a.overallRisk.toUpperCase()];
    if(a.h2h&&a.h2h.available){
      lines.push("  H2H("+a.h2h.totalMeetings+"): "+a.home+" "+a.h2h.homeWins+"V / Nuls "+a.h2h.draws+" / "+a.away+" "+a.h2h.awayWins+"V | Buts/match:"+a.h2h.avgGoals+" BTTS:"+a.h2h.bttsRate+" Tendance:"+a.h2h.trend);
      if(a.h2h.recentMatches&&a.h2h.recentMatches.length)lines.push("  Récents: "+a.h2h.recentMatches.map(function(m){return m.date+" "+m.score;}).join(" | "));
    }
    if(a.homeForm)lines.push("  Forme DOM ["+a.homeForm.last6+"] buts:"+a.homeForm.avgScored+"/c:"+a.homeForm.avgConceded+" momentum:"+a.homeForm.momentum);
    if(a.awayForm)lines.push("  Forme EXT ["+a.awayForm.last6+"] buts:"+a.awayForm.avgScored+"/c:"+a.awayForm.avgConceded+" momentum:"+a.awayForm.momentum);
    if(a.homeStats)lines.push("  Stats DOM: J"+a.homeStats.played+" "+a.homeStats.wins+"V"+a.homeStats.draws+"N"+a.homeStats.losses+"D BP:"+a.homeStats.goalsFor+" BC:"+a.homeStats.goalsAgainst);
    if(a.awayStats)lines.push("  Stats EXT: J"+a.awayStats.played+" "+a.awayStats.wins+"V"+a.awayStats.draws+"N"+a.awayStats.losses+"D BP:"+a.awayStats.goalsFor+" BC:"+a.awayStats.goalsAgainst);
    // NARRATIF
    if(a.narrative){
      var n=a.narrative;
      lines.push("  [NARR DOM] "+n.homeIdentity.identity+" | Psyché:"+n.homeIdentity.psyche+" | Vulnérabilité:"+n.homeIdentity.vulnerability);
      lines.push("  [NARR EXT] "+n.awayIdentity.identity+" | Psyché:"+n.awayIdentity.psyche+" | Vulnérabilité:"+n.awayIdentity.vulnerability);
      lines.push("  [ÉMOTIONS] DOM:"+(n.homeEmotionalState||[]).map(function(e){return e.id+"("+e.intensity+")";}).join(",")+" EXT:"+(n.awayEmotionalState||[]).map(function(e){return e.id+"("+e.intensity+")";}).join(","));
      if(n.narrativeTension)lines.push("  [TENSION] "+n.narrativeTension);
      if(n.storyArc)lines.push("  [ARC] ["+n.storyArc.type+"] "+n.storyArc.description+" → "+n.storyArc.keyMoment);
      if(n.invisibleForces&&n.invisibleForces.length)lines.push("  [FORCES] "+n.invisibleForces.slice(0,2).join(" | "));
      if(n.narrativePrediction)lines.push("  [PRÉDICTION NARRR] "+n.narrativePrediction.narrativeEdge+" — "+n.narrativePrediction.marketImplication);
    }
    var ec=a.emotionalContext;
    if(ec){
      lines.push("  [STATS EMO] "+ec.atmosphere+" | Edge:"+ec.psychologicalEdge);
      if(ec.home.factors.length)lines.push("  DOM moral:"+ec.home.morale+" pression:"+ec.home.pressure+" — "+ec.home.factors.join(", "));
      if(ec.away.factors.length)lines.push("  EXT moral:"+ec.away.morale+" pression:"+ec.away.pressure+" — "+ec.away.factors.join(", "));
    }
    if(a.teamStyles)lines.push("  [STYLES] "+a.teamStyles.note+" | BTTS:"+a.teamStyles.bttsIndex+" O2.5:"+a.teamStyles.over25Index);
    if(a.weather)lines.push("  [MÉTÉO] "+a.weather.note+" (impact:"+a.weather.impact+")");
    if(a.stakes){lines.push("  [ENJEUX] ["+a.stakes.level+"] "+a.stakes.competitionPhase+" urgence:"+a.stakes.urgency); if(a.stakes.factors.length)lines.push("  "+a.stakes.factors.join(" | "));}
    if(a.integrity){lines.push("  [INTÉGRITÉ] ["+a.integrity.riskLevel+"] score:"+a.integrity.suspicionScore+" → "+a.integrity.recommendation); if(a.integrity.flags.length)lines.push("  FLAGS: "+a.integrity.flags.join(" | "));}
    if(a.xFactors&&a.xFactors.length)lines.push("  [FACTEURS X] "+a.xFactors.slice(0,3).join(" | "));
    if(a.betRecommendation)lines.push("  [RECOMM] ["+a.betRecommendation.rating+"] mult:"+a.betRecommendation.miseMultiplier);
    return lines.join("\n");
  }).join("\n");
}

function computeTrend(results){if(!results||!results.length)return"inconnu";var r3=results.slice(0,3);var hw=r3.filter(function(r){return r.winner==="HOME_TEAM";}).length;var aw=r3.filter(function(r){return r.winner==="AWAY_TEAM";}).length;return hw>=2?"avantage domicile":aw>=2?"avantage extérieur":"équilibré";}
function computeMomentum(form){var w=[3,2.5,2,1.5,1,0.5],s=0;form.forEach(function(f,i){s+=f.result==="W"?w[i]||0.3:f.result==="D"?(w[i]||0.3)*0.4:0;});return Math.round(s*10)/10;}

module.exports = { analyzeMatch, formatContextForPrompt };
