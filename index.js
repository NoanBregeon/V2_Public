require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActivityType, Events } = require('discord.js');

for (const k of ['DISCORD_TOKEN','DISCORD_CLIENT_ID']) {
  if (!process.env[k] || !String(process.env[k]).trim()) { console.error('❌ Variable manquante:', k); process.exit(1); }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildModeration],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
});

class ModuleManager { constructor(){ this.modules=new Map(); } register(n,m){ this.modules.set(n,m); console.log('🔗 Module:', n); } get(n){ return this.modules.get(n); } }
client.moduleManager = new ModuleManager();

const CommandHandler = require('./handlers/commandHandler');
const commandHandler = new CommandHandler(client, { token: process.env.DISCORD_TOKEN, guildIds: [process.env.GUILD_ID, process.env.STAFF_GUILD_ID, process.env.COMMUNITY_GUILD_ID].filter(Boolean) });
client.moduleManager.register('commandHandler', commandHandler);

const ticketService = require('./services/ticketService');
client.moduleManager.register('ticketService', ticketService);

const voiceRooms = require('./services/voiceRooms');

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  await voiceRooms.onVoiceStateUpdate(oldState, newState);
});

client.once(Events.ClientReady, async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);
  client.user.setActivity('/help', { type: ActivityType.Watching });
  await commandHandler.loadCommands();
  if ((process.env.CLEAN_COMMANDS_ON_START||'').toLowerCase()==='true') await commandHandler.cleanAllCommands();
  await commandHandler.registerSlashCommands();
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if ((process.env.DEBUG||'').toLowerCase()==='true') console.log(`🛰️ /${interaction.commandName} par ${interaction.user.tag}`);
      await commandHandler.handleInteraction(interaction); return;
    }
    if (interaction.isButton()) {
      await ticketService.handleButton(interaction); return;
    }
  } catch (e) { console.error('interaction error:', e?.message || e); }
});

client.login(process.env.DISCORD_TOKEN).catch(e => { console.error('❌ Login échec:', e?.message || e); process.exit(1); });
