const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');

// Commande Add VIP
const addVipCommand = {
    data: new SlashCommandBuilder()
        .setName('addvip')
        .setDescription('Ajouter un VIP sur Twitch')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('username')
                .setDescription('Nom d\'utilisateur Twitch à promouvoir VIP')
                .setRequired(true)
        ),

    async execute(interaction) {
        const twitchBridge = interaction.client.moduleManager?.getModule('twitchBridge');
        if (!twitchBridge) {
            return interaction.reply({
                content: '❌ Module Twitch non disponible.',
                ephemeral: true
            });
        }

        const username = interaction.options.getString('username');
        
        try {
            await interaction.deferReply({ ephemeral: true });
            
            // Vérifier si l'utilisateur existe sur Twitch
            const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
                headers: {
                    'Client-ID': twitchBridge.config.twitchClientId,
                    'Authorization': `Bearer ${twitchBridge.config.twitchUserToken}`
                },
                params: {
                    login: username.toLowerCase()
                }
            });

            if (userResponse.data.data.length === 0) {
                return interaction.editReply('❌ Utilisateur Twitch introuvable.');
            }

            const twitchUserId = userResponse.data.data[0].id;
            const twitchUserLogin = userResponse.data.data[0].login;

            // Ajouter le VIP
            await axios.post(`https://api.twitch.tv/helix/channels/vips`, {
                user_id: twitchUserId
            }, {
                headers: {
                    'Client-ID': twitchBridge.config.twitchClientId,
                    'Authorization': `Bearer ${twitchBridge.config.twitchUserToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    broadcaster_id: await twitchBridge.getBroadcasterId()
                }
            });

            // Attribution du rôle Discord VIP si configuré
            if (twitchBridge.config.vipRoleId) {
                try {
                    const vipRole = interaction.guild.roles.cache.get(twitchBridge.config.vipRoleId);
                    if (vipRole) {
                        // Chercher l'utilisateur Discord correspondant (optionnel)
                        const discordMember = interaction.guild.members.cache.find(m => 
                            m.displayName.toLowerCase().includes(username.toLowerCase())
                        );
                        
                        if (discordMember) {
                            await discordMember.roles.add(vipRole);
                        }
                    }
                } catch (roleError) {
                    console.warn('⚠️ Impossible d\'attribuer le rôle Discord VIP:', roleError);
                }
            }

            await interaction.editReply({
                content: `✅ **${twitchUserLogin}** a été promu VIP sur Twitch !`
            });

            // Log l'action
            console.log(`👑 VIP ajouté: ${twitchUserLogin} par ${interaction.user.tag}`);

        } catch (error) {
            console.error('❌ Erreur ajout VIP:', error);
            
            let errorMessage = '❌ Erreur lors de la promotion VIP.';
            
            if (error.response?.status === 422) {
                errorMessage = '❌ Cet utilisateur est déjà VIP ou ne peut pas être promu.';
            } else if (error.response?.status === 401) {
                errorMessage = '❌ Token Twitch invalide ou insuffisant.';
            }

            await interaction.editReply({ content: errorMessage });
        }
    }
};

// Commande Remove VIP
const removeVipCommand = {
    data: new SlashCommandBuilder()
        .setName('removevip')
        .setDescription('Retirer un VIP sur Twitch')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('username')
                .setDescription('Nom d\'utilisateur Twitch à rétrograder')
                .setRequired(true)
        ),

    async execute(interaction) {
        const twitchBridge = interaction.client.moduleManager?.getModule('twitchBridge');
        if (!twitchBridge) {
            return interaction.reply({
                content: '❌ Module Twitch non disponible.',
                ephemeral: true
            });
        }

        const username = interaction.options.getString('username');
        
        try {
            await interaction.deferReply({ ephemeral: true });
            
            // Récupérer l'ID utilisateur Twitch
            const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
                headers: {
                    'Client-ID': twitchBridge.config.twitchClientId,
                    'Authorization': `Bearer ${twitchBridge.config.twitchUserToken}`
                },
                params: {
                    login: username.toLowerCase()
                }
            });

            if (userResponse.data.data.length === 0) {
                return interaction.editReply('❌ Utilisateur Twitch introuvable.');
            }

            const twitchUserId = userResponse.data.data[0].id;
            const twitchUserLogin = userResponse.data.data[0].login;

            // Retirer le VIP
            await axios.delete(`https://api.twitch.tv/helix/channels/vips`, {
                headers: {
                    'Client-ID': twitchBridge.config.twitchClientId,
                    'Authorization': `Bearer ${twitchBridge.config.twitchUserToken}`
                },
                params: {
                    broadcaster_id: await twitchBridge.getBroadcasterId(),
                    user_id: twitchUserId
                }
            });

            await interaction.editReply({
                content: `✅ **${twitchUserLogin}** n'est plus VIP sur Twitch.`
            });

            console.log(`👑 VIP retiré: ${twitchUserLogin} par ${interaction.user.tag}`);

        } catch (error) {
            console.error('❌ Erreur suppression VIP:', error);
            
            let errorMessage = '❌ Erreur lors de la suppression VIP.';
            
            if (error.response?.status === 422) {
                errorMessage = '❌ Cet utilisateur n\'est pas VIP ou ne peut pas être rétrogradé.';
            }

            await interaction.editReply({ content: errorMessage });
        }
    }
};

// Commande Add Moderator
const addModoCommand = {
    data: new SlashCommandBuilder()
        .setName('addmodo')
        .setDescription('Ajouter un modérateur sur Twitch')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('username')
                .setDescription('Nom d\'utilisateur Twitch à promouvoir modérateur')
                .setRequired(true)
        ),

    async execute(interaction) {
        const twitchBridge = interaction.client.moduleManager?.getModule('twitchBridge');
        if (!twitchBridge) {
            return interaction.reply({
                content: '❌ Module Twitch non disponible.',
                ephemeral: true
            });
        }

        const username = interaction.options.getString('username');
        
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
                headers: {
                    'Client-ID': twitchBridge.config.twitchClientId,
                    'Authorization': `Bearer ${twitchBridge.config.twitchUserToken}`
                },
                params: {
                    login: username.toLowerCase()
                }
            });

            if (userResponse.data.data.length === 0) {
                return interaction.editReply('❌ Utilisateur Twitch introuvable.');
            }

            const twitchUserId = userResponse.data.data[0].id;
            const twitchUserLogin = userResponse.data.data[0].login;

            // Ajouter le modérateur
            await axios.post(`https://api.twitch.tv/helix/moderation/moderators`, {
                user_id: twitchUserId
            }, {
                headers: {
                    'Client-ID': twitchBridge.config.twitchClientId,
                    'Authorization': `Bearer ${twitchBridge.config.twitchUserToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    broadcaster_id: await twitchBridge.getBroadcasterId()
                }
            });

            await interaction.editReply({
                content: `✅ **${twitchUserLogin}** a été promu modérateur sur Twitch !`
            });

            console.log(`🛡️ Modérateur ajouté: ${twitchUserLogin} par ${interaction.user.tag}`);

        } catch (error) {
            console.error('❌ Erreur ajout modérateur:', error);
            
            let errorMessage = '❌ Erreur lors de la promotion modérateur.';
            
            if (error.response?.status === 422) {
                errorMessage = '❌ Cet utilisateur est déjà modérateur ou ne peut pas être promu.';
            }

            await interaction.editReply({ content: errorMessage });
        }
    }
};

// Commande Remove Moderator
const removeModoCommand = {
    data: new SlashCommandBuilder()
        .setName('removemodo')
        .setDescription('Retirer un modérateur sur Twitch')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option
                .setName('username')
                .setDescription('Nom d\'utilisateur Twitch à rétrograder')
                .setRequired(true)
        ),

    async execute(interaction) {
        const twitchBridge = interaction.client.moduleManager?.getModule('twitchBridge');
        if (!twitchBridge) {
            return interaction.reply({
                content: '❌ Module Twitch non disponible.',
                ephemeral: true
            });
        }

        const username = interaction.options.getString('username');
        
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
                headers: {
                    'Client-ID': twitchBridge.config.twitchClientId,
                    'Authorization': `Bearer ${twitchBridge.config.twitchUserToken}`
                },
                params: {
                    login: username.toLowerCase()
                }
            });

            if (userResponse.data.data.length === 0) {
                return interaction.editReply('❌ Utilisateur Twitch introuvable.');
            }

            const twitchUserId = userResponse.data.data[0].id;
            const twitchUserLogin = userResponse.data.data[0].login;

            // Retirer le modérateur
            await axios.delete(`https://api.twitch.tv/helix/moderation/moderators`, {
                headers: {
                    'Client-ID': twitchBridge.config.twitchClientId,
                    'Authorization': `Bearer ${twitchBridge.config.twitchUserToken}`
                },
                params: {
                    broadcaster_id: await twitchBridge.getBroadcasterId(),
                    user_id: twitchUserId
                }
            });

            await interaction.editReply({
                content: `✅ **${twitchUserLogin}** n'est plus modérateur sur Twitch.`
            });

            console.log(`🛡️ Modérateur retiré: ${twitchUserLogin} par ${interaction.user.tag}`);

        } catch (error) {
            console.error('❌ Erreur suppression modérateur:', error);
            
            let errorMessage = '❌ Erreur lors de la suppression modérateur.';
            
            if (error.response?.status === 422) {
                errorMessage = '❌ Cet utilisateur n\'est pas modérateur ou ne peut pas être rétrogradé.';
            }

            await interaction.editReply({ content: errorMessage });
        }
    }
};

module.exports = [addVipCommand, removeVipCommand, addModoCommand, removeModoCommand];
