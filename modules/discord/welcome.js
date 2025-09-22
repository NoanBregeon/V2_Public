const logger = require('../utils/logger');
const templates = require('../utils/templates');

class WelcomeManager {
    constructor() {
        this.client = null;
        this.welcomeChannelId = null;
        this.defaultRoleId = null;
    }
    
    init(client) {
        this.client = client;
        this.welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
        this.defaultRoleId = process.env.DEFAULT_ROLE_ID;
        
        if (!this.welcomeChannelId) {
            logger.warn('Canal de bienvenue non configuré (WELCOME_CHANNEL_ID)');
        }
        
        logger.success('👋 Système de bienvenue initialisé');
    }
    
    async handleNewMember(member) {
        try {
            // Envoyer le message de bienvenue
            await this.sendWelcomeMessage(member);
            
            // Ajouter le rôle par défaut
            await this.assignDefaultRole(member);
            
            logger.success(`👋 Nouveau membre accueilli: ${member.displayName}`);
            
        } catch (error) {
            logger.error('Erreur gestion nouveau membre:', error);
        }
    }
    
    async sendWelcomeMessage(member) {
        if (!this.welcomeChannelId) return;
        
        try {
            const channel = this.client.channels.cache.get(this.welcomeChannelId);
            if (!channel) {
                logger.warn(`Canal de bienvenue non trouvé: ${this.welcomeChannelId}`);
                return;
            }
            
            const embed = templates.getWelcomeMessage(member, member.guild);
            
            await channel.send({
                content: `👋 ${member}`,
                embeds: [embed]
            });
            
            logger.info(`Message de bienvenue envoyé pour ${member.displayName}`);
            
        } catch (error) {
            logger.error('Erreur envoi message de bienvenue:', error);
        }
    }
    
    async assignDefaultRole(member) {
        if (!this.defaultRoleId) return;
        
        try {
            const role = member.guild.roles.cache.get(this.defaultRoleId);
            if (!role) {
                logger.warn(`Rôle par défaut non trouvé: ${this.defaultRoleId}`);
                return;
            }
            
            await member.roles.add(role, 'Rôle automatique nouveau membre');
            logger.info(`Rôle "${role.name}" ajouté à ${member.displayName}`);
            
        } catch (error) {
            logger.error('Erreur attribution rôle par défaut:', error);
        }
    }
    
    // Statistiques
    getStats() {
        return {
            welcomeChannel: this.welcomeChannelId ? 'Configuré' : 'Non configuré',
            defaultRole: this.defaultRoleId ? 'Configuré' : 'Non configuré'
        };
    }
}

module.exports = new WelcomeManager();