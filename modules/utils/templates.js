const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class TemplateManager {
    constructor() {
        this.templates = null;
        this.configPath = path.join(__dirname, '../../config/messages.json');
        this.loadTemplates();
    }
    
    loadTemplates() {
        try {
            const rawData = fs.readFileSync(this.configPath, 'utf8');
            this.templates = JSON.parse(rawData);
            logger.success('📝 Templates de messages chargés');
        } catch (error) {
            logger.error('Erreur chargement templates:', error);
            this.templates = this.getDefaultTemplates();
        }
    }
    
    getDefaultTemplates() {
        return {
            liveNotification: {
                ping: "@everyone",
                title: "🔴 {streamer} est en live !",
                description: "{title}",
                color: 9520895
            },
            welcomeMessage: {
                title: "👋 Bienvenue !",
                description: "Salut {user} ! Bienvenue sur le serveur !",
                color: 5793266
            }
        };
    }
    
    replaceVariables(text, variables) {
        if (!text) return text;
        
        let result = text;
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{${key}}`;
            result = result.replace(new RegExp(placeholder, 'g'), value || 'Non défini');
        }
        return result;
    }
    
    buildEmbed(templateKey, variables) {
        const template = this.templates[templateKey];
        if (!template) {
            logger.warn(`Template non trouvé: ${templateKey}`);
            return null;
        }
        
        const embed = {};
        
        if (template.title) {
            embed.title = this.replaceVariables(template.title, variables);
        }
        
        if (template.description) {
            embed.description = this.replaceVariables(template.description, variables);
        }
        
        if (template.color) {
            embed.color = template.color;
        }
        
        if (template.fields) {
            embed.fields = template.fields.map(field => ({
                name: this.replaceVariables(field.name, variables),
                value: this.replaceVariables(field.value, variables),
                inline: field.inline || false
            }));
        }
        
        if (template.footer) {
            embed.footer = {
                text: this.replaceVariables(template.footer.text, variables),
                iconURL: this.replaceVariables(template.footer.icon, variables)
            };
        }
        
        if (template.thumbnail) {
            embed.thumbnail = {
                url: this.replaceVariables(template.thumbnail, variables)
            };
        }
        
        if (template.url) {
            embed.url = this.replaceVariables(template.url, variables);
        }
        
        embed.timestamp = new Date().toISOString();
        
        return embed;
    }
    
    getMessage(templateKey, variables) {
        const template = this.templates[templateKey];
        if (!template) {
            logger.warn(`Template non trouvé: ${templateKey}`);
            return null;
        }
        
        if (template.message) {
            return this.replaceVariables(template.message, variables);
        }
        
        return null;
    }
    
    getLiveNotification(streamInfo) {
        const variables = {
            streamer: streamInfo.user_name,
            streamer_login: streamInfo.user_login,
            title: streamInfo.title || 'Aucun titre',
            game: streamInfo.game_name || 'Non défini',
            viewers: new Intl.NumberFormat('fr-FR').format(streamInfo.viewer_count),
            thumbnail: streamInfo.thumbnail_url?.replace('{width}', '320').replace('{height}', '180')
        };
        
        const embed = this.buildEmbed('liveNotification', variables);
        const ping = this.templates.liveNotification.ping;
        
        return { embed, ping };
    }
    
    getOfflineNotification(duration = null) {
        const template = this.templates.offlineNotification;
        let message = template.message;
        
        if (duration && template.showDuration) {
            const durationText = this.replaceVariables(template.durationText, {
                duration: this.formatDuration(duration)
            });
            message += durationText;
        }
        
        return message;
    }
    
    getWelcomeMessage(member, guild) {
        const variables = {
            user: member.toString(),
            username: member.displayName,
            guild_name: guild.name,
            streamer: process.env.STREAMER_USERNAME,
            user_avatar: member.displayAvatarURL(),
            guild_icon: guild.iconURL()
        };
        
        const embed = this.buildEmbed('welcomeMessage', variables);
        return embed;
    }
    
    getVoiceInstructions(member, tempChannel) {
        const variables = {
            user: member.toString(),
            channel_name: tempChannel.name,
            channel_mention: `<#${tempChannel.id}>`
        };
        
        const template = this.templates.voiceInstructions;
        const message = this.replaceVariables(template.title, variables) + '\n\n' + 
                       this.replaceVariables(template.description, variables);
        
        return message;
    }
    
    getModerationWarning(type, user) {
        const template = this.templates.moderation;
        const variables = { user: user.toString() };
        
        switch (type) {
            case 'spam':
                return this.replaceVariables(template.spamWarning, variables);
            case 'bannedWord':
                return this.replaceVariables(template.bannedWordWarning, variables);
            case 'link':
                return this.replaceVariables(template.linkWarning, variables);
            default:
                return '⚠️ Message supprimé par la modération.';
        }
    }
    
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        
        return parts.join(' ');
    }
    
    // Recharger les templates depuis le fichier
    reloadTemplates() {
        this.loadTemplates();
        logger.info('🔄 Templates rechargés depuis le fichier');
    }
    
    // Sauvegarder les templates dans le fichier
    saveTemplates() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.templates, null, 2));
            logger.success('💾 Templates sauvegardés');
        } catch (error) {
            logger.error('Erreur sauvegarde templates:', error);
        }
    }
}

module.exports = new TemplateManager();