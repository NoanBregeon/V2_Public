// Commande d'administration pour gérer le ping des notifications live.
// - /liveping action:enable  => active les mentions (si role/message configurés)
// - /liveping action:disable => désactive les mentions
// - /liveping action:status  => affiche l'état (source: ENV/CONFIG/TEMPLATE)
// Cette commande contrôle la config persistée (config/notifications.json) via notificationConfig.
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const notificationConfig = require('../modules/utils/notificationConfig');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('liveping')
		.setDescription('Gérer le ping des notifications live (admin)')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption(option =>
			option.setName('action')
				.setDescription('enable | disable | status')
				.setRequired(true)
				.addChoices(
					{ name: 'Activer', value: 'enable' },
					{ name: 'Désactiver', value: 'disable' },
					{ name: 'Statut', value: 'status' }
				)
		)
		.addRoleOption(option =>
			option.setName('role')
				.setDescription('Rôle à ping (optionnel)')
				.setRequired(false)
		)
		.addStringOption(option =>
			option.setName('message')
				.setDescription('Message personnalisé (placeholders: {streamer},{title})')
				.setRequired(false)
		),
	async execute(interaction) {
		// Sécurité supplémentaire au cas où la permission côté CommandHandler n'aurait pas filtré
		if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
			return interaction.reply({ content: '❌ Tu dois être administrateur pour utiliser cette commande.', ephemeral: true });
		}

		// Recharger la config au moment de l'exécution pour prendre en compte tout changement externe
		try { notificationConfig.reload(); } catch (e) { /* ignore */ }

		const action = interaction.options.getString('action');
		const role = interaction.options.getRole('role');
		const messageOption = interaction.options.getString('message');

		try {
			if (action === 'status') {
				const all = notificationConfig.getAll();
				const enabled = notificationConfig.isLivePingEnabled();
				const hardKill = all.hardKill || false;
				const roleId = all.effectivePingRoleId || null;
				const message = all.effectivePingMessage || null;
				const source = hardKill ? 'FORCE_DISABLE' : (process.env.LIVE_PING_ENABLED ? 'ENV' : (message ? 'CONFIG' : 'TEMPLATE'));
				return interaction.reply({
					content: `🔔 Live ping: **${enabled ? 'activé' : 'désactivé'}**\n• Mode forcé (kill): **${hardKill ? 'oui' : 'non'}**\n• Source effective: **${source}**\n• Message actuel: ${message ? `\`${message}\`` : '_aucun_'}${roleId ? `\n• Rôle ping: <@&${roleId}>` : ''}`,
					ephemeral: true
				});
			}

			if (action === 'enable') {
				notificationConfig.setLivePing(true);
				if (role) notificationConfig.setPingRoleId(role.id);
				if (messageOption) notificationConfig.setPingMessage(messageOption);

				// recharger pour effet immédiat
				notificationConfig.reload();

				return interaction.reply({
					content: `✅ Live ping activé${role ? ` — rôle ping: ${role}` : ''}${messageOption ? ' — message sauvegardé' : ''}`,
					ephemeral: true
				});
			}

			if (action === 'disable') {
				notificationConfig.setLivePing(false);
				notificationConfig.setPingRoleId(null);
				notificationConfig.setPingMessage(null);
				notificationConfig.reload();
				return interaction.reply({ content: '✅ Live ping désactivé', ephemeral: true });
			}

			return interaction.reply({ content: '❌ Action inconnue', ephemeral: true });
		} catch (e) {
			console.error('❌ Erreur /liveping:', e);
			return interaction.reply({ content: `❌ Erreur: ${e.message}`, ephemeral: true });
		}
	}
};
