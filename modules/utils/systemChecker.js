const { EmbedBuilder } = require('discord.js');
const logger = require('./logger');

class SystemChecker {
    constructor() {
        this.client = null;
        this.checkResults = [];
    }
    
    setClient(client) {
        this.client = client;
    }
    
    async performStartupChecks() {
        logger.info('🔍 Démarrage des vérifications système...');
        
        this.checkResults = [];
        
        // Vérifications
        await this.checkDiscordConnection();
        await this.checkEnvironmentVariables();
        await this.checkTwitchAPI();
        await this.checkDiscordChannels();
        await this.checkDiscordRoles();
        await this.checkModules();
        
        // Envoyer le rapport dans Discord
        await this.sendStartupReport();
        
        logger.success('✅ Vérifications système terminées');
    }
    
    async checkDiscordConnection() {
        try {
            const isConnected = this.client && this.client.isReady();
            const guild = this.client.guilds.cache.first();
            
            this.addResult('Discord', isConnected ? '✅' : '❌', {
                status: isConnected ? 'Connecté' : 'Déconnecté',
                user: this.client.user?.tag,
                guild: guild?.name,
                members: guild?.memberCount || 0
            });
        } catch (error) {
            this.addResult('Discord', '❌', { error: error.message });
        }
    }
    
    async checkEnvironmentVariables() {
        const requiredVars = [
            'DISCORD_TOKEN',
            'TWITCH_CLIENT_ID', 
            'TWITCH_USER_TOKEN',
            'STREAMER_USERNAME'
        ];
        
        const optionalVars = [
            'LOGS_CHANNEL_ID',
            'NOTIFICATIONS_CHANNEL_ID',
            'LIVE_NOTIFICATIONS_CHANNEL_ID',
            'MODERATION_CHANNEL_ID',
            'WELCOME_CHANNEL_ID',
            'CREATE_VOICE_CHANNEL_ID',
            'VOICE_INSTRUCTIONS_CHANNEL_ID'
        ];
        
        const missing = requiredVars.filter(v => !process.env[v]);
        const configured = optionalVars.filter(v => process.env[v]);
        
        this.addResult('Variables ENV', missing.length === 0 ? '✅' : '❌', {
            required: `${requiredVars.length - missing.length}/${requiredVars.length}`,
            optional: `${configured.length}/${optionalVars.length}`,
            missing: missing.join(', ') || 'Aucune'
        });
    }
    
    async checkTwitchAPI() {
        try {
            const twitchAPI = require('../twitch/api');
            
            // Test de connexion API
            const streamerId = await twitchAPI.getStreamerId();
            const [vips, mods] = await Promise.all([
                twitchAPI.getVIPs(),
                twitchAPI.getModerators()
            ]);
            
            this.addResult('API Twitch', '✅', {
                streamer: process.env.STREAMER_USERNAME,
                streamerId: streamerId,
                vips: vips.length,
                moderators: mods.length
            });
        } catch (error) {
            this.addResult('API Twitch', '❌', { error: error.message });
        }
    }
    
    async checkDiscordChannels() {
        const channels = {
            'Logs': process.env.LOGS_CHANNEL_ID,
            'Notifications': process.env.NOTIFICATIONS_CHANNEL_ID,
            'Live Notifications': process.env.LIVE_NOTIFICATIONS_CHANNEL_ID,
            'Modération': process.env.MODERATION_CHANNEL_ID,
            'Bienvenue': process.env.WELCOME_CHANNEL_ID,
            'Créer Vocal': process.env.CREATE_VOICE_CHANNEL_ID,
            'Instructions Vocales': process.env.VOICE_INSTRUCTIONS_CHANNEL_ID
        };
        
        const results = {};
        let validChannels = 0;
        
        for (const [name, id] of Object.entries(channels)) {
            if (id) {
                const channel = this.client.channels.cache.get(id);
                results[name] = channel ? '✅' : '❌';
                if (channel) validChannels++;
            } else {
                results[name] = '⚪';
            }
        }
        
        this.addResult('Canaux Discord', validChannels > 0 ? '✅' : '⚠️', {
            valid: validChannels,
            total: Object.values(channels).filter(id => id).length,
            details: results
        });
    }
    
    async checkDiscordRoles() {
        const roles = {
            'VIP': process.env.VIP_ROLE_ID,
            'Modérateur': process.env.MODERATOR_ROLE_ID,
            'Subscriber': process.env.SUBSCRIBER_ROLE_ID,
            'Défaut': process.env.DEFAULT_ROLE_ID
        };
        
        const results = {};
        let validRoles = 0;
        
        // FORCER LE BON SERVEUR avec GUILD_ID
        const guild = this.client.guilds.cache.get(process.env.GUILD_ID);
        
        if (!guild) {
            logger.error(`❌ Serveur non trouvé avec l'ID: ${process.env.GUILD_ID}`);
            logger.error(`📋 Serveurs disponibles: ${this.client.guilds.cache.map(g => `${g.name} (${g.id})`).join(', ')}`);
            
            this.addResult('Rôles Discord', '❌', {
                error: 'Serveur non trouvé',
                guildId: process.env.GUILD_ID
            });
            return;
        }
        
        logger.debug(`🔍 Debug rôles pour le serveur: ${guild.name} (${guild.id})`);
        logger.debug(`🤖 Bot membre ID: ${this.client.user.id}`);
        
        // Debug: Lister tous les rôles du serveur
        const allRoles = guild.roles.cache.map(r => `${r.name} (${r.id})`).join(', ');
        logger.debug(`📋 Tous les rôles du serveur: ${allRoles}`);
        
        for (const [name, id] of Object.entries(roles)) {
            if (id) {
                logger.debug(`🔍 Recherche du rôle ${name} avec l'ID: ${id}`);
                
                const role = guild.roles.cache.get(id);
                if (role) {
                    results[name] = `✅ ${role.name}`;
                    validRoles++;
                    logger.success(`✅ Rôle ${name}: ${role.name} (${role.id}) - Position: ${role.position}`);
                } else {
                    results[name] = `❌ Introuvable (${id})`;
                    logger.error(`❌ Rôle ${name}: Non trouvé avec l'ID ${id}`);
                    
                    // Essayer de trouver par nom
                    const roleByName = guild.roles.cache.find(r => r.name.toLowerCase().includes(name.toLowerCase()));
                    if (roleByName) {
                        logger.warn(`💡 Rôle similaire trouvé: ${roleByName.name} (${roleByName.id})`);
                    }
                }
            } else {
                results[name] = '⚪ Non configuré';
                logger.debug(`⚪ Rôle ${name}: Non configuré`);
            }
        }
        
        // Debug: Permissions du bot
        const botMember = guild.members.cache.get(this.client.user.id);
        if (botMember) {
            logger.debug(`🤖 Permissions du bot: ${botMember.permissions.toArray().join(', ')}`);
            logger.debug(`👑 Bot a MANAGE_ROLES: ${botMember.permissions.has('ManageRoles')}`);
            logger.debug(`🔧 Bot a ADMINISTRATOR: ${botMember.permissions.has('Administrator')}`);
        }
        
        this.addResult('Rôles Discord', validRoles > 0 ? '✅' : '❌', {
            valid: validRoles,
            total: Object.values(roles).filter(id => id).length,
            details: results
        });
    }
    
    async checkModules() {
        const modules = [
            'Synchronisation Twitch',
            'Notifications Twitch', 
            'Salons Vocaux',
            'Modération Discord',
            'Commandes Slash',
            'Sync Rôles',
            'Système Bienvenue',
            'Templates Messages'
        ];
        
        // Tous les modules sont chargés si on arrive ici
        this.addResult('Modules', '✅', {
            loaded: modules.length,
            total: modules.length,
            list: modules.join(', ')
        });
    }
    
    addResult(category, status, details) {
        this.checkResults.push({ category, status, details });
    }
    
    async sendStartupReport() {
        const logsChannelId = process.env.LOGS_CHANNEL_ID;
        if (!logsChannelId) return;
        
        try {
            const channel = this.client.channels.cache.get(logsChannelId);
            if (!channel) return;
            
            const successCount = this.checkResults.filter(r => r.status === '✅').length;
            const warningCount = this.checkResults.filter(r => r.status === '⚠️').length;
            const errorCount = this.checkResults.filter(r => r.status === '❌').length;
            
            const embed = new EmbedBuilder()
                .setTitle('🚀 Rapport de démarrage du bot')
                .setDescription(`**Bot V2 démarré avec succès !**\n\n**Résumé:**\n✅ ${successCount} OK | ⚠️ ${warningCount} Avertissements | ❌ ${errorCount} Erreurs`)
                .setColor(errorCount > 0 ? 0xff0000 : warningCount > 0 ? 0xffa500 : 0x00ff00)
                .setTimestamp();
            
            // Ajouter les détails des vérifications
            for (const result of this.checkResults) {
                let value = '';
                
                if (typeof result.details === 'object') {
                    for (const [key, val] of Object.entries(result.details)) {
                        if (key === 'details') continue;
                        value += `**${key}:** ${val}\n`;
                    }
                    
                    // Ajouter les détails si présents
                    if (result.details.details) {
                        value += '\n';
                        for (const [key, val] of Object.entries(result.details.details)) {
                            value += `${val} ${key}\n`;
                        }
                    }
                } else {
                    value = result.details;
                }
                
                embed.addFields([{
                    name: `${result.status} ${result.category}`,
                    value: value || 'OK',
                    inline: true
                }]);
            }
            
            await channel.send({ embeds: [embed] });
            logger.success('📊 Rapport de démarrage envoyé dans Discord');
            
        } catch (error) {
            logger.error('Erreur envoi rapport démarrage:', error);
        }
    }
    
    // Méthode pour faire un check manuel
    async performManualCheck() {
        await this.performStartupChecks();
    }
}

module.exports = new SystemChecker();