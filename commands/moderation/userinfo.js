
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Informations sur un utilisateur')
    .addUserOption(o => o.setName('utilisateur').setDescription('Cible').setRequired(false))
    .setDMPermission(false),
  meta: { guildOnly: true },
  async execute(interaction) {
    const user = interaction.options.getUser('utilisateur') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(()=>null);
    const embed = new EmbedBuilder()
      .setTitle(user.tag)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Créé le', value: `<t:${Math.floor(user.createdTimestamp/1000)}:F>`, inline: true },
        { name: 'Rejoint le', value: member ? `<t:${Math.floor(member.joinedTimestamp/1000)}:F>` : 'N/A', inline: true }
      )
      .setColor(0x2b2d31);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
