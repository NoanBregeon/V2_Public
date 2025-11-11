const { Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { ensure } = require('../utils/guards');

class CommandHandler {
  constructor(client, config){ this.client=client; this.config=config; this.commands=new Collection(); }

  async loadCommands(){
    this.commands.clear();
    const dir = path.join(__dirname, '../commands');
    if (!fs.existsSync(dir)) return console.warn('⚠️ commands/ manquant');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    for (const f of files){
      const full = path.join(dir, f);
      delete require.cache[require.resolve(full)];
      const mod = require(full);
      const arr = Array.isArray(mod) ? mod : [mod];
      for (const cmd of arr){
        if (!cmd?.data || typeof cmd.execute !== 'function') { console.warn('⚠️ invalide:', f); continue; }
        const name = cmd.data.name;
        if (this.commands.has(name)) console.warn('⚠️ collision /'+name+' (écrasée par '+f+')');
        this.commands.set(name, cmd);
      }
    }
    console.log('✅ Commandes chargées:', this.commands.size);
  }

  async registerSlashCommands(){
    if (!this.client.user) return;
    const body = [...this.commands.values()].map(c => c.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(this.config.token);
    const guildIds = this.config.guildIds && this.config.guildIds.length ? this.config.guildIds : [];
    if (!guildIds.length) {
      console.log('⚠️ Aucun GUILD_ID fourni — enregistrement global (lent).');
      await rest.put(Routes.applicationCommands(this.client.user.id), { body });
      return;
    }
    for (const gid of guildIds) {
      console.log('🔄 Enregistrement', body.length, 'commandes sur', gid);
      await rest.put(Routes.applicationGuildCommands(this.client.user.id, gid), { body });
      try {
        const cmds = await this.client.application.commands.fetch({ guildId: gid });
        console.log('📦 Visibles sur', gid, ':', cmds.size, cmds.map(c => '/'+c.name).join(', '));
      } catch {}
    }
  }

  async cleanAllCommands(){
    if (!this.client.user) return;
    const rest = new REST({ version: '10' }).setToken(this.config.token);
    const guildIds = this.config.guildIds && this.config.guildIds.length ? this.config.guildIds : [];
    if (!guildIds.length) {
      console.log('🧹 Nettoyage global');
      await rest.put(Routes.applicationCommands(this.client.user.id), { body: [] });
      return;
    }
    for (const gid of guildIds) {
      console.log('🧹 Nettoyage des commandes (guilde)', gid);
      await rest.put(Routes.applicationGuildCommands(this.client.user.id, gid), { body: [] });
    }
  }

  async handleInteraction(interaction){
    if (!interaction.isChatInputCommand()) return;
    const cmd = this.commands.get(interaction.commandName);
    if (!cmd) return interaction.reply({ content: '❌ Commande inconnue.', flags: 64 });
    try {
      // <<< GARDE-FOUS ICI
      const guardError = await ensure(interaction, cmd);
      if (guardError) return; // une réponse a déjà été envoyée par le guard

      await cmd.execute(interaction);
    } catch (e) {
      console.error('❌ Erreur /'+interaction.commandName+':', e);
      const payload = { content: '❌ Erreur pendant l’exécution.', flags: 64 };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
      else await interaction.reply(payload);
    }
  }
}
module.exports = CommandHandler;
