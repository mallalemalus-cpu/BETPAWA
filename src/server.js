// ─── SERVEUR WEB + DASHBOARD v5 ──────────────────────────────────────────────
const http = require("http");
const { loadBets, loadStats, loadMemory, loadCapabilities, loadCausalJournal, loadDimensionScores } = require("./storage");
const logger = require("./logger");
const PORT = process.env.PORT || 3000;

function getDashboard() {
  return ['<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>BetPawa AI Agent v5</title><style>',
  '@import url("https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap");',
  '*{box-sizing:border-box;margin:0;padding:0}',
  ':root{--g:#00ff88;--b:#4488ff;--r:#ff4455;--a:#ffaa00;--p:#cc88ff;--c:#44ddff;--o:#ff8844;',
  '       --bg:#07070f;--bg2:#0e0e1c;--bg3:#0b0b18;--bd:#1a1a2e;}',
  'body{background:var(--bg);color:#c0c0d0;font-family:"Share Tech Mono",monospace;min-height:100vh}',
  '::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#00ff8828;border-radius:2px}',
  'header{background:var(--bg3);border-bottom:1px solid var(--bd);padding:14px 20px;display:flex;align-items:center;justify-content:space-between}',
  '.logo{font-family:"Orbitron",monospace;font-size:16px;font-weight:900;color:var(--g);letter-spacing:2px}',
  '.logo span{color:var(--b)}.vb{font-size:9px;background:#1a1a2e;color:var(--o);border:1px solid var(--o);border-radius:3px;padding:2px 6px;margin-left:8px}',
  '.dot{width:8px;height:8px;border-radius:50%;background:var(--g);box-shadow:0 0 10px var(--g);animation:pulse 2s infinite}',
  '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}',
  '.kgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;padding:16px 20px}',
  '.kpi{background:var(--bg2);border:1px solid var(--bd);border-radius:7px;padding:14px;position:relative;overflow:hidden}',
  '.kpi::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--ac,var(--g)),transparent)}',
  '.kl{font-size:9px;color:#444;letter-spacing:2px;margin-bottom:6px}.kv{font-size:20px;font-weight:700;color:var(--ac,var(--g));font-family:"Orbitron",monospace;line-height:1}.ks{font-size:9px;color:#444;margin-top:5px}',
  'section{padding:0 20px 16px}.sh{font-family:"Orbitron",monospace;font-size:10px;letter-spacing:2px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--bd)}',
  '.tabs{display:flex;gap:2px;margin-bottom:10px}.tab{padding:5px 12px;font-family:"Share Tech Mono";font-size:10px;border:1px solid var(--bd);background:var(--bg2);color:#555;cursor:pointer;border-radius:3px}',
  '.tab.act{background:#0f0f1e;color:var(--g);border-color:#00ff8840}',
  'table{width:100%;border-collapse:collapse;font-size:10px}',
  'th{font-size:9px;color:#444;letter-spacing:1px;padding:6px 8px;text-align:left;border-bottom:1px solid var(--bd)}',
  'td{padding:7px 8px;border-bottom:1px solid #0d0d18;color:#777;vertical-align:top}',
  'tr:hover td{background:#0d0d1c}',
  '.tag{display:inline-block;padding:2px 5px;border-radius:3px;font-size:8px;font-weight:700}',
  '.won{background:#00ff8818;color:var(--g);border:1px solid #00ff8830}',
  '.lost{background:#ff445518;color:var(--r);border:1px solid #ff445530}',
  '.pend{background:#ffaa0018;color:var(--a);border:1px solid #ffaa0030}',
  '.ibox{background:#0b0b1a;border:1px solid #2a1a3e;border-radius:5px;padding:8px;font-size:9px;color:#777;line-height:1.5;margin-top:2px}',
  '.ilbl{color:var(--p);font-size:8px;letter-spacing:2px;display:block;margin-bottom:2px}',
  '.narr-box{background:#08080e;border:1px solid #1a2a1a;border-radius:6px;padding:12px;font-size:10px;color:#888;line-height:1.6}',
  '.narr-title{font-family:"Orbitron",monospace;font-size:9px;color:var(--o);letter-spacing:2px;margin-bottom:8px}',
  '.emo-badge{display:inline-block;background:#1a0a2a;color:var(--p);border:1px solid #3a1a4a;border-radius:3px;padding:2px 6px;font-size:9px;margin:2px}',
  '.score-bar{height:4px;background:var(--bg3);border-radius:2px;margin-top:3px}',
  '.score-fill{height:4px;border-radius:2px;transition:width .5s}',
  'footer{text-align:center;padding:10px;color:#222;font-size:9px;border-top:1px solid var(--bd)}',
  '</style></head><body>',
  '<header><div>',
  '<div style="display:flex;align-items:center"><div class="logo">BETPAWA <span>AI</span> AGENT<span class="vb">v5 NARRATIVE</span></div></div>',
  '<div style="font-size:9px;color:#333;margin-top:2px;letter-spacing:1px">FOOTBALL &bull; 400&ndash;400K &bull; 10 DIM &bull; INTELLIGENCE NARRATIVE &bull; COMPR&Eacute;HENSION PROFONDE</div>',
  '</div><div style="display:flex;align-items:center;gap:8px"><div class="dot"></div><span style="font-size:10px;color:var(--g)">ACTIF 24/7</span></div></header>',
  '<div id="root"><div style="text-align:center;padding:60px;color:#333">Chargement...</div></div>',
  '<footer>v5 &mdash; Forme &bull; Capacit&eacute;s &bull; &Eacute;motions &bull; H2H &bull; Enjeux &bull; Int&eacute;grit&eacute; &bull; M&eacute;t&eacute;o &bull; Styles &bull; Facteurs X &bull; Narration &bull; Kelly &bull; Telegram</footer>',
  '<script>',
  'var tab="all";',
  'async function load(){try{var r=await Promise.all([fetch("/api/stats").then(function(x){return x.json();}),fetch("/api/bets").then(function(x){return x.json();}),fetch("/api/memory").then(function(x){return x.json();}),fetch("/api/caps").then(function(x){return x.json();}),fetch("/api/scores").then(function(x){return x.json();})]);render(r[0],r[1],r[2],r[3],r[4]);}catch(e){console.error(e);}}',
  'function render(st,bets,mem,caps,scores){',
  '  var res=bets.filter(function(b){return b.status==="resolved";});',
  '  var pend=bets.filter(function(b){return b.status==="pending";});',
  '  var wins=res.filter(function(b){return b.won;});var loss=res.filter(function(b){return !b.won;});',
  '  var roi=st.totalMise>0?((st.gains-st.pertes)/st.totalMise*100):0;',
  '  var wr=res.length>0?(wins.length/res.length*100):0;var net=(st.gains||0)-(st.pertes||0);',
  '  var kpis=[{l:"BANKROLL",v:fF(st.bankroll||5000),a:"var(--g)",s:"D\\u00e9part: 5 000 FCFA"},',
  '    {l:"ROI",v:fP(roi),a:roi>=0?"var(--g)":"var(--r)",s:"Retour/invest"},',
  '    {l:"WIN RATE",v:fP(wr),a:wr>=50?"var(--g)":"var(--a)",s:wins.length+"V / "+loss.length+"D"},',
  '    {l:"NET P&L",v:(net>=0?"+":"")+fF(net),a:net>=0?"var(--g)":"var(--r)",s:"Gains - Pertes"},',
  '    {l:"CYCLES",v:(mem.cycles||0),a:"var(--p)",s:"Optim: "+(mem.lastOptimized?new Date(mem.lastOptimized).toLocaleDateString("fr-FR"):"jamais")},',
  '    {l:"EN ATTENTE",v:pend.length,a:"var(--a)",s:fF(pend.reduce(function(s,b){return s+(b.mise||0);},0))},',
  '    {l:"PARIS TOTAL",v:bets.length,a:"var(--c)",s:"R\\u00e9solus: "+res.length},',
  '    {l:"CONFIANCE MOY",v:res.length>0?fP(res.reduce(function(s,b){return s+(b.confidence||0.5);},0)/res.length*100):"\\u2014",a:"var(--o)",s:"Fiabilit\\u00e9 moyenne"},',
  '  ];',
  '  var kh=kpis.map(function(k){return "<div class=\\"kpi\\" style=\\"--ac:"+k.a+"\\"><div class=\\"kl\\">"+k.l+"</div><div class=\\"kv\\">"+k.v+"</div><div class=\\"ks\\">"+k.s+"</div></div>";}).join("");',
  // Panneau narratif
  '  var narrHtml="<div class=\\"narr-box\\"><div class=\\"narr-title\\">\\ud83e\\udde0 INTELLIGENCE NARRATIVE ACTIVE</div>";',
  '  if(mem.latestNarrativeInsight)narrHtml+="<div style=\\"color:#aaa;margin-bottom:8px\\">\\ud83d\\udcd6 "+esc(mem.latestNarrativeInsight)+"</div>";',
  '  if(caps&&caps.length){narrHtml+="<div style=\\"margin-bottom:6px\\"><span style=\\"font-size:8px;color:#555;letter-spacing:1px\\">CAPACIT\\u00c9S: </span>";caps.filter(function(c){return c.active;}).forEach(function(c){narrHtml+="<span class=\\"emo-badge\\">"+esc(c.name)+"</span>";});narrHtml+="</div>";}',
  '  if(scores&&scores.markets){var mktStr=Object.keys(scores.markets).filter(function(m){return scores.markets[m].total>=3;}).map(function(m){var r=scores.markets[m];var pct=Math.round(r.rate*100);return "<span style=\\"margin-right:8px;color:"+(pct>=55?"var(--g)":pct>=40?"var(--a)":"var(--r)") + "\\">"+m+":"+pct+"%</span>";}).join("");if(mktStr)narrHtml+="<div><span style=\\"font-size:8px;color:#555\\">WIN RATE MARCH\\u00c9S: </span>"+mktStr+"</div>";}',
  '  if(mem.optimizationLog&&mem.optimizationLog.length){var last=mem.optimizationLog[mem.optimizationLog.length-1];if(last&&last.changes&&last.changes.length){narrHtml+="<div style=\\"margin-top:8px\\"><span style=\\"font-size:8px;color:var(--o)\\">DERNI\\u00c8RES CORRECTIONS: </span>";last.changes.slice(0,3).forEach(function(c){narrHtml+="<div style=\\"color:#666;font-size:9px\\">&#8226; "+esc(c)+"</div>";});narrHtml+="</div>";}}',
  '  narrHtml+="</div>";',
  // Tableau
  '  var filtered=tab==="all"?bets:tab==="won"?wins:tab==="lost"?loss:pend;',
  '  var tabs=[["all","TOUS",bets.length],["won","GAGN\\u00c9S",wins.length],["lost","PERDUS",loss.length],["pending","EN ATTENTE",pend.length]];',
  '  var tabH=tabs.map(function(t){return "<div class=\\"tab"+(tab===t[0]?" act":"")+" \\" onclick=\\"setTab(\'"+t[0]+"\')\\">"+ t[1]+" "+t[2]+"</div>";}).join("");',
  '  var rows=filtered.slice().reverse().slice(0,50).map(function(b){',
  '    var tg=b.status==="pending"?"<span class=\\"tag pend\\">ATTENTE</span>":b.won?"<span class=\\"tag won\\">GAGN\\u00c9</span>":"<span class=\\"tag lost\\">PERDU</span>";',
  '    var pl=b.won?"<span style=\\"color:var(--g)\\">+"+fF(b.gainNet||0)+"</span>":b.status==="pending"?"<span style=\\"color:#444\\">\\u2014</span>":"<span style=\\"color:var(--r)\\">-"+fF(b.mise||0)+"</span>";',
  '    var evts=(b.selections||[]).slice(0,3).map(function(s){return (s.home||"?").split(" ")[0]+" vs "+(s.away||"?").split(" ")[0];}).join(", ")+(b.selections&&b.selections.length>3?" +"+(b.selections.length-3):"");',
  '    var cf=b.confidence?Math.round(b.confidence*100)+"%":"\\u2014";',
  '    var ins="";',
  '    var fields=[["\\ud83d\\udcd6 R\\u00c9CIT",b.narrativeInsight],["\\u2764\\ufe0f  \\u00c9MOTIONS",b.emotionalStatesNote],["\\ud83c\\udfad ARC",b.arcTypeNote],["\\ud83d\\udc41 FORCES INVISIBLES",b.invisibleForcesNote],["\\ud83c\\udfc6 ENJEUX",b.stakesNote],["\\ud83c\\udf26 M\\u00c9T\\u00c9O",b.weatherNote],["\\u26a0\\ufe0f INT\\u00c9GRIT\\u00c9",b.integrityNote],["\\u26bd STYLES",b.teamStylesNote],["\\ud83c\\udfb2 FACTEURS X",b.xFactors],["\\ud83e\\udd14 CRITIQUE",b.selfCritique],["\\ud83d\\udcad STRAT\\u00c9GIE",b.reasoning]];',
  '    var hasIns=fields.some(function(f){return f[1]&&f[1]!=="N/A"&&f[1].length>3;});',
  '    if(hasIns){ins="<tr><td colspan=\\"7\\" style=\\"padding:0 0 6px\\"><div class=\\"ibox\\">";',
  '      fields.forEach(function(f){if(f[1]&&f[1]!=="N/A"&&f[1].length>3){ins+="<span class=\\"ilbl\\">"+f[0]+"</span>"+esc(f[1].slice(0,200))+"<br>";}});',
  '      ins+="</div></td></tr>";}',
  '    return "<tr><td style=\\"color:#555\\">"+fD(b.timestamp)+"</td><td style=\\"color:#bbb\\">"+evts+"</td><td style=\\"color:var(--p)\\">"+(b.selections&&b.selections.length||0)+" evt|"+(b.totalOdd&&b.totalOdd.toFixed(1)||"\\u2014")+"</td><td>"+fF(b.mise||0)+"</td><td>"+pl+"</td><td style=\\"color:var(--o)\\">"+cf+"</td><td>"+tg+"</td></tr>"+ins;',
  '  }).join("")||"<tr><td colspan=\\"7\\" style=\\"text-align:center;color:#333;padding:30px\\">Aucun pari encore enregistr\\u00e9</td></tr>";',
  '  document.getElementById("root").innerHTML=',
  '    "<div class=\\"kgrid\\">"+kh+"</div>"',
  '    +"<section><div class=\\"sh\\" style=\\"color:var(--b)\\">\\u25c8 COURBE BANKROLL</div>"+buildChart(res)+"</section>"',
  '    +"<section><div class=\\"sh\\" style=\\"color:var(--o)\\">\\u25c8 INTELLIGENCE NARRATIVE</div>"+narrHtml+"</section>"',
  '    +"<section><div class=\\"sh\\" style=\\"color:var(--b)\\">\\u25c8 HISTORIQUE PARIS</div><div class=\\"tabs\\">"+tabH+"</div>"',
  '    +"<table><thead><tr><th>DATE</th><th>MATCHS</th><th>TICKET</th><th>MISE</th><th>P&L</th><th>CONFIANCE</th><th>STATUT</th></tr></thead><tbody>"+rows+"</tbody></table></section>";',
  '}',
  'function buildChart(res){if(!res.length)return"<div style=\\"height:50px;background:var(--bg2);border:1px solid var(--bd);border-radius:5px;display:flex;align-items:center;justify-content:center;color:#333;font-size:10px\\">En attente...</div>";var bank=5000,pts=[bank];res.slice(-40).forEach(function(b){bank=b.won?bank+(b.gainNet||0):bank-(b.mise||0);pts.push(Math.max(0,bank));});var mx=Math.max.apply(null,pts)||1,mn=Math.min.apply(null,pts)||0,rng=mx-mn||1;return"<div style=\\"height:50px;background:var(--bg2);border:1px solid var(--bd);border-radius:5px;padding:5px;display:flex;align-items:flex-end;gap:1px\\">"+pts.map(function(v,i){var h=Math.max(3,Math.round(((v-mn)/rng)*40));var c=i===0||v>=(pts[i-1]||v)?"var(--g)":"var(--r)";return"<div style=\\"flex:1;height:"+h+"px;background:"+c+";border-radius:1px;opacity:.7;min-width:2px\\"></div>";}).join("")+"</div>";}',
  'function setTab(t){tab=t;load();}',
  'function fF(n){return Math.round(n||0).toLocaleString("fr-FR")+" F";}',
  'function fP(n){return(n||0).toFixed(1)+"%";}',
  'function fD(s){return s?new Date(s).toLocaleDateString("fr-FR"):"\\u2014";}',
  'function esc(s){return(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}',
  'load();setInterval(load,30000);',
  '</script></body></html>',
  ].join("\n");
}

function createServer() {
  // Charger le module de sécurité
  var security = null;
  var accessToken = null;
  try {
    security = require("./securityCore");
    accessToken = security.generateAccessToken();
    logger.info("🔒 Sécurité v10 activée | Token: "+accessToken.slice(0,8)+"...");
    if (!global._securityScanStarted) { security.startPeriodicSecurityScan(); global._securityScanStarted = true; }
  } catch(e) { logger.warn("Sécurité non disponible: "+e.message); security = null; }

  var secMiddleware = security ? security.createSecurityMiddleware(accessToken) : null;

  function handleRequest(req, res) {
    var url=req.url.split("?")[0];
    var json={"Content-Type":"application/json","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","X-XSS-Protection":"1; mode=block","Strict-Transport-Security":"max-age=31536000","Cache-Control":"no-store"};
    var htmlH={"Content-Type":"text/html;charset=utf-8","X-Frame-Options":"DENY","X-XSS-Protection":"1; mode=block"};

    if(url==="/"||url==="/dashboard"){res.writeHead(200,htmlH);res.end(getDashboard());}
    else if(url==="/api/stats"){res.writeHead(200,json);res.end(JSON.stringify(loadStats()));}
    else if(url==="/api/bets"){res.writeHead(200,json);res.end(JSON.stringify(loadBets()));}
    else if(url==="/api/memory"){res.writeHead(200,json);res.end(JSON.stringify(loadMemory()));}
    else if(url==="/api/caps"){res.writeHead(200,json);res.end(JSON.stringify(loadCapabilities()));}
    else if(url==="/api/scores"){res.writeHead(200,json);res.end(JSON.stringify(loadDimensionScores()));}
    else if(url==="/api/causal"){res.writeHead(200,json);res.end(JSON.stringify(loadCausalJournal()));}
    else if(url==="/api/security"){var secData=security?security.getSecurityReport():{level:"unavailable",incidents:0,blocked:0};res.writeHead(200,json);res.end(JSON.stringify(secData));}
    else if(url==="/health"){
      var healthData={status:"ok",uptime:Math.floor(process.uptime()),ts:new Date().toISOString(),version:"v10"};
      if(security){var sr=security.getSecurityReport();healthData.security={level:sr.level,incidents:sr.incidents,blocked:sr.totalBlocked};}
      res.writeHead(200,json);res.end(JSON.stringify(healthData));
    }
    else{res.writeHead(404,json);res.end(JSON.stringify({error:"Not found"}));}
  }

  var srv=http.createServer(function(req,res){
    if (secMiddleware) {
      secMiddleware(req, res, handleRequest);
    } else {
      handleRequest(req, res);
    }
  });
  srv.listen(PORT,function(){logger.info("🌐 Dashboard v10 sécurisé: http://localhost:"+PORT+" | token:"+( accessToken&&accessToken.slice(0,8)+"..."));});
  return srv;
}

module.exports={createServer};
