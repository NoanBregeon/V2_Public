/**
 * Configuration des notifications (avec kill-switch FORCE_DISABLE_PINGS)
 */

const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '../../config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'notifications.json');

function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

function load() {
    try {
        ensureConfigDir();

        // Kill switch global (prend le dessus sur tout)
        const envKillRaw = process.env.FORCE_DISABLE_PINGS;
        const envKill = (envKillRaw || '').toString().toLowerCase();
        const hardKill = envKill === 'true' || envKill === '1';

        // Valeurs depuis .env (fallback/default)
        const envEnabledRaw = process.env.LIVE_PING_ENABLED;
        const envEnabled = (envEnabledRaw || '').toString().toLowerCase();
        const envMsg = process.env.LIVE_PING_MESSAGE;
        const envRole = process.env.LIVE_PING_ROLE_ID;

        if (!fs.existsSync(CONFIG_FILE)) {
            // Si pas de fichier persistant, initialiser avec les valeurs .env
            const def = {
                livePing: hardKill ? false : (envEnabled === 'true' || envEnabled === '1'),
                pingRoleId: envRole || null,
                pingMessage: envMsg || null
            };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(def, null, 2), 'utf8');

            if (hardKill) {
                // sécurité : vider l'env au runtime pour éviter lectures directes
                try { process.env.LIVE_PING_ROLE_ID = ''; process.env.LIVE_PING_MESSAGE = ''; } catch (e) {}
                console.log('🔕 FORCE_DISABLE_PINGS actif => pings désactivés (initialisation)');
            }

            return def;
        }

        const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

        // Si kill switch actif, forcer off (et vider vars env pour sécurité)
        if (hardKill) {
            raw.livePing = false;
            try {
                process.env.LIVE_PING_ROLE_ID = '';
                process.env.LIVE_PING_MESSAGE = '';
            } catch (e) {}
            console.log('🔕 FORCE_DISABLE_PINGS actif => pings désactivés (override config existante)');
            return raw;
        }

        // Si LIVE_PING_ENABLED est explicitement défini dans l'environnement,
        // on l'applique et on prend l'env en priorité (override de la valeur persistée).
        if (envEnabledRaw !== undefined && envEnabledRaw !== '') {
            raw.livePing = envEnabled === 'true' || envEnabled === '1';
            // Ne pas forcer l'écriture dans le fichier pour laisser la persistance inchangée.
            if (!raw.livePing) {
                try { process.env.LIVE_PING_ROLE_ID = ''; process.env.LIVE_PING_MESSAGE = ''; } catch (e) {}
                console.log('🔕 LIVE_PING_ENABLED=false dans .env -> pings désactivés (override)');
            } else {
                console.log('🔔 LIVE_PING_ENABLED=true dans .env -> pings activés (override)');
            }
            return raw;
        }

        // Sinon : Si des champs manquent dans la config persistée, utiliser l'env comme fallback (sans écraser)
        if (raw.livePing === undefined || raw.livePing === null) {
            raw.livePing = envEnabled === 'true' || envEnabled === '1';
        }
        if ((!raw.pingMessage || raw.pingMessage === '') && envMsg) {
            raw.pingMessage = envMsg;
        }
        if ((!raw.pingRoleId || raw.pingRoleId === '') && envRole) {
            raw.pingRoleId = envRole;
        }
        return raw;
    } catch (e) {
        console.error('❌ Erreur chargement notifications config:', e.message);
        return {
            livePing: (process.env.LIVE_PING_ENABLED || '').toString().toLowerCase() === 'true',
            pingRoleId: process.env.LIVE_PING_ROLE_ID || null,
            pingMessage: process.env.LIVE_PING_MESSAGE || null
        };
    }
}

function save(cfg) {
    try {
        ensureConfigDir();
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('❌ Erreur sauvegarde notifications config:', e.message);
        return false;
    }
}

let cfg = load();

module.exports = {
    // Retourne true seulement si cfg.livePing true ET aucun hardKill actif
    isLivePingEnabled() {
        const hardKill = ((process.env.FORCE_DISABLE_PINGS || '').toString().toLowerCase() === 'true'
                       || (process.env.FORCE_DISABLE_PINGS || '').toString() === '1');
        return Boolean(cfg.livePing) && !hardKill;
    },

    // Si kill switch ou cfg.livePing false => null
    getPingRoleId() {
        const hardKill = ((process.env.FORCE_DISABLE_PINGS || '').toString().toLowerCase() === 'true'
                       || (process.env.FORCE_DISABLE_PINGS || '').toString() === '1');
        if (!cfg.livePing || hardKill) return null;
        return cfg.pingRoleId || null;
    },

    // Si kill switch ou cfg.livePing false => null
    getPingMessage() {
        const hardKill = ((process.env.FORCE_DISABLE_PINGS || '').toString().toLowerCase() === 'true'
                       || (process.env.FORCE_DISABLE_PINGS || '').toString() === '1');
        if (!cfg.livePing || hardKill) return null;
        return cfg.pingMessage || null;
    },

    setLivePing(enabled) {
        cfg.livePing = Boolean(enabled);
        save(cfg);
        return cfg.livePing;
    },

    setPingRoleId(roleId) {
        cfg.pingRoleId = roleId || null;
        save(cfg);
        return cfg.pingRoleId;
    },

    setPingMessage(message) {
        cfg.pingMessage = message ? String(message) : null;
        save(cfg);
        return cfg.pingMessage;
    },

    getAll() {
        // Exposer la config effective : si désactivé, masquer role/message
        const hardKill = ((process.env.FORCE_DISABLE_PINGS || '').toString().toLowerCase() === 'true'
                       || (process.env.FORCE_DISABLE_PINGS || '').toString() === '1');
        return {
            ...cfg,
            hardKill: hardKill,
            effectivePingRoleId: (!cfg.livePing || hardKill) ? null : (cfg.pingRoleId || null),
            effectivePingMessage: (!cfg.livePing || hardKill) ? null : (cfg.pingMessage || null)
        };
    },

    // Permet de recharger la config depuis le fichier (utile côté émetteur avant envoi)
    reload() {
        cfg = load();
        return cfg;
    }
};