// ─── SERVEUR WEB + DASHBOARD v10 ─────────────────────────────────────────────
const http = require("http");
const { loadBets, loadStats, loadMemory, loadCapabilities, loadCausalJournal, loadDimensionScores } = require("./storage");
const logger = require("./logger");
const PORT = process.env.PORT || 3000;

function getDashboard(stats, bets, memory, scores) {
  var resolved = bets.filter(function(b){ return b.status==="resolved"; });
  var pending  = bets.filter(function(b){ return b.status==="pending"; });
  var wins     = resolved.filter(function(b){ return b.won; });
  var losses   = resolved.filter(function(b){ return !b.won; });
  var roi      = stats.totalMise>0 ? ((stats.gains-stats.pertes)/stats.totalMise*100).toFixed(1) : "0.0";
  var wr       = resolved.length>0 ? (wins.length/resolved.length*100).toFixed(0) : "0";
  var net      = (stats.gains||0)-(stats.pertes||0);

  // Courbe bankroll
  var bankHist = [5000];
  resolved.slice(-20).forEach(function(b){
    var last = bankHist[bankHist.length-1];
    bankHist.push(b.won ? last+(b.gainNet||0) : Math.max(0, last-(b.mise||0)));
  });
  var maxB = Math.max.apply(null, bankHist), minB = Math.min.apply(null, bankHist);
  var rangeB = maxB-minB || 1;
  var chart = bankHist.map(function(v,i){
    var h = Math.max(4, Math.round(((v-minB)/rangeB)*55));
    var up = i===0 || v>=(bankHist[i-1]||v);
    return '<div style="flex:1;height:'+h+'px;background:'+(up?'#00ff88':'#ff4455')+';min-width:3px;border-radius:1px;opacity:0.8"></div>';
  }).join('');

  // Lignes des paris
  var rows = bets.slice().reverse().slice(0,20).map(function(b){
    var statusColor = b.status==="pending" ? "#ffaa00" : b.won ? "#00ff88" : "#ff4455";
    var statusTxt   = b.status==="pending" ? "ATTENTE" : b.won ? "GAGNÉ" : "PERDU";
    var pnlTxt = b.status==="pending" ? "—" : b.won ? "+"+Math.round(b.gainNet||0)+"F" : "-"+(b.mise||0)+"F";
    var pnlColor = b.status==="pending" ? "#555" : b.won ? "#00ff88" : "#ff4455";
    var matchs = (b.selections||[]).slice(0,2).map(function(s){
      return (s.home||"").split(" ")[0]+" vs "+(s.away||"").split(" ")[0];
    }).join(", ")+(b.selections&&b.selections.length>2?" +"+( b.selections.length-2):"");
    var date = b.timestamp ? new Date(b.timestamp).toLocaleDateString("fr-FR") : "—";
    return '<tr>'
      +'<td>'+date+'</td>'
      +'<td style="color:#bbb">'+matchs+'</td>'
      +'<td style="color:#cc88ff">x'+(b.totalOdd?parseFloat(b.totalOdd).toFixed(1):"—")+'</td>'
      +'<td>'+(b.mise||0)+'F</td>'
      +'<td style="color:'+pnlColor+'">'+pnlTxt+'</td>'
      +'<td style="color:#ffaa00">'+(b.confidence?Math.round(b.confidence*100)+"%":"—")+'</td>'
      +'<td style="color:'+statusColor+'">'+statusTxt+'</td>'
    +'</tr>';
  }).join("") || '<tr><td colspan="7" style="text-align:center;color:#333;padding:20px">Aucun pari encore</td></tr>';

  // Marchés
  var mktHtml = Object.keys(scores.markets||{}).filter(function(m){ return scores.markets[m].total>=2; }).map(function(m){
    var s = scores.markets[m];
    var pct = Math.round(s.rate*100);
    var c = pct>=55?"#00ff88":pct>=35?"#ffaa00":"#ff4455";
    return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #0d0d18;font-size:11px">'
      +'<span style="color:#666">'+m+'</span><span style="color:'+c+';font-weight:700">'+pct+'%</span><span style="color:#333">'+s.correct+'/'+s.total+'</span>'
    +'</div>';
  }).join("") || '<div style="color:#333;font-size:11px;padding:8px">En cours d\'accumulation...</div>';

  var anthropicStatus = process.env.ANTHROPIC_API_KEY
    ? '<span style="color:#ffaa00">Clé présente — vérifier crédits</span>'
    : '<span style="color:#ff4455">Non configuré</span>';

  return '<!DOCTYPE html><html lang="fr"><head>'
    +'<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<meta http-equiv="refresh" content="60">'
    +'<title>BetPawa AI Agent v10</title>'
    +'<style>'
    +'*{box-sizing:border-box;margin:0;padding:0}'
    +'body{background:#07070f;color:#c0c0d0;font-family:"Courier New",monospace;font-size:13px}'
    +'header{background:#0a0a16;border-bottom:2px solid #00ff8840;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}'
    +'.logo{font-size:16px;font-weight:900;color:#00ff88;letter-spacing:2px}'
    +'.logo span{color:#4488ff}'
    +'.badge{background:#1a1a2e;color:#ffaa00;border:1px solid #ffaa0050;border-radius:3px;padding:1px 5px;font-size:9px;margin-left:6px;vertical-align:middle}'
    +'.dot{width:7px;height:7px;border-radius:50%;background:#00ff88;box-shadow:0 0 8px #00ff88;display:inline-block;margin-right:5px;animation:p 2s infinite}'
    +'@keyframes p{0%,100%{opacity:1}50%{opacity:.2}}'
    +'.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;padding:12px 16px}'
    +'.kpi{background:#0e0e1c;border:1px solid #1a1a2e;border-radius:7px;padding:11px}'
    +'.kl{font-size:8px;color:#444;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px}'
    +'.kv{font-size:20px;font-weight:900;line-height:1.1}'
    +'.ks{font-size:9px;color:#333;margin-top:3px}'
    +'section{padding:0 16px 12px}'
    +'.sh{font-size:9px;letter-spacing:2px;color:#4488ff;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid #1a1a2e;text-transform:uppercase}'
    +'table{width:100%;border-collapse:collapse;font-size:11px}'
    +'th{color:#333;font-size:8px;letter-spacing:1px;padding:5px 7px;text-align:left;border-bottom:1px solid #1a1a2e}'
    +'td{padding:7px 7px;border-bottom:1px solid #0d0d18;color:#777}'
    +'tr:hover td{background:#0a0a14}'
    +'</style></head><body>'

    +'<header>'
    +'<div>'
    +'<div class="logo">BETPAWA <span>AI</span><span class="badge">v10</span></div>'
    +'<div style="font-size:9px;color:#333;margin-top:2px">FOOTBALL &bull; 30–400 &bull; 10 DIMENSIONS &bull; SÉCURITÉ BLOCKCHAIN &bull; AUTONOMIE PROFONDE</div>'
    +'</div>'
    +'<div><span class="dot"></span><span style="color:#00ff88;font-size:10px">ACTIF 24/7</span></div>'
    +'</header>'

    // KPIs
    +'<div class="grid">'
    +'<div class="kpi"><div class="kl">BANKROLL</div><div class="kv" style="color:#00ff88">'+(stats.bankroll||5000).toLocaleString("fr-FR")+'<span style="font-size:11px;color:#555"> FCFA</span></div><div class="ks">Départ: 5 000 FCFA</div></div>'
    +'<div class="kpi"><div class="kl">ROI</div><div class="kv" style="color:'+(parseFloat(roi)>=0?"#00ff88":"#ff4455")+'">'+roi+'%</div><div class="ks">Retour/investissement</div></div>'
    +'<div class="kpi"><div class="kl">WIN RATE</div><div class="kv" style="color:'+(parseInt(wr)>=50?"#00ff88":parseInt(wr)>=35?"#ffaa00":"#ff4455")+'">'+wr+'%</div><div class="ks">'+wins.length+' gagné / '+losses.length+' perdu</div></div>'
    +'<div class="kpi"><div class="kl">NET P&amp;L</div><div class="kv" style="color:'+(net>=0?"#00ff88":"#ff4455")+'">'+(net>=0?"+":"")+Math.round(net).toLocaleString("fr-FR")+'<span style="font-size:11px;color:#555"> F</span></div><div class="ks">Gains - Pertes</div></div>'
    +'<div class="kpi"><div class="kl">CYCLES</div><div class="kv" style="color:#cc88ff">'+(memory.cycles||0)+'</div><div class="ks">Toutes les 6h</div></div>'
    +'<div class="kpi"><div class="kl">EN ATTENTE</div><div class="kv" style="color:#ffaa00">'+pending.length+'</div><div class="ks">Paris en cours</div></div>'
    +'<div class="kpi"><div class="kl">TOTAL PARIS</div><div class="kv" style="color:#44ddff">'+bets.length+'</div><div class="ks">Résolus: '+resolved.length+'</div></div>'
    +'<div class="kpi"><div class="kl">SÉCURITÉ</div><div class="kv" style="color:#00ff88;font-size:13px">ACTIVE</div><div class="ks">Zero trust blockchain</div></div>'
    +'</div>'

    // Courbe
    +'<section><div class="sh">Courbe Bankroll</div>'
    +'<div style="background:#0e0e1c;border:1px solid #1a1a2e;border-radius:6px;padding:8px;height:70px;display:flex;align-items:flex-end;gap:2px">'
    +chart+'</div></section>'

    // Tableau
    +'<section><div class="sh">Historique des Paris</div>'
    +'<div style="overflow-x:auto">'
    +'<table><thead><tr><th>DATE</th><th>MATCHS</th><th>COTE</th><th>MISE</th><th>P&amp;L</th><th>CONF</th><th>STATUT</th></tr></thead>'
    +'<tbody>'+rows+'</tbody></table></div></section>'

    // Marchés
    +'<section><div class="sh">Win Rate par Marché</div>'
    +'<div style="background:#0e0e1c;border:1px solid #1a1a2e;border-radius:6px;padding:10px">'+mktHtml+'</div></section>'

    // Intelligence
    +'<section><div class="sh">Intelligence Active</div>'
    +'<div style="background:#0e0e1c;border:1px solid #1a1a2e;border-radius:6px;padding:12px;font-size:11px;line-height:2;color:#555">'
    +'<span style="color:#00ff88">✓</span> Cerveau mathématique autonome: Poisson + Elo + Kelly + EV — fonctionne <b style="color:#00ff88">SANS Anthropic</b><br>'
    +'<span style="color:#00ff88">✓</span> Monte Carlo 10 000 simulations/match<br>'
    +'<span style="color:#00ff88">✓</span> Intelligence narrative (12 états émotionnels, arcs, forces invisibles)<br>'
    +'<span style="color:#00ff88">✓</span> Sharp Money + Expected Value + Bookmaker Intel (de-vig)<br>'
    +'<span style="color:#00ff88">✓</span> Sécurité: zero trust, whitelist, rate limit, auto-guérison (1h)<br>'
    +'<span style="color:#4488ff">◎</span> Claude Opus: '+anthropicStatus+'<br>'
    +'<span style="color:#4488ff">◎</span> Cycles effectués: '+(memory.cycles||0)+' | Optimisations: '+(memory.optimizationLog&&memory.optimizationLog.length||0)
    +'</div></section>'

    +'<footer style="text-align:center;padding:8px;color:#111;font-size:9px;border-top:1px solid #0d0d18">'
    +'BetPawa AI Agent v10 — Mise à jour auto toutes les 60 secondes'
    +'</footer></body></html>';
}

function createServer() {
  var security = null;
  try {
    security = require("./securityCore");
    if (!global._secScanStarted) { security.startPeriodicSecurityScan(); global._secScanStarted = true; }
    logger.info("🔒 Sécurité v10 activée");
  } catch(e) { logger.warn("Sécurité: "+e.message); }

  function handle(req, res) {
    var url = req.url.split("?")[0];
    var J = { "Content-Type":"application/json","X-Frame-Options":"DENY","Cache-Control":"no-store" };
    try {
      if (url==="/"||url==="/dashboard") {
        var html = getDashboard(loadStats(), loadBets(), loadMemory(), loadDimensionScores());
        res.writeHead(200,{"Content-Type":"text/html;charset=utf-8"}); res.end(html);
      }
      else if (url==="/api/stats")    { res.writeHead(200,J); res.end(JSON.stringify(loadStats())); }
      else if (url==="/api/bets")     { res.writeHead(200,J); res.end(JSON.stringify(loadBets())); }
      else if (url==="/api/memory")   { res.writeHead(200,J); res.end(JSON.stringify(loadMemory())); }
      else if (url==="/api/caps")     { res.writeHead(200,J); res.end(JSON.stringify(loadCapabilities())); }
      else if (url==="/api/scores")   { res.writeHead(200,J); res.end(JSON.stringify(loadDimensionScores())); }
      else if (url==="/api/causal")   { res.writeHead(200,J); res.end(JSON.stringify(loadCausalJournal())); }
      else if (url==="/api/security") { res.writeHead(200,J); res.end(JSON.stringify(security?security.getSecurityReport():{level:"unavailable"})); }
      else if (url==="/health") {
        var h={status:"ok",uptime:Math.floor(process.uptime()),ts:new Date().toISOString(),version:"v10"};
        if(security){var sr=security.getSecurityReport();h.security={level:sr.level,incidents:sr.incidents};}
        res.writeHead(200,J); res.end(JSON.stringify(h));
      }
      else { res.writeHead(404,J); res.end(JSON.stringify({error:"Not found"})); }
    } catch(e) {
      logger.error("Server: "+e.message);
      try{res.writeHead(500,J);res.end(JSON.stringify({error:"Internal error"}));}catch{}
    }
  }

  var srv = http.createServer(handle);
  srv.listen(PORT, function(){ logger.info("🌐 Dashboard v10: http://localhost:"+PORT); });
  return srv;
}

module.exports = { createServer };
