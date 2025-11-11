// commands/voice.js
const { SlashCommandBuilder, ChannelType } = require('discord.js');
const voiceRooms = require('../services/voiceRooms');

function currentVC(i) { return i.member.voice?.channel || null; }

async function ensureOwner(i, ch) {
  if (!ch || ch.type !== ChannelType.GuildVoice) {
    await i.reply({ content: '❌ Tu dois être dans un salon vocal.', ephemeral: true });
    return false;
  }
  const owner = voiceRooms.isOwner(ch.id, i.user.id);
  if (!owner) {
    await i.reply({ content: '⛔ Seul le **créateur** de ce salon peut utiliser cette commande.', ephemeral: true });
    return false;
  }
  return true;
}

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('rename')
      .setDescription('Renommer votre salon vocal')
      .addStringOption(o => o.setName('nom').setDescription('Nouveau nom').setRequired(true))
      .setDMPermission(false),
    meta: { guildOnly: true, cooldownMs: 2000 },
    async execute(i) {
      const ch = currentVC(i);
      if (!(await ensureOwner(i, ch))) return;
      await ch.setName(i.options.getString('nom')).catch(() => {});
      await i.reply({ content: '✅ Salon renommé.' });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('limit')
      .setDescription('Limiter le nombre d’utilisateurs (0 = illimité)')
      .addIntegerOption(o => o.setName('nombre').setDescription('0-99').setRequired(true))
      .setDMPermission(false),
    meta: { guildOnly: true, cooldownMs: 2000 },
    async execute(i) {
      const ch = currentVC(i);
      if (!(await ensureOwner(i, ch))) return;
      await ch.setUserLimit(i.options.getInteger('nombre')).catch(() => {});
      await i.reply({ content: '✅ Limite appliquée.' });
    }
  },
  {
    data: new SlashCommandBuilder().setName('lock').setDescription('Verrouiller votre salon vocal').setDMPermission(false),
    meta: { guildOnly: true, cooldownMs: 2000 },
    async execute(i) {
      const ch = currentVC(i);
      if (!(await ensureOwner(i, ch))) return;
      await ch.permissionOverwrites.edit(i.guild.roles.everyone, { Connect: false }).catch(() => {});
      await i.reply({ content: '🔒 Verrouillé.' });
    }
  },
  {
    data: new SlashCommandBuilder().setName('unlock').setDescription('Déverrouiller votre salon vocal').setDMPermission(false),
    meta: { guildOnly: true, cooldownMs: 2000 },
    async execute(i) {
      const ch = currentVC(i);
      if (!(await ensureOwner(i, ch))) return;
      await ch.permissionOverwrites.edit(i.guild.roles.everyone, { Connect: true }).catch(() => {});
      await i.reply({ content: '🔓 Déverrouillé.' });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('transfer')
      .setDescription('Transférer la propriété du salon')
      .addUserOption(o => o.setName('utilisateur').setDescription('Nouveau propriétaire').setRequired(true))
      .setDMPermission(false),
    meta: { guildOnly: true, cooldownMs: 2000 },
    async execute(i) {
      const ch = currentVC(i);
      if (!(await ensureOwner(i, ch))) return;
      const target = i.options.getUser('utilisateur');
      await voiceRooms.transferOwnership(ch, target.id);
      await i.reply({ content: `✅ Propriété transférée à <@${target.id}>.` });
    }
  }
];
