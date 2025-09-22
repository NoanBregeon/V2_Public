const { ChannelType, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const templates = require('../utils/templates');

class VoiceManager {
    constructor() {
        this.client = null;
        this.tempChannels = new Map(); // channelId -> { ownerId, createdAt }
        this.createChannelId = process.env.CREATE_VOICE_CHANNEL_ID; // Canal "Créer un salon"
    }
    
    init(client) {
        this.client = client;
        
        if (!this.createChannelId) {
            logger.warn('ID du canal "Créer un salon" non configuré (CREATE_VOICE_CHANNEL_ID)');
            return;
        }
        
        logger.success(`🎤 Gestionnaire de salons vocaux initialisé - Canal trigger: ${this.createChannelId}`);
    }
    
    async handleVoiceStateUpdate(oldState, newState) {
        // Utilisateur rejoint un canal
        if (!oldState.channel && newState.channel) {
            await this.handleUserJoin(newState);
        }
        
        // Utilisateur quitte un canal
        if (oldState.channel && !newState.channel) {
            await this.handleUserLeave(oldState);
        }
        
        // Utilisateur change de canal
        if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            await this.handleUserLeave(oldState);
            await this.handleUserJoin(newState);
        }
    }
    
    async handleUserJoin(voiceState) {
        const { channel, member } = voiceState;
        
        logger.debug(`👤 ${member.displayName} a rejoint le canal vocal: ${channel.name} (${channel.id})`);
        logger.debug(`🔍 Canal trigger configuré: ${this.createChannelId}`);
        
        // Vérifier si l'utilisateur a rejoint le canal "Créer un salon"
        if (channel.id === this.createChannelId) {
            logger.info(`🎯 Trigger détecté ! Création d'un salon pour ${member.displayName}`);
            await this.createTempChannel(member, channel.guild);
        }
    }
    
    async handleUserLeave(voiceState) {
        const { channel } = voiceState;
        
        // Vérifier si le canal est un salon temporaire et s'il est vide
        if (this.tempChannels.has(channel.id)) {
            if (channel.members.size === 0) {
                await this.deleteTempChannel(channel);
            }
        }
    }
    
    async createTempChannel(member, guild) {
        try {
            // Nom du salon temporaire
            const channelName = `🎮 Salon de ${member.displayName}`;
            
            // Créer le canal vocal temporaire
            const tempChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: member.voice.channel.parent, // Même catégorie
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                    },
                    {
                        id: member.id, // Seul le créateur a toutes les permissions
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                            PermissionFlagsBits.ManageChannels, // Seul le créateur peut modifier
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.ManageRoles // Pour gérer les permissions
                        ],
                    }
                ]
            });
            
            // Déplacer l'utilisateur vers le nouveau salon
            await member.voice.setChannel(tempChannel);
            
            // Enregistrer le salon temporaire
            this.tempChannels.set(tempChannel.id, {
                ownerId: member.id,
                createdAt: Date.now()
            });
            
            logger.success(`Salon temporaire créé: ${channelName} (${tempChannel.id})`);
            
            // Envoyer un message privé à l'utilisateur
            // Envoyer un message privé à l'utilisateur avec instructions détaillées
            try {
                // PLUS DE MP DU TOUT - Supprimé définitivement
            /*
            await member.send(...);
            */
            } catch (error) {
                logger.debug(`Impossible d'envoyer un MP à ${member.displayName}`);
            }
            
            await this.sendInstructions(member, tempChannel);
            
        } catch (error) {
            logger.error('Erreur création salon temporaire:', error);
        }
    }
    
    async deleteTempChannel(channel) {
        try {
            const channelData = this.tempChannels.get(channel.id);
            if (!channelData) return;
            
            // Supprimer le canal
            await channel.delete('Salon temporaire vide');
            
            // Retirer de la liste
            this.tempChannels.delete(channel.id);
            
            const duration = Date.now() - channelData.createdAt;
            logger.success(`Salon temporaire supprimé: ${channel.name} (durée: ${Math.floor(duration / 1000)}s)`);
            
        } catch (error) {
            logger.error('Erreur suppression salon temporaire:', error);
        }
    }
    
    // Nettoyage périodique des salons abandonnés
    async cleanup() {
        for (const [channelId, data] of this.tempChannels) {
            try {
                const channel = this.client.channels.cache.get(channelId);
                
                if (!channel) {
                    // Canal n'existe plus
                    this.tempChannels.delete(channelId);
                    continue;
                }
                
                if (channel.members.size === 0) {
                    await this.deleteTempChannel(channel);
                }
                
                // Supprimer les salons trop anciens (24h)
                const age = Date.now() - data.createdAt;
                if (age > 24 * 60 * 60 * 1000) {
                    await this.deleteTempChannel(channel);
                }
                
            } catch (error) {
                logger.error(`Erreur nettoyage salon ${channelId}:`, error);
                this.tempChannels.delete(channelId);
            }
        }
    }
    
    // Méthodes utilitaires
    getTempChannelsCount() {
        return this.tempChannels.size;
    }
    
    isTempChannel(channelId) {
        return this.tempChannels.has(channelId);
    }
    
    getTempChannelOwner(channelId) {
        return this.tempChannels.get(channelId)?.ownerId;
    }
    
    // Démarrer le nettoyage périodique
    startCleanup() {
        setInterval(() => {
            this.cleanup().catch(error => {
                logger.error('Erreur nettoyage périodique:', error);
            });
        }, 5 * 60 * 1000); // Toutes les 5 minutes
        
        logger.info('🧹 Nettoyage périodique des salons vocaux démarré');
    }
    
    async sendInstructions(member, tempChannel) {
        const instructionsChannelId = process.env.VOICE_INSTRUCTIONS_CHANNEL_ID;
        
        if (!instructionsChannelId) {
            logger.warn('Canal d\'instructions vocales non configuré (VOICE_INSTRUCTIONS_CHANNEL_ID)');
            return;
        }
        
        try {
            const instructionsChannel = this.client.channels.cache.get(instructionsChannelId);
            if (!instructionsChannel) {
                logger.warn(`Canal d'instructions non trouvé: ${instructionsChannelId}`);
                return;
            }
            
            // Message dans le salon spécifique avec ping
            const message = templates.getVoiceInstructions(member, tempChannel);
            await instructionsChannel.send(`${member}\n\n${message}`);
            
            logger.success(`Instructions envoyées dans #${instructionsChannel.name} pour ${member.displayName}`);
            
        } catch (error) {
            logger.error('Erreur envoi instructions:', error);
        }
    }
    
    async handleVoiceCommand(message) {
        const instructionsChannelId = process.env.VOICE_INSTRUCTIONS_CHANNEL_ID;
        
        // Vérifier que c'est dans le bon salon
        if (message.channel.id !== instructionsChannelId) return false;
        
        const args = message.content.slice(1).split(' ');
        const command = args[0].toLowerCase();
        const userId = message.author.id;
        
        // Trouver le salon temporaire de l'utilisateur
        let userTempChannel = null;
        for (const [channelId, data] of this.tempChannels) {
            if (data.ownerId === userId) {
                userTempChannel = this.client.channels.cache.get(channelId);
                break;
            }
        }
        
        if (!userTempChannel) {
            await message.reply('❌ Vous n\'avez pas de salon vocal temporaire actif.');
            return true;
        }
        
        try {
            switch (command) {
                case 'rename':
                    if (!args[1]) {
                        await message.reply('❌ Usage: `!rename nouveau_nom`');
                        return true;
                    }
                    const newName = args.slice(1).join(' ');
                    await userTempChannel.setName(`🎮 ${newName}`);
                    await message.reply(`✅ Salon renommé en "${newName}"`);
                    break;
                    
                case 'limit':
                    const limit = parseInt(args[1]);
                    if (!limit || limit < 1 || limit > 99) {
                        await message.reply('❌ Usage: `!limit nombre` (1-99)');
                        return true;
                    }
                    await userTempChannel.setUserLimit(limit);
                    await message.reply(`✅ Limite d'utilisateurs fixée à ${limit}`);
                    break;
                    
                case 'lock':
                    await userTempChannel.permissionOverwrites.edit(message.guild.id, {
                        Connect: false
                    });
                    await message.reply('🔒 Salon verrouillé (invitations seulement)');
                    break;
                    
                case 'unlock':
                    await userTempChannel.permissionOverwrites.edit(message.guild.id, {
                        Connect: true
                    });
                    await message.reply('🔓 Salon déverrouillé');
                    break;
                    
                case 'transfer':
                    const targetUser = message.mentions.users.first();
                    if (!targetUser) {
                        await message.reply('❌ Usage: `!transfer @utilisateur`');
                        return true;
                    }
                    
                    // Transférer la propriété
                    const channelData = this.tempChannels.get(userTempChannel.id);
                    if (channelData) {
                        channelData.ownerId = targetUser.id;
                        
                        // Mettre à jour les permissions
                        await userTempChannel.permissionOverwrites.edit(message.author.id, {
                            ManageChannels: false,
                            MoveMembers: false,
                            ManageRoles: false
                        });
                        
                        await userTempChannel.permissionOverwrites.edit(targetUser.id, {
                            ManageChannels: true,
                            MoveMembers: true,
                            ManageRoles: true
                        });
                        
                        await message.reply(`✅ Propriété du salon transférée à ${targetUser}`);
                    }
                    break;
                    
                default:
                    return false; // Commande non reconnue
            }
            
            logger.info(`Commande vocale: ${command} par ${message.author.tag} pour ${userTempChannel.name}`);
            return true;
            
        } catch (error) {
            logger.error(`Erreur commande vocale ${command}:`, error);
            await message.reply('❌ Erreur lors de l\'exécution de la commande.');
            return true;
        }
    }
}

module.exports = new VoiceManager();