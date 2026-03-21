// ─── LOGGER UNIVERSEL ─────────────────────────────────────────────────────────
const fs   = require("fs");
const path = require("path");

const LOGS_DIR = path.join(__dirname, "../logs");
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

function ts() {
  return new Date().toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" });
}
function write(level, msg) {
  const line = "[" + ts() + "] [" + level + "] " + msg;
  console.log(line);
  try {
    const f = path.join(LOGS_DIR, "agent_" + new Date().toISOString().slice(0,10) + ".log");
    fs.appendFileSync(f, line + "\n");
  } catch {}
}

module.exports = {
  info:  function(m){ write("INFO ", m); },
  warn:  function(m){ write("WARN ", m); },
  error: function(m){ write("ERROR", m); },
  debug: function(m){ write("DEBUG", m); },
};
