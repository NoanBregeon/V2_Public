const { GatewayIntentBits, Partials } = require('discord.js');

module.exports = {
    intents: {
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildModeration
        ],
        partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
    },
    
    channels: {
        logs: process.env.LOGS_CHANNEL_ID || null,
        notifications: process.env.NOTIFICATIONS_CHANNEL_ID || null,
        moderation: process.env.MODERATION_CHANNEL_ID || null
    },
    
    roles: {
        vip: process.env.VIP_ROLE_ID || null,
        subscriber: process.env.SUBSCRIBER_ROLE_ID || null,
        moderator: process.env.MODERATOR_ROLE_ID || null
    },
    
    permissions: {
        ADMINISTRATOR: 8n,
        MANAGE_CHANNELS: 16n,
        MANAGE_ROLES: 268435456n,
        MANAGE_MESSAGES: 8192n,
        CONNECT: 1048576n,
        SPEAK: 2097152n
    }
};