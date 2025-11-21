
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Débannir un utilisateur (ID)')
    .addStringOption(o => o.setName('userid').setDescription('ID utilisateur').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),
  meta: { guildOnly: true },
  async execute(interaction) {
    const id = interaction.options.getString('userid', true);
    await interaction.guild.bans.remove(id).catch(()=>{});
    await interaction.reply({ content: `✅ ${id} débanni.`, ephemeral: false });
  }
};
