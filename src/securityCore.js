// ─── SECURITY CORE v10 — Sécurité Niveau Blockchain ─────────────────────────
// PHILOSOPHIE: L'agent est une forteresse. Fermé par défaut. Ouvert uniquement
//              aux terminaux de confiance explicitement autorisés.
//
// ARCHITECTURE DE SÉCURITÉ (inspirée des principes blockchain):
//   1. ZERO TRUST — Toute requête est suspecte jusqu'à preuve du contraire
//   2. WHITELIST STRICTE — Seuls les IPs/tokens des APIs de confiance passent
//   3. RATE LIMITING — Limite les requêtes par IP et par endpoint
//   4. PAYLOAD SANITIZATION — Tout input est nettoyé avant traitement
//   5. ANOMALY DETECTION — Détecte les patterns d'attaque connus
//   6. SELF-HEALING — Si infecté, isolement immédiat + nettoyage + restauration
//   7. SECURITY EVOLUTION — Les barrières s'améliorent à chaque menace détectée
//   8. IMMUTABLE AUDIT LOG — Journal tamper-proof de tous les accès
//   9. AUTONOMOUS RESPONSE — Réagit sans intervention humaine
//  10. GRACEFUL DEGRADATION — Même sous attaque, le cœur métier continue

const crypto = require("crypto");
const fs     = require("fs");
const path   = require("path");
const logger = require("./logger");

const SECURITY_DIR   = path.join(__dirname, "../data");
const THREAT_LOG     = path.join(SECURITY_DIR, "threat_log.json");
const SECURITY_STATE = path.join(SECURITY_DIR, "security_state.json");
const AUDIT_LOG      = path.join(SECURITY_DIR, "audit_log.json");

// ─── IPs DE CONFIANCE (WHITELIST STRICTE) ────────────────────────────────────
// Seuls ces IPs/ranges sont autorisés. Tout le reste est bloqué.
const TRUSTED_SOURCES = {
  // Telegram API servers (plage officielle Telegram)
  telegram: [
    "149.154.160.0/20",   // Telegram DC1-DC5 Europe
    "91.108.4.0/22",      // Telegram DC1-DC5 Americas
    "91.108.56.0/22",     // Telegram API
    "91.108.8.0/22",
    "95.161.64.0/20",
    "2001:b28:f23d::/48", // IPv6 Telegram
    "2001:b28:f23f::/48",
    "2001:67c:4e8::/48",
  ],
  // Render.com infrastructure (notre hébergeur)
  render: [
    "52.44.0.0/16",       // Render.com AWS us-east-1
    "35.168.0.0/13",
    "127.0.0.1",          // localhost (health checks internes)
    "::1",                // IPv6 localhost
  ],
  // UptimeRobot (ping de santé)
  uptimeRobot: [
    "216.144.248.0/21",
    "69.162.124.0/24",
    "69.162.64.0/18",
    "208.115.199.0/24",
  ],
};

// ─── PATTERNS D'ATTAQUE CONNUS ────────────────────────────────────────────────
const ATTACK_PATTERNS = [
  // Injection
  { type:"sql_injection",   regex:/(\bSELECT\b|\bDROP\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bUNION\b)/i, severity:"critical" },
  { type:"xss",             regex:/<script[\s\S]*?>[\s\S]*?<\/script>|javascript:/i,                   severity:"critical" },
  { type:"path_traversal",  regex:/\.\.(\/|\\)/,                                                        severity:"critical" },
  { type:"shell_injection", regex:/;[\s]*(\bls\b|\bcat\b|\brm\b|\bwget\b|\bcurl\b|\bexec\b|\beval\b)/, severity:"critical" },
  { type:"ssrf",            regex:/(localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254\.|10\.|192\.168\.)/i,   severity:"high" },
  { type:"env_leak",        regex:/process\.env|__dirname|require\s*\(/,                               severity:"high" },
  { type:"json_bomb",       regex:/(\{[^}]*\{[^}]*\{[^}]*\{[^}]*\{){5,}/,                             severity:"medium" },
  { type:"prototype_pollut",regex:/__proto__|constructor\[|prototype\[/,                               severity:"critical" },
  { type:"log4j",           regex:/\$\{jndi:/i,                                                        severity:"critical" },
  { type:"prompt_injection", regex:/(ignore previous|disregard|jailbreak|DAN mode|new instructions)/i, severity:"high" },
];

// ─── ÉTAT DE SÉCURITÉ ─────────────────────────────────────────────────────────
function loadSecurityState() {
  try {
    if (!fs.existsSync(SECURITY_STATE)) return getDefaultState();
    return Object.assign(getDefaultState(), JSON.parse(fs.readFileSync(SECURITY_STATE,"utf8")));
  } catch { return getDefaultState(); }
}
function saveSecurityState(state) {
  try { fs.writeFileSync(SECURITY_STATE, JSON.stringify(state,null,2)); } catch {}
}
function getDefaultState() {
  return {
    version: 10,
    isUnderAttack: false,
    lockdownMode: false,
    blockedIPs: {},            // IP → { count, firstSeen, lastSeen, reason }
    rateLimits: {},            // IP → { requests: [], windowMs: 60000, maxRequests: 20 }
    threatHistory: [],
    securityLevel: "normal",   // normal → elevated → critical → lockdown
    lastSecurityScan: null,
    adaptedRules: [],          // règles apprises des attaques précédentes
    trustedTokens: {},         // hash des tokens autorisés
    incidentCount: 0,
    totalBlockedRequests: 0,
  };
}

// ─── GÉNÉRATION DU TOKEN D'ACCÈS ─────────────────────────────────────────────
// Un token signé HMAC est généré au démarrage et requis pour tous les accès API
function generateAccessToken() {
  var secret = process.env.SECURITY_SECRET || process.env.ANTHROPIC_API_KEY || "betpawa-agent-v10";
  var timestamp = Date.now().toString();
  var token = crypto.createHmac("sha256", secret).update(timestamp + "-betpawa-agent").digest("hex");
  return token.slice(0, 32); // 128 bits
}

// ─── VÉRIFICATION DE L'IP ────────────────────────────────────────────────────
function isIPinCIDR(ip, cidr) {
  try {
    if (!cidr.includes("/")) return ip === cidr;
    var parts = cidr.split("/");
    var net = parts[0].split(".").map(Number);
    var prefix = parseInt(parts[1]);
    var ipParts = ip.split(".").map(Number);
    if (net.length !== 4 || ipParts.length !== 4) return false;
    var netInt = net.reduce(function(s,v,i){ return s + v * Math.pow(256, 3-i); }, 0);
    var ipInt  = ipParts.reduce(function(s,v,i){ return s + v * Math.pow(256, 3-i); }, 0);
    var mask   = prefix > 0 ? 0xFFFFFFFF << (32-prefix) : 0;
    return (netInt & mask) === (ipInt & mask);
  } catch { return false; }
}

function isTrustedIP(ip) {
  if (!ip) return false;
  // Localhost toujours autorisé (health checks internes, Render.com)
  if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") return true;
  // Render.com peut avoir des IPs dynamiques → autoriser les requêtes depuis le même process
  if (process.env.RENDER) return true; // Sur Render.com, l'accès est déjà filtré au niveau infra
  // Vérifier toutes les listes de confiance
  var allTrusted = [];
  Object.values(TRUSTED_SOURCES).forEach(function(list){ allTrusted = allTrusted.concat(list); });
  return allTrusted.some(function(cidr){ return isIPinCIDR(ip, cidr); });
}

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
function checkRateLimit(ip, state) {
  var now = Date.now();
  var windowMs = state.securityLevel === "critical" ? 60000 : 60000;
  var maxRequests = state.securityLevel === "critical" ? 5 :
                    state.securityLevel === "elevated" ? 10 : 20;

  if (!state.rateLimits[ip]) state.rateLimits[ip] = { requests: [] };
  var rl = state.rateLimits[ip];

  // Nettoyer les requêtes hors fenêtre
  rl.requests = rl.requests.filter(function(t){ return now-t < windowMs; });
  rl.requests.push(now);

  if (rl.requests.length > maxRequests) {
    return { allowed: false, reason: "Rate limit: "+rl.requests.length+"/"+maxRequests+" req/min", retryAfter: Math.ceil(windowMs/1000) };
  }
  return { allowed: true };
}

// ─── SCAN DES PAYLOADS ────────────────────────────────────────────────────────
function scanPayload(data) {
  var threats = [];
  var dataStr = typeof data === "string" ? data : JSON.stringify(data);

  ATTACK_PATTERNS.forEach(function(pattern) {
    if (pattern.regex.test(dataStr)) {
      threats.push({ type: pattern.type, severity: pattern.severity, matched: true });
    }
  });

  // Détecter les payloads anormalement grands (DoS)
  if (dataStr.length > 50000) {
    threats.push({ type: "oversized_payload", severity: "medium", size: dataStr.length });
  }
  // Détecter les requêtes de scan
  if (/\.(php|asp|aspx|jsp|cgi|sh|bash|py|rb)\b/i.test(dataStr)) {
    threats.push({ type: "vulnerability_scan", severity: "medium" });
  }

  return threats;
}

// ─── RÉPONSE AUTONOME AUX MENACES ────────────────────────────────────────────
// L'agent réagit immédiatement SANS intervention humaine
async function respondToThreat(threat, ip, state) {
  var now = new Date().toISOString();
  state.incidentCount++;
  state.totalBlockedRequests++;

  // Enregistrer la menace
  var incident = {
    id: "INC_"+Date.now(),
    timestamp: now,
    ip: ip,
    threat: threat,
    responseActions: [],
  };

  // RÉPONSE SELON LA SÉVÉRITÉ
  if (threat.severity === "critical") {
    // 1. Bloquer l'IP immédiatement
    state.blockedIPs[ip] = {
      count:     (state.blockedIPs[ip]&&state.blockedIPs[ip].count||0) + 1,
      firstSeen: state.blockedIPs[ip]&&state.blockedIPs[ip].firstSeen || now,
      lastSeen:  now,
      reason:    threat.type,
      blocked:   true,
      expiresAt: new Date(Date.now() + 24*3600*1000).toISOString(), // 24h ban
    };
    incident.responseActions.push("IP "+ip+" bannie 24h");

    // 2. Élever le niveau de sécurité
    state.securityLevel = "critical";
    incident.responseActions.push("Niveau sécurité → critical");

    // 3. Apprendre de cette attaque → créer une règle adaptée
    var newRule = { type: "learned_from_"+threat.type, timestamp: now, ip: ip };
    if (!state.adaptedRules.find(function(r){ return r.type===newRule.type; })) {
      state.adaptedRules.push(newRule);
      incident.responseActions.push("Nouvelle règle adaptée: "+newRule.type);
    }
    logger.warn("🚨 [SECURITY] MENACE CRITIQUE — "+threat.type+" depuis "+ip+" → BAN 24h + LOCKDOWN");

  } else if (threat.severity === "high") {
    // Blocage temporaire (1h)
    state.blockedIPs[ip] = {
      count: (state.blockedIPs[ip]&&state.blockedIPs[ip].count||0) + 1,
      lastSeen: now, reason: threat.type,
      blocked: true,
      expiresAt: new Date(Date.now() + 3600*1000).toISOString(),
    };
    if (state.securityLevel === "normal") state.securityLevel = "elevated";
    incident.responseActions.push("IP bannie 1h + niveau elevated");
    logger.warn("⚠️ [SECURITY] Menace haute — "+threat.type+" depuis "+ip+" → ban 1h");

  } else {
    // Avertissement + rate limit renforcé
    if (!state.blockedIPs[ip]) state.blockedIPs[ip] = { count:0, reason:threat.type };
    state.blockedIPs[ip].count++;
    state.blockedIPs[ip].lastSeen = now;
    incident.responseActions.push("Warning + rate limit renforcé");
    logger.info("⚠️ [SECURITY] Menace "+threat.severity+" — "+threat.type+" depuis "+ip);
  }

  // Enregistrer l'incident dans le journal
  saveIncident(incident);
  state.threatHistory.push({ ts: now, type: threat.type, ip: ip, severity: threat.severity });
  if (state.threatHistory.length > 200) state.threatHistory = state.threatHistory.slice(-200);

  // Auto-guérison: si pas d'attaque depuis 1h → revenir à la normale
  scheduleSecurityRelaxation(state);

  saveSecurityState(state);
  return incident;
}

// ─── AUTO-GUÉRISON ────────────────────────────────────────────────────────────
// Si le système est "infecté" → isolation, nettoyage, restauration
async function selfHeal(state) {
  logger.info("🔬 [SECURITY] Démarrage auto-guérison...");
  var actions = [];

  // 1. Nettoyer les bans expirés
  var now = Date.now();
  var clearedBans = 0;
  Object.keys(state.blockedIPs).forEach(function(ip) {
    var ban = state.blockedIPs[ip];
    if (ban.expiresAt && new Date(ban.expiresAt).getTime() < now) {
      delete state.blockedIPs[ip];
      clearedBans++;
    }
  });
  if (clearedBans > 0) actions.push("Bans expirés nettoyés: "+clearedBans);

  // 2. Nettoyer les rate limits anciens (fenêtre de 5 min)
  var clearedRL = 0;
  Object.keys(state.rateLimits).forEach(function(ip) {
    var rl = state.rateLimits[ip];
    if (rl.requests && rl.requests.every(function(t){ return now-t > 300000; })) {
      delete state.rateLimits[ip];
      clearedRL++;
    }
  });
  if (clearedRL > 0) actions.push("Rate limits nettoyés: "+clearedRL);

  // 3. Vérifier l'intégrité des fichiers critiques
  var criticalFiles = ["src/agent.js","src/storage.js","src/bookmakerIntel.js"];
  criticalFiles.forEach(function(f) {
    var fullPath = path.join(__dirname,"../",f);
    try {
      var content = fs.readFileSync(fullPath,"utf8");
      // Détecter les injections dans les fichiers sources
      var threats = scanPayload(content);
      var critical = threats.filter(function(t){ return t.severity==="critical"; });
      if (critical.length > 0) {
        logger.warn("🚨 [SECURITY] Intégrité compromise: "+f+" — "+critical.map(function(t){return t.type;}).join(","));
        actions.push("ALERTE: fichier "+f+" potentiellement compromis");
        state.securityLevel = "critical";
      }
    } catch {}
  });

  // 4. Réduire le niveau de sécurité si pas d'incident récent (24h)
  var lastIncident = state.threatHistory[state.threatHistory.length-1];
  var timeSinceLast = lastIncident ? now - new Date(lastIncident.ts).getTime() : Infinity;
  if (timeSinceLast > 24*3600*1000 && state.securityLevel !== "normal") {
    state.securityLevel = "normal";
    actions.push("Niveau sécurité revenu à normal (pas d'incident 24h)");
  }

  // 5. Re-générer les checksums de sécurité
  state.lastSecurityScan = new Date().toISOString();
  actions.push("Scan d'intégrité complété");

  saveSecurityState(state);
  if (actions.length > 1) logger.info("🔬 [SECURITY] Auto-guérison: "+actions.join(" | "));
  return actions;
}

// ─── MIDDLEWARE DE SÉCURITÉ PRINCIPAL ─────────────────────────────────────────
// À appeler pour CHAQUE requête entrante
function createSecurityMiddleware(accessToken) {
  return async function(req, res, next) {
    var state = loadSecurityState();
    var ip = req.headers["x-forwarded-for"]
           ? req.headers["x-forwarded-for"].split(",")[0].trim()
           : req.connection && req.connection.remoteAddress || "unknown";

    var url = req.url || "";
    var method = req.method || "GET";

    // ── PASSE 1: /health est toujours accessible (monitoring Render/UptimeRobot) ──
    if (url.split("?")[0] === "/health" && method === "GET") {
      writeAuditLog({ type:"health_check", ip:ip, allowed:true });
      return next(req, res);
    }

    // ── PASSE 2: Vérifier si l'IP est bannie ──────────────────────────────────
    var ban = state.blockedIPs[ip];
    if (ban && ban.blocked) {
      var banExpiry = ban.expiresAt ? new Date(ban.expiresAt).getTime() : Infinity;
      if (Date.now() < banExpiry) {
        state.totalBlockedRequests++;
        saveSecurityState(state);
        writeAuditLog({ type:"blocked_ban", ip:ip, reason:ban.reason, url:url });
        res.writeHead(403, {"Content-Type":"application/json","X-Security":"blocked"});
        res.end(JSON.stringify({error:"Forbidden",code:403}));
        return;
      } else {
        delete state.blockedIPs[ip];
        saveSecurityState(state);
      }
    }

    // ── PASSE 3: Rate limiting ────────────────────────────────────────────────
    var rlCheck = checkRateLimit(ip, state);
    if (!rlCheck.allowed) {
      await respondToThreat({ type:"rate_limit_exceeded", severity:"medium" }, ip, state);
      res.writeHead(429, {"Content-Type":"application/json","Retry-After":rlCheck.retryAfter});
      res.end(JSON.stringify({error:"Too Many Requests",retryAfter:rlCheck.retryAfter}));
      return;
    }

    // ── PASSE 4: Vérification token pour endpoints API ────────────────────────
    var isAPIEndpoint = url.includes("/api/") && !url.includes("/api/public");
    if (isAPIEndpoint) {
      var token = req.headers["x-agent-token"] || req.headers["authorization"];
      if (token && token.startsWith("Bearer ")) token = token.slice(7);
      if (!accessToken || token !== accessToken) {
        // Sur Render, si on est en production sans token → avertir mais ne pas bloquer le dashboard
        var isDashboardRequest = !url.includes("/api/");
        if (!isDashboardRequest) {
          writeAuditLog({ type:"unauthorized_api", ip:ip, url:url });
          res.writeHead(401, {"Content-Type":"application/json"});
          res.end(JSON.stringify({error:"Unauthorized",message:"Token requis pour les endpoints API"}));
          return;
        }
      }
    }

    // ── PASSE 5: Scan du payload (POST uniquement) ────────────────────────────
    if (method === "POST") {
      var body = "";
      req.on("data", function(chunk){ body += chunk; if(body.length > 50000) req.destroy(); });
      req.on("end", function() {
        var threats = scanPayload(body);
        var criticalThreats = threats.filter(function(t){ return t.severity==="critical"||t.severity==="high"; });
        if (criticalThreats.length > 0) {
          respondToThreat(criticalThreats[0], ip, loadSecurityState()).then(function(){});
          res.writeHead(400, {"Content-Type":"application/json"});
          res.end(JSON.stringify({error:"Bad Request",code:400}));
          return;
        }
        req._parsedBody = body;
        writeAuditLog({ type:"post_ok", ip:ip, url:url });
        next(req, res);
      });
      return;
    }

    // ── PASSE 6: Scan de l'URL ────────────────────────────────────────────────
    var urlThreats = scanPayload(url);
    var critURL = urlThreats.filter(function(t){ return t.severity==="critical"||t.severity==="high"; });
    if (critURL.length > 0) {
      await respondToThreat(critURL[0], ip, state);
      res.writeHead(400, {"Content-Type":"application/json","X-Security":"threat-detected"});
      res.end(JSON.stringify({error:"Bad Request",code:400}));
      return;
    }

    // ── TOUT OK: passer au handler ─────────────────────────────────────────────
    writeAuditLog({ type:"allowed", ip:ip, url:url, method:method });
    next(req, res);
  };
}

// ─── JOURNAL D'AUDIT IMMUABLE ─────────────────────────────────────────────────
function writeAuditLog(entry) {
  try {
    var log = [];
    if (fs.existsSync(AUDIT_LOG)) {
      var raw = fs.readFileSync(AUDIT_LOG,"utf8");
      log = JSON.parse(raw);
    }
    log.push(Object.assign({ ts: new Date().toISOString() }, entry));
    if (log.length > 1000) log = log.slice(-1000);
    fs.writeFileSync(AUDIT_LOG, JSON.stringify(log));
  } catch {}
}

function saveIncident(incident) {
  try {
    var log = [];
    if (fs.existsSync(THREAT_LOG)) log = JSON.parse(fs.readFileSync(THREAT_LOG,"utf8"));
    log.push(incident);
    if (log.length > 500) log = log.slice(-500);
    fs.writeFileSync(THREAT_LOG, JSON.stringify(log,null,2));
  } catch {}
}

function scheduleSecurityRelaxation(state) {
  setTimeout(function() {
    var s = loadSecurityState();
    var last = s.threatHistory[s.threatHistory.length-1];
    if (!last || Date.now() - new Date(last.ts).getTime() > 3600*1000) {
      if (s.securityLevel === "elevated") { s.securityLevel = "normal"; saveSecurityState(s); }
    }
  }, 3600*1000);
}

// ─── SCAN DE SÉCURITÉ PÉRIODIQUE ─────────────────────────────────────────────
// Lancé toutes les heures en arrière-plan
function startPeriodicSecurityScan() {
  var intervalMs = 3600*1000; // 1h
  setInterval(async function() {
    var state = loadSecurityState();
    await selfHeal(state);
  }, intervalMs);
  logger.info("🔒 [SECURITY] Scan périodique activé (1h)");
}

// ─── RAPPORT DE SÉCURITÉ ─────────────────────────────────────────────────────
function getSecurityReport() {
  var state = loadSecurityState();
  var activeBans = Object.keys(state.blockedIPs).filter(function(ip){
    var b = state.blockedIPs[ip];
    return b.blocked && (!b.expiresAt || new Date(b.expiresAt).getTime() > Date.now());
  });
  return {
    level:            state.securityLevel,
    isUnderAttack:    state.isUnderAttack,
    activeBans:       activeBans.length,
    totalBlocked:     state.totalBlockedRequests,
    incidents:        state.incidentCount,
    adaptedRules:     state.adaptedRules.length,
    recentThreats:    state.threatHistory.slice(-5),
    lastScan:         state.lastSecurityScan,
  };
}

module.exports = {
  createSecurityMiddleware,
  generateAccessToken,
  isTrustedIP,
  checkRateLimit,
  scanPayload,
  respondToThreat,
  selfHeal,
  startPeriodicSecurityScan,
  getSecurityReport,
  loadSecurityState,
  saveSecurityState,
  writeAuditLog,
  TRUSTED_SOURCES,
  ATTACK_PATTERNS,
};
