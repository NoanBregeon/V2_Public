const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Commandes d\'administration')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('reload-commands')
                .setDescription('Recharger et réenregistrer toutes les commandes')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('clean-commands')
                .setDescription('Nettoyer toutes les commandes (supprime les doublons)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Afficher le statut du bot et des modules')
        ),

    async execute(interaction) {
        // Vérifier les permissions admin
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Cette commande est réservée aux administrateurs.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const commandHandler = interaction.client.moduleManager?.getModule('commandHandler');

        switch (subcommand) {
            case 'reload-commands':
                await interaction.deferReply({ ephemeral: true });
                
                try {
                    if (commandHandler) {
                        await commandHandler.loadCommands();
                        await commandHandler.registerSlashCommands();
                    }
                    
                    await interaction.editReply({
                        content: '✅ Commandes rechargées et réenregistrées avec succès!'
                    });
                } catch (error) {
                    console.error('❌ Erreur reload commandes:', error);
                    await interaction.editReply({
                        content: '❌ Erreur lors du rechargement des commandes.'
                    });
                }
                break;

            case 'clean-commands':
                await interaction.deferReply({ ephemeral: true });
                
                try {
                    if (commandHandler) {
                        await commandHandler.cleanAllCommands();
                        // Attendre un peu puis réenregistrer
                        setTimeout(async () => {
                            await commandHandler.registerSlashCommands();
                        }, 2000);
                    }
                    
                    await interaction.editReply({
                        content: '✅ Nettoyage des commandes terminé! Réenregistrement en cours...'
                    });
                } catch (error) {
                    console.error('❌ Erreur nettoyage commandes:', error);
                    await interaction.editReply({
                        content: '❌ Erreur lors du nettoyage des commandes.'
                    });
                }
                break;

            case 'status':
                const moduleManager = interaction.client.moduleManager;
                const modules = moduleManager ? Array.from(moduleManager.modules.keys()) : [];
                const commandCount = commandHandler ? commandHandler.commands.size : 0;
                
                const statusEmbed = {
                    title: '🤖 Statut du Bot Discord V2',
                    fields: [
                        {
                            name: '📊 Modules chargés',
                            value: modules.length > 0 ? modules.join(', ') : 'Aucun',
                            inline: false
                        },
                        {
                            name: '⚡ Commandes disponibles',
                            value: commandCount.toString(),
                            inline: true
                        },
                        {
                            name: '🏓 Latence',
                            value: `${interaction.client.ws.ping}ms`,
                            inline: true
                        },
                        {
                            name: '⏱️ Uptime',
                            value: `<t:${Math.floor((Date.now() - interaction.client.uptime) / 1000)}:R>`,
                            inline: true
                        }
                    ],
                    color: 0x00FF00,
                    timestamp: new Date().toISOString()
                };
                
                await interaction.reply({
                    embeds: [statusEmbed],
                    ephemeral: true
                });
                break;

            default:
                await interaction.reply({
                    content: '❌ Sous-commande inconnue.',
                    ephemeral: true
                });
        }
    }
};
