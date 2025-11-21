
const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Vérifier la latence du bot'),
  meta: { guildOnly: true },
  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging…', ephemeral: true, fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(`Pong! Latence: ${latency}ms`);
  }
};
