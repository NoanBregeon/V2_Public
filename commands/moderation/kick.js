
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulser un utilisateur')
    .addUserOption(o => o.setName('utilisateur').setDescription('Cible').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false),
  meta: { guildOnly: true },
  async execute(interaction) {
    const member = await interaction.guild.members.fetch(interaction.options.getUser('utilisateur').id).catch(()=>null);
    const raison = interaction.options.getString('raison') || 'Aucune';
    if (!member) return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });
    await member.kick(raison).catch(()=>{});
    await interaction.reply({ content: `✅ ${member.user.tag} expulsé.`, ephemeral: false });
  }
};
