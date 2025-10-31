const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ticketManager = require('../modules/ticketManager');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ticket')
		.setDescription('Gérer les tickets (création / fermeture)')
		.addSubcommand(sub =>
			sub.setName('create')
				.setDescription('Créer un ticket privé')
				.addStringOption(opt => opt.setName('raison').setDescription('Motif du ticket').setRequired(false))
		)
		.addSubcommand(sub =>
			sub.setName('close')
				.setDescription('Fermer le ticket (dans le channel du ticket ou en spécifiant id)')
				.addChannelOption(opt => opt.setName('channel').setDescription('Channel du ticket (optionnel)').setRequired(false))
		),
	async execute(interaction) {
		const sub = interaction.options.getSubcommand();
		const guild = interaction.guild;
		if (!guild) return interaction.reply({ content: '❌ Commande disponible seulement en serveur.', ephemeral: true });

		try {
			if (sub === 'create') {
				const reason = interaction.options.getString('raison') || '';
				await interaction.deferReply({ ephemeral: true });
				const channel = await ticketManager.createTicket(guild, interaction.member, reason);
				await interaction.editReply({ content: `✅ Ticket créé : <#${channel.id}>` });
				return;
			}

			if (sub === 'close') {
				await interaction.deferReply({ ephemeral: true });
				const chOption = interaction.options.getChannel('channel');
				const targetChannel = chOption ? chOption : interaction.channel;
				// check ticket exists
				const ticket = ticketManager.getTicketByChannel(targetChannel.id);
				if (!ticket) return interaction.editReply({ content: '❌ Ce channel n\'est pas un ticket.' });

				// check permissions: mod role or creator
				const modRoleId = process.env.MODERATOR_ROLE_ID;
				const isMod = interaction.member.roles.cache.has(modRoleId);
				const isCreator = ticket.creatorId === interaction.user.id;
				if (!isMod && !isCreator) return interaction.editReply({ content: '❌ Seuls les modérateurs ou le créateur peuvent fermer ce ticket.', ephemeral: true });

				await ticketManager.closeTicket(targetChannel, interaction.user.id);
				return interaction.editReply({ content: '✅ Ticket fermé.' });
			}
		} catch (e) {
			console.error('❌ Erreur commande ticket:', e);
			if (interaction.deferred) return interaction.editReply({ content: `❌ Erreur: ${e.message}` });
			return interaction.reply({ content: `❌ Erreur: ${e.message}`, ephemeral: true });
		}
	}
};
