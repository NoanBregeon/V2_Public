const logger = require('../modules/utils/logger');

module.exports = (client) => {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands?.get(interaction.commandName);
        if (!command) return;

        try {
            logger.info(`💬 Commande exécutée: /${interaction.commandName} par ${interaction.user.tag}`);
            
            await command.execute(interaction);
        } catch (error) {
            logger.error('Erreur commande:', { 
                command: interaction.commandName, 
                user: interaction.user.tag, 
                error: error.message 
            });

            const errorMessage = '❌ Une erreur est survenue lors de l\'exécution de cette commande.';
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    });
};