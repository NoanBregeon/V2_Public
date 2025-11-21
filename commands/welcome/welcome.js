
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

let enabled = true;
let messages = { default: 'Bienvenue {user} !' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Système de bienvenue')
    .addSubcommand(sc => sc.setName('toggle').setDescription('Activer/désactiver').addBooleanOption(o => o.setName('etat').setDescription('true/false').setRequired(true)))
    .addSubcommand(sc => sc.setName('add').setDescription('Ajouter ou éditer un message').addStringOption(o => o.setName('type').setDescription('default').setRequired(true)).addStringOption(o => o.setName('message').setDescription('Modèle').setRequired(true)))
    .addSubcommand(sc => sc.setName('remove').setDescription('Supprimer un type').addStringOption(o => o.setName('type').setDescription('default').setRequired(true)))
    .addSubcommand(sc => sc.setName('test').setDescription('Tester le message'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  meta: { guildOnly: true },
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'toggle') {
      enabled = interaction.options.getBoolean('etat', true);
      return interaction.reply({ content: `Welcome ${enabled ? 'activé' : 'désactivé'}.`, ephemeral: true });
    }
    if (sub === 'add') {
      const type = interaction.options.getString('type', true);
      const msg = interaction.options.getString('message', true);
      messages[type] = msg;
      return interaction.reply({ content: `Message '${type}' enregistré.`, ephemeral: true });
    }
    if (sub === 'remove') {
      const type = interaction.options.getString('type', true);
      delete messages[type];
      return interaction.reply({ content: `Message '${type}' supprimé.`, ephemeral: true });
    }
    if (sub === 'test') {
      const out = (messages.default || 'Bienvenue {user}!').replace('{user}', `<@${interaction.user.id}>`);
      return interaction.reply({ content: out, ephemeral: false });
    }
  }
};
