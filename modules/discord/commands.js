const { Collection, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const helpers = require('../utils/helpers');
const twitchAPI = require('../twitch/api');
const twitchSync = require('../twitch/sync');
const twitchNotifications = require('../twitch/notifications');

class CommandHandler {
    constructor() {
        this.commands = new Collection();
        this.client = null;
    }
    
    init(client) {
        this.client = client;
        client.commands = this.commands;
        
        // Chargement des commandes
        this.loadCommands();
        
        logger.success('📝 Gestionnaire de commandes initialisé');
    }
    
    loadCommands() {
        // Commande: addvip
        this.commands.set('addvip', {
            data: new SlashCommandBuilder()
                .setName('addvip')
                .setDescription('Ajouter un VIP sur Twitch')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Nom d\'utilisateur Twitch')
                        .setRequired(true))
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
            async execute(interaction) {
                const username = interaction.options.getString('username');
                
                await interaction.deferReply();
                
                try {
                    await twitchAPI.addVIP(username);
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('✅ VIP Ajouté')
                        .setDescription(`**${username}** a été ajouté comme VIP sur Twitch`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    
                    // Force la synchronisation
                    setTimeout(() => twitchSync.forceSync(), 2000);
                    
                } catch (error) {
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ Erreur')
                        .setDescription(`Impossible d'ajouter **${username}** comme VIP:\n${error.message}`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                }
            }
        });
        
        // Commande: removevip
        this.commands.set('removevip', {
            data: new SlashCommandBuilder()
                .setName('removevip')
                .setDescription('Retirer un VIP sur Twitch')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Nom d\'utilisateur Twitch')
                        .setRequired(true))
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
            async execute(interaction) {
                const username = interaction.options.getString('username');
                
                await interaction.deferReply();
                
                try {
                    await twitchAPI.removeVIP(username);
                    
                    const embed = new EmbedBuilder()
                        .setColor(0xffa500)
                        .setTitle('🗑️ VIP Retiré')
                        .setDescription(`**${username}** a été retiré des VIP sur Twitch`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    
                    // Force la synchronisation
                    setTimeout(() => twitchSync.forceSync(), 2000);
                    
                } catch (error) {
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ Erreur')
                        .setDescription(`Impossible de retirer **${username}** des VIP:\n${error.message}`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                }
            }
        });
        
        // Commande: addmod
        this.commands.set('addmod', {
            data: new SlashCommandBuilder()
                .setName('addmod')
                .setDescription('Ajouter un modérateur sur Twitch')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Nom d\'utilisateur Twitch')
                        .setRequired(true))
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
            async execute(interaction) {
                const username = interaction.options.getString('username');
                
                await interaction.deferReply();
                
                try {
                    await twitchAPI.addModerator(username);
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('✅ Modérateur Ajouté')
                        .setDescription(`**${username}** a été ajouté comme modérateur sur Twitch`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    
                    // Force la synchronisation
                    setTimeout(() => twitchSync.forceSync(), 2000);
                    
                } catch (error) {
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ Erreur')
                        .setDescription(`Impossible d'ajouter **${username}** comme modérateur:\n${error.message}`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                }
            }
        });
        
        // Commande: removemod
        this.commands.set('removemod', {
            data: new SlashCommandBuilder()
                .setName('removemod')
                .setDescription('Retirer un modérateur sur Twitch')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Nom d\'utilisateur Twitch')
                        .setRequired(true))
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
            async execute(interaction) {
                const username = interaction.options.getString('username');
                
                await interaction.deferReply();
                
                try {
                    await twitchAPI.removeModerator(username);
                    
                    const embed = new EmbedBuilder()
                        .setColor(0xffa500)
                        .setTitle('🗑️ Modérateur Retiré')
                        .setDescription(`**${username}** a été retiré des modérateurs sur Twitch`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    
                    // Force la synchronisation
                    setTimeout(() => twitchSync.forceSync(), 2000);
                    
                } catch (error) {
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ Erreur')
                        .setDescription(`Impossible de retirer **${username}** des modérateurs:\n${error.message}`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                }
            }
        });
        
        // Commande: ban
        this.commands.set('ban', {
            data: new SlashCommandBuilder()
                .setName('ban')
                .setDescription('Bannir un utilisateur sur Twitch')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Nom d\'utilisateur Twitch')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Raison du ban')
                        .setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
            async execute(interaction) {
                const username = interaction.options.getString('username');
                const reason = interaction.options.getString('reason') || 'Comportement inapproprié';
                
                await interaction.deferReply();
                
                try {
                    await twitchAPI.banUser(username, reason);
                    
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('🔨 Utilisateur Banni')
                        .setDescription(`**${username}** a été banni sur Twitch`)
                        .addFields([
                            {
                                name: 'Raison',
                                value: reason
                            }
                        ])
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    
                } catch (error) {
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ Erreur')
                        .setDescription(`Impossible de bannir **${username}**:\n${error.message}`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                }
            }
        });
        
        // Commande: timeout
        this.commands.set('timeout', {
            data: new SlashCommandBuilder()
                .setName('timeout')
                .setDescription('Timeout un utilisateur sur Twitch')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Nom d\'utilisateur Twitch')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('duration')
                        .setDescription('Durée en secondes (défaut: 600 = 10min)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Raison du timeout')
                        .setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
            async execute(interaction) {
                const username = interaction.options.getString('username');
                const duration = interaction.options.getInteger('duration') || 600;
                const reason = interaction.options.getString('reason') || 'Comportement inapproprié';
                
                await interaction.deferReply();
                
                try {
                    await twitchAPI.banUser(username, reason, duration);
                    
                    const embed = new EmbedBuilder()
                        .setColor(0xffa500)
                        .setTitle('⏰ Utilisateur en Timeout')
                        .setDescription(`**${username}** a été mis en timeout sur Twitch`)
                        .addFields([
                            {
                                name: 'Durée',
                                value: helpers.formatUptime(duration),
                                inline: true
                            },
                            {
                                name: 'Raison',
                                value: reason
                            }
                        ])
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    
                } catch (error) {
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ Erreur')
                        .setDescription(`Impossible de timeout **${username}**:\n${error.message}`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                }
            }
        });
        
        // Commande: unban
        this.commands.set('unban', {
            data: new SlashCommandBuilder()
                .setName('unban')
                .setDescription('Débannir un utilisateur sur Twitch')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Nom d\'utilisateur Twitch')
                        .setRequired(true))
                .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
            async execute(interaction) {
                const username = interaction.options.getString('username');
                
                await interaction.deferReply();
                
                try {
                    await twitchAPI.unbanUser(username);
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('✅ Utilisateur Débanni')
                        .setDescription(`**${username}** a été débanni sur Twitch`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    
                } catch (error) {
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ Erreur')
                        .setDescription(`Impossible de débannir **${username}**:\n${error.message}`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                }
            }
        });
        
        // Commande: listvips
        this.commands.set('listvips', {
            data: new SlashCommandBuilder()
                .setName('listvips')
                .setDescription('Afficher la liste des VIP Twitch'),
            async execute(interaction) {
                await interaction.deferReply();
                
                const vips = twitchSync.getVIPs();
                
                const embed = new EmbedBuilder()
                    .setColor(0x9146ff)
                    .setTitle('👑 Liste des VIP Twitch')
                    .setDescription(vips.length > 0 ? vips.map(vip => `• ${vip}`).join('\n') : 'Aucun VIP trouvé')
                    .addFields([
                        {
                            name: 'Total',
                            value: `${vips.length} VIP(s)`
                        }
                    ])
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
            }
        });
        
        // Commande: listmods
        this.commands.set('listmods', {
            data: new SlashCommandBuilder()
                .setName('listmods')
                .setDescription('Afficher la liste des modérateurs Twitch'),
            async execute(interaction) {
                await interaction.deferReply();
                
                const mods = twitchSync.getModerators();
                
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('🛡️ Liste des Modérateurs Twitch')
                    .setDescription(mods.length > 0 ? mods.map(mod => `• ${mod}`).join('\n') : 'Aucun modérateur trouvé')
                    .addFields([
                        {
                            name: 'Total',
                            value: `${mods.length} modérateur(s)`
                        }
                    ])
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
            }
        });
        
        // Commande: streaminfo
        this.commands.set('streaminfo', {
            data: new SlashCommandBuilder()
                .setName('streaminfo')
                .setDescription('Afficher les informations du stream Twitch'),
            async execute(interaction) {
                await interaction.deferReply();
                
                const streamInfo = twitchNotifications.getCurrentStreamInfo();
                
                if (!streamInfo) {
                    const embed = new EmbedBuilder()
                        .setColor(0x808080)
                        .setTitle('⚫ Stream Offline')
                        .setDescription('Le stream n\'est pas en cours actuellement')
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }
                
                const uptime = twitchNotifications.getUptime();
                
                const embed = new EmbedBuilder()
                    .setColor(0x9146ff)
                    .setTitle(`🔴 ${streamInfo.user_name} - En Live !`)
                    .setDescription(streamInfo.title || 'Aucun titre')
                    .addFields([
                        {
                            name: '🎮 Jeu',
                            value: streamInfo.game_name || 'Non défini',
                            inline: true
                        },
                        {
                            name: '👥 Spectateurs',
                            value: helpers.formatNumber(streamInfo.viewer_count),
                            inline: true
                        },
                        {
                            name: '⏱️ Durée',
                            value: uptime ? helpers.formatUptime(uptime) : 'N/A',
                            inline: true
                        }
                    ])
                    .setThumbnail(streamInfo.thumbnail_url?.replace('{width}', '320').replace('{height}', '180'))
                    .setURL(`https://twitch.tv/${streamInfo.user_login}`)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
            }
        });
        
        // Commande: search
        this.commands.set('search', {
            data: new SlashCommandBuilder()
                .setName('search')
                .setDescription('Rechercher un utilisateur Twitch')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Nom d\'utilisateur Twitch')
                        .setRequired(true)),
            async execute(interaction) {
                const username = interaction.options.getString('username');
                
                await interaction.deferReply();
                
                try {
                    const user = await twitchAPI.searchUser(username);
                    
                    if (!user) {
                        const embed = new EmbedBuilder()
                            .setColor(0xff0000)
                            .setTitle('❌ Utilisateur non trouvé')
                            .setDescription(`L'utilisateur **${username}** n'existe pas sur Twitch`)
                            .setTimestamp();
                        
                        await interaction.editReply({ embeds: [embed] });
                        return;
                    }
                    
                    const isVIP = twitchSync.isVIP(user.login);
                    const isMod = twitchSync.isModerator(user.login);
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x9146ff)
                        .setTitle(`👤 ${user.display_name}`)
                        .setDescription(user.description || 'Aucune description')
                        .addFields([
                            {
                                name: 'Nom d\'utilisateur',
                                value: user.login,
                                inline: true
                            },
                            {
                                name: 'Type',
                                value: user.broadcaster_type || 'Utilisateur',
                                inline: true
                            },
                            {
                                name: 'Statut',
                                value: `${isVIP ? '👑 VIP' : ''}${isMod ? '🛡️ Modérateur' : ''}${!isVIP && !isMod ? 'Utilisateur normal' : ''}`,
                                inline: true
                            },
                            {
                                name: 'Vues totales',
                                value: helpers.formatNumber(user.view_count),
                                inline: true
                            }
                        ])
                        .setThumbnail(user.profile_image_url)
                        .setURL(`https://twitch.tv/${user.login}`)
                        .setTimestamp(new Date(user.created_at));
                    
                    await interaction.editReply({ embeds: [embed] });
                    
                } catch (error) {
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ Erreur')
                        .setDescription(`Erreur lors de la recherche:\n${error.message}`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                }
            }
        });
        
        // Commande: systemcheck (vérification système)
        this.commands.set('systemcheck', {
            data: new SlashCommandBuilder()
                .setName('systemcheck')
                .setDescription('Vérifier l\'état de tous les systèmes du bot')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
            async execute(interaction) {
                await interaction.deferReply();
                
                try {
                    const systemChecker = require('../utils/systemChecker');
                    await systemChecker.performManualCheck();
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('✅ Vérification système')
                        .setDescription('Vérification système terminée ! Consultez le canal de logs pour le rapport détaillé.')
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    
                } catch (error) {
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ Erreur')
                        .setDescription(`Erreur lors de la vérification système:\n${error.message}`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                }
            }
        });
        
        logger.success(`📝 ${this.commands.size} commandes chargées`);
    }
}

module.exports = new CommandHandler();