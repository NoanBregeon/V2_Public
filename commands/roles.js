// commands/roles.js (Twitch-only, admin-only + hide in UI)
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const { helixHeaders, resolveBroadcasterId, getUserByLogin } = require('../services/twitch');

function missing() {
  const miss = [];
  if (!process.env.TWITCH_CLIENT_ID) miss.push('TWITCH_CLIENT_ID');
  if (!process.env.TWITCH_USER_TOKEN) miss.push('TWITCH_USER_TOKEN');
  if (!process.env.STREAMER_USERNAME) miss.push('STREAMER_USERNAME');
  return miss.length ? `⚠️ Twitch non configuré: ${miss.join(', ')}` : null;
}

async function addMod(login) {
  const u = await getUserByLogin(login);
  if (!u) throw new Error('Utilisateur Twitch introuvable.');
  const broadcaster_id = await resolveBroadcasterId();
  await axios.post('https://api.twitch.tv/helix/moderation/moderators', null, { params: { broadcaster_id, user_id: u.id }, headers: helixHeaders() });
  return u;
}
async function removeMod(login) {
  const u = await getUserByLogin(login);
  if (!u) throw new Error('Utilisateur Twitch introuvable.');
  const broadcaster_id = await resolveBroadcasterId();
  await axios.delete('https://api.twitch.tv/helix/moderation/moderators', { params: { broadcaster_id, user_id: u.id }, headers: helixHeaders() });
  return u;
}
async function addVip(login) {
  const u = await getUserByLogin(login);
  if (!u) throw new Error('Utilisateur Twitch introuvable.');
  const broadcaster_id = await resolveBroadcasterId();
  await axios.post('https://api.twitch.tv/helix/channels/vips', null, { params: { broadcaster_id, user_id: u.id }, headers: helixHeaders() });
  return u;
}
async function removeVip(login) {
  const u = await getUserByLogin(login);
  if (!u) throw new Error('Utilisateur Twitch introuvable.');
  const broadcaster_id = await resolveBroadcasterId();
  await axios.delete('https://api.twitch.tv/helix/channels/vips', { params: { broadcaster_id, user_id: u.id }, headers: helixHeaders() });
  return u;
}
async function listMods() {
  const broadcaster_id = await resolveBroadcasterId();
  const r = await axios.get('https://api.twitch.tv/helix/moderation/moderators', { params: { broadcaster_id, first: 100 }, headers: helixHeaders() });
  return r.data?.data ?? [];
}
async function listVips() {
  const broadcaster_id = await resolveBroadcasterId();
  const r = await axios.get('https://api.twitch.tv/helix/channels/vips', { params: { broadcaster_id, first: 100 }, headers: helixHeaders() });
  return r.data?.data ?? [];
}

async function safeExec(interaction, fn) {
  await interaction.deferReply(); // public
  try {
    const txt = await fn();
    await interaction.editReply(txt);
  } catch (e) {
    const msg = e?.response?.data?.message || e.message || 'Erreur inconnue';
    await interaction.editReply(`❌ ${msg}`);
  }
}

const metaAdmin = { adminOnly: true, guildOnly: true, cooldownMs: 4000 };

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('addmodo')
      .setDescription('Ajouter un modérateur sur Twitch')
      .addStringOption(o => o.setName('username').setDescription('Login Twitch').setRequired(true))
      .setDMPermission(false)
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    meta: metaAdmin,
    async execute(i) {
      const miss = missing(); if (miss) return i.reply({ content: miss, flags: 64 });
      const login = i.options.getString('username');
      await safeExec(i, async () => {
        const u = await addMod(login);
        return `✅ **${u.display_name}** ajouté **modérateur Twitch**.`;
      });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('removemodo')
      .setDescription('Retirer un modérateur sur Twitch')
      .addStringOption(o => o.setName('username').setDescription('Login Twitch').setRequired(true))
      .setDMPermission(false)
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    meta: metaAdmin,
    async execute(i) {
      const miss = missing(); if (miss) return i.reply({ content: miss, flags: 64 });
      const login = i.options.getString('username');
      await safeExec(i, async () => {
        const u = await removeMod(login);
        return `✅ **${u.display_name}** retiré des **modérateurs Twitch**.`;
      });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('addvip')
      .setDescription('Ajouter un VIP sur Twitch')
      .addStringOption(o => o.setName('username').setDescription('Login Twitch').setRequired(true))
      .setDMPermission(false)
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    meta: metaAdmin,
    async execute(i) {
      const miss = missing(); if (miss) return i.reply({ content: miss, flags: 64 });
      const login = i.options.getString('username');
      await safeExec(i, async () => {
        const u = await addVip(login);
        return `✅ **${u.display_name}** ajouté **VIP Twitch**.`;
      });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('removevip')
      .setDescription('Retirer un VIP sur Twitch')
      .addStringOption(o => o.setName('username').setDescription('Login Twitch').setRequired(true))
      .setDMPermission(false)
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    meta: metaAdmin,
    async execute(i) {
      const miss = missing(); if (miss) return i.reply({ content: miss, flags: 64 });
      const login = i.options.getString('username');
      await safeExec(i, async () => {
        const u = await removeVip(login);
        return `✅ **${u.display_name}** n’est plus **VIP Twitch**.`;
      });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('listmods')
      .setDescription('Lister les modérateurs Twitch')
      .setDMPermission(false)
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    meta: metaAdmin,
    async execute(i) {
      const miss = missing(); if (miss) return i.reply({ content: miss, flags: 64 });
      await safeExec(i, async () => {
        const mods = await listMods();
        const out = mods.map(m => `${m.user_name} (${m.user_id})`).join('\\n') || 'Aucun.';
        return out.length > 1900 ? out.slice(0, 1900) : out;
      });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('listvips')
      .setDescription('Lister les VIP Twitch')
      .setDMPermission(false)
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    meta: metaAdmin,
    async execute(i) {
      const miss = missing(); if (miss) return i.reply({ content: miss, flags: 64 });
      await safeExec(i, async () => {
        const vips = await listVips();
        const out = vips.map(v => `${v.user_name} (${v.user_id})`).join('\\n') || 'Aucun.';
        return out.length > 1900 ? out.slice(0, 1900) : out;
      });
    }
  }
];