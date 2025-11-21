
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function rows(current, total) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('page:first').setStyle(ButtonStyle.Secondary).setLabel('«'),
      new ButtonBuilder().setCustomId('page:prev').setStyle(ButtonStyle.Secondary).setLabel('‹'),
      new ButtonBuilder().setCustomId('page:next').setStyle(ButtonStyle.Secondary).setLabel('›'),
      new ButtonBuilder().setCustomId('page:last').setStyle(ButtonStyle.Secondary).setLabel('»'),
      new ButtonBuilder().setCustomId('page:stop').setStyle(ButtonStyle.Danger).setLabel('X')
    )
  ];
}

module.exports = { rows };
