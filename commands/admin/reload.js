
const { SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { enforceAdmin } = require('../../utils/permissions');

function collect(dir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collect(full, list);
    else if (e.isFile() && e.name.endsWith('.js')) list.push(full);
  }
  return list;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Administration')
    .addSubcommand(sc => sc.setName('reload').setDescription('Recharger et redéployer les commandes'))
    .setDMPermission(false),
  meta: { adminOnly: true, guildOnly: true },
  async execute(interaction) {
    if (!(await enforceAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const client = interaction.client;
    client.commands.clear();
    const files = collect(path.join(__dirname, '..'));
    for (const file of files) {
      delete require.cache[require.resolve(file)];
      const mod = require(file);
      if (Array.isArray(mod)) mod.forEach(c => client.commands.set(c.data.name, c));
      else if (mod?.data?.name) client.commands.set(mod.data.name, mod);
    }

    const appId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.GUILD_ID;
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const body = [];
    client.commands.forEach(cmd => body.push(cmd.data.toJSON()));
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });

    await interaction.editReply(`Rechargé et redéployé ${client.commands.size} commandes.`);
  }
};
