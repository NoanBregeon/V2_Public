const {
  SlashCommandBuilder, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType
} = require('discord.js');
const axios = require('axios');
const { helixHeaders, resolveBroadcasterId } = require('../services/twitch');

// Récupère TOUTES les entrées de bans via Helix
async function listTwitchBansAll() {
  const broadcaster_id = await resolveBroadcasterId();
  const out = [];
  let cursor = null;
  while (true) {
    const params = { broadcaster_id, first: 100 };
    if (cursor) params.after = cursor;
    const r = await axios.get('https://api.twitch.tv/helix/moderation/banned', {
      headers: helixHeaders(), params
    });
    const data = r.data?.data ?? [];
    out.push(...data);
    cursor = r.data?.pagination?.cursor || null;
    if (!cursor || data.length === 0) break;
  }
  return out;
}

function formatLine(b) {
  const name = b.user_name || b.user_login || b.user_id;
  const mod  = b.moderator_name || b.moderator_id || '—';
  const at   = b.created_at ? `<t:${Math.floor(new Date(b.created_at).getTime()/1000)}:R>` : '—';
  const exp  = b.expires_at ? `<t:${Math.floor(new Date(b.expires_at).getTime()/1000)}:R>` : '—';
  return `• **${name}** \`(${b.user_id})\` — par *${mod}* — ${at} — expire: ${exp}`;
}

function paginate(items, perPage = 10) {
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages;
}

function pageEmbed(allCount, pageIndex, totalPages, pageItems) {
  const desc = pageItems.map(formatLine).join('\n') || '_Aucun résultat sur cette page_';
  return new EmbedBuilder()
    .setTitle(`📕 Bannis Twitch — ${allCount} au total`)
    .setDescription(desc)
    .setColor(0x9146FF)
    .setFooter({ text: `Page ${pageIndex + 1} / ${totalPages}` })
    .setTimestamp(new Date());
}

function navRow(nonce, pageIndex, totalPages) {
  const atFirst = pageIndex <= 0;
  const atLast = pageIndex >= totalPages - 1;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tbans:${nonce}:first`).setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(atFirst),
    new ButtonBuilder().setCustomId(`tbans:${nonce}:prev`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(atFirst),
    new ButtonBuilder().setCustomId(`tbans:${nonce}:next`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(atLast),
    new ButtonBuilder().setCustomId(`tbans:${nonce}:last`).setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(atLast),
    new ButtonBuilder().setCustomId(`tbans:${nonce}:close`).setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
}
function disableRow(row) {
  const r = ActionRowBuilder.from(row);
  r.components = r.components.map(c => ButtonBuilder.from(c).setDisabled(true));
  return r;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitchbans') // <<< nom différent, pas de collision
    .setDescription('Lister les bannis Twitch (embed paginé)')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  meta: {
    adminOnly: true,
    guildOnly: true,
    cooldownMs: 4000,
    // allowedChannels: [process.env.STAFF_MOD_CHANNEL_ID || process.env.MODERATION_CHANNEL_ID].filter(Boolean), // optionnel
  },

  async execute(interaction) {
    await interaction.deferReply(); // public
    let bans;
    try {
      bans = await listTwitchBansAll();
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || 'Erreur inconnue';
      return interaction.editReply(`❌ Erreur Helix: ${msg}`);
    }
    if (!bans.length) return interaction.editReply('Aucun utilisateur banni sur Twitch.');

    const perPage = 25;
    const pages = paginate(bans, perPage);
    const totalPages = pages.length;
    let pageIndex = 0;
    const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2,8);

    const embed = pageEmbed(bans.length, pageIndex, totalPages, pages[pageIndex]);
    const row = navRow(nonce, pageIndex, totalPages);
    const msg = await interaction.editReply({ embeds: [embed], components: [row] });

    const filter = (btnInt) => {
      if (!btnInt.customId.startsWith(`tbans:${nonce}:`)) return false;
      const isInvoker = btnInt.user.id === interaction.user.id;
      const isAdminPerm = btnInt.member?.permissions?.has?.(PermissionFlagsBits.Administrator);
      const hasAdminRole = process.env.ADMIN_ROLE_ID && btnInt.member?.roles?.cache?.has(process.env.ADMIN_ROLE_ID);
      return isInvoker || isAdminPerm || hasAdminRole;
    };

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000,
      filter
    });

    collector.on('collect', async (btn) => {
      const action = btn.customId.split(':')[2];
      if (action === 'close') {
        await btn.update({ components: [disableRow(msg.components[0])] }).catch(() => {});
        return collector.stop('closed');
      }
      if (action === 'first') pageIndex = 0;
      else if (action === 'prev') pageIndex = Math.max(0, pageIndex - 1);
      else if (action === 'next') pageIndex = Math.min(totalPages - 1, pageIndex + 1);
      else if (action === 'last') pageIndex = totalPages - 1;

      const newEmbed = pageEmbed(bans.length, pageIndex, totalPages, pages[pageIndex]);
      const newRow = navRow(nonce, pageIndex, totalPages);
      await btn.update({ embeds: [newEmbed], components: [newRow] }).catch(() => {});
    });

    collector.on('end', async () => {
      try {
        const current = await interaction.fetchReply();
        const disabled = [disableRow(current.components[0])];
        await interaction.editReply({ components: disabled });
      } catch {}
    });
  }
};
