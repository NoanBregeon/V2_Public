
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('discordban')
    .setDescription('Bannir un utilisateur')
    .addUserOption(o => o.setName('utilisateur').setDescription('Cible').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),
  meta: { guildOnly: true },
  async execute(interaction) {
    const user = interaction.options.getUser('utilisateur', true);
    const raison = interaction.options.getString('raison') || 'Aucune';
    await interaction.guild.members.ban(user.id, { reason: raison }).catch(()=>{});
    await interaction.reply({ content: `✅ ${user.tag} banni.`, ephemeral: false });
  }
};
