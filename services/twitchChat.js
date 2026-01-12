// services/twitchChat.js
const tmi = require('tmi.js');

// ============================================================
//    STOCKAGE DES RELATIONS TWITCH <-> DISCORD POUR SUPPRESSION
// ============================================================
//
// relayByMsgId:
//   key   = `${channelName}:${twitchMsgId}`
//   value = { channelId, messageId, userId, username }
//
// relayByUserId:
//   key   = `${channelName}:uid:${userId}`
//   value = Set de `${channelId}:${messageId}`
//
// relayByUsername:
//   key   = `${channelName}:un:${username}` (username en minuscule)
//   value = Set de `${channelId}:${messageId}`
//
const relayByMsgId = new Map();
const relayByUserId = new Map();
const relayByUsername = new Map();

// ============================================================
//     BADGES CUSTOM DISCORD (⚠️ REMPLACE LES IDs !!!)
// ============================================================

// Clic droit sur l'emoji -> "Copier l'identifiant" et remplace ID_...
const BADGE_MODO  = '<:badgemodo:1441537294552273089>';
const BADGE_FONDA = '<:badgefonda:1441536069802655886>';
const BADGE_LEAD_MODO = '<:badgemodofirst:1453809360538173539>';

const SUB_BADGES = {
  LYUBAW_1_MOIS:  '<:Lyubaw1mois:1087630336680263722>',
  LYUBAW_2_MOIS:  '<:Lyubaw2mois:1087630387079041075>',
  LYUBAW_3_MOIS:  '<:Lyubaw3mois:1087630423816933436>',
  LYUBAW_6_MOIS:  '<:Lyubaw6Mois:1087630466187800576>',
  LYUBAW_9_MOIS:  '<:Lyubaw9Mois:1087630502426574859>',
  LYUBAW_1_ANS:   '<:Lyubaw1ans:1087630557766242394>',
  LYUBAW_ELITE:   '<:LyubawElite:1087630629304283157>',
  LYUBAW_ELITE2:  '<:LyubawElite2:1087630718168989696>',
  LYUBAW_ELITE3:  '<:LyubawElite3:1087630759822635029>',
  LYUBAW_ELITE4:  '<:LyubawElite4:1087630785504366632>',
};

// ============================================================
//     DÉTERMINATION DU BADGE SUB SELON LES MOIS
// ============================================================

function getSubBadgeEmoji(tags) {
  const badgeInfo = tags['badge-info'] || {};
  const rawMonths = badgeInfo.subscriber;
  const months = parseInt(rawMonths, 10);

  if (!rawMonths || Number.isNaN(months)) {
    return SUB_BADGES.LYUBAW_1_MOIS;
  }

  // Paliers selon ce que tu m'as donné
  if (months <= 2)  return SUB_BADGES.LYUBAW_1_MOIS;
  if (months <= 3)  return SUB_BADGES.LYUBAW_2_MOIS;
  if (months <= 6)  return SUB_BADGES.LYUBAW_3_MOIS;
  if (months <= 9)  return SUB_BADGES.LYUBAW_6_MOIS;
  if (months <= 18) return SUB_BADGES.LYUBAW_9_MOIS;
  if (months <= 30) return SUB_BADGES.LYUBAW_1_ANS;
  if (months <= 42) return SUB_BADGES.LYUBAW_ELITE;
  if (months <= 54) return SUB_BADGES.LYUBAW_ELITE2;
  if (months <= 66) return SUB_BADGES.LYUBAW_ELITE3;
  return SUB_BADGES.LYUBAW_ELITE4;
}

// ============================================================
//     RÉCUPÉRATION DES CHANNELS TWITCH
// ============================================================

function resolveChannels() {
  const raw =
    (process.env.TWITCH_CHANNELS && process.env.TWITCH_CHANNELS.trim()) ||
    (process.env.STREAMER_USERNAME && process.env.STREAMER_USERNAME.trim()) ||
    '';

  return raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

// ============================================================
//     HELPERS SUPPRESSION DISCORD
// ============================================================

async function deleteDiscordMessage(client, channelId, messageId) {
  try {
    const discordChannel = await client.channels.fetch(channelId).catch(() => null);
    if (!discordChannel || !discordChannel.isTextBased()) return;
    const msg = await discordChannel.messages.fetch(messageId).catch(() => null);
    if (!msg) return;
    await msg.delete().catch(() => {});
  } catch {
    // on évite de spammer la console
  }
}

async function deleteAllForUserKey(map, key, client) {
  const entries = map.get(key);
  if (!entries || !entries.size) return;

  map.delete(key);

  for (const entry of entries) {
    const [channelId, messageId] = entry.split(':');
    await deleteDiscordMessage(client, channelId, messageId);
  }
}

// ============================================================
//     RELAY TWITCH → DISCORD
// ============================================================

function startTwitchRelay(client) {
  const relayChannelId = process.env.TWITCH_RELAY_CHANNEL_ID;
  const channels = resolveChannels();

  if (!relayChannelId || !channels.length) {
    console.log('[TwitchRelay] Config incomplète : pas de salon Discord ou pas de channel Twitch.');
    return;
  }

  if (!process.env.TWITCH_BOT_USERNAME || !process.env.TWITCH_BOT_TOKEN) {
    console.log('[TwitchRelay] TWITCH_BOT_USERNAME / TWITCH_BOT_TOKEN manquants.');
    return;
  }

  const twitchClient = new tmi.Client({
    connection: { secure: true, reconnect: true },
    identity: {
      username: process.env.TWITCH_BOT_USERNAME,
      password: process.env.TWITCH_BOT_TOKEN, // "oauth:xxxxx"
    },
    channels,
  });

  twitchClient
    .connect()
    .then(() => {
      console.log('[TwitchRelay] Connecté aux chats Twitch :', channels.join(', '));
    })
    .catch((err) => {
      console.error('[TwitchRelay] Erreur de connexion Twitch :', err.message);
    });

  // ===========================
  //   MESSAGE TWITCH → DISCORD
  // ===========================
  twitchClient.on('message', async (channel, tags, message, self) => {
    if (self) return;

    const discordChannel = await client.channels.fetch(relayChannelId).catch(() => null);
    if (!discordChannel || !discordChannel.isTextBased()) return;

    const channelName = channel.replace('#', '');
    const login = (tags.username || '').toLowerCase();
    const userId = tags['user-id'] || null;
    const displayName = tags['display-name'] || login || 'Unknown';

    // Nettoyage éventuel du /me, si activé
    const removeFormat = (process.env.TWITCH_REMOVE_FORMAT || '').toLowerCase() === 'true';
    let content = message;
    if (removeFormat) {
      content = content.replace(/^\u0001ACTION (.*)\u0001$/, '$1');
    }

    // Badges
    const badges = tags.badges || {};
    const badgeList = [];

    if (badges.broadcaster) badgeList.push('📺');

    // ajouter la check Lead Mod avant tout
    if (badges['lead_moderator']) badgeList.push(BADGE_LEAD_MODO);
    else if (badges.moderator) badgeList.push(BADGE_MODO);

    if (badges.vip) badgeList.push('💎');

    if (badges.founder) {
      badgeList.push(BADGE_FONDA);
      // Si tu veux cumuler fondateur + rang sub, tu peux aussi faire :
      // if (badges.subscriber) badgeList.push(getSubBadgeEmoji(tags));
    } else if (badges.subscriber) {
      badgeList.push(getSubBadgeEmoji(tags));
    }

    const badgeString = badgeList.slice(0, 3).join(' ');
    const prefix = badgeString
      ? `[${channelName}] ${badgeString} **${displayName}**`
      : `[${channelName}] **${displayName}**`;

    const sent = await discordChannel.send(`${prefix} : ${content}`).catch(() => null);
    if (!sent) return;

    const twitchMsgId = tags.id;

    // Sauvegarde par message
    if (twitchMsgId) {
      relayByMsgId.set(`${channelName}:${twitchMsgId}`, {
        channelId: relayChannelId,
        messageId: sent.id,
        userId,
        username: login,
      });
    }

    // Sauvegarde par userId
    if (userId) {
      const keyId = `${channelName}:uid:${userId}`;
      if (!relayByUserId.has(keyId)) relayByUserId.set(keyId, new Set());
      relayByUserId.get(keyId).add(`${relayChannelId}:${sent.id}`);
    }

    // Sauvegarde par username
    if (login) {
      const keyName = `${channelName}:un:${login}`;
      if (!relayByUsername.has(keyName)) relayByUsername.set(keyName, new Set());
      relayByUsername.get(keyName).add(`${relayChannelId}:${sent.id}`);
    }
  });

  // =================================
  //   MESSAGE SUPPRIMÉ SUR TWITCH
  // =================================
  twitchClient.on('messagedeleted', async (channel, username, deletedMessage, state) => {
    const twitchMsgId = state['target-msg-id'];
    if (!twitchMsgId) return;

    const channelName = channel.replace('#', '');
    const key = `${channelName}:${twitchMsgId}`;
    const entry = relayByMsgId.get(key);
    if (!entry) return;

    relayByMsgId.delete(key);

    const { channelId, messageId, userId, username: storedLogin } = entry;

    await deleteDiscordMessage(client, channelId, messageId);

    // Nettoyage userId
    if (userId) {
      const keyId = `${channelName}:uid:${userId}`;
      const set = relayByUserId.get(keyId);
      if (set) {
        set.delete(`${channelId}:${messageId}`);
        if (!set.size) relayByUserId.delete(keyId);
      }
    }

    // Nettoyage username
    if (storedLogin) {
      const keyName = `${channelName}:un:${storedLogin}`;
      const set = relayByUsername.get(keyName);
      if (set) {
        set.delete(`${channelId}:${messageId}`);
        if (!set.size) relayByUsername.delete(keyName);
      }
    }
  });

  // ================================
  //     BAN
  // ================================
  twitchClient.on('ban', async (channel, username, reason, userstate) => {
    const channelName = channel.replace('#', '');
    const login = username ? username.toLowerCase() : null;
    const targetUserId =
      (userstate && (userstate['target-user-id'] || userstate['user-id'])) || null;

    console.log('[TwitchRelay] ban reçu :', {
      channel: channelName,
      username: login,
      targetUserId,
      reason,
    });

    if (targetUserId) {
      const keyId = `${channelName}:uid:${targetUserId}`;
      await deleteAllForUserKey(relayByUserId, keyId, client);
    }

    if (login) {
      const keyName = `${channelName}:un:${login}`;
      await deleteAllForUserKey(relayByUsername, keyName, client);
    }
  });

  // ================================
  //     TIMEOUT
  // ================================
  twitchClient.on('timeout', async (channel, username, reason, duration, userstate) => {
    const channelName = channel.replace('#', '');
    const login = username ? username.toLowerCase() : null;
    const targetUserId =
      (userstate && (userstate['target-user-id'] || userstate['user-id'])) || null;

    console.log('[TwitchRelay] timeout reçu :', {
      channel: channelName,
      username: login,
      targetUserId,
      duration,
      reason,
    });

    if (targetUserId) {
      const keyId = `${channelName}:uid:${targetUserId}`;
      await deleteAllForUserKey(relayByUserId, keyId, client);
    }

    if (login) {
      const keyName = `${channelName}:un:${login}`;
      await deleteAllForUserKey(relayByUsername, keyName, client);
    }
  });

  // ================================
  //     CLEARCHAT (éventuel)
// ================================
  twitchClient.on('clearchat', async (channel, username, state) => {
    const channelName = channel.replace('#', '');
    const login = username ? username.toLowerCase() : null;
    const targetUserId = state && (state['target-user-id'] || state['user-id']) || null;

    console.log('[TwitchRelay] clearchat reçu :', {
      channel: channelName,
      username: login,
      targetUserId,
    });

    // /clear global -> rien à faire côté Discord
    if (!login && !targetUserId) return;

    if (targetUserId) {
      const keyId = `${channelName}:uid:${targetUserId}`;
      await deleteAllForUserKey(relayByUserId, keyId, client);
    }

    if (login) {
      const keyName = `${channelName}:un:${login}`;
      await deleteAllForUserKey(relayByUsername, keyName, client);
    }
  });

  twitchClient.on('connected', (addr, port) => {
    console.log(`[TwitchRelay] Connecté au réseau IRC Twitch (${addr}:${port}).`);
  });

  twitchClient.on('disconnected', (reason) => {
    console.warn('[TwitchRelay] Déconnecté de Twitch :', reason);
  });
}

module.exports = { startTwitchRelay };
