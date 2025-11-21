// handlers/voiceTemp.js
const { ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  register(client) {
    client.on('voiceStateUpdate', async (oldState, newState) => {
      try {
        const guild = newState.guild || oldState.guild;
        const member = newState.member || oldState.member;
        if (!guild || !member) return;
        if (member.user.bot) return;

        const createId = process.env.CREATE_VOICE_CHANNEL_ID;
        const categoryId = process.env.VOICE_CATEGORY_ID;

        if (!createId || !categoryId) return; // pas configuré

        const oldCh = oldState.channel;
        const newCh = newState.channel;

        // -------------------------------------------------
        // 1) Création d'un vocal temporaire
        //    Quand un membre rejoint le salon "créateur"
        // -------------------------------------------------
        const joinedCreator =
          newCh &&
          newCh.id === createId &&
          (!oldCh || oldCh.id !== createId);

        if (joinedCreator) {
          const category = guild.channels.cache.get(categoryId);
          if (!category || category.type !== ChannelType.GuildCategory) {
            console.warn('VOICE_CATEGORY_ID invalide ou non catégorie');
            return;
          }

          const template = process.env.VOICE_NAME_TEMPLATE || 'Salon de {user}';
          const name = template.replace('{user}', member.displayName || member.user.username);

          let userLimit = 0;
          const rawLimit = process.env.VOICE_DEFAULT_LIMIT;
          if (rawLimit && !isNaN(parseInt(rawLimit, 10))) {
            userLimit = parseInt(rawLimit, 10);
          }

          // Permissions de base
          const overwrites = [
            {
              id: guild.roles.everyone.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak
              ]
            },
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers
              ]
            }
          ];

          // Staff (optionnel)
          const adminRoleId = process.env.ADMIN_ROLE_ID;
          const modRoleId = process.env.MODERATOR_ROLE_ID;

          if (modRoleId) {
            overwrites.push({
              id: modRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers,
                PermissionFlagsBits.ManageChannels
              ]
            });
          }

          if (adminRoleId) {
            overwrites.push({
              id: adminRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers,
                PermissionFlagsBits.ManageChannels
              ]
            });
          }

          // Bot
          if (guild.members.me?.id) {
            overwrites.push({
              id: guild.members.me.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers,
                PermissionFlagsBits.ManageChannels
              ]
            });
          }

          const newVoice = await guild.channels.create({
            name,
            type: ChannelType.GuildVoice,
            parent: category.id,
            userLimit,
            permissionOverwrites: overwrites,
            reason: `Salon vocal temporaire créé pour ${member.user.tag}`
            });

            // déplacer le membre dans son salon
            await member.voice.setChannel(newVoice).catch(() => {});

            // ping dans la discussion du vocal (si Text-in-Voice est actif)
            try {
            // suivant la config du serveur, newVoice peut accepter les messages
            if (typeof newVoice.send === 'function') {
                await newVoice.send({
                content:
                    `🎧 **Salon vocal créé !**\n` +
                    `<@${member.id}>, ton salon vocal personnel est maintenant disponible.\n\n` +
                    `Tu peux :\n` +
                    `• Renommer le salon avec \`/rename\`\n` +
                    `• Changer la limite d’utilisateurs avec \`/limit\`\n` +
                    `• Verrouiller/déverrouiller avec \`/lock\` et \`/unlock\`\n\n` +
                    `🗑️ Le salon sera automatiquement supprimé lorsqu'il sera vide.`
                });
            }
            } catch (err) {
            console.error('voiceTemp ping owner error:', err);
            }

            return;
        }

        // -------------------------------------------------
        // 2) Suppression auto des vocaux temporaires vides
        //    → tous les vocaux sous VOICE_CATEGORY_ID
        //      (sauf le salon "créateur")
        // -------------------------------------------------
        if (
          oldCh &&
          oldCh.type === ChannelType.GuildVoice &&
          oldCh.parentId === categoryId &&
          oldCh.id !== createId &&
          oldCh.members.size === 0
        ) {
          await oldCh.delete('Salon vocal temporaire vide').catch(() => {});
        }
      } catch (err) {
        console.error('voiceTemp error:', err);
      }
    });
  }
};
