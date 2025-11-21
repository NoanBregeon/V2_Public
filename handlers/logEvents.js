// handlers/logEvents.js
const { EmbedBuilder, ChannelType } = require('discord.js');

function getLogChannel(guild) {
  const id = process.env.LOGS_CHANNEL_ID;
  if (!id) return null;
  const ch = guild.channels.cache.get(id);
  if (!ch) return null;
  if (!ch.isTextBased()) return null;
  return ch;
}

async function sendLog(guild, embed) {
  try {
    const channel = getLogChannel(guild);
    if (!channel) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Erreur log Discord :', err);
  }
}

module.exports = {
  register(client) {
    // 👤 Membre rejoint
    client.on('guildMemberAdd', async (member) => {
      const embed = new EmbedBuilder()
        .setTitle('👤 Nouveau membre')
        .setDescription(`${member} a rejoint le serveur.`)
        .addFields(
          { name: 'Utilisateur', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: 'Créé le', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setColor(0x2ecc71)
        .setTimestamp(new Date());

      await sendLog(member.guild, embed);
    });

    // 🚪 Membre quitte / kick / ban
    client.on('guildMemberRemove', async (member) => {
      // member.user peut être partiellement null selon les cas, on sécurise
      const tag = member.user ? member.user.tag : 'Inconnu';
      const avatar = member.user ? member.user.displayAvatarURL() : null;

      const embed = new EmbedBuilder()
        .setTitle('🚪 Membre parti')
        .setDescription(`${tag} (\`${member.id}\`) a quitté le serveur.`)
        .setColor(0xe74c3c)
        .setTimestamp(new Date());

      if (avatar) embed.setThumbnail(avatar);

      await sendLog(member.guild, embed);
    });

    // 🔊 Mouvements vocaux
    client.on('voiceStateUpdate', async (oldState, newState) => {
      const guild = newState.guild || oldState.guild;
      const member = newState.member || oldState.member;
      if (!guild || !member) return;

      const oldChannel = oldState.channel;
      const newChannel = newState.channel;

      // Rien de significatif
      if (oldChannel === newChannel) return;

      let title;
      let desc;

      if (!oldChannel && newChannel) {
        // Join
        title = '🔊 Connexion au vocal';
        desc = `${member} a rejoint **${newChannel.name}**.`;
      } else if (oldChannel && !newChannel) {
        // Leave
        title = '🔇 Déconnexion du vocal';
        desc = `${member} a quitté **${oldChannel.name}**.`;
      } else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
        // Move
        title = '🔁 Déplacement vocal';
        desc = `${member} est passé de **${oldChannel.name}** à **${newChannel.name}**.`;
      } else {
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .addFields({ name: 'Utilisateur', value: `${member.user.tag} (\`${member.id}\`)` })
        .setColor(0x9b59b6)
        .setTimestamp(new Date());

      await sendLog(guild, embed);
    });

    // 📁 Salon créé
    client.on('channelCreate', async (channel) => {
      if (!channel.guild) return;
      if (channel.type === ChannelType.DM) return;

      const embed = new EmbedBuilder()
        .setTitle('📁 Salon créé')
        .addFields(
          { name: 'Nom', value: `${channel.name}`, inline: true },
          { name: 'ID', value: `\`${channel.id}\``, inline: true },
          { name: 'Type', value: `${channel.type}`, inline: true }
        )
        .setColor(0x3498db)
        .setTimestamp(new Date());

      await sendLog(channel.guild, embed);
    });

    // 🗑️ Salon supprimé
    client.on('channelDelete', async (channel) => {
      if (!channel.guild) return;
      if (channel.type === ChannelType.DM) return;

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Salon supprimé')
        .addFields(
          { name: 'Nom', value: `${channel.name}`, inline: true },
          { name: 'ID', value: `\`${channel.id}\``, inline: true },
          { name: 'Type', value: `${channel.type}`, inline: true }
        )
        .setColor(0xc0392b)
        .setTimestamp(new Date());

      await sendLog(channel.guild, embed);
    });

    // ✏️ Salon modifié
    client.on('channelUpdate', async (oldChannel, newChannel) => {
      if (!newChannel.guild) return;
      if (newChannel.type === ChannelType.DM) return;

      const changes = [];
      if (oldChannel.name !== newChannel.name) {
        changes.push(`• Nom: \`${oldChannel.name}\` → \`${newChannel.name}\``);
      }
      if (oldChannel.parentId !== newChannel.parentId) {
        const oldParent = oldChannel.parent?.name || 'Aucune';
        const newParent = newChannel.parent?.name || 'Aucune';
        changes.push(`• Catégorie: \`${oldParent}\` → \`${newParent}\``);
      }

      if (!changes.length) return;

      const embed = new EmbedBuilder()
        .setTitle('✏️ Salon modifié')
        .setDescription(changes.join('\n'))
        .addFields(
          { name: 'Salon', value: `${newChannel} (\`${newChannel.id}\`)` }
        )
        .setColor(0xf1c40f)
        .setTimestamp(new Date());

      await sendLog(newChannel.guild, embed);
    });

    // 🎭 Rôle créé
    client.on('roleCreate', async (role) => {
      if (!role.guild) return;

      const embed = new EmbedBuilder()
        .setTitle('🎭 Rôle créé')
        .addFields(
          { name: 'Nom', value: `${role.name}`, inline: true },
          { name: 'ID', value: `\`${role.id}\``, inline: true }
        )
        .setColor(0x2ecc71)
        .setTimestamp(new Date());

      await sendLog(role.guild, embed);
    });

    // 🗑️ Rôle supprimé
    client.on('roleDelete', async (role) => {
      if (!role.guild) return;

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Rôle supprimé')
        .addFields(
          { name: 'Nom', value: `${role.name}`, inline: true },
          { name: 'ID', value: `\`${role.id}\``, inline: true }
        )
        .setColor(0xe74c3c)
        .setTimestamp(new Date());

      await sendLog(role.guild, embed);
    });

    // ✏️ Rôle mis à jour
    client.on('roleUpdate', async (oldRole, newRole) => {
      if (!newRole.guild) return;

      const changes = [];
      if (oldRole.name !== newRole.name) {
        changes.push(`• Nom: \`${oldRole.name}\` → \`${newRole.name}\``);
      }
      if (oldRole.color !== newRole.color) {
        changes.push(`• Couleur: \`#${oldRole.color.toString(16)}\` → \`#${newRole.color.toString(16)}\``);
      }

      if (!changes.length) return;

      const embed = new EmbedBuilder()
        .setTitle('✏️ Rôle modifié')
        .setDescription(changes.join('\n'))
        .addFields(
          { name: 'Rôle', value: `${newRole} (\`${newRole.id}\`)` }
        )
        .setColor(0xf1c40f)
        .setTimestamp(new Date());

      await sendLog(newRole.guild, embed);
    });
  }
};
