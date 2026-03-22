// ─── TELEGRAM NOTIFIER v10 — Format clair et lisible ─────────────────────────
const https  = require("https");
const logger = require("./logger");

const TOKEN   = process.env.TELEGRAM_TOKEN   || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

function send(text) {
  if (!TOKEN || !CHAT_ID) { logger.warn("Telegram non configuré"); return Promise.resolve(null); }
  // Nettoyer le texte pour éviter les erreurs de parsing Markdown
  var clean = text.slice(0,4000)
    .replace(/[_*\[\]()~`>#+=|{}.!-]/g, function(c) {
      return '\\'+c; // Échapper tous les caractères spéciaux
    });
  // Utiliser mode texte simple pour éviter les erreurs de parse
  var body = JSON.stringify({ chat_id: CHAT_ID, text: text.slice(0,4000), parse_mode: "HTML" });
  return new Promise(function(resolve) {
    var opts = { hostname:"api.telegram.org", path:"/bot"+TOKEN+"/sendMessage", method:"POST", headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)} };
    var req = https.request(opts, function(res) {
      var d=""; res.on("data",function(c){d+=c;}); res.on("end",function(){
        try { var r=JSON.parse(d); if(r.ok) logger.info("📨 Telegram OK"); else { logger.warn("Telegram erreur: "+r.description+" — réessai sans formatage"); sendPlain(text.slice(0,4000)).then(resolve); return; } resolve(r); } catch { resolve(null); }
      });
    });
    req.on("error",function(){resolve(null);});
    req.setTimeout(8000,function(){req.destroy();resolve(null);});
    req.write(body); req.end();
  });
}

// Fallback sans formatage si HTML échoue
function sendPlain(text) {
  if (!TOKEN || !CHAT_ID) return Promise.resolve(null);
  var body = JSON.stringify({ chat_id: CHAT_ID, text: text });
  return new Promise(function(resolve) {
    var opts = { hostname:"api.telegram.org", path:"/bot"+TOKEN+"/sendMessage", method:"POST", headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)} };
    var req = https.request(opts, function(res) {
      var d=""; res.on("data",function(c){d+=c;}); res.on("end",function(){resolve(null);});
    });
    req.on("error",function(){resolve(null);});
    req.setTimeout(8000,function(){req.destroy();resolve(null);});
    req.write(body); req.end();
  });
}

// ─── NOUVEAU PARI ─────────────────────────────────────────────────────────────
function notifyNewBet(bet) {
  var sels = bet.selections||[];
  var lines = [];
  lines.push("🎯 <b>NOUVEAU PARI — Cycle #"+bet.cycleNum+"</b>");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("💰 Mise: <b>"+bet.mise+" FCFA</b>  |  Gain potentiel: <b>"+Math.round(bet.mise*(bet.totalOdd||1))+" FCFA</b>");
  lines.push("📊 Cote totale: <b>"+(bet.totalOdd||0).toFixed(2)+"</b>  |  Confiance: <b>"+Math.round((bet.confidence||0.5)*100)+"%</b>");
  if (bet.simulationResult) {
    lines.push("🎲 Probabilité simulée: <b>"+bet.simulationResult.prob+"</b>  |  ROI espéré: "+bet.simulationResult.roi);
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("<b>SÉLECTIONS ("+sels.length+" matchs):</b>");
  sels.forEach(function(s,i) {
    lines.push((i+1)+". <b>"+s.home+" vs "+s.away+"</b>");
    lines.push("   → "+s.market+": <b>"+s.outcome+"</b> @ <b>"+s.odd+"</b>");
    if (s.justification && s.justification !== "Fallback v7" && s.justification !== "Fallback v5") {
      lines.push("   💡 "+s.justification.slice(0,80));
    }
  });
  if (bet.reasoning && bet.reasoning.length > 5 && !bet.reasoning.includes("Fallback")) {
    lines.push("━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("🧠 <b>Analyse:</b> "+bet.reasoning.slice(0,200));
  }
  if (bet.weatherNote && bet.weatherNote.length > 3 && bet.weatherNote !== "N/A") {
    lines.push("🌦 "+bet.weatherNote.slice(0,100));
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("⏰ "+new Date(bet.timestamp).toLocaleString("fr-FR"));
  return send(lines.join("\n"));
}

// Version v7 avec champs supplémentaires
function notifyNewBetV7(bet, ticketSim, stressTest, reasoningVal) {
  return notifyNewBet(bet);
}

// ─── RÉSULTAT ─────────────────────────────────────────────────────────────────
function notifyResult(bet, accuracy, postMortem, winAnalysis) {
  var lines = [];
  lines.push(bet.won ? "✅ <b>PARI GAGNÉ !</b>" : "❌ <b>PARI PERDU</b>");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("📊 Cote: "+(bet.totalOdd||0).toFixed(2)+"  |  Mise: "+bet.mise+" FCFA");
  lines.push(bet.won ? "💚 Gain: <b>+"+bet.gainNet+" FCFA</b>" : "🔴 Perte: <b>-"+(bet.mise||0)+" FCFA</b>");
  if (accuracy) {
    lines.push("━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("🎯 Précision: <b>"+accuracy.globalAccuracy+"%</b>  ("+accuracy.correctSelections+"/"+accuracy.totalSelections+" correctes)");
    if (accuracy.wellPredicted && accuracy.wellPredicted.length) {
      lines.push("\n👍 <b>Bien prédits:</b>");
      accuracy.wellPredicted.slice(0,3).forEach(function(w){ lines.push("  ✓ "+w.slice(0,90)); });
    }
    if (accuracy.wrongPredicted && accuracy.wrongPredicted.length) {
      lines.push("\n👎 <b>Mal prédits:</b>");
      accuracy.wrongPredicted.slice(0,3).forEach(function(w){ lines.push("  ✗ "+w.slice(0,90)); });
    }
  }
  if (!bet.won && postMortem && postMortem.rootCauses && postMortem.rootCauses.length) {
    lines.push("━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("🔍 <b>Cause principale:</b>");
    lines.push("  • "+(postMortem.rootCauses[0]||"").slice(0,150));
    if (postMortem.remediation && postMortem.remediation.length) {
      lines.push("🔧 <b>Correction:</b> "+(postMortem.remediation[0]||"").slice(0,120));
    }
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("⏰ "+new Date(bet.resolvedAt||Date.now()).toLocaleString("fr-FR"));
  return send(lines.join("\n"));
}

// ─── RAPPORT DE CYCLE ─────────────────────────────────────────────────────────
function notifyCycleReport(stats, cycleNum, memory) {
  var roi = stats.totalMise>0 ? ((stats.gains-stats.pertes)/stats.totalMise*100).toFixed(1) : "0.0";
  var wr  = (stats.wins+stats.losses)>0 ? (stats.wins/(stats.wins+stats.losses)*100).toFixed(0) : "0";
  var lines = [];
  lines.push("📈 <b>RAPPORT CYCLE #"+cycleNum+"</b>");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("💰 Bankroll: <b>"+(stats.bankroll||5000).toLocaleString("fr-FR")+" FCFA</b>");
  lines.push("📊 ROI: <b>"+roi+"%</b>  |  Win rate: <b>"+wr+"%</b>");
  lines.push("✅ "+( stats.wins||0)+" gagnés  |  ❌ "+(stats.losses||0)+" perdus");
  lines.push("💚 Gains: +"+(stats.gains||0).toLocaleString("fr-FR")+" FCFA");
  lines.push("🔴 Pertes: -"+(stats.pertes||0).toLocaleString("fr-FR")+" FCFA");
  if (memory && memory.optimizationLog && memory.optimizationLog.length) {
    var last = memory.optimizationLog[memory.optimizationLog.length-1];
    if (last && last.changes && last.changes.length) {
      lines.push("━━━━━━━━━━━━━━━━━━━━━━");
      lines.push("🔧 <b>Corrections appliquées:</b>");
      last.changes.slice(0,3).forEach(function(c){ lines.push("  • "+c.slice(0,100)); });
    }
  }
  lines.push("⏰ "+new Date().toLocaleString("fr-FR"));
  return send(lines.join("\n"));
}

function notifyAlert(type, message) {
  var emoji = type==="integrity"?"🚨":type==="erreur"?"💥":"⚠️";
  return send(emoji+" <b>"+type.toUpperCase()+"</b>\n"+message.slice(0,400));
}

module.exports = { send, sendPlain, notifyNewBet, notifyNewBetV7, notifyResult, notifyCycleReport, notifyAlert };
