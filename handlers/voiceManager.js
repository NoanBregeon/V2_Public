// VoiceManager.js
const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

class VoiceManager {
  /**
   * @param {import('discord.js').Client} client
   * @param {{ guildId: string, createVoiceChannelId: string, voiceInstructionsChannelId?: string }} config
   */
  constructor(client, config) {
    this.client = client;
    this.config = config;
    // channelId -> { owner: userId, created: timestamp }
    this.tempChannels = new Map();
  }

  async initialize() {
    // Événements vocaux
    this.client.on('voiceStateUpdate', this.handleVoiceStateUpdate.bind(this));

    // Nettoyer les canaux temporaires au démarrage
    await this.cleanupTempChannels();

    console.log('✅ VoiceManager initialisé');
  }

  async handleVoiceStateUpdate(oldState, newState) {
    // Création du canal vocal temporaire
    if (newState.channelId === this.config.createVoiceChannelId) {
      await this.createTempChannel(newState);
      return;
    }

    // Si quitte un canal temporaire, vérifier s'il faut le supprimer
    if (oldState.channel && this.tempChannels.has(oldState.channelId)) {
      const tempChannel = oldState.channel;

      // Attendre un peu pour éviter les suppressions lors des déplacements
      setTimeout(async () => {
        try {
          const currentChannel = await this.client.channels.fetch(tempChannel.id).catch(() => null);
          if (currentChannel && currentChannel.members.size === 0) {
            await this.deleteTempChannel(tempChannel.id);
          }
        } catch (error) {
          console.error('❌ Erreur vérification canal temporaire:', error);
        }
      }, 1000);
    }
  }

  isTempChannel(channelId) {
    return this.tempChannels.has(channelId);
  }

  async createTempChannel(state) {
    const member = state.member;
    if (!member) return;

    try {
      // Créer le canal vocal
      const channel = await state.guild.channels.create({
        name: `🔊 Salon de ${member.displayName}`,
        type: ChannelType.GuildVoice,
        parent: state.channel?.parentId || state.channel?.parent || null,
        permissionOverwrites: [
          {
            id: state.guild.id, // @everyone
            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
          },
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MuteMembers,
              PermissionFlagsBits.DeafenMembers,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.MoveMembers,
            ],
          },
        ],
      });

      // Déplacer le membre dans le nouveau canal
      if (member.voice?.channelId !== channel.id) {
        await member.voice.setChannel(channel);
      }

      // Enregistrer le canal temporaire
      this.tempChannels.set(channel.id, {
        owner: member.id,
        created: Date.now(),
      });

      console.log(`🎤 Canal vocal temporaire créé par ${member.user.tag}: ${channel.name}`);

      // Envoyer les instructions
      await this.sendInstructions(member, channel);
    } catch (error) {
      console.error('❌ Erreur création canal temporaire:', error);
    }
  }

  async deleteTempChannel(channelId) {
    try {
      const channel = this.client.channels.cache.get(channelId);
      if (channel) {
        await channel.delete();
        console.log(`🗑️ Canal vocal temporaire supprimé: ${channel.name}`);
      }

      this.tempChannels.delete(channelId);
    } catch (error) {
      console.error('❌ Erreur suppression canal temporaire:', error);
    }
  }

  async cleanupTempChannels() {
    const guild = this.client.guilds.cache.get(this.config.guildId);
    if (!guild) return;

    try {
      // Vider la Map pour commencer proprement
      this.tempChannels.clear();

      // Recherche des canaux vides dans la même catégorie que le canal de création
      const createChannel = guild.channels.cache.get(this.config.createVoiceChannelId);
      if (!createChannel) return;

      const categoryId = createChannel.parentId;
      if (!categoryId) return;

      const emptyVoiceChannels = guild.channels.cache.filter(
        (ch) =>
          ch.parentId === categoryId &&
          ch.id !== this.config.createVoiceChannelId &&
          ch.type === ChannelType.GuildVoice &&
          ch.members.size === 0
      );

      // Supprimer les canaux vides
      for (const [, channel] of emptyVoiceChannels) {
        await channel.delete();
        console.log(`🧹 Canal vide nettoyé: ${channel.name}`);
      }

      console.log(`🧹 ${emptyVoiceChannels.size} canaux temporaires vides nettoyés`);
    } catch (error) {
      console.error('❌ Erreur nettoyage canaux:', error);
    }
  }

  async sendInstructions(member, channel) {
    // Canal pour les instructions
    const instructionChannelId = this.config.voiceInstructionsChannelId || member.dmChannel?.id;
    if (!instructionChannelId && !this.config.voiceInstructionsChannelId) {
      // On essaiera d'ouvrir un DM si pas de salon dédié
    }

    try {
      let targetChannel;

      if (this.config.voiceInstructionsChannelId) {
        targetChannel = await this.client.channels.fetch(this.config.voiceInstructionsChannelId);
      } else {
        targetChannel = await member.createDM();
      }

      if (!targetChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('🎤 Salon vocal temporaire créé')
        .setDescription(`Tu as créé un salon vocal temporaire. Tu en es le propriétaire et tu peux le gérer.`)
        .addFields(
          { name: '👤 Propriétaire', value: member.toString(), inline: true },
          { name: '🔊 Salon', value: channel.toString(), inline: true },
          {
            name: '🛠️ Commandes',
            value:
              '`/rename <nom>` - Renommer le salon\n' +
              "`/limit <nombre>` - Limiter le nombre d'utilisateurs\n" +
              '`/lock` - Verrouiller le salon\n' +
              '`/unlock` - Déverrouiller le salon\n' +
              '`/transfer <utilisateur>` - Transférer la propriété',
          }
        )
        .setColor(0x3498db)
        .setFooter({ text: 'Le salon sera supprimé quand il sera vide' });

      await targetChannel.send({
        content: member.toString(),
        embeds: [embed],
        allowedMentions: { users: [member.id] },
      });
    } catch (error) {
      console.error('❌ Erreur envoi instructions vocales:', error);
    }
  }

  /** Gestion commandes slash */
  async handleSlashCommand(interaction, command) {
    const member = interaction.member;
    const channel = member.voice.channel;

    // Vérifier si l'utilisateur est dans un canal vocal
    if (!channel) {
      return interaction.reply({
        content: '❌ Tu dois être dans un salon vocal pour utiliser cette commande',
        ephemeral: true,
      });
    }

    // Vérifier si c'est un canal temporaire
    const tempChannel = this.isTempChannel(channel.id) ? this.tempChannels.get(channel.id) : null;
    if (!tempChannel) {
      return interaction.reply({
        content: '❌ Cette commande ne fonctionne que dans les salons vocaux temporaires',
        ephemeral: true,
      });
    }

    // Vérifier si l'utilisateur est le propriétaire ou un administrateur
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const isOwner = tempChannel.owner === member.id;

    if (!isAdmin && !isOwner) {
      return interaction.reply({
        content: '❌ Seul le propriétaire du salon peut utiliser cette commande',
        ephemeral: true,
      });
    }

    // Traiter la commande
    switch (command) {
      case 'rename':
        return this.handleRename(interaction, channel);
      case 'limit':
        return this.handleLimit(interaction, channel);
      case 'lock':
        return this.handleLock(interaction, channel);
      case 'unlock':
        return this.handleUnlock(interaction, channel);
      case 'transfer':
        return this.handleTransfer(interaction, channel);
      default:
        return interaction.reply({
          content: '❌ Commande inconnue',
          ephemeral: true,
        });
    }
  }

  /** Gestion commandes texte (préfixe) */
  async handleTextCommand(message, command, args) {
    const member = message.member;
    const channel = member.voice.channel;

    // Vérifications similaires à handleSlashCommand
    if (!channel) {
      return message.reply('❌ Tu dois être dans un salon vocal pour utiliser cette commande');
    }

    const tempChannel = this.tempChannels.get(channel.id);
    if (!tempChannel) {
      return message.reply('❌ Cette commande ne fonctionne que dans les salons vocaux temporaires');
    }

    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const isOwner = tempChannel.owner === member.id;

    if (!isAdmin && !isOwner) {
      return message.reply('❌ Seul le propriétaire du salon peut utiliser cette commande');
    }

    // Traiter la commande
    try {
      switch (command) {
        case 'rename':
          if (!args.length) return message.reply('❌ Tu dois spécifier un nom');
          await channel.setName(args.join(' '));
          return message.reply(`✅ Salon renommé en: ${args.join(' ')}`);

        case 'limit':
          {
            const limit = parseInt(args[0], 10);
            if (isNaN(limit) || limit < 0 || limit > 99) return message.reply('❌ Limite invalide (0-99)');
            await channel.setUserLimit(limit);
            return message.reply(`✅ Limite définie à: ${limit === 0 ? 'illimité' : limit}`);
          }

        case 'lock':
          await channel.permissionOverwrites.edit(message.guild.id, {
            Connect: false,
          });
          return message.reply('✅ Salon verrouillé');

        case 'unlock':
          await channel.permissionOverwrites.edit(message.guild.id, {
            Connect: true,
          });
          return message.reply('✅ Salon déverrouillé');

        case 'transfer':
          {
            if (!args.length) return message.reply('❌ Tu dois mentionner un utilisateur');
            const targetId = args[0].replace(/[<@!&>]/g, '');
            const target = message.guild.members.cache.get(targetId);
            if (!target) return message.reply('❌ Utilisateur introuvable');
            if (!channel.members.has(target.id)) return message.reply("❌ L'utilisateur doit être dans le salon");

            // Retirer les permissions du propriétaire actuel
            await channel.permissionOverwrites.edit(member.id, {
              ManageChannels: false,
              MuteMembers: false,
              DeafenMembers: false,
              ManageMessages: false,
              MoveMembers: false,
            });

            // Donner les permissions au nouveau propriétaire
            await channel.permissionOverwrites.edit(target.id, {
              ManageChannels: true,
              MuteMembers: true,
              DeafenMembers: true,
              ManageMessages: true,
              MoveMembers: true,
            });

            // Mettre à jour le propriétaire
            this.tempChannels.set(channel.id, {
              owner: target.id,
              created: tempChannel.created,
            });

            return message.reply(`✅ Propriété du salon transférée à ${target.toString()}`);
          }

        default:
          return message.reply('❌ Commande inconnue');
      }
    } catch (error) {
      console.error(`❌ Erreur commande vocale ${command}:`, error);
      return message.reply('❌ Une erreur est survenue');
    }
  }

  // ---- Handlers slash détaillés ----

  async handleRename(interaction, channel) {
    const name = interaction.options.getString('nom');
    if (!name) {
      return interaction.reply({ content: '❌ Tu dois fournir un nom', ephemeral: true });
    }

    try {
      await channel.setName(name);
      return interaction.reply({
        content: `✅ Salon renommé en: ${name}`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('❌ Erreur rename:', error);
      return interaction.reply({
        content: '❌ Erreur lors du renommage du salon',
        ephemeral: true,
      });
    }
  }

  async handleLimit(interaction, channel) {
    const limit = interaction.options.getInteger('nombre');
    if (limit == null || isNaN(limit) || limit < 0 || limit > 99) {
      return interaction.reply({ content: '❌ Limite invalide (0-99)', ephemeral: true });
    }

    try {
      await channel.setUserLimit(limit);
      return interaction.reply({
        content: `✅ Limite définie à: ${limit === 0 ? 'illimité' : limit}`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('❌ Erreur limit:', error);
      return interaction.reply({
        content: '❌ Erreur lors de la définition de la limite',
        ephemeral: true,
      });
    }
  }

  async handleLock(interaction, channel) {
    try {
      await channel.permissionOverwrites.edit(interaction.guild.id, {
        Connect: false,
      });
      return interaction.reply({
        content: '✅ Salon verrouillé',
        ephemeral: true,
      });
    } catch (error) {
      console.error('❌ Erreur lock:', error);
      return interaction.reply({
        content: '❌ Erreur lors du verrouillage du salon',
        ephemeral: true,
      });
    }
  }

  async handleUnlock(interaction, channel) {
    try {
      await channel.permissionOverwrites.edit(interaction.guild.id, {
        Connect: true,
      });
      return interaction.reply({
        content: '✅ Salon déverrouillé',
        ephemeral: true,
      });
    } catch (error) {
      console.error('❌ Erreur unlock:', error);
      return interaction.reply({
        content: '❌ Erreur lors du déverrouillage du salon',
        ephemeral: true,
      });
    }
  }

  async handleTransfer(interaction, channel) {
    const target = interaction.options.getMember('utilisateur');
    const tempChannel = this.tempChannels.get(channel.id);

    if (!target) {
      return interaction.reply({
        content: '❌ Utilisateur introuvable',
        ephemeral: true,
      });
    }

    if (!channel.members.has(target.id)) {
      return interaction.reply({
        content: "❌ L'utilisateur doit être présent dans le salon",
        ephemeral: true,
      });
    }

    try {
      // Retirer les permissions du propriétaire actuel
      await channel.permissionOverwrites.edit(interaction.user.id, {
        ManageChannels: false,
        MuteMembers: false,
        DeafenMembers: false,
        ManageMessages: false,
        MoveMembers: false,
      });

      // Donner les permissions au nouveau propriétaire
      await channel.permissionOverwrites.edit(target.id, {
        ManageChannels: true,
        MuteMembers: true,
        DeafenMembers: true,
        ManageMessages: true,
        MoveMembers: true,
      });

      // Mettre à jour le propriétaire dans la Map
      this.tempChannels.set(channel.id, {
        owner: target.id,
        created: tempChannel.created,
      });

      return interaction.reply({
        content: `✅ Propriété du salon transférée à ${target.toString()}`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('❌ Erreur transfer:', error);
      return interaction.reply({
        content: '❌ Erreur lors du transfert de propriété',
        ephemeral: true,
      });
    }
  }
}

module.exports = VoiceManager;