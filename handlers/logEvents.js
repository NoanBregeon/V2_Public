// handlers/logEvents.js
const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { sendLog, baseEmbed, humanTime } = require('../services/logsDiscord');

async function onChannelCreate(channel, client) {
  const embed = baseEmbed({
    title: '📁 Salon créé',
    color: 0x2ecc71,
    description: `**${channel.name}** (${channel.id}) [${channel.type}]`,
    fields: [
      { name: 'Catégorie / Parent', value: `${channel.parentId || '—'}`, inline: true },
      { name: 'NS', value: `ID: \`${channel.id}\``, inline: true },
    ]
  });
  embed.setFooter({ text: `guild: ${channel.guild?.name || '—'}` });
  await sendLog(client, embed);
}

async function onChannelDelete(channel, client) {
  const embed = baseEmbed({
    title: '🗑️ Salon supprimé',
    color: 0xe74c3c,
    description: `**${channel.name || '—'}** (${channel.id})`,
    fields: [
      { name: 'Type', value: `${channel.type}`, inline: true },
      { name: 'Parent', value: `${channel.parentId || '—'}`, inline: true },
    ]
  });
  await sendLog(client, embed);
}

async function onChannelUpdate(oldCh, newCh, client) {
  const changes = [];
  if (oldCh.name !== newCh.name) changes.push(`Nom: \`${oldCh.name}\` → \`${newCh.name}\``);
  if (String(oldCh.parentId || '') !== String(newCh.parentId || '')) changes.push(`Parent: \`${oldCh.parentId || '—'}\` → \`${newCh.parentId || '—'}\``);
  if (changes.length === 0) return;
  const embed = baseEmbed({
    title: '✏️ Salon modifié',
    color: 0xf1c40f,
    description: changes.join('\n')
  });
  embed.addFields([{ name: 'Salon', value: `${newCh.name} (${newCh.id})` }]);
  await sendLog(client, embed);
}

async function onRoleCreate(role, client) {
  const embed = baseEmbed({
    title: '🆕 Rôle créé',
    color: 0x2ecc71,
    description: `**${role.name}** (${role.id})`,
    fields: [{ name: 'Position', value: `${role.position}`, inline: true }]
  });
  await sendLog(client, embed);
}

async function onRoleDelete(role, client) {
  const embed = baseEmbed({
    title: '🗑️ Rôle supprimé',
    color: 0xe74c3c,
    description: `**${role.name || '—'}** (${role.id})`,
  });
  await sendLog(client, embed);
}

async function onRoleUpdate(oldRole, newRole, client) {
  const changes = [];
  if (oldRole.name !== newRole.name) changes.push(`Nom: \`${oldRole.name}\` → \`${newRole.name}\``);
  if (oldRole.color !== newRole.color) changes.push(`Couleur: \`${oldRole.color}\` → \`${newRole.color}\``);
  if (changes.length === 0) return;
  const embed = baseEmbed({
    title: '✏️ Rôle modifié',
    color: 0xf1c40f,
    description: changes.join('\n')
  });
  embed.addFields([{ name: 'Rôle', value: `${newRole.name} (${newRole.id})` }]);
  await sendLog(client, embed);
}

/**
 * Membre parti — on tente de déterminer si c'est un kick
 * Utilise les audit logs : nécessite permission ViewAuditLog
 */
async function onGuildMemberRemove(member, client) {
  // default: left
  let action = '🔴 Membre a quitté';
  let actor = null;
  try {
    // fetch recent audit logs for MemberKick
    if (member.guild && member.guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
      const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 }).catch(() => null);
      const entry = logs?.entries?.find(e => e.targetId === member.id);
      if (entry) {
        const ts = entry.createdTimestamp;
        // si l'event est récent (<5s) on considère que c'est un kick
        if (Date.now() - ts < 5000) {
          action = '🔨 Membre exclu (kick)';
          actor = entry.executor?.tag || String(entry.executorId || '—');
        }
      }
    }
  } catch (e) { /* ignore */ }

  const embed = baseEmbed({
    title: action,
    color: action.includes('exclu') ? 0xe67e22 : 0x95a5a6,
    description: `Utilisateur: **${member.user.tag}** (${member.id})`,
    fields: actor ? [{ name: 'Par', value: `${actor}` }] : []
  });
  await sendLog(client, embed);
}

async function onGuildBanAdd(guild, user) {
  const embed = baseEmbed({
    title: '⛔ Utilisateur banni',
    color: 0xe74c3c,
    description: `**${user.tag || user.id}** (${user.id})`,
  });
  await sendLog(guild.client, embed);
}

async function onGuildBanRemove(guild, user) {
  const embed = baseEmbed({
    title: '✅ Bannissement retiré',
    color: 0x2ecc71,
    description: `**${user.tag || user.id}** (${user.id})`,
  });
  await sendLog(guild.client, embed);
}

async function onMessageDelete(message, client) {
  // si message partial, tente fetch
  try {
    if (message.partial) await message.fetch();
  } catch (e) {}

  const content = message.content ? message.content.slice(0, 1500) : '_pas de contenu_';
  const embed = baseEmbed({
    title: '🗑️ Message supprimé',
    color: 0xe74c3c,
    description: `Auteur: **${message.author?.tag || 'Inconnu'}** \nSalon: ${message.channel?.toString() || message.channelId}`,
    fields: [{ name: 'Contenu (extrait)', value: content || '—' }]
  });
  await sendLog(client, embed);
}

module.exports = {
  register: function(client) {
    client.on('channelCreate', ch => onChannelCreate(ch, client));
    client.on('channelDelete', ch => onChannelDelete(ch, client));
    client.on('channelUpdate', (oldC, newC) => onChannelUpdate(oldC, newC, client));
    client.on('roleCreate', r => onRoleCreate(r, client));
    client.on('roleDelete', r => onRoleDelete(r, client));
    client.on('roleUpdate', (o,n) => onRoleUpdate(o,n,client));
    client.on('guildMemberRemove', m => onGuildMemberRemove(m, client));
    client.on('guildBanAdd', (guild, user) => onGuildBanAdd(guild, user));
    client.on('guildBanRemove', (guild, user) => onGuildBanRemove(guild, user));
    client.on('messageDelete', m => onMessageDelete(m, client));
  }
};
