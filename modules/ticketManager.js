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

// Handlers: events logging
const logEvents = require('./handlers/logEvents');
logEvents.register(client);

// ticketManager.js
let state = null;
const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { load, save } = require('../utils/stateManager');

class TicketManager {
    constructor(client) {
        this.client = client;
    }

    async createTicket(interaction) {
        // ...existing code...
    }

    hasPermissionToCreateTicket(userId) {
        // ...existing code...
    }

    // CHANGEMENT : fermer le ticket (verrouille + renomme) au lieu de supprimer le salon
    async closeTicket(interaction) {
        const ticket = this.getTicketByChannel(interaction.channel.id);
        if (!ticket) {
            throw new Error('Ticket introuvable');
        }

        // Récupérer le message d'embed initial si possible (chercher dans les derniers messages)
        let embedMessage = null;
        try {
            const messages = await interaction.channel.messages.fetch({ limit: 50 });
            embedMessage = messages.find(m => m.embeds && m.embeds.length && (m.embeds[0].title?.includes('Ticket') || m.embeds[0].title?.includes('Nouveau Ticket') || m.embeds[0].title?.includes('🎫')));
        } catch (e) {
            // ignore
        }

        // Construire l'embed "fermé"
        const closedEmbed = new EmbedBuilder()
            .setTitle('🎫 Ticket fermé')
            .setDescription(`Ticket fermé par ${interaction.user}`)
            .addFields({ name: 'Statut', value: '🔴 Fermé' })
            .setColor(0xE74C3C)
            .setTimestamp();

        // Bouton de suppression (sera traité côté interaction : vérification des permissions requise)
        const deleteButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('delete_ticket')
                    .setLabel('Supprimer définitivement')
                    .setStyle(ButtonStyle.Danger)
            );

        // Éditer le message existant si trouvé, sinon poster un nouveau message indiquant la fermeture
        try {
            if (embedMessage) {
                await embedMessage.edit({ embeds: [closedEmbed], components: [deleteButton] }).catch(()=>{});
            } else {
                await interaction.channel.send({ embeds: [closedEmbed], components: [deleteButton] }).catch(()=>{});
            }
        } catch (e) {
            console.warn('⚠️ Impossible d\'éditer/ envoyer le message de ticket fermé:', e?.message || e);
        }

        // Retirer l'accès du créateur (permission overwrite)
        try {
            if (ticket.creatorId) {
                await interaction.channel.permissionOverwrites.delete(ticket.creatorId).catch(()=>{});
            }
        } catch (e) {
            console.warn('⚠️ Impossible de retirer les permissions du créateur:', e?.message || e);
        }

        // Renommer le salon en closed-{pseudo} (éviter caractères spéciaux et collisions)
        try {
            const creator = await this.client.users.fetch(ticket.creatorId).catch(()=>null);
            let base = creator ? String(creator.username).toLowerCase().replace(/[^a-z0-9-_]/g, '-') : `user-${ticket.creatorId.slice(-4)}`;
            base = base.replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0, 24) || `user-${ticket.creatorId.slice(-4)}`;
            let newName = `closed-${base}`;
            // Éviter collision de noms
            let suffix = 1;
            while (interaction.channel.guild.channels.cache.some(c => c.name === newName && c.id !== interaction.channel.id)) {
                newName = `closed-${base}-${suffix++}`;
            }
            await interaction.channel.setName(newName).catch(()=>{});
        } catch (e) {
            console.warn('⚠️ Impossible de renommer le salon:', e?.message || e);
        }

        // Mettre à jour l'état : marqué comme fermé
        try {
            state.tickets[interaction.channel.id] = {
                ...state.tickets[interaction.channel.id],
                closed: true,
                closedAt: Date.now()
            };
            save(state);
        } catch (e) {
            console.warn('⚠️ Impossible de sauvegarder l\'état du ticket:', e?.message || e);
        }

        // Informer l'acteur (éphemère)
        try {
            await interaction.reply({ content: '✅ Ticket fermé — seul un modérateur peut supprimer définitivement via le bouton.', ephemeral: true });
        } catch (e) {
            // ignore if reply fails
        }

        return true;
    }

    // CHANGEMENT : supprimer définitivement le ticket (nettoie l'état d'abord)
    async deleteTicket(channel) {
        try {
            const id = channel.id;
            if (state.tickets[id]) {
                delete state.tickets[id];
                save(state);
            }
        } catch (e) {
            console.warn('⚠️ Impossible de supprimer l\'entrée d\'état du ticket:', e?.message || e);
        }

        // Supprimer le salon
        try {
            await channel.delete('Suppression définitive du ticket');
        } catch (e) {
            console.error('❌ Erreur suppression salon ticket:', e?.message || e);
            throw e;
        }
    }

    getTicketByChannel(channelId) {
        return state.tickets[channelId] || null;
    }

    isTicketCreator(userId, channelId) {
        const t = this.getTicketByChannel(channelId);
        return t && t.creatorId === userId;
    }

    listTickets() {
        return { ...state.tickets };
    }

    reload() {
        state = load();
        return state;
    }
}

module.exports = TicketManager;