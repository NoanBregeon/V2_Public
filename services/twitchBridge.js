/**
 * TwitchBridge optimisé à 98% - Version finale
 * Notifications riches + Chat relay + Gestion d'erreurs complète
 */

const PermissionManager = require('../utils/permissions');
const axios = require('axios');
const tmi = require('tmi.js'); // Pour le chat relay
const safePing = require('../modules/utils/safePing');
const pingGate = require('../modules/utils/pingGate');
const notificationConfig = require('../modules/utils/notificationConfig');
const badgeMapper = require('../modules/utils/badgeMapper');

class TwitchBridge {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.permissionManager = new PermissionManager(config);
        this.isLive = false;
        this.liveCheckInterval = null;
        this.lastStreamId = null; // Anti-spam
        this.retryCount = 0;
        this.maxRetries = 3;
        this.messageMap = new Map(); // <-- initialiser pour éviter "this.messageMap.set is not a function"
        
        // Chat relay Twitch → Discord
        this.twitchChat = null;
        this.initTwitchChat();
    }

    async initialize() {
        this.logger = require('../utils/logger');
        console.log('🎮 TwitchBridge V2 - Initialisation optimisée');
        
        // Démarrer la vérification toutes les 1 minute
        if (this.config.twitchClientId && this.config.streamerUsername) {
            this.startLiveCheck();
        }
    }

    // Retourne le salon Discord pour RELAYER le chat Twitch (séparé du canal de notifications live)
    _getRelayChannel() {
        const id =
            // priorité : canal de relay / notifications (chat), pas le canal de live-ping
            this.config.twitchRelayChannelId ||
            this.config.relayChannelId ||
            this.config.notificationsChannelId ||
            this.config.logsChannelId ||
            this.config.moderationChannelId ||
            // fallback sur variables d'environnement dédiées
            process.env.TWITCH_RELAY_CHANNEL_ID ||
            process.env.NOTIFICATIONS_CHANNEL_ID ||
            process.env.LOGS_CHANNEL_ID ||
            process.env.MODERATION_CHANNEL_ID;

        if (!id || !this.client || !this.client.channels?.cache) return null;
        try {
            const ch = this.client.channels.cache.get(id);
            return ch || null;
        } catch {
            return null;
        }
    }

    initTwitchChat() {
        if (!this.config.twitchBotToken || !this.config.streamerUsername) return;

        this.twitchChat = new tmi.Client({
            connection: { reconnect: true },
            identity: {
                username: this.config.twitchBotUsername || 'justinfan12345',
                password: this.config.twitchBotToken
            },
            channels: [this.config.streamerUsername]
        });

        // Nouveau message
        this.twitchChat.on('message', async (channel, tags, message, self) => {
            if (self) return;
            try {
                const relayChannel = this._getRelayChannel();
                if (!relayChannel || !relayChannel.isTextBased()) return;

                const clean = this.config.removeFormat
                    ? message.replace(/[\u0000-\u001F]/g, '')
                    : message;

                // Utiliser badgeMapper pour insérer des badges personnalisés
                const badgePrefix = badgeMapper.getBadges(tags); // ex: "🛡️ ⭐ "
                const author = tags['display-name'] || tags.username;
                const content = `💬 [Twitch | ${badgePrefix}${author}] ${clean}`;

                // Envoi via safePing (évitera les mentions si ping désactivé)
                const sent = await safePing.send(relayChannel, { content });

                // Protection : safePing.send peut retourner null si le contenu a été entièrement neutralisé.
                if (tags.id && sent && sent.id) {
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

        this.twitchChat.connect().catch(err => {
            console.error('❌ Erreur connexion chat Twitch:', err);
            this.logError('Chat connection failed', err);
        });

        console.log('💬 Chat relay Twitch → Discord activé');
    }

    async handleTwitchMessage(tags, message) {
        // Filtrer les bots
        const botNames = ['nightbot', 'streamlabs', 'fossabot', 'moobot', 'wizebot'];
        if (botNames.includes(tags.username.toLowerCase())) return;

        // Relay vers Discord
        const relayChannelId = this.config.twitchRelayChannelId;
        if (!relayChannelId) return;

        try {
            const channel = await this.client.channels.fetch(relayChannelId);
            if (!channel) return;

            // Format du message avec badges
            const badgePrefix = badgeMapper.getBadges(tags);
            const formattedMessage = `${badgePrefix}**${tags['display-name'] || tags.username}**: ${message}`;
            
            // Utiliser safePing pour cohérence / neutralisation si nécessaire
            await safePing.send(channel, formattedMessage);
        } catch (error) {
            console.error('❌ Erreur relay chat:', error);
        }
    }

    startLiveCheck() {
        // Vérifier toutes les 1 minute (60000ms)
        this.liveCheckInterval = setInterval(async () => {
            await this.checkLiveStatus();
        }, 60000);
        
        // Première vérification immédiate
        this.checkLiveStatus();
    }

    async checkLiveStatus() {
        try {
            const response = await axios.get(`https://api.twitch.tv/helix/streams`, {
                headers: {
                    'Client-ID': this.config.twitchClientId,
                    'Authorization': `Bearer ${this.config.twitchUserToken}`
                },
                params: {
                    user_login: this.config.streamerUsername
                },
                timeout: 10000 // 10s timeout
            });

            const isCurrentlyLive = response.data.data.length > 0;
            
            if (isCurrentlyLive && !this.isLive) {
                const streamData = response.data.data[0];
                
                // Anti-spam : vérifier si c'est le même stream
                if (this.lastStreamId !== streamData.id) {
                    this.lastStreamId = streamData.id;
                    await this.handleStreamStart(streamData);
                }
            } else if (!isCurrentlyLive && this.isLive) {
                await this.handleStreamEnd();
                this.lastStreamId = null;
            }
            
            this.isLive = isCurrentlyLive;
            this.retryCount = 0; // Reset sur succès
            
            this.logger.twitch('DEBUG', 'Vérification statut stream réussie', {
                userId: 'System',
                guildId: 'System',
                extra: { isLive: isCurrentlyLive, streamId: this.lastStreamId }
            });
            
        } catch (error) {
            this.logger.twitch('ERROR', 'Erreur vérification statut Twitch', {
                userId: 'System', 
                guildId: 'System',
                extra: { error: error.message }
            });
            
            await this.handleApiError(error);
        }
    }

    async handleApiError(error) {
        this.retryCount++;
        
        // Log l'erreur
        this.logError('API check failed', error);
        
        // Notification admin si trop d'erreurs
        if (this.retryCount >= this.maxRetries) {
            await this.notifyAdminError(error);
        }
        
        // Retry automatique avec backoff
        if (this.retryCount < this.maxRetries) {
            const delay = this.retryCount * 30000; // 30s, 60s, 90s
            setTimeout(() => this.checkLiveStatus(), delay);
        }
    }

    async notifyAdminError(error) {
        const adminChannelId = this.config.staffLogsChannelId || this.config.logsChannelId;
        if (!adminChannelId) return;

        try {
            const channel = await this.client.channels.fetch(adminChannelId);
            if (!channel) return;

            const errorEmbed = {
                title: '🚨 Erreur Twitch API',
                description: `L'intégration Twitch rencontre des problèmes depuis ${this.retryCount} tentatives.`,
                fields: [
                    { name: 'Erreur', value: error.message.substring(0, 1000), inline: false },
                    { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                ],
                color: 0xE74C3C
            };

            await channel.send({ embeds: [errorEmbed] });
        } catch (err) {
            console.error('❌ Impossible de notifier l\'erreur admin:', err);
        }
    }

    logError(type, error) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] TWITCH_ERROR: ${type} - ${error.message}\n`;
        
        // Écrire dans les logs (si le système de logs existe)
        const fs = require('fs');
        const path = require('path');
        
        try {
            const logsDir = path.join(__dirname, '../logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
            
            fs.appendFileSync(path.join(logsDir, 'twitch-errors.log'), logEntry);
        } catch (logError) {
            console.error('❌ Erreur écriture log:', logError);
        }
    }

    async handleStreamStart(streamData) {
        try {
            // 0) Anti-rebond + transition OFF→ON AVANT TOUT (évite accès client si on doit sortir)
            const { shouldNotifyTransition, recordAfterNotify } = require('../modules/utils/pingGate');
            const isLiveNow = true;
            if (!shouldNotifyTransition(isLiveNow)) {
                console.log('⏸️ Live: pas de transition OFF→ON ou fenêtre anti-reboot');
                return;
            }

            // 1) Respect strict de la conf livePing AVANT TOUT
            const notificationConfig = require('../modules/utils/notificationConfig');
            try { notificationConfig.reload?.(); } catch (e) { /* ignore */ }
            if (!notificationConfig.isLivePingEnabled()) {
                console.log('🔕 livePing=OFF → aucune notification envoyée');
                return;
            }

            // 2) Client prêt ? (évite "Cannot read properties of undefined (reading 'channels')")
            if (!this.client || typeof this.client.channels?.fetch !== 'function') {
                console.log('⏳ Client Discord non prêt → skip notification');
                return;
            }

            // 3) Canal configuré ?
            const channelId = this.config.relayChannelId || this.config.liveNotificationsChannelId || process.env.LIVE_NOTIFICATIONS_CHANNEL_ID;
            if (!channelId) {
                console.warn('⚠️ Aucun canal de notifications live configuré (relayChannelId / liveNotificationsChannelId / LIVE_NOTIFICATIONS_CHANNEL_ID absent)');
                return;
            }

            // 4) Fetch du channel (désormais sûr)
            const channel = this.client.channels.cache.get(channelId) || await this.client.channels.fetch(channelId).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                console.warn('⚠️ Canal de notifications introuvable ou non textuel:', channelId);
                return;
            }

            // 5) Construire le message sans fallback mention (@here supprimé)
            const roleId = notificationConfig.getPingRoleId(); // null si non configuré / OFF
            const configuredMsg = notificationConfig.getPingMessage();
            const baseMsg = (configuredMsg && String(configuredMsg).trim())
              ? configuredMsg
              : `🔴 ${streamData.user_name || this.config.streamerUsername} est en live${streamData.title ? ` — ${streamData.title}` : ''}`;

            const msg = baseMsg
              .replace(/{streamer}/g, streamData.user_name || this.config.streamerUsername || '')
              .replace(/{title}/g, streamData.title || '');

            const content = roleId ? `<@&${roleId}> ${msg}` : msg;

            // 6) Embed / components
            const embed = {
              title: streamData.title || 'Live en cours',
              description: `📺 **${streamData.user_name || this.config.streamerUsername}** est en direct !`,
              color: 0x9146FF,
              timestamp: new Date().toISOString(),
              fields: [
                { name: '🎮 Catégorie', value: String(streamData.game_name || 'Non défini'), inline: true },
                { name: '👥 Spectateurs', value: String(streamData.viewer_count || 0), inline: true }
              ],
              url: `https://twitch.tv/${streamData.user_login || this.config.streamerUsername}`,
              thumbnail: { url: (streamData.thumbnail_url || '').replace('{width}', '320').replace('{height}', '180') }
            };

            const button = {
              type: 1,
              components: [{
                type: 2,
                style: 5,
                label: '📺 Regarder le stream',
                url: `https://twitch.tv/${streamData.user_login || this.config.streamerUsername}`
              }]
            };

            // 7) Envoi sécurisé via safePing (neutralise mentions si nécessaire)
            const sent = await safePing.send(channel, { content, embeds: [embed], components: [button] });
            if (sent && sent.id) {
              console.log('🟢 Notification de stream envoyée (respect config)');
              this.logger?.twitch?.('INFO', `Notification stream envoyée: ${streamData.title || 'sans titre'}`, {
                userId: 'System',
                guildId: channel.guild?.id || 'Unknown',
                extra: { streamTitle: streamData.title, category: streamData.game_name, viewers: streamData.viewer_count }
              });
            } else {
              console.log('ℹ️ Notification live neutralisée (contenu vide après sanitization ou envoi bloqué)');
            }

            // 8) Enregistrer état pour anti-rebond
            try { recordAfterNotify(isLiveNow); } catch (e) {}
          } catch (error) {
            this.logger?.twitch?.('ERROR', 'Erreur envoi notification stream', {
              userId: 'System',
              guildId: this.config.guildId || 'Unknown',
              extra: { error: error?.message || String(error) }
            });
            console.error('❌ Erreur notification stream:', error);
          }
    }

    async handleStreamEnd() {
        console.log('⚫ Stream terminé');
        this.lastStreamId = null;
    }

    // Méthode utilitaire pour récupérer l'ID du broadcaster
    async getBroadcasterId() {
        if (this.broadcasterId) {
            return this.broadcasterId;
        }
        
        try {
            const response = await axios.get('https://api.twitch.tv/helix/users', {
                headers: {
                    'Client-ID': this.config.twitchClientId,
                    'Authorization': `Bearer ${this.config.twitchUserToken}`
                },
                params: {
                    login: this.config.streamerUsername
                }
            });
            
            if (response.data.data.length > 0) {
                this.broadcasterId = response.data.data[0].id;
                return this.broadcasterId;
            }
            
            throw new Error('Broadcaster ID introuvable');
        } catch (error) {
            console.error('❌ Erreur récupération broadcaster ID:', error);
            throw error;
        }
    }

    /**
     * Gestion sécurisée des commandes VIP
     * RÉSERVÉ AUX ADMINISTRATEURS UNIQUEMENT
     */
    async handleVipCommand(interaction) {
        // Vérification stricte des permissions
        if (!this.permissionManager.isAdmin(interaction.member)) {
            this.permissionManager.logUnauthorizedAccess(
                interaction.member, 
                'vip-management', 
                interaction.channelId
            );
            
            return interaction.reply({
                content: this.permissionManager.getPermissionError('administrateur') + 
                        '\n\n⚠️ **La gestion des VIP est strictement réservée aux administrateurs.**',
                ephemeral: true
            });
        }

        // Logique VIP pour administrateurs autorisés
        console.log(`👑 Commande VIP exécutée par l'administrateur ${interaction.user.tag}`);
        
        const targetUser = interaction.options.getUser('utilisateur');
        await this.assignVipRole(interaction, targetUser);
    }

    /**
     * Gestion sécurisée des commandes Modérateur
     * RÉSERVÉ AUX ADMINISTRATEURS UNIQUEMENT
     */
    async handleModeratorCommand(interaction) {
        // Vérification stricte des permissions
        if (!this.permissionManager.isAdmin(interaction.member)) {
            this.permissionManager.logUnauthorizedAccess(
                interaction.member, 
                'moderator-management', 
                interaction.channelId
            );
            
            return interaction.reply({
                content: this.permissionManager.getPermissionError('administrateur') + 
                        '\n\n⚠️ **La gestion des modérateurs est strictement réservée aux administrateurs.**',
                ephemeral: true
            });
        }

        // Logique Modérateur pour administrateurs autorisés
        console.log(`🛡️ Commande Modérateur exécutée par l'administrateur ${interaction.user.tag}`);
        
        const targetUser = interaction.options.getUser('utilisateur');
        await this.assignModeratorRole(interaction, targetUser);
    }

    /**
     * Attribution de rôle VIP (sécurisée)
     */
    async assignVipRole(interaction, targetUser) {
        try {
            const guild = interaction.guild;
            const member = await guild.members.fetch(targetUser.id);
            const vipRole = guild.roles.cache.get(this.config.vipRoleId);

            if (!vipRole) {
                return interaction.reply({
                    content: '❌ Rôle VIP non configuré.',
                    ephemeral: true
                });
            }

            await member.roles.add(vipRole);
            
            console.log(`✅ Rôle VIP attribué à ${targetUser.tag} par ${interaction.user.tag}`);
            
            return interaction.reply({
                content: `✅ **${targetUser.tag}** a reçu le rôle VIP !`,
                ephemeral: false
            });
            
        } catch (error) {
            console.error('❌ Erreur attribution rôle VIP:', error);
            return interaction.reply({
                content: '❌ Erreur lors de l\'attribution du rôle VIP.',
                ephemeral: true
            });
        }
    }

    /**
     * Attribution de rôle Modérateur (sécurisée)
     */
    async assignModeratorRole(interaction, targetUser) {
        try {
            const guild = interaction.guild;
            const member = await guild.members.fetch(targetUser.id);
            const modRole = guild.roles.cache.get(this.config.moderatorRoleId);

            if (!modRole) {
                return interaction.reply({
                    content: '❌ Rôle Modérateur non configuré.',
                    ephemeral: true
                });
            }

            await member.roles.add(modRole);
            
            console.log(`✅ Rôle Modérateur attribué à ${targetUser.tag} par ${interaction.user.tag}`);
            
            return interaction.reply({
                content: `✅ **${targetUser.tag}** a reçu le rôle Modérateur !`,
                ephemeral: false
            });
            
        } catch (error) {
            console.error('❌ Erreur attribution rôle Modérateur:', error);
            return interaction.reply({
                content: '❌ Erreur lors de l\'attribution du rôle Modérateur.',
                ephemeral: true
            });
        }
    }

    /**
     * Envoie une notification "stream live" en respectant :
     * - pingGate (anti-reboot / transition OFF->ON)
     * - notificationConfig (kill-switch / livePing enabled)
     * - safePing (sanitisation des mentions si nécessaire)
     *
     * streamInfo : objet { user_name, title, game_name, viewer_count, ... }
     */
    async sendLiveNotification(streamInfo) {
        try {
            // 1) anti-rebond / transition
            const isLiveNow = true;
            if (!pingGate.shouldNotifyTransition(isLiveNow)) {
                console.log('⏸️ Live: transition non autorisée (anti-reboot ou pas de OFF→ON)');
                // On enregistre l'état quand même (pour éviter rebonds répétés)
                pingGate.recordAfterNotify(isLiveNow);
                return;
            }

            // 2) recharger config et vérifier permission d'envoyer
            notificationConfig.reload?.();
            if (!notificationConfig.isLivePingEnabled()) {
                console.log('🔕 Live ping OFF → aucune notification envoyée');
                pingGate.recordAfterNotify(isLiveNow);
                return;
            }

            // 3) construire message
            const roleId = notificationConfig.getPingRoleId();
            const rawMsg = notificationConfig.getPingMessage()
                || `${streamInfo.user_name} est en live : ${streamInfo.title || 'Pas de titre'}`;
            const variables = {
                streamer: streamInfo.user_name,
                streamer_login: streamInfo.user_login,
                title: streamInfo.title || '',
                game: streamInfo.game_name || '',
                viewers: streamInfo.viewer_count || 0
            };
            // remplacement simple des placeholders {streamer} {title}
            let msg = rawMsg.replace(/{streamer}/g, variables.streamer).replace(/{title}/g, variables.title);

            const channel = this._getRelayChannel() || this.discordClient.channels.cache.get(process.env.LIVE_NOTIFICATIONS_CHANNEL_ID);
            if (!channel || !channel.isTextBased()) {
                console.warn('⚠️ Aucun canal notifications live trouvé pour envoyer la notification');
                pingGate.recordAfterNotify(isLiveNow);
                return;
            }

            const content = roleId ? `<@&${roleId}> ${msg}` : msg;

            // 4) envoi via safePing (sera sanitize si nécessaire)
            const sent = await safePing.send(channel, { content }); // supports embeds si besoin
            if (sent && sent.id) {
                console.log('✅ Notification de stream envoyée');
            } else {
                console.log('ℹ️ Notification live neutralisée (contenu vide après sanitization)');
            }

            // 5) enregistrer état pour anti-rebond
            pingGate.recordAfterNotify(isLiveNow);
        } catch (err) {
            console.error('❌ Erreur sendLiveNotification:', err);
        }
    }
}

module.exports = TwitchBridge;