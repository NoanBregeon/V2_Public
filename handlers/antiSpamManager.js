/**
 * Gestionnaire Anti-Spam Intelligent
 * Détection et prévention automatique du spam
 */

const { EmbedBuilder } = require('discord.js');

class AntiSpamManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        
        // Configuration anti-spam
        this.settings = {
            // Messages identiques
            duplicateThreshold: 3,          // 3 messages identiques
            duplicateTimeWindow: 30000,     // dans 30 secondes
            
            // Flood de messages
            messageThreshold: 5,            // 5 messages
            messageTimeWindow: 10000,       // dans 10 secondes
            
            // Mentions excessives
            mentionThreshold: 5,            // 5 mentions
            mentionTimeWindow: 60000,       // dans 1 minute
            
            // Emojis/Réactions spam
            emojiThreshold: 10,             // 10 emojis
            emojiTimeWindow: 30000,         // dans 30 secondes
            
            // Liens suspects
            linkThreshold: 3,               // 3 liens
            linkTimeWindow: 60000,          // dans 1 minute
            
            // Sanctions
            muteFirstOffense: 300000,       // 5 minutes
            muteSecondOffense: 900000,      // 15 minutes
            muteThirdOffense: 3600000,      // 1 heure
            banAfterOffenses: 3,            // Ban après 3 offenses
            
            // Whitelist
            excludedRoles: ['MODERATOR_ROLE_ID', 'VIP_ROLE_ID'],
            excludedChannels: ['LOGS_CHANNEL_ID']
        };
        
        // Stockage temporaire des données
        this.userMessages = new Map();      // userId -> [messages]
        this.userOffenses = new Map();      // userId -> offense count
        this.mutedUsers = new Map();        // userId -> unmute timestamp
        
        // Patterns de détection
        this.suspiciousPatterns = [
            /discord\.gg\/\w+/gi,           // Invitations Discord
            /discordapp\.com\/invite/gi,    // Invitations Discord alt
            /bit\.ly\/\w+/gi,               // Liens raccourcis suspects
            /tinyurl\.com\/\w+/gi,          // Liens raccourcis
            /@everyone|@here/gi,            // Mentions everyone/here
            /(.)\1{10,}/gi,                 // Répétition de caractères (11+)
            /🚀|💰|💎|🎁/g                    // Emojis souvent utilisés pour spam
        ];
    }

    async initialize() {
        this.logger = require('../utils/logger');
        
        // Nettoyer les données anciennes toutes les 5 minutes
        setInterval(() => {
            this.cleanOldData();
        }, 300000);
        
        console.log('✅ AntiSpamManager initialisé');
    }

    async checkMessage(message) {
        // Ignorer les bots
        if (message.author.bot) return false;
        
        // Ignorer les utilisateurs avec rôles exclus
        if (this.isExcludedUser(message.member)) return false;
        
        // Ignorer les canaux exclus
        if (this.settings.excludedChannels.includes(message.channel.id)) return false;
        
        const userId = message.author.id;
        const now = Date.now();
        
        // Initialiser les données utilisateur
        if (!this.userMessages.has(userId)) {
            this.userMessages.set(userId, []);
        }
        
        const userMessages = this.userMessages.get(userId);
        
        // Ajouter le message actuel
        userMessages.push({
            id: message.id,
            content: message.content,
            timestamp: now,
            channelId: message.channel.id,
            mentions: message.mentions.users.size,
            attachments: message.attachments.size
        });
        
        // Vérifications anti-spam
        const violations = [];
        
        // 1. Messages identiques
        if (this.checkDuplicateMessages(userMessages, now)) {
            violations.push('Messages identiques répétés');
        }
        
        // 2. Flood de messages
        if (this.checkMessageFlood(userMessages, now)) {
            violations.push('Flood de messages');
        }
        
        // 3. Mentions excessives
        if (this.checkExcessiveMentions(userMessages, now)) {
            violations.push('Mentions excessives');
        }
        
        // 4. Contenu suspect
        if (this.checkSuspiciousContent(message.content)) {
            violations.push('Contenu suspect détecté');
        }
        
        // 5. Emojis spam
        if (this.checkEmojiSpam(message.content)) {
            violations.push('Spam d\'emojis');
        }
        
        // Appliquer les sanctions si violations détectées
        if (violations.length > 0) {
            await this.handleSpamViolation(message, violations);
            return true; // Message considéré comme spam
        }
        
        return false;
    }

    checkDuplicateMessages(userMessages, now) {
        const recentDuplicates = userMessages.filter(msg => 
            now - msg.timestamp <= this.settings.duplicateTimeWindow
        );
        
        if (recentDuplicates.length < this.settings.duplicateThreshold) return false;
        
        // Vérifier si les 3 derniers messages sont identiques
        const lastMessages = recentDuplicates.slice(-this.settings.duplicateThreshold);
        const firstContent = lastMessages[0].content.toLowerCase();
        
        return lastMessages.every(msg => msg.content.toLowerCase() === firstContent);
    }

    checkMessageFlood(userMessages, now) {
        const recentMessages = userMessages.filter(msg => 
            now - msg.timestamp <= this.settings.messageTimeWindow
        );
        
        return recentMessages.length >= this.settings.messageThreshold;
    }

    checkExcessiveMentions(userMessages, now) {
        const recentMentions = userMessages.filter(msg => 
            now - msg.timestamp <= this.settings.mentionTimeWindow
        );
        
        const totalMentions = recentMentions.reduce((sum, msg) => sum + msg.mentions, 0);
        return totalMentions >= this.settings.mentionThreshold;
    }

    checkSuspiciousContent(content) {
        return this.suspiciousPatterns.some(pattern => pattern.test(content));
    }

    checkEmojiSpam(content) {
        const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
        return emojiCount >= this.settings.emojiThreshold;
    }

    async handleSpamViolation(message, violations) {
        const userId = message.author.id;
        
        // Supprimer le message de spam
        try {
            await message.delete();
        } catch (error) {
            console.warn('⚠️ Impossible de supprimer le message spam:', error);
        }
        
        // Incrémenter le compteur d'offenses
        const currentOffenses = (this.userOffenses.get(userId) || 0) + 1;
        this.userOffenses.set(userId, currentOffenses);
        
        // Déterminer la sanction
        let action, duration;
        
        if (currentOffenses >= this.settings.banAfterOffenses) {
            action = 'ban';
            await this.banUser(message.member, violations);
        } else {
            action = 'mute';
            duration = this.getMuteDuration(currentOffenses);
            await this.muteUser(message.member, duration, violations);
        }
        
        // Log de l'action
        await this.logSpamAction(message, violations, action, duration, currentOffenses);
        
        // Log détaillé de l'action anti-spam
        this.logger.security(`Spam détecté: ${violations.join(', ')}`, {
            userId: `${message.author.tag}:${message.author.id}`,
            guildId: message.guild.id,
            extra: {
                channelId: message.channel.id,
                messageContent: message.content.substring(0, 100),
                action: action,
                duration: duration,
                offenseCount: currentOffenses,
                violations: violations
            }
        });

        // Notifier l'utilisateur
        await this.notifyUser(message.author, violations, action, duration);
    }

    getMuteDuration(offenseCount) {
        switch (offenseCount) {
            case 1: return this.settings.muteFirstOffense;
            case 2: return this.settings.muteSecondOffense;
            default: return this.settings.muteThirdOffense;
        }
    }

    async muteUser(member, duration, violations) {
        try {
            await member.timeout(duration, `Anti-spam: ${violations.join(', ')}`);
            
            // Enregistrer le mute
            this.mutedUsers.set(member.id, Date.now() + duration);
            
            console.log(`🔇 Utilisateur muted: ${member.user.tag} pour ${duration/1000}s`);
        } catch (error) {
            console.error('❌ Erreur mute anti-spam:', error);
        }
    }

    async banUser(member, violations) {
        try {
            await member.ban({ 
                reason: `Anti-spam automatique: ${violations.join(', ')}`,
                deleteMessageDays: 1
            });
            
            console.log(`🔨 Utilisateur banni: ${member.user.tag} (spam répété)`);
        } catch (error) {
            console.error('❌ Erreur ban anti-spam:', error);
        }
    }

    async logSpamAction(message, violations, action, duration, offenseCount) {
        if (!this.config.moderationChannelId) return;
        
        try {
            const logChannel = await this.client.channels.fetch(this.config.moderationChannelId);
            if (!logChannel) return;
            
            const embed = new EmbedBuilder()
                .setTitle('🚨 Action Anti-Spam')
                .setColor(action === 'ban' ? 0xE74C3C : 0xF39C12)
                .addFields(
                    { name: '👤 Utilisateur', value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
                    { name: '📍 Canal', value: `<#${message.channel.id}>`, inline: true },
                    { name: '⚖️ Action', value: action === 'ban' ? 'Bannissement' : `Timeout ${Math.round(duration/60000)}min`, inline: true },
                    { name: '📊 Offense #', value: offenseCount.toString(), inline: true },
                    { name: '🚫 Violations', value: violations.join('\n• '), inline: false },
                    { name: '💬 Message', value: message.content.substring(0, 1000) || '*Pas de contenu*', inline: false }
                )
                .setTimestamp();
            
            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Erreur log anti-spam:', error);
        }
    }

    async notifyUser(user, violations, action, duration) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Action Anti-Spam')
                .setDescription(`Votre message a été détecté comme spam et supprimé.`)
                .addFields(
                    { name: '🚫 Raisons', value: violations.join('\n• '), inline: false },
                    { name: '⚖️ Sanction', value: action === 'ban' ? 'Bannissement du serveur' : `Timeout de ${Math.round(duration/60000)} minutes`, inline: false },
                    { name: '💡 Conseil', value: 'Respectez les règles du serveur pour éviter de futures sanctions.', inline: false }
                )
                .setColor(action === 'ban' ? 0xE74C3C : 0xF39C12)
                .setTimestamp();
            
            await user.send({ embeds: [embed] });
        } catch (error) {
            // L'utilisateur a probablement désactivé les MPs
            console.log(`ℹ️ Impossible d'envoyer MP à ${user.tag}`);
        }
    }

    isExcludedUser(member) {
        if (!member) return false;
        
        // Vérifier les permissions administrateur
        if (member.permissions.has('Administrator')) return true;
        
        // Vérifier les rôles exclus
        return this.settings.excludedRoles.some(roleId => 
            member.roles.cache.has(this.config[roleId])
        );
    }

    cleanOldData() {
        const now = Date.now();
        const maxAge = Math.max(
            this.settings.duplicateTimeWindow,
            this.settings.messageTimeWindow,
            this.settings.mentionTimeWindow,
            this.settings.linkTimeWindow
        );
        
        // Nettoyer les messages anciens
        this.userMessages.forEach((messages, userId) => {
            const recentMessages = messages.filter(msg => now - msg.timestamp <= maxAge);
            if (recentMessages.length === 0) {
                this.userMessages.delete(userId);
            } else {
                this.userMessages.set(userId, recentMessages);
            }
        });
        
        // Nettoyer les mutes expirés
        this.mutedUsers.forEach((unmuteTime, userId) => {
            if (now >= unmuteTime) {
                this.mutedUsers.delete(userId);
            }
        });
        
        console.log(`🧹 Anti-spam: Données nettoyées (${this.userMessages.size} utilisateurs actifs)`);
    }

    // Méthodes de configuration
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('⚙️ Paramètres anti-spam mis à jour');
    }

    getStats() {
        return {
            activeUsers: this.userMessages.size,
            mutedUsers: this.mutedUsers.size,
            totalOffenses: Array.from(this.userOffenses.values()).reduce((sum, count) => sum + count, 0)
        };
    }
}

module.exports = AntiSpamManager;
