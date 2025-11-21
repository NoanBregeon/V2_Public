
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { helixHeaders, resolveBroadcasterId } = require('../../services/twitch');
const { rows } = require('../../utils/paginator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitchlistbans')
    .setDescription('Lister les bannis Twitch (pagination)')
    .setDMPermission(false),
  meta: { adminOnly: true, guildOnly: true, cooldownMs: 3000 },
  async execute(interaction) {
    await interaction.deferReply();
    const broadcaster_id = await resolveBroadcasterId();

    async function fetchPage(cursor = null) {
      const params = { broadcaster_id, first: 100 };
      if (cursor) params.after = cursor;
      const r = await axios.get('https://api.twitch.tv/helix/moderation/banned', { params, headers: helixHeaders() });
      return r.data;
    }

    const all = [];
    let cursor = null, loops = 0;
    do {
      const data = await fetchPage(cursor);
      all.push(...(data.data || []));
      cursor = data.pagination?.cursor || null;
      loops++;
    } while (cursor && loops < 10);

    if (all.length === 0) {
      return interaction.editReply('Aucun utilisateur banni.');
    }

    const pageSize = 10;
    const pages = Math.ceil(all.length / pageSize);
    let idx = 0;

    function buildEmbed(i) {
      const slice = all.slice(i*pageSize, (i+1)*pageSize);
      const lines = slice.map(b => `• **${b.user_name}** (${b.user_id}) — ${b.expires_at ? `expire: ${b.expires_at}` : 'permanent'}`);
      return new EmbedBuilder()
        .setTitle(`Twitch Bans — page ${i+1}/${pages}`)
        .setDescription(lines.join('\\n'))
        .setColor(0x6441A5);
    }

    const msg = await interaction.editReply({ embeds: [buildEmbed(idx)], components: rows(idx+1, pages) });

    const collector = msg.createMessageComponentCollector({ time: 5 * 60 * 1000 });
    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) return i.reply({ content: 'Seul l’initiateur peut naviguer.', ephemeral: true });
      const id = i.customId;
      if (id === 'page:first') idx = 0;
      else if (id === 'page:prev') idx = Math.max(0, idx - 1);
      else if (id === 'page:next') idx = Math.min(pages - 1, idx + 1);
      else if (id === 'page:last') idx = pages - 1;
      else if (id === 'page:stop') { collector.stop('user'); return i.update({ components: [] }); }

      await i.update({ embeds: [buildEmbed(idx)], components: rows(idx+1, pages) });
    });

    collector.on('end', async () => {
      try { await interaction.editReply({ components: [] }); } catch {}
    });
  }
};
