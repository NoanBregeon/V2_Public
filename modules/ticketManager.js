const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../../config');
const STATE_FILE = path.join(STATE_DIR, 'tickets.json');

function ensureDir() {
	if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
}
function load() {
	try {
		ensureDir();
		if (!fs.existsSync(STATE_FILE)) {
			const def = { tickets: {} };
			fs.writeFileSync(STATE_FILE, JSON.stringify(def, null, 2), 'utf8');
			return def;
		}
		return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
	} catch (e) {
		console.error('❌ Erreur chargement tickets state:', e.message);
		return { tickets: {} };
	}
}
function save(state) {
	try {
		ensureDir();
		fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
		return true;
	} catch (e) {
		console.error('❌ Erreur sauvegarde tickets state:', e.message);
		return false;
	}
}

let state = load();

module.exports = {
	async createTicket(guild, member, reason = '') {
		// catégorie configurée via env ou config.guild-specific (préférence env)
		const categoryId = process.env.TICKET_CATEGORY_ID || (guild?.config && guild.config.ticketCategoryId) || null;
		const channelNameBase = `ticket-${member.user.username}`.toLowerCase().replace(/[^a-z0-9-_]/g, '');
		// ajouter suffixe unique
		const suffix = Date.now().toString().slice(-4);
		const channelName = `${channelNameBase}-${suffix}`;

		// Permissions
		const everyoneRole = guild.roles.everyone;
		const moderatorRoleId = process.env.MODERATOR_ROLE_ID || null;

		// Créer le salon
		const opts = {
			type: 0, // GUILD_TEXT
			topic: `Ticket créé par ${member.user.tag} ${reason ? `| ${reason}` : ''}`,
			permissionOverwrites: [
				{
					id: everyoneRole.id,
					deny: ['ViewChannel']
				},
				{
					id: member.user.id,
					allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
				},
				{
					id: guild.client.user.id,
					allow: ['ViewChannel', 'SendMessages', 'ManageChannels', 'ReadMessageHistory']
				}
			]
		};
		// ajouter mod role si défini
		if (moderatorRoleId) {
			opts.permissionOverwrites.push({
				id: moderatorRoleId,
				allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
			});
		}
		// créer dans catégorie si existante
		if (categoryId) opts.parent = categoryId;

		const channel = await guild.channels.create({
			name: channelName,
			type: 0, // GuildText
			topic: opts.topic,
			permissionOverwrites: opts.permissionOverwrites,
			parent: opts.parent || null
		}).catch(err => { throw err; });

		// Enregistrer
		state.tickets[channel.id] = {
			creatorId: member.user.id,
			createdAt: Date.now(),
			reason: reason || '',
			channelId: channel.id,
			guildId: guild.id
		};
		save(state);

		// Message de bienvenue dans le ticket
		const intro = `🎫 Ticket créé par ${member}.\n` +
			`• Modérateurs et vous seul avez accès à ce salon.\n` +
			`${reason ? `• Motif: ${reason}\n` : ''}` +
			`Pour fermer le ticket : \`/ticket close\` (modération ou créateur).`;
		await channel.send({ content: intro });

		return channel;
	},

	async closeTicket(channel, closedById = null) {
		const t = state.tickets[channel.id];
		if (!t) throw new Error('Ticket introuvable');
		// Option : envoyer un message avant suppression
		await channel.send({ content: '🔒 Ticket fermé. Ce salon sera supprimé dans 5 secondes.' }).catch(()=>{});
		// remove from state then delete channel
		delete state.tickets[channel.id];
		save(state);
		// small delay to allow message to appear
		setTimeout(() => {
			channel.delete('Ticket closed').catch(()=>{});
		}, 5000);
		return true;
	},

	getTicketByChannel(channelId) {
		return state.tickets[channelId] || null;
	},

	isTicketCreator(userId, channelId) {
		const t = this.getTicketByChannel(channelId);
		return t && t.creatorId === userId;
	},

	listTickets() {
		return { ...state.tickets };
	},

	reload() {
		state = load();
		return state;
	}
};
