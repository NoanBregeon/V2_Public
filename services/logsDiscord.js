// services/logsDiscord.js
const { EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = process.env.LOGS_CHANNEL_ID || null;

function humanTime(d = new Date()) {
  return `<t:${Math.floor(new Date(d).getTime()/1000)}:F>`;
}

async function sendLog(client, payload) {
  if (!LOG_CHANNEL_ID) return;
  try {
    const ch = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (!ch || !ch.isTextBased()) return;
    return ch.send({ embeds: [payload] }).catch(() => null);
  } catch (e) {
    console.error('logsDiscord sendLog error', e?.message || e);
  }
}

/** Helpers d'embed */
function baseEmbed({ title, color = 0x2f3136, description = '', fields = [] } = {}) {
  const e = new EmbedBuilder()
    .setTitle(title || 'Log')
    .setColor(color)
    .setDescription(description || null)
    .setTimestamp(new Date());
  if (fields && fields.length) e.addFields(fields);
  return e;
}

module.exports = { sendLog, baseEmbed, humanTime };
