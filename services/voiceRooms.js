// services/voiceRooms.js
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const STORE = path.join(__dirname, '../data/voiceRooms.json');

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE, 'utf8'));
  } catch {
    return { owners: {} }; // { [channelId]: userId }
  }
}
function saveStore(data) {
  try {
    fs.mkdirSync(path.dirname(STORE), { recursive: true });
    fs.writeFileSync(STORE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('❌ voiceRooms save error:', e?.message || e);
  }
}

const db = loadStore();

function cfg() {
  return {
    hubId: process.env.CREATE_VOICE_CHANNEL_ID,
    parentId: process.env.VOICE_CATEGORY_ID || null,
    nameTpl: process.env.VOICE_NAME_TEMPLATE || '🔊│{user}',
    baseUserLimit: parseInt(process.env.VOICE_DEFAULT_LIMIT || '0', 10), // 0 = illimité
  };
}

function buildOverwrites(guild, ownerId) {
  return [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
    { id: ownerId, allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.Stream,
        PermissionFlagsBits.UseVAD,
        PermissionFlagsBits.ManageChannels
      ]},
  ];
}

async function createPersonalChannel(guild, member) {
  const c = cfg();
  const name = c.nameTpl.replace('{user}', member.user.username);
  const overwrites = buildOverwrites(guild, member.id);

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: c.parentId || undefined,
    userLimit: Number.isFinite(c.baseUserLimit) ? c.baseUserLimit : 0,
    permissionOverwrites: overwrites,
    reason: `Salon perso pour ${member.user.tag}`
  });

  // persist owner
  db.owners[channel.id] = member.id;
  saveStore(db);

  return channel;
}

function shouldDelete(channel) {
  const looksLikeTemp = channel.name.startsWith('🔊') || channel.name.includes('│');
  return channel.members.size === 0 && looksLikeTemp && db.owners[channel.id];
}

async function handleJoin(oldState, newState) {
  const c = cfg();
  if (!c.hubId) return;
  // entrée dans le hub
  if (!oldState.channelId && newState.channelId === c.hubId) {
    const guild = newState.guild;
    const member = newState.member;
    try {
      const created = await createPersonalChannel(guild, member);
      await member.voice.setChannel(created.id).catch(() => {});
    } catch (e) {
      console.error('❌ voiceRooms create error:', e?.message || e);
    }
  }
}

async function handleLeave(oldState, _newState) {
  if (oldState.channel && oldState.channel.members.size === 0) {
    if (shouldDelete(oldState.channel)) {
      const id = oldState.channel.id;
      await oldState.channel.delete('Salon vocal perso vide (auto-suppression)').catch(() => {});
      delete db.owners[id];
      saveStore(db);
    }
  }
}

function isOwner(channelId, userId) {
  // propriétaire explicite en base
  if (db.owners[channelId] && db.owners[channelId] === userId) return true;
  return false;
}

async function transferOwnership(channel, newOwnerId) {
  db.owners[channel.id] = newOwnerId;
  saveStore(db);
  // donner les perms de gestion au nouveau proprio
  await channel.permissionOverwrites.edit(newOwnerId, {
    ManageChannels: true, Connect: true, Speak: true, Stream: true, UseVAD: true, ViewChannel: true
  }).catch(() => {});
}

module.exports = {
  onVoiceStateUpdate: async (oldState, newState) => {
    try {
      if (newState.channelId) await handleJoin(oldState, newState);
      await handleLeave(oldState, newState);
    } catch (e) {
      console.error('❌ voiceRooms onVoiceStateUpdate:', e?.message || e);
    }
  },
  isOwner,
  transferOwnership,
};
