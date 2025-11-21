
const { PermissionFlagsBits } = require('discord.js');

function isAdmin(member) {
  if (!member) return false;
  if (member.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  if (adminRoleId && member.roles?.cache?.has?.(adminRoleId)) return true;
  if (member.guild?.ownerId && member.id === member.guild.ownerId) return true;
  return false;
}

async function enforceAdmin(interaction) {
  if (isAdmin(interaction.member)) return true;
  await interaction.reply({ content: '⛔ Commande réservée aux administrateurs.', ephemeral: true }).catch(()=>{});
  return false;
}

module.exports = { isAdmin, enforceAdmin };
