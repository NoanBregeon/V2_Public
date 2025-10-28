const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Tester le système et les commandes')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('commands')
                .setDescription('Tester toutes les commandes disponibles')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('modules')
                .setDescription('Tester le chargement des modules')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('permissions')
                .setDescription('Tester le système de permissions')
                .addUserOption(option =>
                    option
                        .setName('utilisateur')
                        .setDescription('Utilisateur à tester (optionnel)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('voice')
                .setDescription('Tester spécifiquement le système vocal')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('twitch')
                .setDescription('Tester spécifiquement le système Twitch')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'commands':
                return this.testCommands(interaction);
            case 'modules':
                return this.testModules(interaction);
            case 'permissions':
                return this.testPermissions(interaction);
            case 'voice':
                return this.testVoiceSystem(interaction);
            case 'twitch':
                return this.testTwitchSystem(interaction);
            default:
                return interaction.reply({
                    content: '❌ Sous-commande de test inconnue.',
                    ephemeral: true
                });
        }
    },

    async testCommands(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const commandHandler = interaction.client.moduleManager?.getModule('commandHandler');
        if (!commandHandler) {
            return interaction.editReply('❌ CommandHandler non disponible');
        }

        const results = [];
        const commands = commandHandler.commands;
        
        results.push(`📋 **Test des commandes (${commands.size} trouvées)**\n`);
        
        for (const [name, command] of commands) {
            let status = '✅';
            let details = 'OK';
            
            try {
                if (!command.data) {
                    status = '❌';
                    details = 'Pas de data';
                } else if (!command.execute) {
                    status = '❌';
                    details = 'Pas de fonction execute';
                } else if (typeof command.execute !== 'function') {
                    status = '❌';
                    details = 'execute n\'est pas une fonction';
                } else {
                    details = 'Structure valide';
                }
            } catch (error) {
                status = '❌';
                details = `Erreur: ${error.message}`;
            }
            
            results.push(`${status} \`/${name}\` - ${details}`);
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🧪 Test des Commandes')
            .setDescription(results.join('\n'))
            .setColor(results.some(r => r.includes('❌')) ? 0xE74C3C : 0x00FF00)
            .setTimestamp();
            
        return interaction.editReply({ embeds: [embed] });
    },

    async testModules(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const moduleManager = interaction.client.moduleManager;
        if (!moduleManager) {
            return interaction.editReply('❌ ModuleManager non disponible');
        }

        const results = [];
        const expectedModules = ['commandHandler', 'voiceManager', 'moderationManager', 'welcomeManager', 'twitchBridge', 'interactionHandler'];
        
        results.push(`🔧 **Test des modules (${moduleManager.modules.size} chargés)**\n`);
        
        for (const moduleName of expectedModules) {
            const module = moduleManager.getModule(moduleName);
            let status = '✅';
            let details = 'Chargé et fonctionnel';
            
            if (!module) {
                status = '❌';
                details = 'Module non chargé';
            } else {
                try {
                    if (typeof module.initialize !== 'function') {
                        status = '⚠️';
                        details = 'Pas de méthode initialize';
                    }
                } catch (error) {
                    status = '❌';
                    details = `Erreur: ${error.message}`;
                }
            }
            
            results.push(`${status} **${moduleName}** - ${details}`);
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🔧 Test des Modules')
            .setDescription(results.join('\n'))
            .setColor(results.some(r => r.includes('❌')) ? 0xE74C3C : 0x00FF00)
            .setTimestamp();
            
        return interaction.editReply({ embeds: [embed] });
    },

    async testPermissions(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const commandHandler = interaction.client.moduleManager?.getModule('commandHandler');
        if (!commandHandler?.permissionManager) {
            return interaction.editReply('❌ PermissionManager non disponible');
        }

        const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        const permManager = commandHandler.permissionManager;
        
        const results = [];
        results.push(`🔐 **Test des permissions pour ${targetUser.tag}**\n`);
        
        const tests = [
            { name: 'Administrateur', test: () => permManager.isAdmin(targetMember) },
            { name: 'Modérateur', test: () => permManager.isModerator(targetMember) },
            { name: 'Commandes Twitch de base', test: () => permManager.canUseTwitchCommand(targetMember) },
            { name: 'Commandes Twitch admin (VIP/Mod)', test: () => permManager.canUseTwitchAdminCommand(targetMember, 'twitch-vip') }
        ];
        
        for (const { name, test } of tests) {
            try {
                const result = test();
                const status = result ? '✅' : '❌';
                results.push(`${status} **${name}**: ${result ? 'Autorisé' : 'Refusé'}`);
            } catch (error) {
                results.push(`❌ **${name}**: Erreur - ${error.message}`);
            }
        }
        
        const roles = targetMember.roles.cache
            .filter(role => role.name !== '@everyone')
            .map(role => role.name)
            .join(', ') || 'Aucun rôle';
            
        results.push(`\n**Rôles actuels:** ${roles}`);
        
        const embed = new EmbedBuilder()
            .setTitle('🔐 Test des Permissions')
            .setDescription(results.join('\n'))
            .setColor(0x3498DB)
            .setTimestamp();
            
        return interaction.editReply({ embeds: [embed] });
    },

    async testVoiceSystem(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const voiceManager = interaction.client.moduleManager?.getModule('voiceManager');
        if (!voiceManager) {
            return interaction.editReply('❌ VoiceManager non disponible');
        }

        const results = [];
        results.push(`🎤 **Test du système vocal**\n`);
        
        const config = voiceManager.config;
        const configTests = [
            { name: 'Canal de création', value: config.createVoiceChannelId },
            { name: 'Catégorie vocale', value: config.voiceCategoryId },
            { name: 'Canal d\'instructions', value: config.voiceInstructionsChannelId },
            { name: 'Canal de logs vocaux', value: config.voiceLogsChannelId }
        ];
        
        for (const { name, value } of configTests) {
            if (value) {
                try {
                    const channel = await interaction.client.channels.fetch(value);
                    results.push(`✅ **${name}**: ${channel.name} (${channel.id})`);
                } catch (error) {
                    results.push(`❌ **${name}**: Canal introuvable (${value})`);
                }
            } else {
                results.push(`⚠️ **${name}**: Non configuré`);
            }
        }
        
        results.push(`\n📊 **Statistiques:**`);
        results.push(`• Salons temporaires actifs: ${voiceManager.tempChannels.size}`);
        results.push(`• Paramètres de salons: ${voiceManager.channelSettings.size}`);
        
        if (voiceManager.tempChannels.size > 0) {
            results.push(`\n🔊 **Salons actifs:**`);
            for (const [channelId, creatorId] of voiceManager.tempChannels) {
                try {
                    const channel = await interaction.client.channels.fetch(channelId);
                    const creator = await interaction.client.users.fetch(creatorId);
                    results.push(`• ${channel.name} (Propriétaire: ${creator.tag})`);
                } catch (error) {
                    results.push(`• Canal ${channelId} (Erreur de récupération)`);
                }
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🎤 Test du Système Vocal')
            .setDescription(results.join('\n'))
            .setColor(results.some(r => r.includes('❌')) ? 0xF39C12 : 0x00FF00)
            .setTimestamp();
            
        return interaction.editReply({ embeds: [embed] });
    },

    async testTwitchSystem(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const twitchBridge = interaction.client.moduleManager?.getModule('twitchBridge');
        if (!twitchBridge) {
            return interaction.editReply('❌ TwitchBridge non disponible');
        }

        const results = [];
        results.push(`🎮 **Test du système Twitch**\n`);
        
        const config = twitchBridge.config;
        const configTests = [
            { name: 'Client ID Twitch', value: config.twitchClientId, required: true },
            { name: 'Token utilisateur Twitch', value: config.twitchUserToken, required: true },
            { name: 'Username streamer', value: config.streamerUsername, required: true },
            { name: 'Canal notifications live', value: config.liveNotificationsChannelId, required: true },
            { name: 'Canal chat relay', value: config.twitchRelayChannelId, required: false },
            { name: 'Bot Twitch username', value: config.twitchBotUsername, required: false },
            { name: 'Bot Twitch token', value: config.twitchBotToken, required: false }
        ];
        
        for (const { name, value, required } of configTests) {
            if (value) {
                if (name.includes('Canal')) {
                    try {
                        const channel = await interaction.client.channels.fetch(value);
                        results.push(`✅ **${name}**: ${channel.name}`);
                    } catch (error) {
                        results.push(`❌ **${name}**: Canal introuvable`);
                    }
                } else {
                    const masked = value.substring(0, 8) + '***';
                    results.push(`✅ **${name}**: ${masked}`);
                }
            } else {
                const status = required ? '❌' : '⚠️';
                const suffix = required ? ' (REQUIS)' : ' (Optionnel)';
                results.push(`${status} **${name}**: Non configuré${suffix}`);
            }
        }
        
        if (twitchBridge.checkLiveStatus) {
            results.push(`\n🔍 **Test API Twitch:**`);
            try {
                await twitchBridge.checkLiveStatus();
                results.push(`✅ API Twitch fonctionnelle`);
                results.push(`📊 Statut actuel: ${twitchBridge.isLive ? 'EN LIVE' : 'Hors ligne'}`);
            } catch (error) {
                results.push(`❌ Erreur API Twitch: ${error.message}`);
            }
        }
        
        try {
            const guild = interaction.guild;
            const notifRole = guild.roles.cache.find(r => r.name === 'Live Notifications');
            if (notifRole) {
                results.push(`✅ **Rôle notifications**: ${notifRole.name} (${notifRole.members.size} membres)`);
            } else {
                results.push(`⚠️ **Rôle notifications**: Sera créé automatiquement`);
            }
        } catch (error) {
            results.push(`❌ **Rôle notifications**: Erreur de vérification`);
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🎮 Test du Système Twitch')
            .setDescription(results.join('\n'))
            .setColor(results.some(r => r.includes('❌')) ? 0xE74C3C : 0x00FF00)
            .setTimestamp();
            
        return interaction.editReply({ embeds: [embed] });
    }
};
