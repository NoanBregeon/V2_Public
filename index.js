require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, ActivityType, Events } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
    Partials.User
  ]
});

client.commands = new Collection();

// =========================
// HANDLERS
// =========================
const commandHandler = require('./handlers/commandHandler');
const ticketButtons = require('./handlers/ticketButtons');
const logEvents = require('./handlers/logEvents');
const { startTwitchRelay } = require('./services/twitchChat');

// ⬇️ ⬇️ ⬇️
// LE PLUS IMPORTANT : AVANT LES COMMANDES
require('./handlers/voiceTemp').register(client);
// ⬆️ ⬆️ ⬆️

// Ensuite seulement
commandHandler.register(client);
ticketButtons.register(client);
logEvents.register(client);

// =========================
// READY
// =========================
client.once(Events.ClientReady, () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'Discord + Twitch', type: ActivityType.Watching }],
    status: 'online'
  });

  startTwitchRelay(client);
});

// =========================
// LOGIN (EN DERNIER)
// =========================
client.login(process.env.DISCORD_TOKEN);
