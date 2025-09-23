let tmi;
try {
    tmi = require('tmi.js');
} catch (e) {
    console.warn('⚠️ tmi.js non installé, TwitchBridge sera désactivé (npm install tmi.js)');
}

// Fallback fetch pour Node < 18
if (typeof fetch !== 'function') {
    global.fetch = (...args) => import('node-fetch').then(m => m.default(...args));
}

class TwitchBridge {
    constructor(client, config) {
        this.discordClient = client;

        const envChannels = process.env.TWITCH_CHANNELS
            ? process.env.TWITCH_CHANNELS.split(',').map(c => c.trim()).filter(Boolean)
            : [];

        const cfg = config?.twitch || {};

        this.config = {
            username: cfg.username || process.env.TWITCH_BOT_USERNAME,
            oauth: (cfg.oauth || process.env.TWITCH_BOT_TOKEN || '').trim(),
            channels: (Array.isArray(cfg.channels) && cfg.channels.length ? cfg.channels : envChannels),
            relayChannelId: cfg.relayChannelId || process.env.TWITCH_RELAY_CHANNEL_ID,
            removeFormat: typeof cfg.removeFormat === 'boolean' ? cfg.removeFormat : (process.env.TWITCH_REMOVE_FORMAT === 'true')
        };

        this.enabled = false;
        this.tmi = null;
        this.messageMap = new Map(); // twitchMsgId -> { discordMessageId, discordChannelId, userId }
    }

    async initialize() {
        if (!tmi) {
            console.warn('⚠️ Initialisation TwitchBridge ignorée (tmi.js absent)');
            return;
        }

        if (!this.config.username || !this.config.oauth || !this.config.channels.length || !this.config.relayChannelId) {
            console.warn('⚠️ TwitchBridge désactivé: config incomplète');
            return;
        }

        if (!this.config.oauth.startsWith('oauth:'))
            this.config.oauth = `oauth:${this.config.oauth}`;

        this.config.channels = this.config.channels.map(c => c.startsWith('#') ? c.toLowerCase() : `#${c.toLowerCase()}`);

        this.tmi = new tmi.Client({
            options: { skipUpdatingEmotesets: true },
            connection: { secure: true, reconnect: true },
            identity: {
                username: this.config.username,
                password: this.config.oauth
            },
            channels: this.config.channels
        });

        this._registerEvents();

        try {
            await this.tmi.connect();
            this.enabled = true;
            console.log(`✅ TwitchBridge connecté: ${this.config.channels.join(', ')}`);
        } catch (e) {
            console.error('❌ Connexion Twitch échouée:', e);
        }
    }

    _getRelayChannel() {
        return this.discordClient.channels.cache.get(this.config.relayChannelId);
    }

    _registerEvents() {
        if (!tmi) return;

        // Nouveau message
        this.tmi.on('message', async (channel, tags, message, self) => {
            if (self) return;
            try {
                const relayChannel = this._getRelayChannel();
                if (!relayChannel || !relayChannel.isTextBased()) return;

                const clean = this.config.removeFormat
                    ? message.replace(/[\u0000-\u001F]/g, '')
                    : message;

                const content = `💬 [Twitch | ${tags['display-name'] || tags.username}] ${clean}`;
                const sent = await relayChannel.send({ content });

                if (tags.id) {
                    this.messageMap.set(tags.id, {
                        discordMessageId: sent.id,
                        discordChannelId: relayChannel.id,
                        userId: tags['user-id'],
                        login: tags.username
                    });
                }
            } catch (err) {
                console.error('❌ Erreur relais Twitch -> Discord:', err);
            }
        });

        // Suppression d'un message (clearmsg)
        this.tmi.on('clearmsg', async (_channel, tags) => {
            try {
                const tid = tags['target-msg-id'];
                if (!tid) return;
                const meta = this.messageMap.get(tid);
                if (!meta) return;
                const ch = this.discordClient.channels.cache.get(meta.discordChannelId);
                if (ch?.isTextBased()) {
                    await ch.messages.delete(meta.discordMessageId).catch(()=>{});
                }
                this.messageMap.delete(tid);
            } catch (err) {
                console.error('❌ Erreur clearmsg sync:', err);
            }
        });

        // Timeout / ban utilisateur (clearchat avec target-user-id)
        this.tmi.on('clearchat', async (_channel, tags) => {
            try {
                const targetUserId = tags['target-user-id'];
                // Si purge globale du chat (pas de target-user-id) on ignore
                if (!targetUserId) return;
                const toDelete = [];
                for (const [twId, meta] of this.messageMap.entries()) {
                    if (meta.userId === targetUserId) toDelete.push([twId, meta]);
                }
                for (const [, meta] of toDelete) {
                    const ch = this.discordClient.channels.cache.get(meta.discordChannelId);
                    if (ch?.isTextBased())
                        await ch.messages.delete(meta.discordMessageId).catch(()=>{});
                }
                toDelete.forEach(([twId]) => this.messageMap.delete(twId));
            } catch (err) {
                console.error('❌ Erreur clearchat sync:', err);
            }
        });

        this.tmi.on('disconnected', reason => {
            console.warn('⚠️ Twitch déconnecté:', reason);
            this.enabled = false;
        });
        this.tmi.on('reconnect', () => console.log('↻ Reconnexion Twitch...'));
    }

    getStatus() {
        return this.enabled ? '🟢' : '🔴';
    }

    // Méthode pour tester les permissions du token
    async testTwitchToken() {
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `Bearer ${process.env.TWITCH_USER_TOKEN}`
                }
            });

            if (!response.ok) {
                return { valid: false, error: `HTTP ${response.status}` };
            }

            const data = await response.json();
            return {
                valid: true,
                login: data.login,
                userId: data.user_id,
                clientId: data.client_id,
                scopes: data.scopes
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // Nouvelle méthode pour récupérer les listes Twitch
    async getTwitchList(type) {
        if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_USER_TOKEN || !process.env.STREAMER_USERNAME) {
            throw new Error('Configuration Twitch API manquante');
        }

        const broadcasterUsername = process.env.STREAMER_USERNAME;
        
        try {
            // 1. Vérifier la validité du token
            const tokenValidation = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `Bearer ${process.env.TWITCH_USER_TOKEN}`
                }
            });

            if (!tokenValidation.ok) {
                throw new Error(`Token invalide ou expiré: ${tokenValidation.status}`);
            }

            const tokenData = await tokenValidation.json();
            console.log(`🔑 Token valide pour: ${tokenData.login}, Scopes: ${tokenData.scopes.join(', ')}`);

            // 2. Récupérer l'ID du broadcaster
            // 2. Récupérer l'ID du broadcaster
            const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${broadcasterUsername}`, {
                headers: {
                    'Client-ID': process.env.TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${process.env.TWITCH_USER_TOKEN}`
                }
            });

            if (!userResponse.ok) {
                throw new Error(`Erreur API Twitch users: ${userResponse.status}`);
            }

            const userData = await userResponse.json();
            if (!userData.data || userData.data.length === 0) {
                throw new Error(`Utilisateur ${broadcasterUsername} non trouvé`);
            }

            const broadcasterId = userData.data[0].id;

            // 3. Récupérer la liste des mods ou VIPs
            let apiUrl;
            if (type === 'moderators') {
                apiUrl = `https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${broadcasterId}`;
            } else if (type === 'vips') {
                apiUrl = `https://api.twitch.tv/helix/channels/vips?broadcaster_id=${broadcasterId}`;
            } else {
                throw new Error(`Type ${type} non supporté`);
            }

            const listResponse = await fetch(apiUrl, {
                headers: {
                    'Client-ID': process.env.TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${process.env.TWITCH_USER_TOKEN}`
                }
            });

            if (!listResponse.ok) {
                // Ajouter plus de détails sur l'erreur
                const errorText = await listResponse.text();
                throw new Error(`Erreur API Twitch ${type}: ${listResponse.status} - ${errorText}`);
            }

            const listData = await listResponse.json();
            return listData.data || [];

        } catch (error) {
            console.error(`❌ Erreur getTwitchList(${type}):`, error);
            throw error;
        }
    }

    async destroy() {
        try {
            if (this.tmi) await this.tmi.disconnect();
        } catch {}
        this.enabled = false;
        this.messageMap.clear();
    }
}

module.exports = TwitchBridge;
