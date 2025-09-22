const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Simulation des modules manquants s'ils n'existent pas
const logger = {
    success: console.log,
    error: console.error,
    warn: console.warn,
    info: console.log,
    debug: console.log
};

// Simulation des templates s'ils n'existent pas
const templates = {
    getModerationWarning: (type, user) => {
        return `⚠️ Attention ${user}, votre message contient du contenu non autorisé (${type}).`;
    },
    templates: {
        moderation: {
            warningDuration: 10000 // 10 secondes
        }
    }
};

class ModerationManager {
    constructor() {
        this.client = null;
        this.spamTracker = new Map(); 
        this.settings = {
            spamLimit: 5,
            spamWindow: 5000, 
            muteDuration: 5 * 60 * 1000,
        };
        
        this.bannedWords = [
            'spam', 'hate', 'toxic'
        ];
        
        this.allowedDomains = [
            'youtube.com', 'youtu.be', 'twitch.tv',
            'twitter.com', 'instagram.com', 'discord.gg'
        ];
    }
    
    init(client) {
        this.client = client;
        
        setInterval(() => {
            this.cleanupSpamTracker();
        }, 60000);
        
        logger.success('🛡️ Système de modération Discord initialisé');
    }
    
    async handleMessage(message) {
        if (message.author.bot) return;
        if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;
        
        try {
            await this.checkSpam(message);
            await this.checkBannedWords(message);
            await this.checkLinks(message);
            
        } catch (error) {
            logger.error('Erreur modération message:', error);
        }
    }
    
    async checkSpam(message) {
        const userId = message.author.id;
        const now = Date.now();
        
        if (!this.spamTracker.has(userId)) {
            this.spamTracker.set(userId, { messages: [], lastWarning: 0 });
        }
        
        const userData = this.spamTracker.get(userId);
        
        userData.messages = userData.messages.filter(
            timestamp => now - timestamp < this.settings.spamWindow
        );
        
        userData.messages.push(now);
        
        if (userData.messages.length >= this.settings.spamLimit) {
            await this.handleSpam(message, userData);
        }
    }
    
    async handleSpam(message, userData) {
        const now = Date.now();
        
        if (now - userData.lastWarning < 30000) return;
        
        userData.lastWarning = now;
        userData.messages = [];
        
        try {
            await message.delete();
            await message.member.timeout(this.settings.muteDuration, 'Spam détecté');
            
            await this.logModeration({
                action: 'Timeout (Spam)',
                user: message.author,
                moderator: this.client.user,
                reason: 'Messages spam détectés',
                duration: this.settings.muteDuration / 1000,
                channel: message.channel
            });
            
            logger.warn(`Spam détecté: ${message.author.tag} dans #${message.channel.name}`);
            
        } catch (error) {
            logger.error('Erreur gestion spam:', error);
        }
    }
    
    async checkBannedWords(message) {
        const content = message.content.toLowerCase();
        
        const foundBannedWord = this.bannedWords.find(word => 
            content.includes(word.toLowerCase())
        );
        
        if (foundBannedWord) {
            try {
                await message.delete();
                
                const warningMessage = await message.channel.send({
                    content: templates.getModerationWarning('bannedWord', message.author)
                });
                
                setTimeout(() => {
                    warningMessage.delete().catch(() => {});
                }, templates.templates.moderation.warningDuration);
                
                await this.logModeration({
                    action: 'Message supprimé',
                    user: message.author,
                    moderator: this.client.user,
                    reason: `Mot interdit: "${foundBannedWord}"`,
                    channel: message.channel
                });
                
                logger.warn(`Mot interdit détecté: ${message.author.tag} - "${foundBannedWord}"`);
                
            } catch (error) {
                logger.error('Erreur gestion mots interdits:', error);
            }
        }
    }
    
    async checkLinks(message) {
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const urls = message.content.match(urlRegex);
        
        if (!urls) return;
        
        const isAllowed = urls.every(url => {
            try {
                const domain = new URL(url).hostname.replace('www.', '');
                return this.allowedDomains.some(allowed => domain.includes(allowed));
            } catch {
                return false;
            }
        });
        
        if (!isAllowed) {
            try {
                await message.delete();
                
                const warningMessage = await message.channel.send({
                    content: templates.getModerationWarning('link', message.author)
                });
                
                setTimeout(() => {
                    warningMessage.delete().catch(() => {});
                }, templates.templates.moderation.warningDuration);
                
                await this.logModeration({
                    action: 'Lien supprimé',
                    user: message.author,
                    moderator: this.client.user,
                    reason: 'Lien non autorisé',
                    channel: message.channel
                });
                
                logger.warn(`Lien non autorisé: ${message.author.tag} - ${urls[0]}`);
                
            } catch (error) {
                logger.error('Erreur gestion liens:', error);
            }
        }
    }
    
    async logModeration(data) {
        const logChannelId = process.env.MODERATION_CHANNEL_ID;
        if (!logChannelId) return;
        
        try {
            const logChannel = this.client.channels.cache.get(logChannelId);
            if (!logChannel) return;
            
            const embed = new EmbedBuilder()
                .setColor(data.action.includes('Timeout') ? 0xffa500 : 0xff0000)
                .setTitle(`🛡️ Action de modération: ${data.action}`)
                .addFields([
                    {
                        name: '👤 Utilisateur',
                        value: `${data.user.tag} (${data.user.id})`,
                        inline: true
                    },
                    {
                        name: '🤖 Modérateur',
                        value: data.moderator.tag,
                        inline: true
                    },
                    {
                        name: '📍 Canal',
                        value: `#${data.channel.name}`,
                        inline: true
                    },
                    {
                        name: '📝 Raison',
                        value: data.reason
                    }
                ])
                .setThumbnail(data.user.displayAvatarURL())
                .setTimestamp();
            
            if (data.duration) {
                embed.addFields([
                    {
                        name: '⏱️ Durée',
                        value: `${data.duration} secondes`
                    }
                ]);
            }
            
            await logChannel.send({ embeds: [embed] });
            
        } catch (error) {
            logger.error('Erreur envoi log modération:', error);
        }
    }
    
    cleanupSpamTracker() {
        const now = Date.now();
        
        for (const [userId, userData] of this.spamTracker.entries()) {
            if (userData.messages.length === 0 && now - userData.lastWarning > 600000) {
                this.spamTracker.delete(userId);
            }
        }
        
        logger.debug(`Spam tracker nettoyé: ${this.spamTracker.size} utilisateurs trackés`);
    }
    
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        logger.info('Paramètres de modération mis à jour:', newSettings);
    }
    
    addBannedWord(word) {
        if (!this.bannedWords.includes(word.toLowerCase())) {
            this.bannedWords.push(word.toLowerCase());
            logger.info(`Mot ajouté à la liste interdite: ${word}`);
            return true;
        }
        return false;
    }
    
    removeBannedWord(word) {
        const index = this.bannedWords.indexOf(word.toLowerCase());
        if (index > -1) {
            this.bannedWords.splice(index, 1);
            logger.info(`Mot retiré de la liste interdite: ${word}`);
            return true;
        }
        return false;
    }
    
    addAllowedDomain(domain) {
        if (!this.allowedDomains.includes(domain.toLowerCase())) {
            this.allowedDomains.push(domain.toLowerCase());
            logger.info(`Domaine ajouté à la liste autorisée: ${domain}`);
            return true;
        }
        return false;
    }
    
    getStats() {
        return {
            trackedUsers: this.spamTracker.size,
            bannedWords: this.bannedWords.length,
            allowedDomains: this.allowedDomains.length,
            settings: this.settings
        };
    }
}

module.exports = new ModerationManager();