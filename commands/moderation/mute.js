
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Muter un utilisateur (timeout)')
    .addUserOption(o => o.setName('utilisateur').setDescription('Cible').setRequired(true))
    .addIntegerOption(o => o.setName('durée').setDescription('Durée en minutes').setMinValue(1).setMaxValue(10080).setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  meta: { guildOnly: true },
  async execute(interaction) {
    const member = await interaction.guild.members.fetch(interaction.options.getUser('utilisateur').id).catch(()=>null);
    const minutes = interaction.options.getInteger('durée', true);
    const raison = interaction.options.getString('raison') || 'Aucune';
    if (!member) return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });
    const ms = minutes * 60 * 1000;
    await member.timeout(ms, raison).catch(()=>{});
    await interaction.reply({ content: `✅ ${member.user.tag} muté ${minutes} min.`, ephemeral: false });
  }
};
