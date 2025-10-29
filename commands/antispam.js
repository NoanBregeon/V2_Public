const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antispam')
        .setDescription('Gérer le système anti-spam')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Afficher le statut du système anti-spam')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('Afficher la configuration anti-spam')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('whitelist')
                .setDescription('Ajouter/retirer un utilisateur de la whitelist')
                .addUserOption(option =>
                    option
                        .setName('utilisateur')
                        .setDescription('Utilisateur à whitelister/déwhitelister')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option
                        .setName('ajouter')
                        .setDescription('True pour ajouter, False pour retirer')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const antiSpamManager = interaction.client.moduleManager?.getModule('antiSpamManager');
        if (!antiSpamManager) {
            return interaction.reply({
                content: '❌ Module anti-spam non disponible.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'status':
                return this.showStatus(interaction, antiSpamManager);
            case 'config':
                return this.showConfig(interaction, antiSpamManager);
            case 'whitelist':
                return this.manageWhitelist(interaction, antiSpamManager);
        }
    },

    async showStatus(interaction, antiSpamManager) {
        const stats = antiSpamManager.getStats();
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Statut Anti-Spam')
            .addFields(
                { name: '👥 Utilisateurs actifs', value: stats.activeUsers.toString(), inline: true },
                { name: '🔇 Utilisateurs mutés', value: stats.mutedUsers.toString(), inline: true },
                { name: '⚠️ Total offenses', value: stats.totalOffenses.toString(), inline: true },
                { name: '🛡️ Statut', value: '✅ Actif et fonctionnel', inline: false }
            )
            .setColor(0x00FF00)
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async showConfig(interaction, antiSpamManager) {
        const settings = antiSpamManager.settings;
        
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Configuration Anti-Spam')
            .addFields(
                { name: '📝 Messages identiques', value: `${settings.duplicateThreshold} en ${settings.duplicateTimeWindow/1000}s`, inline: true },
                { name: '💬 Flood messages', value: `${settings.messageThreshold} en ${settings.messageTimeWindow/1000}s`, inline: true },
                { name: '👥 Mentions', value: `${settings.mentionThreshold} en ${settings.mentionTimeWindow/1000}s`, inline: true },
                { name: '😀 Emojis', value: `${settings.emojiThreshold} en ${settings.emojiTimeWindow/1000}s`, inline: true },
                { name: '🔗 Liens', value: `${settings.linkThreshold} en ${settings.linkTimeWindow/1000}s`, inline: true },
                { name: '⚖️ Sanctions', value: `Mute: ${settings.muteFirstOffense/60000}min → ${settings.muteSecondOffense/60000}min → ${settings.muteThirdOffense/60000}min\nBan après: ${settings.banAfterOffenses} offenses`, inline: false }
            )
            .setColor(0x3498DB)
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async manageWhitelist(interaction, antiSpamManager) {
        // Cette fonctionnalité nécessiterait une base de données pour persister
        // Pour l'instant, on peut juste informer
        return interaction.reply({
            content: '⚠️ La gestion de whitelist nécessite une implémentation de base de données. Actuellement, les modérateurs et VIPs sont automatiquement exclus.',
            ephemeral: true
        });
    }
};
