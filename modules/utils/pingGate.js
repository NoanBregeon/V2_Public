const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../../config/ping_state.json');
const START_AT = Date.now();
const STARTUP_GRACE_MS = 5 * 60 * 1000; // 5 minutes

function readState() {
	try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { lastPingAt: 0, lastLive: false }; }
}
function writeState(s) {
	try { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); } catch {}
	try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch {}
}

/**
 * Retourne true uniquement si :
 * - hors fenêtre de démarrage (STARTUP_GRACE_MS)
 * - et la transition est OFF -> ON (wasLive=false && isLiveNow=true)
 */
function shouldNotifyTransition(isLiveNow) {
	const st = readState();
	const now = Date.now();
	if (now - START_AT < STARTUP_GRACE_MS) return false;
	const wasLive = Boolean(st.lastLive);
	return (!wasLive && Boolean(isLiveNow));
}

function recordAfterNotify(isLiveNow) {
	const st = readState();
	st.lastLive = Boolean(isLiveNow);
	st.lastPingAt = Date.now();
	writeState(st);
}

module.exports = { shouldNotifyTransition, recordAfterNotify };
