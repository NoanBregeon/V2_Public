const fs = require('fs');
const path = require('path');
const { REST, Routes, Collection, Events } = require('discord.js');
const { enforceAdmin } = require('../utils/permissions');

function collectCommands(dir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collectCommands(full, list);
    else if (e.isFile() && e.name.endsWith('.js')) list.push(full);
  }
  return list;
}

async function deployGuildCommands(client) {
  const guildId = process.env.GUILD_ID;
  const appId = process.env.DISCORD_CLIENT_ID;
  if (!guildId || !appId) {
    console.log('⚠️ GUILD_ID ou DISCORD_CLIENT_ID manquant — skip deploy.');
    return;
  }
  const body = [];
  client.commands.forEach(cmd => body.push(cmd.data.toJSON()));
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
  console.log(`🔁 Slash Commands déployées sur la guilde ${guildId} (${client.commands.size} cmds)`);
}

module.exports.register = (client) => {
  const cmdFiles = collectCommands(path.join(__dirname, '..', 'commands'));
  for (const file of cmdFiles) {
    const mod = require(file);
    if (Array.isArray(mod)) {
      for (const c of mod) client.commands.set(c.data.name, c);
    } else if (mod?.data?.name) {
      client.commands.set(mod.data.name, mod);
    }
  }
  console.log(`🔗 Loaded ${client.commands.size} commands`);

  client.on(Events.ClientReady, async () => {
    try {
      if (String(process.env.CLEAN_COMMANDS_ON_START).toLowerCase() === 'true') {
        await deployGuildCommands(client);
      }
    } catch (e) {
      console.error('deploy error:', e);
    }
  });

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return;

      if (cmd.meta?.guildOnly && !interaction.guild) {
        return interaction.reply({ content: 'Commande serveur uniquement.', ephemeral: true });
      }
      if (cmd.meta?.adminOnly) {
        const ok = await enforceAdmin(interaction);
        if (!ok) return;
      }
      await cmd.execute(interaction);
    } catch (err) {
      console.error('interaction error:', err);
      if (interaction.replied || interaction.deferred) {
        interaction.followUp({ content: 'Erreur interne.', ephemeral: true }).catch(()=>{});
      } else {
        interaction.reply({ content: 'Erreur interne.', ephemeral: true }).catch(()=>{});
      }
    }
  });
};
