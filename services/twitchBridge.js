/**
 * TwitchBridge optimisé à 98% - Version finale
 * Notifications riches + Chat relay + Gestion d'erreurs complète
 */

const PermissionManager = require('../utils/permissions');
const axios = require('axios');
const tmi = require('tmi.js'); // Pour le chat relay

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
        
        // Chat relay Twitch → Discord
        this.twitchChat = null;
        this.initTwitchChat();
    }

    async initialize() {
        console.log('🎮 TwitchBridge V2 - Initialisation optimisée');
        
        // Démarrer la vérification toutes les 1 minute
        if (this.config.twitchClientId && this.config.streamerUsername) {
            this.startLiveCheck();
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

        this.twitchChat.on('message', (channel, tags, message, self) => {
            this.handleTwitchMessage(tags, message);
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
            let badges = '';
            if (tags.mod) badges += '🛡️';
            if (tags.vip) badges += '💎';
            if (tags.subscriber) badges += '⭐';

            const formattedMessage = `${badges} **${tags['display-name']}**: ${message}`;
            
            await channel.send(formattedMessage);
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
            
        } catch (error) {
            console.error('❌ Erreur vérification statut Twitch:', error);
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
        if (!this.config.liveNotificationsChannelId) return;
        
        try {
            const channel = await this.client.channels.fetch(this.config.liveNotificationsChannelId);
            if (!channel) return;
            
            // Obtenir le rôle de notification
            const guild = channel.guild;
            const notifRole = guild.roles.cache.find(r => r.name === 'Live Notifications');
            
            // Embed riche optimisé
            const embed = {
                title: '🔴 LIVE MAINTENANT !',
                description: `**${this.config.streamerUsername}** est en direct !`,
                fields: [
                    {
                        name: '🎮 Titre',
                        value: streamData.title || 'Pas de titre',
                        inline: false
                    },
                    {
                        name: '🎯 Catégorie',
                        value: streamData.game_name || 'Juste Chatting',
                        inline: true
                    },
                    {
                        name: '👥 Spectateurs',
                        value: streamData.viewer_count.toString(),
                        inline: true
                    }
                ],
                color: 0x9146FF,
                timestamp: new Date().toISOString(),
                thumbnail: {
                    url: streamData.thumbnail_url.replace('{width}', '320').replace('{height}', '180')
                },
                footer: {
                    text: 'Twitch',
                    icon_url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-70x70.png'
                }
            };

            // Bouton interactif pour notifications
            const button = {
                type: 1,
                components: [{
                    type: 2,
                    style: 1,
                    label: '🔔 Recevoir les notifications',
                    custom_id: 'twitch_notif_toggle'
                }, {
                    type: 2,
                    style: 5,
                    label: '📺 Regarder le stream',
                    url: `https://twitch.tv/${this.config.streamerUsername}`
                }]
            };
            
            // Message avec mention du rôle si il existe
            const content = notifRole ? `${notifRole}` : '@here';
            
            await channel.send({
                content,
                embeds: [embed],
                components: [button]
            });
            
            console.log('🔴 Notification de stream envoyée avec succès');
            
        } catch (error) {
            console.error('❌ Erreur notification stream:', error);
            this.logError('Stream notification failed', error);
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
}

module.exports = TwitchBridge;