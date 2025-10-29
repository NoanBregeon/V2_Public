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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('logs')
                .setDescription('Gérer et consulter les logs')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('Action à effectuer')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Statistiques', value: 'stats' },
                            { name: 'Rechercher', value: 'search' },
                            { name: 'Nettoyer', value: 'clean' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('categorie')
                        .setDescription('Catégorie de logs (pour recherche)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Sécurité', value: 'security' },
                            { name: 'Twitch', value: 'twitch' },
                            { name: 'Vocal', value: 'voice' },
                            { name: 'Modération', value: 'moderation' },
                            { name: 'Système', value: 'system' },
                            { name: 'Erreurs', value: 'error' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('terme')
                        .setDescription('Terme à rechercher dans les logs')
                        .setRequired(false)
                )
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

            case 'logs':
                return this.manageLogs(interaction);

            default:
                await interaction.reply({
                    content: '❌ Sous-commande inconnue.',
                    ephemeral: true
                });
        }
    },

    async manageLogs(interaction) {
        const logger = require('../utils/logger');
        const action = interaction.options.getString('action');
        
        await interaction.deferReply({ ephemeral: true });
        
        switch (action) {
            case 'stats':
                const stats = await logger.getLogStats();
                
                const statsEmbed = {
                    title: '📊 Statistiques des Logs',
                    fields: Object.entries(stats).map(([category, data]) => ({
                        name: `📁 ${category.charAt(0).toUpperCase() + category.slice(1)}`,
                        value: data.exists 
                            ? `Taille: ${(data.size / 1024).toFixed(1)} KB\nModifié: ${data.modified.toLocaleString()}`
                            : 'Fichier non créé',
                        inline: true
                    })),
                    color: 0x3498DB,
                    timestamp: new Date().toISOString()
                };
                
                return interaction.editReply({ embeds: [statsEmbed] });
                
            case 'search':
                const category = interaction.options.getString('categorie');
                const searchTerm = interaction.options.getString('terme');
                
                if (!category || !searchTerm) {
                    return interaction.editReply('❌ Catégorie et terme de recherche requis.');
                }
                
                const results = await logger.searchLogs(category, searchTerm, 10);
                
                if (results.length === 0) {
                    return interaction.editReply(`❌ Aucun résultat trouvé pour "${searchTerm}" dans ${category}.`);
                }
                
                const searchEmbed = {
                    title: `🔍 Recherche: "${searchTerm}" dans ${category}`,
                    description: results.slice(0, 5).join('\n'),
                    color: 0xF39C12,
                    footer: { text: `${results.length} résultat(s) trouvé(s)` }
                };
                
                return interaction.editReply({ embeds: [searchEmbed] });
                
            case 'clean':
                await logger.cleanOldLogs();
                return interaction.editReply('✅ Nettoyage des anciens logs terminé.');
                
            default:
                return interaction.editReply('❌ Action inconnue.');
        }
    }
};
