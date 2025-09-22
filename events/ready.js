const logger = require('../modules/utils/logger');

module.exports = (client) => {
    client.once('ready', async () => {
        logger.success(`🤖 Bot connecté: ${client.user.tag}`);
        logger.info(`📊 Serveurs: ${client.guilds.cache.size}`);
        logger.info(`👥 Utilisateurs: ${client.users.cache.size}`);
        
        // Statut du bot
        client.user.setActivity('Twitch & Discord', { type: 'WATCHING' });
        
        logger.success('🎯 Bot prêt à fonctionner !');
    });
};