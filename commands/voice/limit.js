
const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('limit')
    .setDescription('Limiter le nombre d’utilisateurs dans votre salon vocal')
    .addIntegerOption(o => o.setName('nombre').setDescription('0 = illimité').setMinValue(0).setMaxValue(99).setRequired(true))
    .setDMPermission(false),
  meta: { guildOnly: true },
  async execute(interaction) {
    const me = await interaction.guild.members.fetch(interaction.user.id);
    const ch = me.voice?.channel;
    if (!ch || ch.type !== 2) return interaction.reply({ content: 'Rejoignez un salon vocal.', ephemeral: true });
    await ch.setUserLimit(interaction.options.getInteger('nombre'));
    await interaction.reply({ content: 'Limite mise à jour.', ephemeral: true });
  }
};
