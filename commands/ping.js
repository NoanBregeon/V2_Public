// Commande simple de latence (pong).
// Ne gère PAS les notifications live / pings de rôle.
// Utilisez /liveping pour activer/désactiver le ping des notifications de stream.
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Vérifier la latence du bot'),

    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);
        
        await interaction.editReply(
            `🏓 **Pong !**\n` +
            `📡 Latence: **${latency}ms**\n` +
            `💻 API Discord: **${apiLatency}ms**`
        );
    }
};
