const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lead')
    .setDescription('Transférer la propriété du salon vocal')
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('Utilisateur à qui donner le lead')
        .setRequired(true)
    )
    .setDMPermission(false),

  meta: { guildOnly: true },

  async execute(interaction) {
    const me = await interaction.guild.members.fetch(interaction.user.id);
    const channel = me.voice?.channel;

    if (!channel || channel.type !== 2) {
      return interaction.reply({
        content: '❌ Tu dois être dans ton salon vocal.',
        flags: MessageFlags.Ephemeral
      });
    }

    const voiceTemp = interaction.client.voiceTemp;

    // 🔒 Sécurité : handler vocal bien initialisé ?
    if (!voiceTemp || typeof voiceTemp.transferOwnership !== 'function') {
      return interaction.reply({
        content: '❌ Erreur interne : gestion vocale non initialisée.',
        flags: MessageFlags.Ephemeral
      });
    }

    const ownerId = voiceTemp.getOwner(channel.id);

    if (ownerId !== me.id) {
      return interaction.reply({
        content: '❌ Tu n’es pas le propriétaire du salon.',
        flags: MessageFlags.Ephemeral
      });
    }

    const target = interaction.options.getMember('user');

    if (!target || target.voice?.channelId !== channel.id) {
      return interaction.reply({
        content: '❌ L’utilisateur doit être dans le même salon vocal.',
        flags: MessageFlags.Ephemeral
      });
    }

    // ✅ Transfert réel
    voiceTemp.transferOwnership(channel, target.id);

    return interaction.reply({
      content:
        `👑 <@${target.id}> tu as maintenant le **lead du salon vocal**.\n` +
        `🎙️ Tu peux gérer le salon (déplacements, permissions, etc.).`
    });
  }
};
