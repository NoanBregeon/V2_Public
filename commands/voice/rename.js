
const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Renommer votre salon vocal (salon temporaire)')
    .addStringOption(o => o.setName('nom').setDescription('Nouveau nom').setRequired(true))
    .setDMPermission(false),
  meta: { guildOnly: true },
  async execute(interaction) {
    const me = await interaction.guild.members.fetch(interaction.user.id);
    const ch = me.voice?.channel;
    if (!ch || ch.type !== 2) return interaction.reply({ content: 'Rejoignez un salon vocal.', ephemeral: true });
    await ch.setName(interaction.options.getString('nom'));
    await interaction.reply({ content: 'Salon renommé.', ephemeral: true });
  }
};
