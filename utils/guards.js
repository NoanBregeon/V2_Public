const { PermissionFlagsBits, ChannelType } = require('discord.js');

const cooldowns = new Map();

async function safeReplyEphemeral(interaction, content) {
  const payload = { content, flags: 64 }; // ephemeral
  try {
    if (interaction.replied || interaction.deferred) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch {}
}

function hasPerm(member, perm) {
  try { return member?.permissions?.has?.(perm); } catch { return false; }
}

async function ensure(interaction, cmd) {
  const meta = cmd?.meta || {};
  const member = interaction.member;

  // 1) DM/Guild rules
  const guildOnly = meta.guildOnly !== false;
  const dmAllowed = meta.dmAllowed === true;
  if (!interaction.inGuild()) {
    if (guildOnly && !dmAllowed) {
      await safeReplyEphemeral(interaction, 'Cette commande doit être utilisée dans un serveur.');
      return true;
    }
  }

  // 2) Allowed guilds
  if (interaction.inGuild() && Array.isArray(meta.allowedGuilds) && meta.allowedGuilds.length) {
    if (!meta.allowedGuilds.includes(interaction.guildId)) {
      await safeReplyEphemeral(interaction, 'Cette commande n’est pas disponible sur ce serveur.');
      return true;
    }
  }

  // 3) Allowed channels
  if (interaction.channelId && Array.isArray(meta.allowedChannels) && meta.allowedChannels.length) {
    if (!meta.allowedChannels.includes(interaction.channelId)) {
      await safeReplyEphemeral(interaction, 'Cette commande n’est pas autorisée dans ce salon.');
      return true;
    }
  }

  // 4) Channel type restriction
  if (interaction.channel && Array.isArray(meta.channelTypes) && meta.channelTypes.length) {
    if (!meta.channelTypes.includes(interaction.channel.type)) {
      await safeReplyEphemeral(interaction, 'Cette commande n’est pas autorisée dans ce type de salon.');
      return true;
    }
  }

  // 5) Owner only
  if (meta.ownerOnly) {
    const ownerId = process.env.OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
      await safeReplyEphemeral(interaction, 'Commande réservée au propriétaire du bot.');
      return true;
    }
  }

  // 6) Admin only (Administrator perm OR ADMIN_ROLE_ID)
  if (interaction.inGuild() && meta.adminOnly) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    const isAdminPerm = hasPerm(member, PermissionFlagsBits.Administrator);
    const hasAdminRole = adminRoleId ? member?.roles?.cache?.has(adminRoleId) : false;
    if (!isAdminPerm && !hasAdminRole) {
      await safeReplyEphemeral(interaction, 'Commande réservée aux administrateurs.');
      return true;
    }
  }

  // 7) Required member permissions
  if (interaction.inGuild() && Array.isArray(meta.requiredPermissions) && meta.requiredPermissions.length) {
    if (!member?.permissions?.has?.(meta.requiredPermissions)) {
      await safeReplyEphemeral(interaction, `Permissions requises: ${meta.requiredPermissions.join(', ')}`);
      return true;
    }
  }

  // 8) Required roles
  if (interaction.inGuild() && Array.isArray(meta.requiredRoles) && meta.requiredRoles.length) {
    const ok = meta.requiredRoles.some(id => member?.roles?.cache?.has(id));
    if (!ok) {
      await safeReplyEphemeral(interaction, `Rôle requis: ${meta.requiredRoles.map(r => `<@&${r}>`).join(', ')}`);
      return true;
    }
  }

  // 9) Cooldown
  const cd = meta.cooldownMs || 0;
  if (cd > 0) {
    const key = `${interaction.commandName}:${interaction.user.id}`;
    const last = cooldowns.get(key) || 0;
    const now = Date.now();
    if (now - last < cd) {
      const remain = Math.ceil((cd - (now - last)) / 1000);
      await safeReplyEphemeral(interaction, `⌛ Merci d'attendre ${remain}s avant de réutiliser cette commande.`);
      return true;
    }
    cooldowns.set(key, now);
    setTimeout(() => cooldowns.delete(key), cd);
  }

  return false; // OK
}

module.exports = { ensure };