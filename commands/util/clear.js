
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprimer des messages (1–100)')
    .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de messages').setMinValue(1).setMaxValue(100).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  meta: { guildOnly: true },
  async execute(interaction) {
    const n = interaction.options.getInteger('nombre');
    const ch = interaction.channel;
    const msgs = await ch.bulkDelete(n, true);
    await interaction.reply({ content: `Supprimé ${msgs.size} messages.`, ephemeral: true });
  }
};
