const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const { helixHeaders, resolveBroadcasterId, getUserByLogin } = require('../services/twitch');

function need(i){ const miss=[]; if(!process.env.TWITCH_CLIENT_ID) miss.push('TWITCH_CLIENT_ID'); if(!process.env.TWITCH_USER_TOKEN) miss.push('TWITCH_USER_TOKEN'); if(!process.env.STREAMER_USERNAME) miss.push('STREAMER_USERNAME'); if(miss.length){ i.reply({ content:`⚠️ Twitch non configuré: ${miss.join(', ')}`, flags:64 }); return true; } return false; }

async function listTwitchBansAll() {
  const broadcaster_id = await resolveBroadcasterId();
  const out = [];
  let cursor = null;

  while (true) {
    const params = { broadcaster_id, first: 100 };
    if (cursor) params.after = cursor;

    const r = await axios.get('https://api.twitch.tv/helix/moderation/banned', {
      headers: helixHeaders(),
      params
    });

    const data = r.data?.data ?? [];
    out.push(...data);
    cursor = r.data?.pagination?.cursor || null;
    if (!cursor || data.length === 0) break;
  }
  return out;
}

module.exports = [
  { data:new SlashCommandBuilder().setName('twitchsearch').setDescription('Rechercher un utilisateur Twitch').addStringOption(o=>o.setName('username').setDescription('Nom Twitch').setRequired(true)).setDMPermission(false),
    async execute(i){ if(need(i)) return; const u=await getUserByLogin(i.options.getString('username')); if(!u) return i.reply({ content:'Utilisateur introuvable.', flags:64 }); await i.reply({ content:`✅ ${u.display_name} (id: ${u.id})`, flags:64 }); } },
  { data:new SlashCommandBuilder().setName('twitchaddmod').setDescription('Ajouter un modérateur Twitch').addStringOption(o=>o.setName('username').setDescription('Nom Twitch').setRequired(true)).setDMPermission(false),
    async execute(i){ if(need(i)) return; const u=await getUserByLogin(i.options.getString('username')); if(!u) return i.reply({ content:'Utilisateur introuvable.', flags:64 }); const broadcaster_id=await resolveBroadcasterId(); await axios.post('https://api.twitch.tv/helix/moderation/moderators', null, { params:{ broadcaster_id, user_id:u.id }, headers:helixHeaders() }); await i.reply({ content:`✅ ${u.display_name} ajouté modérateur Twitch.`, flags:64 }); } },
  { data:new SlashCommandBuilder().setName('twitchremovemod').setDescription('Retirer un modérateur Twitch').addStringOption(o=>o.setName('username').setDescription('Nom Twitch').setRequired(true)).setDMPermission(false),
    async execute(i){ if(need(i)) return; const u=await getUserByLogin(i.options.getString('username')); if(!u) return i.reply({ content:'Utilisateur introuvable.', flags:64 }); const broadcaster_id=await resolveBroadcasterId(); await axios.delete('https://api.twitch.tv/helix/moderation/moderators', { params:{ broadcaster_id, user_id:u.id }, headers:helixHeaders() }); await i.reply({ content:`✅ ${u.display_name} retiré des modérateurs Twitch.`, flags:64 }); } },
  { data:new SlashCommandBuilder().setName('twitchban').setDescription('Bannir sur Twitch').addStringOption(o=>o.setName('username').setDescription('Nom Twitch').setRequired(true)).addStringOption(o=>o.setName('raison').setDescription('Raison').setRequired(false)).setDMPermission(false),
    async execute(i){ if(need(i)) return; const u=await getUserByLogin(i.options.getString('username')); if(!u) return i.reply({ content:'Utilisateur introuvable.', flags:64 }); const reason=i.options.getString('raison')||'Moderation'; const broadcaster_id=await resolveBroadcasterId(); const moderator_id=broadcaster_id; await axios.post(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${broadcaster_id}&moderator_id=${moderator_id}`, { data:{ user_id:u.id, reason } }, { headers:helixHeaders() }); await i.reply({ content:`✅ ${u.display_name} banni sur Twitch.`, flags:64 }); } },
  { data:new SlashCommandBuilder().setName('twitchtimeout').setDescription('Timeout sur Twitch').addStringOption(o=>o.setName('username').setDescription('Nom Twitch').setRequired(true)).addIntegerOption(o=>o.setName('durée').setDescription('Secondes (1-1209600)').setRequired(true)).addStringOption(o=>o.setName('raison').setDescription('Raison').setRequired(false)).setDMPermission(false),
    async execute(i){ if(need(i)) return; const u=await getUserByLogin(i.options.getString('username')); if(!u) return i.reply({ content:'Utilisateur introuvable.', flags:64 }); const seconds=Math.max(1, Math.min(1209600, i.options.getInteger('durée'))); const reason=i.options.getString('raison')||'Timeout'; const broadcaster_id=await resolveBroadcasterId(); const moderator_id=broadcaster_id; await axios.post(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${broadcaster_id}&moderator_id=${moderator_id}`, { data:{ user_id:u.id, duration: seconds, reason } }, { headers:helixHeaders() }); await i.reply({ content:`✅ ${u.display_name} timeout ${seconds}s sur Twitch.`, flags:64 }); } },
  { data:new SlashCommandBuilder().setName('twitchunban').setDescription('Débannir sur Twitch').addStringOption(o=>o.setName('username').setDescription('Nom Twitch').setRequired(true)).setDMPermission(false),
    async execute(i){ if(need(i)) return; const u=await getUserByLogin(i.options.getString('username')); if(!u) return i.reply({ content:'Utilisateur introuvable.', flags:64 }); const broadcaster_id=await resolveBroadcasterId(); const moderator_id=broadcaster_id; await axios.delete(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${broadcaster_id}&moderator_id=${moderator_id}&user_id=${u.id}`, { headers:helixHeaders() }); await i.reply({ content:`✅ ${u.display_name} débanni sur Twitch.`, flags:64 }); } },
  // {
  //   data: new SlashCommandBuilder()
  //     .setName('twitchlistbans')
  //     .setDescription('Lister les bannis Twitch (Helix)')
  //     .setDMPermission(false)
  //     .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  //   meta: {
  //     adminOnly: true,
  //     guildOnly: true,
  //     cooldownMs: 4000,
  //   },
  //   async execute(interaction) {
  //     await interaction.deferReply();
  //     try {
  //       const bans = await listTwitchBansAll();
  //       if (!bans.length) return interaction.editReply('Aucun utilisateur banni sur Twitch.');
  //       const lines = bans.map(b => {
  //         const name = b.user_name || b.user_login || b.user_id;
  //         const mod  = b.moderator_name || b.moderator_id || '—';
  //         const at   = b.created_at ? new Date(b.created_at).toISOString() : '—';
  //         const exp  = b.expires_at ? new Date(b.expires_at).toISOString() : '—';
  //         return `• ${name} (${b.user_id}) — par ${mod} — ${at} — expire: ${exp}`;
  //       });
  //       const text = lines.join('\n');
  //       if (text.length <= 1900) {
  //         await interaction.editReply(`📕 **Bannis Twitch (${bans.length})**\n${text}`);
  //       } else {
  //         await interaction.editReply(`📕 **Bannis Twitch (${bans.length})** — sortie longue, en plusieurs messages :`);
  //         let chunk = [];
  //         let size = 0;
  //         for (const line of lines) {
  //           if (size + line.length + 1 > 1800) {
  //             await interaction.followUp(chunk.join('\n'));
  //             chunk = [];
  //             size = 0;
  //           }
  //           chunk.push(line);
  //           size += line.length + 1;
  //         }
  //         if (chunk.length) await interaction.followUp(chunk.join('\n'));
  //       }
  //     } catch (e) {
  //       const msg = e?.response?.data?.message || e.message || 'Erreur inconnue';
  //       await interaction.editReply(`❌ twitchlistbans: ${msg}`);
  //     }
  //   }
  // }
];
