/**
 * Gestionnaire des salons vocaux temporaires
 */

const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

class VoiceManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.tempChannels = new Map(); // channelId -> creatorId
        this.channelSettings = new Map(); // channelId -> settings
    }

    async initialize() {
        console.log('✅ VoiceManager initialisé');
    }

    async handleVoiceStateUpdate(oldState, newState) {
        // Création de salon temporaire
        if (newState.channelId === this.config.createVoiceChannelId) {
            await this.createTempVoiceChannel(newState.member);
        }

        // Suppression de salon temporaire vide
        if (oldState.channel && this.tempChannels.has(oldState.channelId)) {
            if (oldState.channel.members.size === 0) {
                await this.deleteTempVoiceChannel(oldState.channel);
            }
        }
    }

    async createTempVoiceChannel(member) {
        try {
            const guild = member.guild;
            const category = guild.channels.cache.get(this.config.voiceCategoryId);
            
            const channel = await guild.channels.create({
                name: `🎤 ${member.displayName}`,
                type: ChannelType.GuildVoice,
                parent: category,
                permissionOverwrites: [
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.MuteMembers,
                            PermissionFlagsBits.DeafenMembers
                        ]
                    }
                ]
            });

            // Déplacer le membre dans le nouveau salon
            await member.voice.setChannel(channel);
            
            // Enregistrer le salon temporaire
            this.tempChannels.set(channel.id, member.id);
            
            console.log(`🎤 Salon vocal temporaire créé: ${channel.name} pour ${member.displayName}`);
            
            // IMPORTANT: Envoyer le message d'instructions
            await this.sendVoiceInstructions(member, channel);
            
            // Log dans le canal approprié
            await this.logVoiceAction('create', member, channel);
            
        } catch (error) {
            console.error('❌ Erreur création salon vocal:', error);
        }
    }

    async sendVoiceInstructions(member, channel) {
        if (!this.config.voiceInstructionsChannelId) return;
        
        try {
            const instructionsChannel = await this.client.channels.fetch(this.config.voiceInstructionsChannelId);
            if (!instructionsChannel) return;
            
            const embed = new EmbedBuilder()
                .setTitle('🎤 Salon vocal temporaire créé')
                .setDescription(`Tu as créé un salon vocal temporaire. Tu en es le propriétaire et tu peux le gérer.`)
                .addFields(
                    { 
                        name: '👑 Propriétaire', 
                        value: `${member.toString()}`, 
                        inline: true 
                    },
                    { 
                        name: '🔊 Salon', 
                        value: `${channel.toString()}`, 
                        inline: true 
                    },
                    { 
                        name: '🔧 Commandes', 
                        value: `\`!rename <nom>\` - Renommer le salon
                        \`!limit <nombre>\` - Limiter le nombre d'utilisateurs
                        \`!lock\` - Verrouiller le salon
                        \`!unlock\` - Déverrouiller le salon
                        \`/voice transfer <utilisateur>\` - Transférer la propriété`, 
                        inline: false 
                    }
                )
                .setColor(0x3498DB)
                .setFooter({ text: 'Le salon sera supprimé quand il sera vide' })
                .setTimestamp();
            
            await instructionsChannel.send({ 
                content: `${member.toString()} 📋`, 
                embeds: [embed] 
            });
            
        } catch (error) {
            console.error('❌ Erreur envoi instructions vocales:', error);
        }
    }

    async deleteTempVoiceChannel(channel) {
        try {
            const creatorId = this.tempChannels.get(channel.id);
            
            await channel.delete('Salon vocal temporaire vide');
            this.tempChannels.delete(channel.id);
            this.channelSettings.delete(channel.id);
            
            console.log(`🗑️ Salon vocal temporaire supprimé: ${channel.name}`);
            
            // Log dans le canal approprié
            if (creatorId) {
                const creator = await channel.guild.members.fetch(creatorId).catch(() => null);
                await this.logVoiceAction('delete', creator, channel);
            }
            
        } catch (error) {
            console.error('❌ Erreur suppression salon vocal:', error);
        }
    }

    async logVoiceAction(action, member, channel) {
        if (!this.config.voiceLogsChannelId) return;
        
        try {
            const logChannel = await this.client.channels.fetch(this.config.voiceLogsChannelId);
            if (!logChannel) return;
            
            const actions = {
                create: '🎤 **Salon vocal créé**',
                delete: '🗑️ **Salon vocal supprimé**',
                rename: '✏️ **Salon vocal renommé**',
                limit: '👥 **Limite du salon modifiée**',
                lock: '🔒 **Salon vocal verrouillé**',
                unlock: '🔓 **Salon vocal déverrouillé**',
                transfer: '👑 **Propriété transférée**'
            };
            
            const message = `${actions[action] || action}
            **Salon:** ${channel.name}
            **Utilisateur:** ${member ? member.displayName : 'Inconnu'}
            **Heure:** <t:${Math.floor(Date.now() / 1000)}:F>`;
            
            await logChannel.send(message);
            
        } catch (error) {
            console.error('❌ Erreur log vocal:', error);
        }
    }

    // Méthodes pour les commandes de gestion des salons vocaux
    async handleVoiceCommand(interaction, subcommand) {
        const member = interaction.member;
        const voiceChannel = member.voice.channel;
        
        if (!voiceChannel || !this.tempChannels.has(voiceChannel.id)) {
            return interaction.reply({
                content: '❌ Vous devez être dans un salon vocal temporaire pour utiliser cette commande.',
                ephemeral: true
            });
        }
        
        const creatorId = this.tempChannels.get(voiceChannel.id);
        if (creatorId !== member.id) {
            return interaction.reply({
                content: '❌ Seul le propriétaire du salon peut utiliser cette commande.',
                ephemeral: true
            });
        }
        
        switch (subcommand) {
            case 'rename':
                return this.handleRename(interaction, voiceChannel);
            case 'limit':
                return this.handleLimit(interaction, voiceChannel);
            case 'lock':
                return this.handleLock(interaction, voiceChannel);
            case 'unlock':
                return this.handleUnlock(interaction, voiceChannel);
            case 'transfer':
                return this.handleTransfer(interaction, voiceChannel);
            default:
                return interaction.reply({ content: '❌ Sous-commande inconnue', ephemeral: true });
        }
    }

    async handleRename(interaction, channel) {
        const newName = interaction.options.getString('nom');
        
        if (!newName || newName.length > 32) {
            return interaction.reply({
                content: '❌ Le nom doit contenir entre 1 et 32 caractères.',
                ephemeral: true
            });
        }
        
        try {
            const oldName = channel.name;
            await channel.setName(newName);
            
            await this.logVoiceAction('rename', interaction.member, channel);
            
            return interaction.reply({
                content: `✅ Salon renommé de "${oldName}" vers "${newName}"`,
                ephemeral: true
            });
        } catch (error) {
            console.error('❌ Erreur renommage salon:', error);
            return interaction.reply({
                content: '❌ Erreur lors du renommage du salon.',
                ephemeral: true
            });
        }
    }

    async handleLimit(interaction, channel) {
        const limit = interaction.options.getInteger('nombre');
        
        if (limit < 0 || limit > 99) {
            return interaction.reply({
                content: '❌ La limite doit être entre 0 (illimité) et 99.',
                ephemeral: true
            });
        }
        
        try {
            await channel.setUserLimit(limit);
            
            await this.logVoiceAction('limit', interaction.member, channel);
            
            return interaction.reply({
                content: `✅ Limite du salon définie à ${limit === 0 ? 'illimitée' : limit + ' utilisateurs'}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('❌ Erreur limite salon:', error);
            return interaction.reply({
                content: '❌ Erreur lors de la modification de la limite.',
                ephemeral: true
            });
        }
    }

    async handleLock(interaction, channel) {
        try {
            await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                Connect: false
            });
            
            await this.logVoiceAction('lock', interaction.member, channel);
            
            return interaction.reply({
                content: '🔒 Salon verrouillé - Personne ne peut plus rejoindre',
                ephemeral: true
            });
        } catch (error) {
            console.error('❌ Erreur verrouillage salon:', error);
            return interaction.reply({
                content: '❌ Erreur lors du verrouillage du salon.',
                ephemeral: true
            });
        }
    }

    async handleUnlock(interaction, channel) {
        try {
            await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                Connect: null
            });
            
            await this.logVoiceAction('unlock', interaction.member, channel);
            
            return interaction.reply({
                content: '🔓 Salon déverrouillé - Tout le monde peut maintenant rejoindre',
                ephemeral: true
            });
        } catch (error) {
            console.error('❌ Erreur déverrouillage salon:', error);
            return interaction.reply({
                content: '❌ Erreur lors du déverrouillage du salon.',
                ephemeral: true
            });
        }
    }

    async handleTransfer(interaction, channel) {
        const newOwner = interaction.options.getUser('utilisateur');
        
        if (!newOwner) {
            return interaction.reply({
                content: '❌ Vous devez spécifier un utilisateur.',
                ephemeral: true
            });
        }
        
        if (newOwner.id === interaction.user.id) {
            return interaction.reply({
                content: '❌ Vous êtes déjà le propriétaire de ce salon.',
                ephemeral: true
            });
        }
        
        try {
            const newOwnerMember = await interaction.guild.members.fetch(newOwner.id);
            
            if (!newOwnerMember.voice.channel || newOwnerMember.voice.channelId !== channel.id) {
                return interaction.reply({
                    content: '❌ L\'utilisateur doit être dans le salon vocal pour en devenir propriétaire.',
                    ephemeral: true
                });
            }
            
            // Retirer les permissions de l'ancien propriétaire
            await channel.permissionOverwrites.edit(interaction.user.id, {
                ManageChannels: null,
                MoveMembers: null,
                MuteMembers: null,
                DeafenMembers: null
            });
            
            // Donner les permissions au nouveau propriétaire
            await channel.permissionOverwrites.edit(newOwner.id, {
                ManageChannels: true,
                MoveMembers: true,
                MuteMembers: true,
                DeafenMembers: true
            });
            
            // Mettre à jour le propriétaire
            this.tempChannels.set(channel.id, newOwner.id);
            
            await this.logVoiceAction('transfer', interaction.member, channel);
            
            return interaction.reply({
                content: `✅ Propriété du salon transférée à ${newOwner.toString()}`,
                ephemeral: false
            });
            
        } catch (error) {
            console.error('❌ Erreur transfert propriété:', error);
            return interaction.reply({
                content: '❌ Erreur lors du transfert de propriété.',
                ephemeral: true
            });
        }
    }
}

module.exports = VoiceManager;