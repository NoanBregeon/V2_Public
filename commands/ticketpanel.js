
const {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');

const OPEN_ID = 'ticket:open';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Publier un panneau pour ouvrir des tickets (embed + bouton).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption(o => o.setName('salon').setDescription('Salon cible').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption(o => o.setName('titre').setDescription('Titre embed').setRequired(false))
    .addStringOption(o => o.setName('message').setDescription('Description embed').setRequired(false)),
  meta: { adminOnly: true, guildOnly: true },
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getChannel('salon');
    const title = interaction.options.getString('titre') || 'Support / Tickets';
    const desc = interaction.options.getString('message') || 'Cliquez sur le bouton pour ouvrir un ticket. Un membre du staff vous répondra.';
    const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x2b2d31).setTimestamp(new Date());
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(OPEN_ID).setLabel('Ouvrir un ticket').setStyle(ButtonStyle.Success)
    );
    const msg = await target.send({ embeds: [embed], components: [row] });
    await interaction.editReply(`Panneau envoyé dans ${target} (message ${msg.id}).`);
  }
};
