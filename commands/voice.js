const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Gérer votre salon vocal temporaire')
        .setDMPermission(false) // Interdire en MP
        // PAS de setDefaultMemberPermissions() = accessible à tous
        .addSubcommand(subcommand =>
            subcommand
                .setName('rename')
                .setDescription('Renommer votre salon vocal')
                .addStringOption(option =>
                    option
                        .setName('nom')
                        .setDescription('Nouveau nom du salon')
                        .setRequired(true)
                        .setMaxLength(32)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('limit')
                .setDescription('Limiter le nombre d\'utilisateurs')
                .addIntegerOption(option =>
                    option
                        .setName('nombre')
                        .setDescription('Nombre maximum d\'utilisateurs (0 = illimité)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(99)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('lock')
                .setDescription('Verrouiller le salon (empêcher les nouveaux utilisateurs de rejoindre)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlock')
                .setDescription('Déverrouiller le salon')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('transfer')
                .setDescription('Transférer la propriété du salon')
                .addUserOption(option =>
                    option
                        .setName('utilisateur')
                        .setDescription('Nouveau propriétaire du salon')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const voiceManager = interaction.client.moduleManager?.getModule('voiceManager');
        
        if (!voiceManager) {
            return interaction.reply({
                content: '❌ Module vocal non disponible.',
                ephemeral: true
            });
        }
        
        await voiceManager.handleVoiceCommand(interaction, subcommand);
    }
};
