// ─── TELEGRAM NOTIFIER v5 ────────────────────────────────────────────────────
const https  = require("https");
const logger = require("./logger");

const TOKEN   = process.env.TELEGRAM_TOKEN   || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

function sendRequest(method, payload) {
  return new Promise(function(resolve) {
    if (!TOKEN||!CHAT_ID){resolve(null);return;}
    var body=JSON.stringify(payload);
    var opts={hostname:"api.telegram.org",path:"/bot"+TOKEN+"/"+method,method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}};
    var req=https.request(opts,function(res){var d="";res.on("data",function(c){d+=c;});res.on("end",function(){try{resolve(JSON.parse(d));}catch{resolve(null);}});});
    req.on("error",function(){resolve(null);});
    req.setTimeout(8000,function(){req.destroy();resolve(null);});
    req.write(body);req.end();
  });
}

function send(text) {
  if(!TOKEN||!CHAT_ID){logger.warn("Telegram non configuré");return Promise.resolve(null);}
  return sendRequest("sendMessage",{chat_id:CHAT_ID,text:text.slice(0,4096),parse_mode:"Markdown",disable_web_page_preview:true})
    .then(function(r){if(r&&r.ok)logger.info("📨 Telegram OK");else logger.warn("Telegram: "+JSON.stringify(r));return r;});
}

// ─── NOUVEAU PARI ─────────────────────────────────────────────────────────────
function notifyNewBet(bet) {
  var lines=[];
  lines.push("🎯 *NOUVEAU PARI — Cycle #"+bet.cycleNum+"*");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("🆔 `"+bet.id+"`");
  lines.push("💰 Mise: *"+bet.mise+" FCFA* | Gain potentiel: *"+Math.round(bet.mise*(bet.totalOdd||1))+" FCFA*");
  lines.push("📊 Cote totale: *"+(bet.totalOdd||0).toFixed(2)+"*");
  lines.push("🔒 Fiabilité estimée: *"+Math.round((bet.confidence||0.5)*100)+"%*");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("*SÉLECTIONS ("+( bet.selections||[]).length+" événements):*");
  (bet.selections||[]).forEach(function(s,i){
    lines.push((i+1)+". *"+s.home+" vs "+s.away+"*");
    lines.push("   └ "+s.market+": *"+s.outcome+"* @ "+s.odd+(s.justification?" — _"+s.justification.slice(0,70)+"_":""));
  });
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  // Intelligence narrative
  if(bet.narrativeInsight)   lines.push("📖 *Récit:* _"+bet.narrativeInsight.slice(0,200)+"_");
  if(bet.emotionalInsight)   lines.push("❤️ *Émotions:* _"+bet.emotionalInsight.slice(0,150)+"_");
  if(bet.stakesNote)         lines.push("🏆 *Enjeux:* _"+bet.stakesNote.slice(0,150)+"_");
  if(bet.weatherNote)        lines.push("🌦 *Météo:* _"+bet.weatherNote.slice(0,100)+"_");
  if(bet.integrityNote)      lines.push("⚠️ *Intégrité:* _"+bet.integrityNote.slice(0,100)+"_");
  if(bet.xFactors)           lines.push("🎲 *Facteurs X:* _"+bet.xFactors.slice(0,100)+"_");
  if(bet.selfCritique)       lines.push("🤔 *Auto-critique:* _"+bet.selfCritique.slice(0,150)+"_");
  if(bet.causalInsightUsed)  lines.push("🧬 *Leçon appliquée:* _"+bet.causalInsightUsed.slice(0,120)+"_");
  lines.push("");
  lines.push("⏰ "+new Date(bet.timestamp).toLocaleString("fr-FR"));
  return send(lines.join("\n"));
}

// ─── RÉSULTAT D'UN PARI ───────────────────────────────────────────────────────
function notifyResult(bet, accuracy, postMortem, winAnalysis) {
  var won=bet.won, gain=bet.gainNet||0, lines=[];
  lines.push(won?"✅ *PARI GAGNÉ !*":"❌ *PARI PERDU*");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("🆔 `"+bet.id+"` | Cote: "+(bet.totalOdd||0).toFixed(2));
  lines.push(won?"💚 Gain net: *+"+gain+" FCFA*":"🔴 Perte: *-"+(bet.mise||0)+" FCFA*");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");

  // Analyse de précision sélection par sélection
  if(accuracy){
    lines.push("*PRÉCISION SÉLECTION PAR SÉLECTION:*");
    lines.push("🎯 Précision: *"+accuracy.globalAccuracy+"%* | "+accuracy.correctSelections+"/"+accuracy.totalSelections+" correctes");
    lines.push("Confiance estimée: *"+Math.round((bet.confidence||0.5)*100)+"%* → Précision réelle: *"+accuracy.realizedRate+"%*");
    if(accuracy.wellPredicted&&accuracy.wellPredicted.length){lines.push(""); lines.push("👍 *Bien prédits:*"); accuracy.wellPredicted.slice(0,3).forEach(function(w){lines.push("  ✓ "+w.slice(0,100));});}
    if(accuracy.wrongPredicted&&accuracy.wrongPredicted.length){lines.push(""); lines.push("👎 *Mal prédits:*"); accuracy.wrongPredicted.slice(0,3).forEach(function(w){lines.push("  ✗ "+w.slice(0,100));});}
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━");

  // COMPRÉHENSION NARRATIVE du résultat
  if(!won && postMortem){
    lines.push("*COMPRÉHENSION DE LA DÉFAITE:*");
    if(postMortem.narrativeAnalysis&&postMortem.narrativeAnalysis.aiExplanation){
      lines.push("📖 *Pourquoi:* _"+postMortem.narrativeAnalysis.aiExplanation.slice(0,250)+"_");
    }
    if(postMortem.rootCauses&&postMortem.rootCauses.length){
      lines.push("🔍 *Causes racines:*");
      postMortem.rootCauses.slice(0,2).forEach(function(c){lines.push("  • "+c.slice(0,120));});
    }
    if(postMortem.wasAvoidable===true) lines.push("⚡ *Cette perte était évitable* — correction appliquée au prochain cycle");
    else if(postMortem.wasAvoidable===false) lines.push("🎲 *Perte incompressible* — aléa statistique, pas d'ajustement brutal");
    if(postMortem.remediation&&postMortem.remediation.length){
      lines.push("🔧 *Correction immédiate:* _"+postMortem.remediation[0].slice(0,150)+"_");
    }
  } else if(won && winAnalysis){
    lines.push("*COMPRÉHENSION DE LA VICTOIRE:*");
    if(winAnalysis.narrativeWinReason) lines.push("📖 *Pourquoi ça a marché:* _"+winAnalysis.narrativeWinReason.slice(0,200)+"_");
    if(winAnalysis.successFactors&&winAnalysis.successFactors.length){
      lines.push("✨ *Facteurs clés:*");
      winAnalysis.successFactors.slice(0,2).forEach(function(f){lines.push("  • "+f.slice(0,100));});
    }
    if(winAnalysis.replicablePattern) lines.push("♻️ *Pattern à reproduire:* `"+winAnalysis.replicablePattern+"`");
  } else if(accuracy&&accuracy.lesson){
    lines.push("📚 *Leçon:* _"+accuracy.lesson.slice(0,200)+"_");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("⏰ "+new Date(bet.resolvedAt||Date.now()).toLocaleString("fr-FR"));
  return send(lines.join("\n"));
}

// ─── RAPPORT DE CYCLE ─────────────────────────────────────────────────────────
function notifyCycleReport(stats, cycleNum, memory) {
  var roi=stats.totalMise>0?((stats.gains-stats.pertes)/stats.totalMise*100).toFixed(1):"0.0";
  var wr=(stats.wins+stats.losses)>0?(stats.wins/(stats.wins+stats.losses)*100).toFixed(1):"0.0";
  var lines=[];
  lines.push("📊 *RAPPORT CYCLE #"+cycleNum+"*");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("💰 Bankroll: *"+((stats.bankroll||5000).toLocaleString("fr-FR"))+" FCFA*");
  lines.push("📈 ROI: *"+roi+"%*  |  Win rate: *"+wr+"%*");
  lines.push("✅ "+( stats.wins||0)+" gagnés  |  ❌ "+(stats.losses||0)+" perdus");
  lines.push("💚 Gains: +"+Math.round(stats.gains||0).toLocaleString("fr-FR")+" FCFA");
  lines.push("🔴 Pertes: -"+Math.round(stats.pertes||0).toLocaleString("fr-FR")+" FCFA");
  if(memory&&memory.latestNarrativeInsight){
    lines.push("━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("🧠 *Insight narratif:* _"+memory.latestNarrativeInsight.slice(0,200)+"_");
  }
  if(memory&&memory.optimizationLog&&memory.optimizationLog.length){
    var lastOpt=memory.optimizationLog[memory.optimizationLog.length-1];
    if(lastOpt&&lastOpt.changes&&lastOpt.changes.length){
      lines.push("━━━━━━━━━━━━━━━━━━━━━━");
      lines.push("🔧 *Dernières corrections:*");
      lastOpt.changes.slice(0,3).forEach(function(c){lines.push("  • "+c.slice(0,100));});
    }
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("⏰ "+new Date().toLocaleString("fr-FR"));
  return send(lines.join("\n"));
}

function notifyAlert(type,message){
  var emoji=type==="integrity"?"🚨":type==="weather"?"🌦":type==="optimize"?"🔧":type==="erreur"?"💥":"⚠️";
  return send(emoji+" *ALERTE "+type.toUpperCase()+"*\n"+message.slice(0,500));
}

module.exports = { send, notifyNewBet, notifyResult, notifyCycleReport, notifyAlert };

// ─── NOUVEAU PARI v7 (avec simulation + stress test + validation raisonnement) ─
function notifyNewBetV7(bet, ticketSim, stressTest, reasoningVal) {
  var lines = [];
  lines.push("🎯 *PARI v7 — Cycle #"+bet.cycleNum+"*");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("🆔 `"+bet.id+"`");
  lines.push("💰 Mise: *"+bet.mise+" FCFA* | Gain potentiel: *"+Math.round(bet.mise*(bet.totalOdd||1))+" FCFA*");
  lines.push("📊 Cote: *"+(bet.totalOdd||0).toFixed(2)+"* | Fiabilité: *"+Math.round((bet.confidence||0.5)*100)+"%*");
  if (ticketSim) {
    lines.push("🎲 Prob simulée (Monte Carlo): *"+ticketSim.simulatedWinProb*100 > 0 ? (ticketSim.simulatedWinProb*100).toFixed(3)+"%" : "< 0.001%"+"*");
    lines.push("📈 ROI espéré: *"+ticketSim.expectedROI+"%* | Edge: *"+ticketSim.edgePct+"%*");
  }
  if (stressTest) lines.push("🛡 Robustesse: *"+stressTest.robustness+"% ("+stressTest.robustnessRating+")*");
  if (reasoningVal && !reasoningVal.isLogicallySound) lines.push("⚠️ Biais détectés: "+reasoningVal.flawsFound+" — corrigés auto");
  else if (reasoningVal) lines.push("✅ Raisonnement validé — aucun biais majeur");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("*SÉLECTIONS ("+( bet.selections||[]).length+"):*");
  (bet.selections||[]).forEach(function(s,i){
    lines.push((i+1)+". *"+s.home+" vs "+s.away+"*");
    lines.push("   └ "+s.market+": *"+s.outcome+"* @ "+s.odd+(s.justification?" — _"+s.justification.slice(0,70)+"_":""));
  });
  lines.push("━━━━━━━━━━━━━━━━━━━━━━");
  if (bet.narrativeInsight)    lines.push("📖 *Récit:* _"+bet.narrativeInsight.slice(0,180)+"_");
  if (bet.emotionalStatesNote) lines.push("❤️ *Émotions:* _"+bet.emotionalStatesNote.slice(0,130)+"_");
  if (bet.newsInsight)         lines.push("📰 *Actualités:* _"+bet.newsInsight.slice(0,130)+"_");
  if (bet.sharpMoneyNote)      lines.push("🐟 *Sharp:* _"+bet.sharpMoneyNote.slice(0,100)+"_");
  if (bet.weatherNote)         lines.push("🌦 *Météo:* _"+bet.weatherNote.slice(0,80)+"_");
  if (bet.integrityNote)       lines.push("⚠️ *Intégrité:* _"+bet.integrityNote.slice(0,80)+"_");
  if (bet.mentalTrainingUsed && bet.mentalTrainingUsed !== "N/A") lines.push("🧠 *Mental:* _"+bet.mentalTrainingUsed.slice(0,120)+"_");
  lines.push("⏰ "+new Date(bet.timestamp).toLocaleString("fr-FR"));
  return send(lines.join("\n"));
}

module.exports.notifyNewBetV7 = notifyNewBetV7;
