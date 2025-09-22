const logger = require('../modules/utils/logger');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // Ignore les bots
        if (message.author.bot) return;
        
        try {
            // Vérifier les commandes vocales d'abord
            const voiceManager = require('../modules/discord/voice');
            if (message.content.startsWith('!')) {
                const handled = await voiceManager.handleVoiceCommand(message);
                if (handled) return; // Commande vocale traitée, ne pas continuer
            }
            
            // Anti-spam et modération
            const moderation = require('../modules/discord/moderation');
            await moderation.handleMessage(message);
            
        } catch (error) {
            logger.error('Erreur gestion message:', error);
        }
    });
};