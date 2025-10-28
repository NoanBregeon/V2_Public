const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche la liste des commandes disponibles')
        .setDMPermission(false),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📖 Centre d\'aide')
            .setDescription(`Salut ${interaction.user} ! 🎉\n\nVoici toutes les commandes disponibles :`)
            .addFields(
                {
                    name: '🎤 Commandes Vocales',
                    value: '`!rename` - Renommer ton salon\n`!limit` - Limiter les utilisateurs\n`!lock` - Verrouiller le salon\n`!unlock` - Déverrouiller le salon',
                    inline: true
                },
                {
                    name: '🎮 Commandes Générales', 
                    value: '`/ping` - Latence du bot\n`/help` - Cette aide\n`/test` - Tests (Admin)',
                    inline: true
                },
                {
                    name: '🛡️ Modération',
                    value: '`/moderation ban` - Bannir\n`/moderation kick` - Expulser\n`/moderation timeout` - Timeout\n`/moderation warn` - Avertir',
                    inline: true
                },
                {
                    name: '🔥 Twitch (Admins)',
                    value: '`/twitch-vip` - Rôle VIP\n`/twitch-mod` - Rôle Mod',
                    inline: true
                }
            )
            .setColor(0x7289DA)
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ 
                text: 'Bot Discord V2',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();
            
        return interaction.reply({ embeds: [embed] });
    }
};
