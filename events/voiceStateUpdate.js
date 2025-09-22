const logger = require('../modules/utils/logger');

module.exports = (client) => {
    client.on('voiceStateUpdate', async (oldState, newState) => {
        const voiceManager = require('../modules/discord/voice');
        
        try {
            await voiceManager.handleVoiceStateUpdate(oldState, newState);
        } catch (error) {
            logger.error('Erreur gestion état vocal:', error);
        }
    });
};