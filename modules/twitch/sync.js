const twitchAPI = require('./api');
const logger = require('../utils/logger');

class TwitchSync {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.vipList = new Set();
        this.moderatorList = new Set();
        this.client = null;
    }
    
    setClient(client) {
        this.client = client;
    }
    
    async start() {
        if (this.isRunning) return;
        
        logger.info('🔄 Démarrage de la synchronisation Twitch');
        this.isRunning = true;
        
        // Sync immédiate (silencieuse au démarrage)
        await this.initialSync();
        
        // Sync périodique (toutes les minutes)
        this.intervalId = setInterval(() => {
            this.sync().catch(error => {
                logger.error('Erreur sync périodique:', error);
            });
        }, 60000);
    }
    
    async stop() {
        if (!this.isRunning) return;
        
        logger.info('⏹️ Arrêt de la synchronisation Twitch');
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    async sync() {
        try {
            logger.debug('🔄 Vérification des changements Twitch...');
            
            // Récupération des listes Twitch
            const [vips, moderators] = await Promise.all([
                twitchAPI.getVIPs(),
                twitchAPI.getModerators()
            ]);
            
            // Mise à jour des listes locales
            const oldVips = new Set(this.vipList);
            const oldModerators = new Set(this.moderatorList);
            
            this.vipList = new Set(vips);
            this.moderatorList = new Set(moderators);
            
            // Détection des changements
            await this.detectChanges('VIP', oldVips, this.vipList);
            await this.detectChanges('Modérateur', oldModerators, this.moderatorList);
            
            // Afficher un résumé seulement s'il y a des changements
            const vipChanges = (this.vipList.size !== oldVips.size);
            const modChanges = (this.moderatorList.size !== oldModerators.size);
            
            if (vipChanges || modChanges) {
                logger.success(`Sync terminée: ${this.vipList.size} VIP(s), ${this.moderatorList.size} modo(s)`);
            }
        } catch (error) {
            logger.error('Erreur synchronisation:', error);
        }
    }
    
    async initialSync() {
        try {
            logger.debug('🔄 Synchronisation initiale...');
            
            // Récupération des listes Twitch (première fois)
            const [vips, moderators] = await Promise.all([
                twitchAPI.getVIPs(),
                twitchAPI.getModerators()
            ]);
            
            // Initialisation des listes (pas de détection de changements)
            this.vipList = new Set(vips);
            this.moderatorList = new Set(moderators);
            
            logger.success(`✅ Synchronisation initiale terminée: ${vips.length} VIP(s), ${moderators.length} modo(s)`);
            
        } catch (error) {
            logger.error('Erreur synchronisation initiale:', error);
        }
    }
    
    async detectChanges(type, oldList, newList) {
        let hasChanges = false;
        
        // Nouveaux ajouts
        for (const username of newList) {
            if (!oldList.has(username)) {
                logger.success(`➕ Nouveau ${type}: ${username}`);
                await this.notifyDiscord('add', type, username);
                hasChanges = true;
            }
        }
        
        // Suppressions
        for (const username of oldList) {
            if (!newList.has(username)) {
                logger.info(`➖ ${type} retiré: ${username}`);
                await this.notifyDiscord('remove', type, username);
                hasChanges = true;
            }
        }
        
        return hasChanges;
    }
    
    async notifyDiscord(action, type, username) {
        if (!this.client || !process.env.LOGS_CHANNEL_ID) return;
        
        try {
            const channel = this.client.channels.cache.get(process.env.LOGS_CHANNEL_ID);
            if (!channel) return;
            
            const emoji = action === 'add' ? '✅' : '❌';
            const actionText = action === 'add' ? 'ajouté' : 'retiré';
            
            await channel.send(`${emoji} **${username}** ${actionText} comme ${type} sur Twitch`);
        } catch (error) {
            logger.error('Erreur notification Discord:', error);
        }
    }
    
    // Méthodes pour les commandes Discord
    getVIPs() {
        return Array.from(this.vipList);
    }
    
    getModerators() {
        return Array.from(this.moderatorList);
    }
    
    isVIP(username) {
        return this.vipList.has(username.toLowerCase());
    }
    
    isModerator(username) {
        return this.moderatorList.has(username.toLowerCase());
    }
    
    async forceSync() {
        logger.info('🔄 Synchronisation forcée demandée');
        await this.sync();
    }
}

module.exports = new TwitchSync();