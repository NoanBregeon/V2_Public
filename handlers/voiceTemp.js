// handlers/voiceTemp.js
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/voiceRooms.json');

// =========================
// STORAGE
// =========================
let store = { rooms: {} };

function loadStore() {
  try {
    store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    store = { rooms: {} };
  }
}

function saveStore() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function registerRoom(channelId, ownerId) {
  store.rooms[channelId] = {
    owner: ownerId,
    created: Date.now()
  };
  saveStore();
}

function unregisterRoom(channelId) {
  if (store.rooms[channelId]) {
    delete store.rooms[channelId];
    saveStore();
  }
}

function isOwner(channelId, userId) {
  return store.rooms[channelId]?.owner === userId;
}

function userAlreadyHasRoom(userId) {
  return Object.values(store.rooms).some(r => r.owner === userId);
}

// =========================
// INFO MESSAGE (Text-in-Voice)
// =========================
function sendVoiceInfoMessage(voiceChannel, ownerId) {
  setTimeout(async () => {
    try {
      if (typeof voiceChannel.send !== 'function') return;

      await voiceChannel.send({
        content:
          `🎧 **Salon vocal créé !**\n` +
          `<@${ownerId}>, tu es le propriétaire de ce salon.\n\n` +
          `📌 **Commandes disponibles :**\n` +
          `• \`/rename <nom>\` → Renommer le salon\n` +
          `• \`/limit <nombre>\` → Limiter le nombre de personnes\n` +
          `• \`/lock\` → Verrouiller le salon\n` +
          `• \`/unlock\` → Déverrouiller le salon\n\n` +
          `🗑️ Le salon sera automatiquement supprimé quand il sera vide.`
      });
    } catch (err) {
      console.error('[voiceTemp] sendVoiceInfoMessage error:', err);
    }
  }, 1000);
}

// =========================
// OWNER TRANSFER
// =========================
function transferOwnership(channel, newOwnerId) {
  if (!store.rooms[channel.id]) return;

  store.rooms[channel.id].owner = newOwnerId;
  saveStore();

  channel.permissionOverwrites.edit(newOwnerId, {
    ViewChannel: true,
    Connect: true,
    ManageChannels: true,
    MoveMembers: true
  }).catch(() => {});
}

// =========================
// SAFE DELETE
// =========================
function deleteIfStillEmpty(channel, delay = 3000) {
  setTimeout(async () => {
    try {
      const fresh = await channel.guild.channels.fetch(channel.id).catch(() => null);
      if (!fresh) return;

      if (fresh.members.size === 0) {
        unregisterRoom(fresh.id);
        await fresh.delete('Salon vocal temporaire vide').catch(() => {});
      }
    } catch {
      // silence
    }
  }, delay);
}

// =========================
// INIT
// =========================
loadStore();

// =========================
// HANDLER
// =========================
module.exports = {
  register(client) {
    client.on('voiceStateUpdate', async (oldState, newState) => {
      try {
        const guild = newState.guild || oldState.guild;
        const member = newState.member || oldState.member;
        if (!guild || !member || member.user.bot) return;

        const createId = process.env.CREATE_VOICE_CHANNEL_ID;
        const categoryId = process.env.VOICE_CATEGORY_ID;
        if (!createId || !categoryId) return;

        const oldCh = oldState.channel;
        const newCh = newState.channel;

        // =========================
        // CREATE TEMP VOICE
        // =========================
        if (
          newCh &&
          newCh.id === createId &&
          (!oldCh || oldCh.id !== createId) &&
          !userAlreadyHasRoom(member.id)
        ) {
          const category = guild.channels.cache.get(categoryId);
          if (!category || category.type !== ChannelType.GuildCategory) return;

          const template = process.env.VOICE_NAME_TEMPLATE || '🔊 {user}';
          const name = template.replace(
            '{user}',
            member.displayName || member.user.username
          );

          const voice = await guild.channels.create({
            name,
            type: ChannelType.GuildVoice,
            parent: categoryId,
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.Connect
                ]
              },
              {
                id: member.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.MoveMembers
                ]
              }
            ],
            reason: `Salon vocal temporaire créé pour ${member.user.tag}`
          });

          registerRoom(voice.id, member.id);
          await member.voice.setChannel(voice).catch(() => {});
          sendVoiceInfoMessage(voice, member.id);
          return;
        }

        // =========================
        // OWNER LEAVE / DELETE
        // =========================
        if (
          oldCh &&
          oldCh.parentId === categoryId &&
          oldCh.id !== createId
        ) {
          const room = store.rooms[oldCh.id];

          // transfert automatique si l'owner quitte
          if (room && room.owner === member.id) {
            const remaining = [...oldCh.members.values()].filter(m => m.id !== member.id);

            if (remaining.length > 0) {
              const newOwner = remaining[0];
              transferOwnership(oldCh, newOwner.id);

              if (typeof oldCh.send === 'function') {
                oldCh.send({
                  content: `👑 <@${newOwner.id}> est maintenant propriétaire du salon.`
                }).catch(() => {});
              }
            }
          }

          deleteIfStillEmpty(oldCh, 3000);
        }
      } catch (err) {
        console.error('[voiceTemp] error:', err);
      }
    });

    // =========================
    // API POUR COMMANDES /voice
    // =========================
    client.voiceTemp = {
      isOwner,
      getOwner(channelId) {
        return store.rooms[channelId]?.owner || null;
      },
      transferOwnership
    };
  }
};
