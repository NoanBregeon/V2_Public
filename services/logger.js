// services/logger.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../data/logs');
const MAX_ATTACHMENT_BYTES = parseInt(process.env.LOG_DISCORD_MAX_BYTES || String(8 * 1024 * 1024), 10); // 8MB par défaut

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function filePathFor(name) {
  // sanitize name (letters, numbers, -, _)
  const safe = String(name || 'app').replace(/[^a-zA-Z0-9-_\.]/g, '_');
  return path.join(LOG_DIR, safe.endsWith('.log') ? safe : `${safe}.log`);
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes/1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes/(1024**2)).toFixed(2)} MB`;
  return `${(bytes/(1024**3)).toFixed(2)} GB`;
}

async function append(name, level, message, meta = {}) {
  const file = filePathFor(name);
  const ts = new Date().toISOString();
  const line = `[${ts}] [${(level||'INFO').toUpperCase()}] ${message} ${Object.keys(meta).length?JSON.stringify(meta):''}\n`;
  return fs.promises.appendFile(file, line, 'utf8').catch(err => { console.error('logger append error', err); });
}

async function listLogs() {
  const files = await fs.promises.readdir(LOG_DIR).catch(()=>[]);
  const stats = await Promise.all(files.map(async f => {
    const p = path.join(LOG_DIR, f);
    const s = await fs.promises.stat(p).catch(()=>null);
    return s ? { name: f, size: s.size, mtime: s.mtime } : null;
  }));
  return stats.filter(Boolean).sort((a,b)=>b.mtime - a.mtime);
}

async function tail(name, lines = 30) {
  const p = filePathFor(name);
  if (!fs.existsSync(p)) return { exists:false, lines: [] };
  const data = await fs.promises.readFile(p, 'utf8');
  const arr = data.split(/\r?\n/).filter(Boolean);
  return { exists:true, lines: arr.slice(-Math.max(1,lines)) };
}

async function getFile(name) {
  const p = filePathFor(name);
  if (!fs.existsSync(p)) return { exists:false };
  const s = await fs.promises.stat(p);
  return { exists:true, path:p, size:s.size };
}

// Optionnel : compresser avant envoi (gzip) — retourne path du gzip temporaire
async function gzipFile(srcPath) {
  const dst = `${srcPath}.gz`;
  return new Promise((res, rej) => {
    const inp = fs.createReadStream(srcPath);
    const out = fs.createWriteStream(dst);
    const gz = zlib.createGzip();
    inp.pipe(gz).pipe(out).on('finish', ()=>res(dst)).on('error', rej);
  });
}

module.exports = { append, listLogs, tail, getFile, gzipFile, humanSize, LOG_DIR, MAX_ATTACHMENT_BYTES };
