// ─── BETPAWA AI AGENT v7 — POINT D'ENTRÉE ────────────────────────────────────
const { runCycle, resolvePendingBets, CONFIG } = require("./src/agent");
const { createServer } = require("./src/server");
const { startPeriodicSecurityScan, getSecurityReport, selfHeal, loadSecurityState } = require("./src/securityCore");
const telegram = require("./src/telegram");
const logger   = require("./src/logger");

logger.info("╔═══════════════════════════════════════════════════════════╗");
logger.info("║       BETPAWA AI AGENT v7 — JE VEUX GAGNER.               ║");
logger.info("║  Monte Carlo | Self-Healer | 10 dim | Narration | Causal  ║");
logger.info("╚═══════════════════════════════════════════════════════════╝");

[["ANTHROPIC_API_KEY","CRITIQUE"],["TELEGRAM_TOKEN","notifications off"],["TELEGRAM_CHAT_ID","notifications off"],["ODDS_API_KEY","mode simulé"],["FOOTBALL_DATA_KEY","H2H off"],["API_FOOTBALL_KEY","stats off"],["NEWS_API_KEY","news off"]].forEach(function(p){ if(!process.env[p[0]])logger.warn("⚠️  "+p[0]+" — "+p[1]); });

createServer();

// Démarrer le scan de sécurité périodique autonome
try {
  startPeriodicSecurityScan();
  logger.info("🔒 Système de sécurité v10 opérationnel");
} catch(e) { logger.warn("Sécurité: "+e.message); }

setTimeout(function(){
  telegram.send(
    "🤖 *BETPAWA AI AGENT v7 — DÉMARRÉ*\n"+"━━━━━━━━━━━━━━━━━━━━━━\n"
    +"Football | Cotes 30–400 | 5-10 sélections\n\n"
    +"*CAPACITÉS v7:*\n"
    +"→ Monte Carlo: 10 000 simulations/match\n"
    +"→ Sécurité niveau blockchain (zero trust, whitelist, auto-guérison)\n"
    +"→ Autonomie profonde (fallback IA, initiatives, créativité)\n"
    +"→ Entraînement mental sur historique\n"
    +"→ Auto-évaluation & correction de bugs\n"
    +"→ Validation des chaînes de raisonnement\n"
    +"→ Détection biais cognitifs (gambler's fallacy, overconfidence...)\n"
    +"→ Stress test du ticket complet\n"
    +"→ 10 dimensions + narrative + Sharp + EV + News\n\n"
    +"*VOLONTÉ:* Je ne cesserai jamais de progresser.\n"
    +"Premier cycle dans 15 secondes..."
  ).catch(function(e){logger.warn("TG: "+e.message);});
},3000);

async function mainLoop(){
  logger.info("⏰ ["+new Date().toLocaleString("fr-FR")+"] Début...");
  try{await resolvePendingBets();}catch(e){logger.error("Résolution: "+e.message);}
  try{await runCycle();}catch(e){
    logger.error("Cycle: "+e.message);
    telegram.notifyAlert("erreur","Cycle v7: "+e.message).catch(function(){});
  }
  logger.info("⏰ Prochain cycle dans "+(CONFIG.CYCLE_INTERVAL_MS/3600000)+"h");
  setTimeout(mainLoop, CONFIG.CYCLE_INTERVAL_MS);
}

setTimeout(mainLoop, 15000);
process.on("uncaughtException",function(e){logger.error("Exception: "+e.message);telegram.notifyAlert("erreur",e.message).catch(function(){});});
process.on("unhandledRejection",function(e){logger.error("Rejet: "+(e&&e.message||String(e)));});
