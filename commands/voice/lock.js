
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder().setName('lock').setDescription('Verrouiller votre salon vocal').setDMPermission(false),
  meta: { guildOnly: true },
  async execute(interaction) {
    const me = await interaction.guild.members.fetch(interaction.user.id);
    const ch = me.voice?.channel;
    if (!ch || ch.type !== 2) return interaction.reply({ content: 'Rejoignez un salon vocal.', ephemeral: true });
    await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false }).catch(()=>{});
    await interaction.reply({ content: 'Salon verrouillé.', ephemeral: true });
  }
};
