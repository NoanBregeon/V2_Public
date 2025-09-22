const logger = require('../modules/utils/logger');

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        try {
            const welcomeManager = require('../modules/discord/welcome');
            await welcomeManager.handleNewMember(member);
            
        } catch (error) {
            logger.error('Erreur gestion nouveau membre:', error);
        }
    });
};