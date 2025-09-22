/**
 * Bot Discord principal - Point d'entrée unique
 * Architecture modulaire pour faciliter la maintenance
 */

require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');

console.log('🚀 Bot Discord V2 - Démarrage...');

// === CONFIGURATION ===
const config = {
    discordToken: process.env.DISCORD_TOKEN,
    guildId: process.env.GUILD_ID,
    createVoiceChannelId: process.env.CREATE_VOICE_CHANNEL_ID,
    welcomeChannelId: process.env.WELCOME_CHANNEL_ID,
    logsChannelId: process.env.LOGS_CHANNEL_ID,
    notificationsChannelId: process.env.NOTIFICATIONS_CHANNEL_ID,
    moderationChannelId: process.env.MODERATION_CHANNEL_ID,
    liveNotificationsChannelId: process.env.LIVE_NOTIFICATIONS_CHANNEL_ID,
    voiceInstructionsChannelId: process.env.VOICE_INSTRUCTIONS_CHANNEL_ID,
    voiceLogsChannelId: process.env.VOICE_LOGS_CHANNEL_ID,
    // Rôles
    vipRoleId: process.env.VIP_ROLE_ID,
    moderatorRoleId: process.env.MODERATOR_ROLE_ID,
    subscriberRoleId: process.env.SUBSCRIBER_ROLE_ID,
    defaultRoleId: process.env.DEFAULT_ROLE_ID,
    // Twitch
    streamerUsername: process.env.STREAMER_USERNAME,
    // Twitch Helix (ajout)
    twitchClientId: process.env.TWITCH_CLIENT_ID,
    twitchUserToken: process.env.TWITCH_USER_TOKEN,
    // Multi-guild (optionnel)
    staffGuildId: process.env.STAFF_GUILD_ID,
    communityGuildId: process.env.COMMUNITY_GUILD_ID
};

// Vérification des variables requises
const requiredVars = ['DISCORD_TOKEN', 'GUILD_ID'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Variables requises manquantes:', missingVars.join(', '));
    process.exit(1);
}

console.log('⚙️ Configuration chargée');

// === CLIENT DISCORD ===
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildBans
    ]
});

// === GESTIONNAIRE DE MODULES ===
class ModuleManager {
    constructor() {
        this.modules = new Map();
        this.handlersDir = path.join(__dirname, 'handlers');
    }

    registerModule(name, instance) { // <-- ajouté
        this.modules.set(name, instance);
        console.log(`🔗 Module enregistré manuellement: ${name}`);
    }

    async loadModule(moduleName) {
        try {
            const modulePath = path.join(this.handlersDir, `${moduleName}.js`);
            
            if (!fs.existsSync(modulePath)) {
                console.warn(`⚠️ Module ${moduleName} introuvable`);
                return false;
            }

            delete require.cache[require.resolve(modulePath)];
            const ModuleClass = require(modulePath);
            
            const moduleInstance = new ModuleClass(client, config);
            await moduleInstance.initialize();
            
            this.modules.set(moduleName, moduleInstance);
            console.log(`✅ Module ${moduleName} chargé`);
            return true;
        } catch (error) {
            console.error(`❌ Erreur chargement ${moduleName}:`, error);
            return false;
        }
    }

    async loadAllModules() {
        const moduleList = [
            'commandHandler',
            'voiceManager', 
            'moderationManager',
            'welcomeManager'
        ];

        console.log('🔄 Chargement des modules...');
        
        for (const moduleName of moduleList) {
            await this.loadModule(moduleName);
        }

        console.log(`✅ ${this.modules.size} modules chargés`);
    }

    getModule(name) {
        return this.modules.get(name);
    }
}

// === ÉVÉNEMENTS DISCORD ===
let moduleManager;

async function bootstrap() {
    if (client.__started) return;
    client.__started = true;
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    moduleManager = new ModuleManager();
    client.moduleManager = moduleManager;

    await moduleManager.loadAllModules();

    client.user.setActivity('Système modulaire', { type: ActivityType.Watching });
    console.log('🎯 Initialisation terminée');
}

// Support v14 + futur v15
client.once('ready', bootstrap);
client.once('clientReady', bootstrap);

// Renforcer log des interactions (debug)
client.on('interactionCreate', async (interaction) => {
    const commandHandler = moduleManager?.getModule('commandHandler');
    if (process.env.DEBUG && interaction.isChatInputCommand()) {
        console.log(`🛰️ Interaction: /${interaction.commandName} par ${interaction.user.tag}`);
    }
    if (commandHandler) {
        try {
            await commandHandler.handleInteraction(interaction);
        } catch (e) {
            console.error('❌ Erreur interaction:', e);
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ Erreur interne.', ephemeral: true });
            }
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const commandHandler = moduleManager?.getModule('commandHandler');
    if (commandHandler) {
        await commandHandler.handleMessage(message);
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const voiceManager = moduleManager?.getModule('voiceManager');
    if (voiceManager) {
        await voiceManager.handleVoiceStateUpdate(oldState, newState);
    }
});

client.on('guildMemberAdd', async (member) => {
    const welcomeManager = moduleManager?.getModule('welcomeManager');
    if (welcomeManager) {
        await welcomeManager.handleMemberJoin(member);
    }
});

// === GESTION DES ERREURS ===
process.on('unhandledRejection', (reason) => {
    console.error('❌ Promesse rejetée:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exception:', error);
});

// === DÉMARRAGE ===
client.login(config.discordToken);

// === AJOUT TWITCH BRIDGE (propre) ===
const TwitchBridge = require('./services/twitchBridge');

client.once('ready', async () => {
    try {
        if (!client.moduleManager) return;
        const twitchBridge = new TwitchBridge(client, { twitch: {} });
        await twitchBridge.initialize();
        client.moduleManager.registerModule('twitchBridge', twitchBridge);
        console.log('✅ Module twitchBridge chargé');
    } catch (e) {
        console.error('❌ Erreur initialisation twitchBridge:', e);
    }
});

// (Optionnel) après bootstrap: choisir la guild pour register si staff présente
// Dans bootstrap() ou _registerSlash() côté commandHandler, tu peux utiliser:
// const targetGuildId = this.config.staffGuildId || this.config.guildId;