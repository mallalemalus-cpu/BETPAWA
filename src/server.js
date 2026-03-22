// ─── SERVEUR WEB + DASHBOARD v10 INTERACTIF ──────────────────────────────────
const http = require("http");
const { loadBets, loadStats, loadMemory, loadCapabilities, loadCausalJournal, loadDimensionScores } = require("./storage");
const logger = require("./logger");
const PORT = process.env.PORT || 3000;

function getDashboard(stats, bets, memory, scores) {
  var resolved = bets.filter(function(b){ return b.status==="resolved"; });
  var pending  = bets.filter(function(b){ return b.status==="pending"; });
  var wins     = resolved.filter(function(b){ return b.won; });
  var losses   = resolved.filter(function(b){ return !b.won; });
  var roi      = stats.totalMise > 0 ? ((stats.gains - stats.pertes) / stats.totalMise * 100).toFixed(1) : "0.0";
  var wr       = resolved.length > 0 ? (wins.length / resolved.length * 100).toFixed(0) : "0";
  var net      = (stats.gains || 0) - (stats.pertes || 0);
  var roiColor = parseFloat(roi) >= 0 ? "#00ff88" : "#ff4455";
  var wrColor  = parseInt(wr) >= 50 ? "#00ff88" : parseInt(wr) >= 35 ? "#ffaa00" : "#ff4455";

  // Courbe bankroll
  var bankHist = [5000];
  resolved.slice(-30).forEach(function(b){
    var last = bankHist[bankHist.length - 1];
    bankHist.push(b.won ? last + (b.gainNet || 0) : Math.max(0, last - (b.mise || 0)));
  });
  var maxB = Math.max.apply(null, bankHist), minB = Math.min.apply(null, bankHist);
  var rangeB = maxB - minB || 1;

  // Points SVG pour la courbe
  var svgW = 600, svgH = 80;
  var points = bankHist.map(function(v, i){
    var x = (i / Math.max(1, bankHist.length - 1)) * svgW;
    var y = svgH - ((v - minB) / rangeB) * (svgH - 10) - 5;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  var lastColor = bankHist[bankHist.length-1] >= bankHist[0] ? "#00ff88" : "#ff4455";

  // Données des paris pour JavaScript
  var betsJSON = JSON.stringify(bets.slice().reverse().slice(0, 50).map(function(b){
    return {
      id: b.id, date: b.timestamp ? b.timestamp.slice(0,10) : "—",
      matchs: (b.selections||[]).map(function(s){ return s.home+" vs "+s.away+" ("+s.market+":"+s.outcome+"@"+s.odd+")"; }),
      cote: b.totalOdd ? parseFloat(b.totalOdd).toFixed(1) : "—",
      mise: b.mise || 0,
      pnl: b.status==="pending" ? null : b.won ? (b.gainNet||0) : -(b.mise||0),
      conf: b.confidence ? Math.round(b.confidence*100) : 0,
      won: b.won,
      pending: b.status==="pending",
      reasoning: b.reasoning||"",
      narrative: b.narrativeInsight||"",
      bookmaker: b.bookmakerNote||"",
      weather: b.weatherNote||"",
      vig: b.vigAnalysis||"",
    };
  }));

  // Marchés
  var mktData = Object.keys(scores.markets||{}).filter(function(m){ return scores.markets[m].total >= 2; }).map(function(m){
    var s = scores.markets[m];
    return { market: m, rate: s.rate, correct: s.correct||0, total: s.total||0 };
  }).sort(function(a,b){ return b.rate - a.rate; });

  var anthropicOk = !!process.env.ANTHROPIC_API_KEY;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BetPawa AI Agent v10</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#07070f;--bg2:#0e0e1c;--bg3:#131325;--border:#1a1a2e;
  --green:#00ff88;--blue:#4488ff;--orange:#ffaa00;--red:#ff4455;--purple:#cc88ff;
  --text:#c0c0d0;--muted:#444;--font:"Courier New",monospace;
}
body{background:var(--bg);color:var(--text);font-family:var(--font);min-height:100vh;overflow-x:hidden;}

/* HEADER */
header{background:var(--bg2);border-bottom:2px solid rgba(0,255,136,0.15);padding:12px 20px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100;}
.logo{font-size:18px;font-weight:900;color:var(--green);letter-spacing:3px;}
.logo span{color:var(--blue);}
.badge{background:rgba(255,170,0,0.1);color:var(--orange);border:1px solid rgba(255,170,0,0.3);border-radius:3px;padding:2px 7px;font-size:9px;margin-left:6px;vertical-align:middle;}
.status{display:flex;align-items:center;gap:8px;}
.dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 10px var(--green);animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(0.8);}}
.subtext{font-size:8px;color:var(--muted);letter-spacing:2px;margin-top:2px;}

/* TABS */
.tabs{display:flex;background:var(--bg2);border-bottom:1px solid var(--border);padding:0 20px;overflow-x:auto;}
.tab{padding:10px 16px;font-size:10px;letter-spacing:1px;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;transition:all 0.2s;white-space:nowrap;}
.tab:hover{color:var(--text);}
.tab.active{color:var(--green);border-bottom-color:var(--green);}

/* PAGES */
.page{display:none;padding:16px 20px;}
.page.active{display:block;}

/* KPI GRID */
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px;}
.kpi{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;cursor:default;transition:all 0.2s;position:relative;overflow:hidden;}
.kpi:hover{border-color:rgba(68,136,255,0.4);transform:translateY(-2px);box-shadow:0 4px 20px rgba(0,0,0,0.3);}
.kpi::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--blue),transparent);opacity:0;transition:opacity 0.3s;}
.kpi:hover::before{opacity:1;}
.kl{font-size:8px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;}
.kv{font-size:22px;font-weight:900;line-height:1.1;}
.ks{font-size:9px;color:var(--muted);margin-top:4px;}

/* SECTION HEADER */
.sh{font-size:9px;letter-spacing:2px;color:var(--blue);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;}

/* COURBE BANKROLL */
.chart-container{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px;position:relative;}
.chart-container:hover{border-color:rgba(0,255,136,0.3);}
svg.sparkline{width:100%;height:80px;overflow:visible;}
.chart-stats{display:flex;gap:20px;margin-top:8px;font-size:10px;}
.cs{color:var(--muted);}
.cs span{font-weight:700;}

/* TABLEAU PARIS */
.bets-table{width:100%;border-collapse:collapse;font-size:11px;}
.bets-table th{font-size:8px;letter-spacing:1px;color:var(--muted);padding:8px;text-align:left;border-bottom:1px solid var(--border);}
.bets-table td{padding:10px 8px;border-bottom:1px solid rgba(26,26,46,0.5);cursor:pointer;transition:background 0.15s;}
.bets-table tr:hover td{background:rgba(68,136,255,0.05);}
.bet-row.won td:first-child{border-left:3px solid var(--green);}
.bet-row.lost td:first-child{border-left:3px solid var(--red);}
.bet-row.pending td:first-child{border-left:3px solid var(--orange);}
.status-badge{padding:2px 7px;border-radius:20px;font-size:9px;font-weight:700;}
.status-won{background:rgba(0,255,136,0.15);color:var(--green);}
.status-lost{background:rgba(255,68,85,0.15);color:var(--red);}
.status-pending{background:rgba(255,170,0,0.15);color:var(--orange);}

/* DÉTAIL PARI (modal) */
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1000;padding:20px;overflow-y:auto;}
.modal-overlay.open{display:flex;align-items:flex-start;justify-content:center;}
.modal{background:var(--bg2);border:1px solid var(--border);border-radius:14px;width:100%;max-width:600px;margin:auto;}
.modal-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;}
.modal-body{padding:20px;}
.modal-close{background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;transition:color 0.2s;}
.modal-close:hover{color:var(--text);}
.detail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(26,26,46,0.5);font-size:11px;}
.detail-row:last-child{border:none;}
.detail-label{color:var(--muted);}
.detail-val{color:var(--text);text-align:right;max-width:60%;}
.selections-list{margin-top:12px;}
.sel-item{background:rgba(68,136,255,0.05);border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:6px;}
.sel-match{font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;}
.sel-info{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;}
.sel-badge{padding:2px 8px;border-radius:20px;font-size:9px;}
.badge-market{background:rgba(68,136,255,0.15);color:var(--blue);}
.badge-odd{background:rgba(204,136,255,0.15);color:var(--purple);}
.badge-edge{background:rgba(0,255,136,0.15);color:var(--green);}
.badge-edge-neg{background:rgba(255,68,85,0.15);color:var(--red);}
.sel-just{font-size:9px;color:var(--muted);margin-top:4px;line-height:1.5;}

/* MARCHÉS */
.market-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:16px;}
.mkt-card{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;transition:all 0.2s;cursor:default;}
.mkt-card:hover{transform:translateY(-2px);border-color:rgba(0,255,136,0.3);}
.mkt-bar{height:4px;border-radius:2px;margin:8px 0;background:var(--border);}
.mkt-bar-fill{height:100%;border-radius:2px;transition:width 0.8s ease;}

/* INTELLIGENCE */
.intel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px;}
.intel-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;}
.intel-title{font-size:9px;letter-spacing:2px;color:var(--blue);margin-bottom:10px;text-transform:uppercase;}
.intel-item{display:flex;align-items:flex-start;gap:8px;padding:5px 0;font-size:11px;border-bottom:1px solid rgba(26,26,46,0.5);}
.intel-item:last-child{border:none;}
.intel-icon{font-size:14px;flex-shrink:0;}
.intel-text{color:var(--muted);line-height:1.5;}
.intel-text strong{color:var(--text);}

/* FILTRES */
.filters{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;}
.filter-btn{background:rgba(26,26,46,0.8);border:1px solid var(--border);color:var(--muted);padding:5px 12px;border-radius:20px;font-size:9px;cursor:pointer;letter-spacing:1px;transition:all 0.2s;}
.filter-btn:hover,.filter-btn.active{background:rgba(68,136,255,0.15);border-color:var(--blue);color:var(--blue);}

/* LIVE INDICATOR */
.live-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(255,68,85,0.1);border:1px solid rgba(255,68,85,0.3);padding:2px 8px;border-radius:20px;font-size:9px;color:var(--red);}
.live-dot{width:5px;height:5px;border-radius:50%;background:var(--red);animation:pulse 1s infinite;}

/* LOADING BAR */
.progress{height:2px;background:var(--border);border-radius:1px;overflow:hidden;margin-bottom:16px;}
.progress-bar{height:100%;background:linear-gradient(90deg,var(--green),var(--blue));animation:loading 2s linear infinite;}
@keyframes loading{0%{transform:translateX(-100%);}100%{transform:translateX(200%);}}

/* TOOLTIPS */
[data-tip]{position:relative;}
[data-tip]:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);color:var(--text);padding:5px 10px;border-radius:5px;font-size:10px;white-space:nowrap;z-index:200;pointer-events:none;}

/* RESPONSIVE */
@media(max-width:480px){
  .kpi-grid{grid-template-columns:1fr 1fr;}
  .tabs .tab{padding:8px 12px;font-size:9px;}
  .bets-table th:nth-child(n+4),.bets-table td:nth-child(n+4){display:none;}
}

/* ANIMATIONS ENTRÉE */
@keyframes fadeIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
.kpi{animation:fadeIn 0.4s ease both;}
.kpi:nth-child(1){animation-delay:0.05s;}.kpi:nth-child(2){animation-delay:0.1s;}.kpi:nth-child(3){animation-delay:0.15s;}.kpi:nth-child(4){animation-delay:0.2s;}.kpi:nth-child(5){animation-delay:0.25s;}.kpi:nth-child(6){animation-delay:0.3s;}.kpi:nth-child(7){animation-delay:0.35s;}.kpi:nth-child(8){animation-delay:0.4s;}
</style>
</head>
<body>

<header>
  <div>
    <div class="logo">BETPAWA <span>AI</span><span class="badge">v10</span></div>
    <div class="subtext">FOOTBALL &bull; 30–400 &bull; 10 DIM &bull; SÉCURITÉ BLOCKCHAIN &bull; AUTONOMIE</div>
  </div>
  <div class="status">
    <span class="live-badge"><span class="live-dot"></span>LIVE</span>
    <span class="dot"></span>
    <span style="color:var(--green);font-size:10px;">ACTIF 24/7</span>
  </div>
</header>

<div class="tabs">
  <div class="tab active" onclick="showPage('overview')">📊 Vue d'ensemble</div>
  <div class="tab" onclick="showPage('bets')">🎯 Paris</div>
  <div class="tab" onclick="showPage('markets')">📈 Marchés</div>
  <div class="tab" onclick="showPage('intelligence')">🧠 Intelligence</div>
</div>

<!-- PAGE: VUE D'ENSEMBLE -->
<div class="page active" id="page-overview">
  <div class="progress"><div class="progress-bar"></div></div>

  <div class="kpi-grid">
    <div class="kpi" data-tip="Bankroll actuelle">
      <div class="kl">BANKROLL</div>
      <div class="kv" style="color:var(--green)">${(stats.bankroll||5000).toLocaleString("fr-FR")}<small style="font-size:12px;color:var(--muted)"> F</small></div>
      <div class="ks">Départ: 5 000 FCFA</div>
    </div>
    <div class="kpi" data-tip="Retour sur investissement">
      <div class="kl">ROI</div>
      <div class="kv" style="color:${roiColor}">${roi}%</div>
      <div class="ks">Retour/investissement</div>
    </div>
    <div class="kpi" data-tip="Pourcentage de tickets gagnants">
      <div class="kl">WIN RATE</div>
      <div class="kv" style="color:${wrColor}">${wr}%</div>
      <div class="ks">${wins.length} gagné / ${losses.length} perdu</div>
    </div>
    <div class="kpi" data-tip="Gains moins pertes">
      <div class="kl">NET P&amp;L</div>
      <div class="kv" style="color:${net>=0?"var(--green)":"var(--red)"}">${net>=0?"+":""}${Math.round(net).toLocaleString("fr-FR")}<small style="font-size:12px;color:var(--muted)"> F</small></div>
      <div class="ks">Gains − Pertes</div>
    </div>
    <div class="kpi" data-tip="Cycles effectués toutes les 6h">
      <div class="kl">CYCLES</div>
      <div class="kv" style="color:var(--purple)">${memory.cycles||0}</div>
      <div class="ks">Toutes les 6h</div>
    </div>
    <div class="kpi" data-tip="Paris en attente de résultat">
      <div class="kl">EN ATTENTE</div>
      <div class="kv" style="color:var(--orange)">${pending.length}</div>
      <div class="ks">Paris en cours</div>
    </div>
    <div class="kpi" data-tip="Total des paris placés">
      <div class="kl">TOTAL PARIS</div>
      <div class="kv" style="color:#44ddff">${bets.length}</div>
      <div class="ks">Résolus: ${resolved.length}</div>
    </div>
    <div class="kpi" data-tip="Sécurité blockchain active">
      <div class="kl">SÉCURITÉ</div>
      <div class="kv" style="color:var(--green);font-size:13px;">ACTIVE</div>
      <div class="ks">Zero trust · Whitelist · Auto-heal</div>
    </div>
  </div>

  <div class="chart-container">
    <div class="sh">Évolution de la Bankroll
      <span style="font-size:9px;color:var(--muted)">${bankHist.length} points</span>
    </div>
    <svg class="sparkline" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${lastColor}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${lastColor}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polyline points="${points}" fill="none" stroke="${lastColor}" stroke-width="2" stroke-linejoin="round"/>
      ${bankHist.map(function(v,i){
        var x = (i / Math.max(1, bankHist.length-1)) * svgW;
        var y = svgH - ((v - minB) / rangeB) * (svgH-10) - 5;
        var isLast = i === bankHist.length-1;
        return isLast ? '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="4" fill="'+lastColor+'" stroke="'+lastColor+'" stroke-width="2"/><circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="8" fill="none" stroke="'+lastColor+'" stroke-width="1" opacity="0.3"><animate attributeName="r" values="4;12;4" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/></circle>' : '';
      }).join("")}
    </svg>
    <div class="chart-stats">
      <div class="cs">Max: <span style="color:var(--green)">${maxB.toLocaleString("fr-FR")} F</span></div>
      <div class="cs">Min: <span style="color:var(--red)">${minB.toLocaleString("fr-FR")} F</span></div>
      <div class="cs">Actuel: <span style="color:${lastColor}">${(stats.bankroll||5000).toLocaleString("fr-FR")} F</span></div>
    </div>
  </div>

  <div class="sh">Derniers paris <span style="font-size:9px;color:var(--muted)">Cliquer pour les détails</span></div>
  <div style="overflow-x:auto">
    <table class="bets-table">
      <thead><tr><th>DATE</th><th>MATCHS</th><th>COTE</th><th>MISE</th><th>P&amp;L</th><th>STATUT</th></tr></thead>
      <tbody id="bets-preview"></tbody>
    </table>
  </div>
</div>

<!-- PAGE: PARIS -->
<div class="page" id="page-bets">
  <div class="filters">
    <button class="filter-btn active" onclick="filterBets('all',this)">TOUS</button>
    <button class="filter-btn" onclick="filterBets('pending',this)">EN ATTENTE</button>
    <button class="filter-btn" onclick="filterBets('won',this)">GAGNÉS</button>
    <button class="filter-btn" onclick="filterBets('lost',this)">PERDUS</button>
  </div>
  <div style="overflow-x:auto">
    <table class="bets-table">
      <thead><tr><th>DATE</th><th>MATCHS</th><th>COTE</th><th>MISE</th><th>P&amp;L</th><th>CONF</th><th>STATUT</th></tr></thead>
      <tbody id="bets-full"></tbody>
    </table>
  </div>
  <div id="no-bets" style="display:none;text-align:center;padding:40px;color:var(--muted);font-size:12px;">
    Aucun pari dans cette catégorie
  </div>
</div>

<!-- PAGE: MARCHÉS -->
<div class="page" id="page-markets">
  <div class="sh">Win Rate par Marché</div>
  <div class="market-grid" id="market-cards"></div>

  <div class="sh" style="margin-top:16px">Ligues analysées</div>
  <div id="league-stats" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;"></div>
</div>

<!-- PAGE: INTELLIGENCE -->
<div class="page" id="page-intelligence">
  <div class="intel-grid">
    <div class="intel-card">
      <div class="intel-title">Cerveaux actifs</div>
      <div class="intel-item"><span class="intel-icon">🧮</span><div class="intel-text"><strong>Poisson bivarié</strong><br>xG estimés → proba exactes</div></div>
      <div class="intel-item"><span class="intel-icon">⚡</span><div class="intel-text"><strong>Elo étendu</strong><br>Force relative + avantage domicile</div></div>
      <div class="intel-item"><span class="intel-icon">📊</span><div class="intel-text"><strong>Expected Value</strong><br>Edge ≥ +2% requis pour chaque sél.</div></div>
      <div class="intel-item"><span class="intel-icon">💼</span><div class="intel-text"><strong>Portfolio builder</strong><br>Max 2 du même marché · max 3 par ligue</div></div>
      <div class="intel-item"><span class="intel-icon">🎲</span><div class="intel-text"><strong>Monte Carlo</strong><br>10 000 simulations/match</div></div>
    </div>
    <div class="intel-card">
      <div class="intel-title">Protection active</div>
      <div class="intel-item"><span class="intel-icon">🔒</span><div class="intel-text"><strong>Sécurité blockchain</strong><br>Zero trust · whitelist · rate limit</div></div>
      <div class="intel-item"><span class="intel-icon">🛡</span><div class="intel-text"><strong>Auto-guérison</strong><br>Scan intégrité toutes les heures</div></div>
      <div class="intel-item"><span class="intel-icon">🔍</span><div class="intel-text"><strong>Anti-biais cognitifs</strong><br>Gambler fallacy · overconfidence</div></div>
      <div class="intel-item"><span class="intel-icon">🚫</span><div class="intel-text"><strong>Anti-pattern</strong><br>Détection surexploitation marchés</div></div>
      <div class="intel-item"><span class="intel-icon">✅</span><div class="intel-text"><strong>Déduplication</strong><br>Même équipe 1 seule fois/jour</div></div>
    </div>
    <div class="intel-card">
      <div class="intel-title">Statut Claude Opus</div>
      <div class="intel-item">
        <span class="intel-icon">${anthropicOk ? "🟡" : "🔴"}</span>
        <div class="intel-text">
          <strong>${anthropicOk ? "Clé présente" : "Non configuré"}</strong><br>
          ${anthropicOk ? "Vérifier crédits sur console.anthropic.com" : "ANTHROPIC_API_KEY manquant"}
        </div>
      </div>
      <div class="intel-item"><span class="intel-icon">🤖</span><div class="intel-text"><strong>Fallback actif</strong><br>Cerveau mathématique autonome opérationnel sans Anthropic</div></div>
      <div class="intel-item"><span class="intel-icon">🔄</span><div class="intel-text"><strong>Cycles effectués: ${memory.cycles||0}</strong><br>Optimisations: ${(memory.optimizationLog&&memory.optimizationLog.length)||0}</div></div>
      <div class="intel-item"><span class="intel-icon">📅</span><div class="intel-text"><strong>Dernier cycle</strong><br>${stats.lastCycle ? new Date(stats.lastCycle).toLocaleString("fr-FR") : "Aucun"}</div></div>
    </div>
  </div>
</div>

<!-- MODAL DÉTAIL PARI -->
<div class="modal-overlay" id="modal" onclick="closeModal(event)">
  <div class="modal" onclick="event.stopPropagation()">
    <div class="modal-header">
      <span id="modal-title" style="font-size:13px;font-weight:700;color:var(--text)">Détail du pari</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" id="modal-body"></div>
  </div>
</div>

<footer style="text-align:center;padding:10px;color:var(--muted);font-size:9px;border-top:1px solid var(--border);margin-top:8px;">
  BetPawa AI Agent v10 · Mise à jour auto 60s · <span id="last-update">${new Date().toLocaleTimeString("fr-FR")}</span>
</footer>

<script>
var ALL_BETS = ${betsJSON};
var MKT_DATA = ${JSON.stringify(mktData)};
var currentFilter = 'all';

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
  document.getElementById('page-'+name).classList.add('active');
  event.target.classList.add('active');
  if (name==='markets') renderMarkets();
}

// ─── RENDER BETS TABLE ────────────────────────────────────────────────────────
function renderBetsTable(tbodyId, bets) {
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = bets.map(function(b, i) {
    var statusClass = b.pending ? 'pending' : b.won ? 'won' : 'lost';
    var statusBadge = b.pending
      ? '<span class="status-badge status-pending">ATTENTE</span>'
      : b.won
        ? '<span class="status-badge status-won">GAGNÉ</span>'
        : '<span class="status-badge status-lost">PERDU</span>';
    var pnlHtml = b.pnl === null ? '<span style="color:var(--muted)">—</span>'
      : b.pnl >= 0
        ? '<span style="color:var(--green)">+'+b.pnl.toLocaleString('fr-FR')+'F</span>'
        : '<span style="color:var(--red)">'+b.pnl.toLocaleString('fr-FR')+'F</span>';
    var matchSummary = b.matchs.slice(0,2).join(', ') + (b.matchs.length>2 ? ' <span style="color:var(--muted)">+' + (b.matchs.length-2) + '</span>' : '');
    var confHtml = b.conf ? '<span style="color:var(--orange)">' + b.conf + '%</span>' : '—';
    return '<tr class="bet-row '+statusClass+'" onclick="openBet('+i+')" style="animation:fadeIn 0.3s ease '+(i*0.03)+'s both">'
      + '<td style="color:var(--muted);font-size:10px">'+b.date+'</td>'
      + '<td style="color:var(--text);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+matchSummary+'</td>'
      + '<td style="color:var(--purple)">×'+b.cote+'</td>'
      + '<td>'+b.mise+'F</td>'
      + '<td>'+pnlHtml+'</td>'
      + (tbodyId==='bets-full' ? '<td>'+confHtml+'</td>' : '')
      + '<td>'+statusBadge+'</td>'
      + '</tr>';
  }).join('');
}

// ─── FILTRE PARIS ─────────────────────────────────────────────────────────────
function filterBets(type, btn) {
  currentFilter = type;
  document.querySelectorAll('.filter-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  var filtered = ALL_BETS.filter(function(b) {
    if (type==='all') return true;
    if (type==='pending') return b.pending;
    if (type==='won') return b.won && !b.pending;
    if (type==='lost') return !b.won && !b.pending;
    return true;
  });
  renderBetsTable('bets-full', filtered);
  document.getElementById('no-bets').style.display = filtered.length===0 ? 'block' : 'none';
}

// ─── MODAL DÉTAIL ─────────────────────────────────────────────────────────────
function openBet(idx) {
  var b = ALL_BETS[idx];
  if (!b) return;
  var statusColor = b.pending ? 'var(--orange)' : b.won ? 'var(--green)' : 'var(--red)';
  var statusText  = b.pending ? 'EN ATTENTE' : b.won ? 'GAGNÉ ✓' : 'PERDU ✗';
  var pnlText = b.pnl === null ? '—' : (b.pnl >= 0 ? '+' : '') + b.pnl.toLocaleString('fr-FR') + ' FCFA';

  document.getElementById('modal-title').innerHTML = '<span style="color:'+statusColor+'">'+statusText+'</span> · '+b.date;

  var body = '<div class="detail-row"><span class="detail-label">Cote totale</span><span class="detail-val" style="color:var(--purple)">×'+b.cote+'</span></div>'
    + '<div class="detail-row"><span class="detail-label">Mise</span><span class="detail-val">'+b.mise+' FCFA</span></div>'
    + '<div class="detail-row"><span class="detail-label">P&L</span><span class="detail-val" style="color:'+statusColor+'">'+pnlText+'</span></div>'
    + '<div class="detail-row"><span class="detail-label">Confiance</span><span class="detail-val" style="color:var(--orange)">'+(b.conf||'—')+'%</span></div>'
    + (b.narrative ? '<div class="detail-row"><span class="detail-label">Analyse</span><span class="detail-val" style="color:var(--muted);font-size:10px">'+b.narrative.slice(0,150)+'</span></div>' : '')
    + (b.bookmaker ? '<div class="detail-row"><span class="detail-label">Bookmaker</span><span class="detail-val" style="color:var(--muted);font-size:10px">'+b.bookmaker.slice(0,120)+'</span></div>' : '')
    + '<div class="selections-list"><div class="sh" style="margin-bottom:8px">Sélections ('+b.matchs.length+')</div>';

  b.matchs.forEach(function(m) {
    var parts = m.match(/^(.+?) \((.+?):(.+?)@(.+?)\)$/);
    if (parts) {
      var edge = parseFloat(parts[4]) < 2.5 ? 'badge-edge-neg' : 'badge-edge';
      body += '<div class="sel-item"><div class="sel-match">'+parts[1]+'</div>'
        + '<div class="sel-info">'
        + '<span class="sel-badge badge-market">'+parts[2]+'</span>'
        + '<span class="sel-badge" style="background:rgba(204,136,255,0.15);color:var(--purple)">'+parts[3]+'</span>'
        + '<span class="sel-badge badge-odd">@'+parts[4]+'</span>'
        + '</div></div>';
    } else {
      body += '<div class="sel-item"><div class="sel-match">'+m+'</div></div>';
    }
  });
  body += '</div>';

  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(e) {
  if (!e || e.target===document.getElementById('modal')) {
    document.getElementById('modal').classList.remove('open');
    document.body.style.overflow = '';
  }
}
document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeModal(); });

// ─── MARCHÉS ─────────────────────────────────────────────────────────────────
function renderMarkets() {
  var grid = document.getElementById('market-cards');
  if (!MKT_DATA.length) {
    grid.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:20px">En cours d\'accumulation...</div>';
    return;
  }
  grid.innerHTML = MKT_DATA.map(function(m) {
    var pct = Math.round(m.rate*100);
    var c = pct>=55 ? 'var(--green)' : pct>=35 ? 'var(--orange)' : 'var(--red)';
    return '<div class="mkt-card">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      + '<span style="font-size:11px;font-weight:700;color:var(--text)">'+m.market+'</span>'
      + '<span style="font-size:16px;font-weight:900;color:'+c+'">'+pct+'%</span>'
      + '</div>'
      + '<div class="mkt-bar"><div class="mkt-bar-fill" style="width:'+pct+'%;background:'+c+'"></div></div>'
      + '<div style="font-size:9px;color:var(--muted)">'+m.correct+' / '+m.total+' corrects</div>'
      + '</div>';
  }).join('');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
renderBetsTable('bets-preview', ALL_BETS.slice(0,5));
renderBetsTable('bets-full', ALL_BETS);

// Rafraîchissement auto
setTimeout(function(){ location.reload(); }, 60000);
document.getElementById('last-update').textContent = new Date().toLocaleTimeString('fr-FR');
</script>
</body></html>`;
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
        res.writeHead(200, {"Content-Type":"text/html;charset=utf-8"}); res.end(html);
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
  srv.listen(PORT, function(){ logger.info("🌐 Dashboard v10 interactif: http://localhost:"+PORT); });
  return srv;
}

module.exports = { createServer };
