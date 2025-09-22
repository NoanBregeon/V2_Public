const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class ModerationManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.twitchAPI = null; // À initialiser avec l'API Twitch
    }

    async initialize() {
        console.log('🛡️ Initialisation du ModerationManager...');
        // Initialiser l'API Twitch si nécessaire
        console.log('✅ ModerationManager initialisé');
    }

    // Gestion des commandes Discord
    async handleDiscordCommand(interaction, command) {
        switch (command) {
            case 'addmodo':
                await this.addModerator(interaction);
                break;
            case 'removemodo':
                await this.removeModerator(interaction);
                break;
            case 'addvip':
                await this.addVIP(interaction);
                break;
            case 'removevip':
                await this.removeVIP(interaction);
                break;
            case 'listmods':
                await this.listModerators(interaction);
                break;
            case 'listvips':
                await this.listVIPs(interaction);
                break;
        }
    }

    // Nouvelle méthode pour gérer les commandes de modération Discord
    async handleDiscordModerationCommand(interaction, command) {
        switch (command) {
            case 'mute':
                await this.muteUser(interaction);
                break;
            case 'unmute':
                await this.unmuteUser(interaction);
                break;
            case 'kick':
                await this.kickUser(interaction);
                break;
            case 'discordban':
                await this.banDiscordUser(interaction);
                break;
            case 'unban':
                await this.unbanDiscordUser(interaction);
                break;
            case 'warn':
                await this.warnUser(interaction);
                break;
            case 'userinfo':
                await this.showUserInfo(interaction);
                break;
            case 'listbans':
                await this.listBans(interaction);
                break;
        }
    }

    async addModerator(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const member = await interaction.guild.members.fetch(user.id);
        
        const moderatorRole = interaction.guild.roles.cache.find(role => 
            role.name.toLowerCase().includes('modérateur') || 
            role.name.toLowerCase().includes('moderateur') ||
            role.name.toLowerCase().includes('mod')
        );

        if (!moderatorRole) {
            return await interaction.reply({
                content: '❌ Aucun rôle modérateur trouvé. Créez un rôle contenant "modérateur" dans son nom.',
                ephemeral: true
            });
        }

        try {
            await member.roles.add(moderatorRole);
            
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Modérateur ajouté')
                .setDescription(`${user} a été promu modérateur`)
                .addFields(
                    { name: 'Utilisateur', value: user.tag, inline: true },
                    { name: 'Rôle', value: moderatorRole.name, inline: true },
                    { name: 'Par', value: interaction.user.tag, inline: true }
                )
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            console.log(`🛡️ ${user.tag} promu modérateur par ${interaction.user.tag}`);
        } catch (error) {
            console.error('Erreur ajout modérateur:', error);
            await interaction.reply({
                content: '❌ Erreur lors de l\'ajout du rôle modérateur',
                ephemeral: true
            });
        }
    }

    async removeModerator(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const member = await interaction.guild.members.fetch(user.id);
        
        const moderatorRole = interaction.guild.roles.cache.find(role => 
            role.name.toLowerCase().includes('modérateur') || 
            role.name.toLowerCase().includes('moderateur') ||
            role.name.toLowerCase().includes('mod')
        );

        if (!moderatorRole) {
            return await interaction.reply({
                content: '❌ Aucun rôle modérateur trouvé.',
                ephemeral: true
            });
        }

        try {
            await member.roles.remove(moderatorRole);
            
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Modérateur retiré')
                .setDescription(`${user} n'est plus modérateur`)
                .addFields(
                    { name: 'Utilisateur', value: user.tag, inline: true },
                    { name: 'Rôle retiré', value: moderatorRole.name, inline: true },
                    { name: 'Par', value: interaction.user.tag, inline: true }
                )
                .setColor(0xFF6600)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            console.log(`🛡️ ${user.tag} rétrogradé par ${interaction.user.tag}`);
        } catch (error) {
            console.error('Erreur retrait modérateur:', error);
            await interaction.reply({
                content: '❌ Erreur lors du retrait du rôle modérateur',
                ephemeral: true
            });
        }
    }

    async addVIP(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const member = await interaction.guild.members.fetch(user.id);
        
        const vipRole = interaction.guild.roles.cache.find(role => 
            role.name.toLowerCase().includes('vip')
        );

        if (!vipRole) {
            return await interaction.reply({
                content: '❌ Aucun rôle VIP trouvé. Créez un rôle contenant "VIP" dans son nom.',
                ephemeral: true
            });
        }

        try {
            await member.roles.add(vipRole);
            
            const embed = new EmbedBuilder()
                .setTitle('⭐ VIP ajouté')
                .setDescription(`${user} est maintenant VIP`)
                .addFields(
                    { name: 'Utilisateur', value: user.tag, inline: true },
                    { name: 'Rôle', value: vipRole.name, inline: true },
                    { name: 'Par', value: interaction.user.tag, inline: true }
                )
                .setColor(0xFFD700)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            console.log(`⭐ ${user.tag} promu VIP par ${interaction.user.tag}`);
        } catch (error) {
            console.error('Erreur ajout VIP:', error);
            await interaction.reply({
                content: '❌ Erreur lors de l\'ajout du rôle VIP',
                ephemeral: true
            });
        }
    }

    async removeVIP(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const member = await interaction.guild.members.fetch(user.id);
        
        const vipRole = interaction.guild.roles.cache.find(role => 
            role.name.toLowerCase().includes('vip')
        );

        if (!vipRole) {
            return await interaction.reply({
                content: '❌ Aucun rôle VIP trouvé.',
                ephemeral: true
            });
        }

        try {
            await member.roles.remove(vipRole);
            
            const embed = new EmbedBuilder()
                .setTitle('⭐ VIP retiré')
                .setDescription(`${user} n'est plus VIP`)
                .addFields(
                    { name: 'Utilisateur', value: user.tag, inline: true },
                    { name: 'Rôle retiré', value: vipRole.name, inline: true },
                    { name: 'Par', value: interaction.user.tag, inline: true }
                )
                .setColor(0xFF6600)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            console.log(`⭐ ${user.tag} VIP retiré par ${interaction.user.tag}`);
        } catch (error) {
            console.error('Erreur retrait VIP:', error);
            await interaction.reply({
                content: '❌ Erreur lors du retrait du rôle VIP',
                ephemeral: true
            });
        }
    }

    async listModerators(interaction) {
        const moderatorRole = interaction.guild.roles.cache.find(role => 
            role.name.toLowerCase().includes('modérateur') || 
            role.name.toLowerCase().includes('moderateur') ||
            role.name.toLowerCase().includes('mod')
        );

        if (!moderatorRole) {
            return await interaction.reply({
                content: '❌ Aucun rôle modérateur trouvé.',
                ephemeral: true
            });
        }

        const moderators = moderatorRole.members.map(member => member.user.tag).join('\n') || 'Aucun modérateur';

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Liste des modérateurs')
            .setDescription(moderators.length > 1024 ? moderators.substring(0, 1021) + '...' : moderators)
            .addFields({ name: 'Total', value: `${moderatorRole.members.size} modérateur(s)`, inline: true })
            .setColor(0x0099FF)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async listVIPs(interaction) {
        const vipRole = interaction.guild.roles.cache.find(role => 
            role.name.toLowerCase().includes('vip')
        );

        if (!vipRole) {
            return await interaction.reply({
                content: '❌ Aucun rôle VIP trouvé.',
                ephemeral: true
            });
        }

        const vips = vipRole.members.map(member => member.user.tag).join('\n') || 'Aucun VIP';

        const embed = new EmbedBuilder()
            .setTitle('⭐ Liste des VIPs')
            .setDescription(vips.length > 1024 ? vips.substring(0, 1021) + '...' : vips)
            .addFields({ name: 'Total', value: `${vipRole.members.size} VIP(s)`, inline: true })
            .setColor(0xFFD700)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async muteUser(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const duration = interaction.options.getInteger('duree'); // en minutes
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

        try {
            const member = await interaction.guild.members.fetch(user.id);
            const timeoutDuration = duration * 60 * 1000; // Convertir en millisecondes
            
            await member.timeout(timeoutDuration, reason);
            
            const embed = new EmbedBuilder()
                .setTitle('🔇 Utilisateur muté')
                .setDescription(`${user} a été mis en timeout`)
                .addFields(
                    { name: 'Utilisateur', value: user.tag, inline: true },
                    { name: 'Durée', value: `${duration} minute(s)`, inline: true },
                    { name: 'Raison', value: reason, inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true },
                    { name: 'Expire le', value: `<t:${Math.floor((Date.now() + timeoutDuration) / 1000)}:F>`, inline: false }
                )
                .setColor(0xFF6600)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            console.log(`🔇 ${user.tag} muté pour ${duration}min par ${interaction.user.tag}: ${reason}`);
        } catch (error) {
            console.error('Erreur mute utilisateur:', error);
            await interaction.reply({
                content: '❌ Erreur lors du mute de l\'utilisateur. Vérifiez que j\'ai les permissions et que l\'utilisateur n\'est pas un modérateur.',
                ephemeral: true
            });
        }
    }

    async unmuteUser(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

        try {
            const member = await interaction.guild.members.fetch(user.id);
            await member.timeout(null, reason);
            
            const embed = new EmbedBuilder()
                .setTitle('🔊 Utilisateur démuté')
                .setDescription(`${user} a été démuté`)
                .addFields(
                    { name: 'Utilisateur', value: user.tag, inline: true },
                    { name: 'Raison', value: reason, inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true }
                )
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            console.log(`🔊 ${user.tag} démuté par ${interaction.user.tag}: ${reason}`);
        } catch (error) {
            console.error('Erreur unmute utilisateur:', error);
            await interaction.reply({
                content: '❌ Erreur lors du démute de l\'utilisateur.',
                ephemeral: true
            });
        }
    }

    async kickUser(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

        try {
            const member = await interaction.guild.members.fetch(user.id);
            
            if (!member.kickable) {
                return await interaction.reply({
                    content: '❌ Impossible d\'expulser cet utilisateur (permissions insuffisantes).',
                    ephemeral: true
                });
            }

            await member.kick(reason);
            
            const embed = new EmbedBuilder()
                .setTitle('👢 Utilisateur expulsé')
                .setDescription(`${user} a été expulsé du serveur`)
                .addFields(
                    { name: 'Utilisateur', value: user.tag, inline: true },
                    { name: 'Raison', value: reason, inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true }
                )
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            console.log(`👢 ${user.tag} expulsé par ${interaction.user.tag}: ${reason}`);
        } catch (error) {
            console.error('Erreur kick utilisateur:', error);
            await interaction.reply({
                content: '❌ Erreur lors de l\'expulsion de l\'utilisateur.',
                ephemeral: true
            });
        }
    }

    async banDiscordUser(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
        const deleteMessages = interaction.options.getInteger('supprimer_messages') || 0;

        try {
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            
            if (member && !member.bannable) {
                return await interaction.reply({
                    content: '❌ Impossible de bannir cet utilisateur (permissions insuffisantes).',
                    ephemeral: true
                });
            }

            await interaction.guild.members.ban(user, {
                reason: reason,
                deleteMessageDays: deleteMessages
            });
            
            const embed = new EmbedBuilder()
                .setTitle('🔨 Utilisateur banni')
                .setDescription(`${user} a été banni du serveur`)
                .addFields(
                    { name: 'Utilisateur', value: user.tag, inline: true },
                    { name: 'Raison', value: reason, inline: true },
                    { name: 'Messages supprimés', value: `${deleteMessages} jour(s)`, inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true }
                )
                .setColor(0x000000)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            console.log(`🔨 ${user.tag} banni par ${interaction.user.tag}: ${reason}`);
        } catch (error) {
            console.error('Erreur ban utilisateur:', error);
            await interaction.reply({
                content: '❌ Erreur lors du bannissement de l\'utilisateur.',
                ephemeral: true
            });
        }
    }

    async unbanDiscordUser(interaction) {
        const userId = interaction.options.getString('userid');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

        try {
            const bannedUser = await interaction.guild.bans.fetch(userId).catch(() => null);
            
            if (!bannedUser) {
                return await interaction.reply({
                    content: '❌ Cet utilisateur n\'est pas banni ou l\'ID est incorrect.',
                    ephemeral: true
                });
            }

            await interaction.guild.members.unban(userId, reason);
            
            const embed = new EmbedBuilder()
                .setTitle('✅ Utilisateur débanni')
                .setDescription(`${bannedUser.user.tag} a été débanni du serveur`)
                .addFields(
                    { name: 'Utilisateur', value: bannedUser.user.tag, inline: true },
                    { name: 'Raison', value: reason, inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true }
                )
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            console.log(`✅ ${bannedUser.user.tag} débanni par ${interaction.user.tag}: ${reason}`);
        } catch (error) {
            console.error('Erreur unban utilisateur:', error);
            await interaction.reply({
                content: '❌ Erreur lors du débannissement. Vérifiez l\'ID utilisateur.',
                ephemeral: true
            });
        }
    }

    async warnUser(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const reason = interaction.options.getString('raison');

        try {
            // Envoyer un MP à l'utilisateur
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Avertissement')
                    .setDescription(`Vous avez reçu un avertissement sur **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Raison', value: reason, inline: false },
                        { name: 'Modérateur', value: interaction.user.tag, inline: true }
                    )
                    .setColor(0xFFAA00)
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`⚠️ Impossible d'envoyer un MP à ${user.tag}`);
            }

            const embed = new EmbedBuilder()
                .setTitle('⚠️ Avertissement donné')
                .setDescription(`${user} a été averti`)
                .addFields(
                    { name: 'Utilisateur', value: user.tag, inline: true },
                    { name: 'Raison', value: reason, inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true }
                )
                .setColor(0xFFAA00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            console.log(`⚠️ ${user.tag} averti par ${interaction.user.tag}: ${reason}`);
        } catch (error) {
            console.error('Erreur warn utilisateur:', error);
            await interaction.reply({
                content: '❌ Erreur lors de l\'avertissement.',
                ephemeral: true
            });
        }
    }

    async showUserInfo(interaction) {
        const user = interaction.options.getUser('utilisateur') || interaction.user;
        
        try {
            const member = await interaction.guild.members.fetch(user.id);
            
            const embed = new EmbedBuilder()
                .setTitle(`👤 Informations: ${member.displayName}`)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'Nom d\'utilisateur', value: user.tag, inline: true },
                    { name: 'ID', value: user.id, inline: true },
                    { name: 'Surnom', value: member.nickname || 'Aucun', inline: true },
                    { name: 'Compte créé', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
                    { name: 'A rejoint le serveur', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
                    { name: 'Statut', value: member.presence?.status || 'Hors ligne', inline: true },
                    { name: 'Rôle le plus élevé', value: member.roles.highest.name, inline: true },
                    { name: 'Nombre de rôles', value: `${member.roles.cache.size - 1}`, inline: true },
                    { name: 'Permissions', value: member.permissions.has('Administrator') ? 'Administrateur' : 'Standard', inline: true }
                )
                .setColor(member.displayHexColor || 0x3498DB)
                .setTimestamp();

            // Ajouter les rôles si pas trop nombreux
            const roles = member.roles.cache.filter(role => role.id !== interaction.guild.id).map(role => role.name).join(', ');
            if (roles.length < 1024) {
                embed.addFields({ name: 'Rôles', value: roles || 'Aucun rôle', inline: false });
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur userinfo:', error);
            await interaction.reply({
                content: '❌ Erreur lors de la récupération des informations utilisateur.',
                ephemeral: true
            });
        }
    }

    async listBans(interaction) {
        try {
            const bans = await interaction.guild.bans.fetch();
            
            if (bans.size === 0) {
                return await interaction.reply({
                    content: '✅ Aucun utilisateur banni sur ce serveur.',
                    ephemeral: true
                });
            }

            const banList = bans.map((ban, index) => {
                const reason = ban.reason || 'Aucune raison';
                return `**${index + 1}.** ${ban.user.tag} (${ban.user.id})\n📝 Raison: ${reason}`;
            }).slice(0, 10).join('\n\n'); // Limiter à 10 pour éviter les messages trop longs

            const embed = new EmbedBuilder()
                .setTitle(`🔨 Utilisateurs bannis (${bans.size})`)
                .setDescription(banList)
                .setColor(0x000000)
                .setTimestamp();

            if (bans.size > 10) {
                embed.setFooter({ text: `... et ${bans.size - 10} autres` });
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur listbans:', error);
            await interaction.reply({
                content: '❌ Erreur lors de la récupération de la liste des bannis.',
                ephemeral: true
            });
        }
    }

    // Commandes Twitch (placeholder - nécessite API Twitch)
    async addTwitchMod(interaction) {
        const username = interaction.options.getString('username');
        
        await interaction.reply({
            content: `📺 Fonction Twitch en développement - addmod pour ${username}`,
            ephemeral: true
        });
    }

    async removeTwitchMod(interaction) {
        const username = interaction.options.getString('username');
        
        await interaction.reply({
            content: `📺 Fonction Twitch en développement - removemod pour ${username}`,
            ephemeral: true
        });
    }

    async banTwitchUser(interaction) {
        const username = interaction.options.getString('username');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
        
        await interaction.reply({
            content: `📺 Fonction Twitch en développement - ban ${username} (${reason})`,
            ephemeral: true
        });
    }

    async timeoutTwitchUser(interaction) {
        const username = interaction.options.getString('username');
        const duration = interaction.options.getInteger('duree');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
        
        await interaction.reply({
            content: `📺 Fonction Twitch en développement - timeout ${username} ${duration}min (${reason})`,
            ephemeral: true
        });
    }

    async unbanTwitchUser(interaction) {
        const username = interaction.options.getString('username');
        
        await interaction.reply({
            content: `📺 Fonction Twitch en développement - unban pour ${username}`,
            ephemeral: true
        });
    }

    async searchTwitchUser(interaction) {
        const username = interaction.options.getString('username');
        
        await interaction.reply({
            content: `📺 Fonction Twitch en développement - recherche pour ${username}`,
            ephemeral: true
        });
    }
}

module.exports = ModerationManager;
        const duration = interaction.options.getInteger('duree');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
        
        await interaction.reply({
            content: `📺 Fonction Twitch en développement - timeout ${username} ${duration}min (${reason})`,
            ephemeral: true
        });
    }

    async unbanTwitchUser(interaction) {
        const username = interaction.options.getString('username');
        
        await interaction.reply({
            content: `📺 Fonction Twitch en développement - unban pour ${username}`,
            ephemeral: true
        });
    }

    async searchTwitchUser(interaction) {
        const username = interaction.options.getString('username');
        
        await interaction.reply({
            content: `📺 Fonction Twitch en développement - recherche pour ${username}`,
            ephemeral: true
        });
    }
}

module.exports = ModerationManager;
